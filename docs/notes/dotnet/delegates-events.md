# 6. 委托、Lambda 与事件

委托(delegate)是 C# 里表示"对方法的引用"的类型,是回调、事件、LINQ、异步等一切现代 C# 特性的地基。Lambda 是创建委托实例最常用的语法糖;事件则是基于委托的发布-订阅机制,通过访问器限制了外部对委托字段的破坏性访问。

这一篇把四件事串起来讲:委托的运行时模型、内置委托类型、Lambda 与闭包、以及事件的设计与陷阱。

## 委托的本质

### 类型安全的函数指针

C++ 的函数指针只记录一个地址,C# 的委托是一个**对象**,它至少包含两项信息:

1. 目标对象(`Target`),即方法所属的实例;静态方法则为 `null`。
2. 方法描述(`Method`),即要调用的方法。

委托还是**类型安全**的:编译器知道这个委托的签名,调用时参数和返回值都受检查,不像 `void*` 那样裸奔。

```csharp
public delegate int Calculator(int a, int b);

int Add(int x, int y) => x + y;

Calculator calc = Add;
Console.WriteLine(calc(2, 3));        // 输出: 5
Console.WriteLine(calc.Target);        // 输出: (空,静态方法)
Console.WriteLine(calc.Method.Name);   // 输出: Add
```

### 委托类型是类

`public delegate int Calculator(int a, int b);` 这行声明等价于编译器为你生成一个继承自 `System.MulticastDelegate` 的类,包含:

- 构造函数 `Calculator(object target, IntPtr method)`
- `Invoke` 方法(签名和委托一致)
- `BeginInvoke` / `EndInvoke`(历史异步 API,现代代码不用)
- 从 `MulticastDelegate` 继承的 `Combine` / `Remove` 等

用 ildasm 或 `dotnet-ildasm` 可以看到它确实是一个类。这也解释了几件事:

- 委托可以继承、可以有字段、可以放进集合。
- 委托实例是堆上对象,创建它有分配成本。
- 委托的 `==` 是**值相等**(目标对象和方法都相同则相等),不是引用相等。

### 实例方法委托会持有目标

```csharp
class Greeter
{
    private readonly string _name;
    public Greeter(string name) => _name = name;
    public string Hello() => $"Hello, {_name}";
}

var g = new Greeter("world");
Func<string> f = g.Hello;
Console.WriteLine(f.Target == g);      // 输出: True
Console.WriteLine(f());                // 输出: Hello, world
```

`f.Target` 就是 `g`。这带来一个关键后果:**只要委托还活着,它就持有目标对象的强引用**,目标无法被 GC 回收。这是后面"事件内存泄漏"的根源。

## 自定义委托声明与使用

```csharp
public delegate void Notify(string message);

void PrintToConsole(string msg) => Console.WriteLine($"[console] {msg}");
void PrintToFile(string msg) { /* ... */ }

Notify n = PrintToConsole;
n += PrintToFile;          // 多播
n("done");                 // 依次调用两个方法
```

委托声明独立于方法;同一个方法可以转换到任何签名兼容的委托。

## 内置委托类型

绝大多数情况下不需要自定义委托,直接用 BCL 提供的类型。

| 类型 | 签名 | 用途 |
| --- | --- | --- |
| `Action` | `void ()` | 无参无返回的回调 |
| `Action<T>` … `Action<T1..T16>` | `void (T...)` | 有参无返回的回调 |
| `Func<TResult>` | `TResult ()` | 无参有返回 |
| `Func<T1..T16, TResult>` | `TResult (T...)` | 有参有返回 |
| `Predicate<T>` | `bool (T)` | 判断条件,常用于 `List<T>.Find` 等 |
| `Comparison<T>` | `int (T, T)` | 比较器,常用于 `List<T>.Sort` |
| `Converter<TInput,TOutput>` | `TOutput (TInput)` | 单项转换 |
| `EventHandler` | `void (object?, EventArgs)` | 无自定义数据的事件处理器 |
| `EventHandler<TEventArgs>` | `void (object?, TEventArgs)` | 有自定义数据的事件处理器 |

`Action` 和 `Func` 各有 0 到 16 个参数的重载。场景选择:

- 只是"执行一个动作"用 `Action`。
- "给定输入产出结果"用 `Func`。
- "给定一个元素返回 bool"用 `Predicate<T>`(语义更明确,但很多 API 也用 `Func<T, bool>`)。
- "比较两个元素返回 `-1/0/1`"用 `Comparison<T>`。
- 事件用 `EventHandler<TEventArgs>`,保持 `sender` / `e` 约定。

```csharp
Action log = () => Console.WriteLine("tick");
Action<string, int> log2 = (s, n) => Console.WriteLine($"{s}:{n}");
Func<int, int, int> mul = (a, b) => a * b;
Predicate<int> isEven = x => x % 2 == 0;
Comparison<int> byAbs = (a, b) => Math.Abs(a).CompareTo(Math.Abs(b));
Converter<string, int> parse = int.Parse;

Console.WriteLine(mul(3, 4));      // 输出: 12
Console.WriteLine(isEven(4));      // 输出: True
Console.WriteLine(parse("42"));    // 输出: 42
```

注意 `Func<int, int, int>` 的最后一个是**返回类型**,前面都是参数。

## 多播委托

`+=` 会把新委托追加到调用列表,`-=` 移除。底层是 `MulticastDelegate.Combine` / `Remove`。

```csharp
Action a = () => Console.WriteLine("A");
Action b = () => Console.WriteLine("B");

Action multi = a + b;
multi();                 // 输出: A 然后 B

multi -= a;
multi();                 // 输出: B
```

### 返回值只取最后一个

`Func<int>` 这类有返回值的多播委托,调用时每个方法都执行,但返回值只有**最后一个**被返回:

```csharp
Func<int> f = () => 1;
f += () => 2;
f += () => 3;
Console.WriteLine(f());  // 输出: 3
```

想拿到所有返回值,遍历 `GetInvocationList()`:

```csharp
foreach (Func<int> item in f.GetInvocationList())
    Console.WriteLine(item());  // 输出: 1 2 3
```

### 异常会中断后续调用

多播链里任何一个方法抛异常,后面的方法都不会执行:

```csharp
Action g = () => Console.WriteLine("1");
g += () => throw new InvalidOperationException("boom");
g += () => Console.WriteLine("3");

try { g(); }
catch (InvalidOperationException ex) { Console.WriteLine(ex.Message); }
// 输出: 1 然后 boom,永远不会输出 3
```

需要容错时手动遍历并逐个 try/catch:

```csharp
foreach (Action item in g.GetInvocationList())
{
    try { item(); }
    catch (Exception ex) { Console.WriteLine($"handler failed: {ex.Message}"); }
}
```

::: warning
多播委托的异常处理和返回值都需要手动遍历 `GetInvocationList()`。事件触发时若某个订阅者抛异常,会一并中断其他订阅者。健壮的发布者在触发事件时通常需要逐个调用并隔离异常。
:::

## 委托相等性与移除

`-=` 依赖**值相等**:目标对象和方法都相同才认为相等。

```csharp
Action h1 = Print;
Action h2 = Print;
Console.WriteLine(h1 == h2);  // 输出: True
```

但匿名函数每次求值通常产生**不同的**委托实例:

```csharp
Action x = () => Console.WriteLine("hi");
Action y = () => Console.WriteLine("hi");
Console.WriteLine(x == y);    // 输出: False
```

因此下面这段代码的 `-=` **无效**,事件不会真正退订:

```csharp
Action evt = null!;
evt += () => Console.WriteLine("once");

// 试图移除:构造了一个新的、不相等的委托
evt -= () => Console.WriteLine("once");   // 什么也没移除
evt();                                     // 仍然输出: once
```

正确做法是把委托保存到字段或变量:

```csharp
Action handler = () => Console.WriteLine("once");
evt += handler;
evt -= handler;      // 有效
evt();               // 不再输出
```

同样的规则适用于 `List<T>.Remove` 或 `Dictionary` 里以委托为键的场景。

## 匿名方法(历史写法)

C# 2.0 引入匿名方法,是 Lambda 的前身:

```csharp
Func<int, int> square = delegate(int x) { return x * x; };
```

它的能力比 Lambda 少(没有表达式体、不能直接赋给表达式树),现代代码几乎都该用 Lambda。保留它的意义在于理解历史,以及少数需要 `delegate` 关键字才能表达签名的场合(已极少)。

## Lambda 全解

### 表达式体与语句体

```csharp
Func<int, int> f1 = x => x + 1;                 // 表达式体
Func<int, int> f2 = (x) => { return x + 1; };   // 语句体
Action f3 = () => Console.WriteLine("no args");
Action<int, int> f4 = (a, b) => Console.WriteLine(a + b);
```

### 天然类型(C# 10)与显式返回类型

C# 10 起 Lambda 可以有自己的"天然类型"(natural type),从而用 `var` 声明:

```csharp
var f = (int x) => x * 2;      // f 是 Func<int, int>
Console.WriteLine(f(5));       // 输出: 10
```

前提是参数类型明确。若参数类型也省了,`var` 无法推断:

```csharp
// var bad = x => x * 2;  // 编译错误:无法推断 x 的类型
```

需要时显式写返回类型(参数列表必须加括号):

```csharp
var parse = int? (string s) => int.TryParse(s, out var v) ? v : null;
Console.WriteLine(parse("7"));   // 输出: 7
Console.WriteLine(parse("x"));   // 输出: (null)
```

### 给 Lambda 加特性(C# 10)

```csharp
var f = [Obsolete("use g instead")] () => 0;
```

特性写在参数列表之前。常用于 `[return: ...]`、`[NotNull]` 等可空性标注。

### 默认参数(C# 12)

```csharp
var greet = (string name = "world") => $"Hello, {name}";
Console.WriteLine(greet());         // 输出: Hello, world
Console.WriteLine(greet("C#"));     // 输出: Hello, C#
```

### 参数修饰符(C# 14)

简单 Lambda 参数上可以直接写 `ref` / `in` / `out`,不必显式写类型:

```csharp
delegate bool TryParse<T>(string s, out T value);
TryParse<int> p = (s, out value) => int.TryParse(s, out value);
Console.WriteLine(p("42", out var n));   // 输出: True
Console.WriteLine(n);                     // 输出: 42
```

### 丢弃参数 `_`

```csharp
Action<int, int> ignoreBoth = (_, _) => Console.WriteLine("ignored");
```

C# 9 起,多个 `_` 可以在 Lambda 中作为各自独立的丢弃参数。若只有一个参数,`_` 就是参数名(不特殊),需要命名冲突意识。

### Lambda 与匿名方法的区别

- Lambda 可以转换成表达式树,匿名方法不能。
- Lambda 支持表达式体、天然类型、默认参数、丢弃参数等新特性。
- 两者在闭包实现上基本相同(都会生成闭包类)。

::: tip
把 Lambda 赋给 `Expression<Func<...>>` 时,编译器会把它编译成**数据结构**而不是可执行代码;赋给 `Func<...>` 时则编译成委托。同一个 Lambda 语法,两种目标类型,产物完全不同。
:::

## 闭包与变量捕获

### 捕获的原理

Lambda 可以引用外部作用域的变量,这些变量被"捕获"进一个编译器生成的闭包类里:

```csharp
int threshold = 10;
Func<int, bool> above = x => x > threshold;
Console.WriteLine(above(15));   // 输出: True
```

编译器大致生成:

```csharp
// 伪代码,展示概念
sealed class Closure
{
    public int threshold;                 // 捕获的变量变成字段
    public bool Method(int x) => x > threshold;
}
```

所以捕获是**按引用共享**的:闭包看到的是变量的当前值,而不是捕获那一刻的快照。

```csharp
int counter = 0;
Action inc = () => counter++;
inc(); inc();
Console.WriteLine(counter);   // 输出: 2
```

### 捕获 `this`

Lambda 里引用实例成员会捕获 `this`,从而持有整个对象:

```csharp
class Service
{
    private int _count;
    public Func<int> GetCounter() => () => _count;  // 捕获 this
}
```

### `for` 循环的经典陷阱

`for` 循环的循环变量是**同一个变量**,所有闭包共享它:

```csharp
var actions = new List<Action>();
for (int i = 0; i < 3; i++)
    actions.Add(() => Console.WriteLine(i));

foreach (var a in actions) a();
// 输出: 3 3 3(全是最终值)
```

修正:在循环体内复制到局部变量。

```csharp
var fixedActions = new List<Action>();
for (int i = 0; i < 3; i++)
{
    int captured = i;                    // 每次迭代一个新变量
    fixedActions.Add(() => Console.WriteLine(captured));
}
foreach (var a in fixedActions) a();
// 输出: 0 1 2
```

### 为什么 `foreach` 不一样

C# 5 起,`foreach` 的迭代变量**每次迭代都是新变量**,所以下面的代码输出 `0 1 2`:

```csharp
var list = new List<Action>();
foreach (int i in new[] { 0, 1, 2 })
    list.Add(() => Console.WriteLine(i));

foreach (var a in list) a();
// 输出: 0 1 2
```

在 C# 5 之前,`foreach` 也共享变量,输出 `2 2 2`。这是语言规范的一次破坏性修复,专门为异步场景(`await` 在循环里)服务。

### `static` Lambda(C# 9)

```csharp
Func<int, int> pure = static x => x + 1;   // 不允许捕获任何外部变量
```

写成 `static` 后,任何捕获都会编译错误,从而避免不必要的闭包分配:

```csharp
int factor = 3;
// Func<int, int> bad = static x => x * factor; // 编译错误
Func<int, int> ok = x => x * factor;           // 允许,但有分配
```

在热路径上,如果 Lambda 不需要捕获,加 `static` 可以让它被缓存为单例,避免每次分配闭包对象。

### 闭包延长生命周期

闭包持有变量的引用,变量(及其对象图)在闭包存活期间无法回收:

```csharp
public class Cache
{
    private readonly List<Action> _callbacks = new();

    public void Register(byte[] bigBuffer)
    {
        // 这个 lambda 捕获了 bigBuffer,缓存会一直持有它
        _callbacks.Add(() => Console.WriteLine(bigBuffer.Length));
    }
}
```

若 `_callbacks` 是长期存活的,`bigBuffer` 也一直存活。解决办法是不要捕获大对象,或及时清空集合。

::: danger
闭包捕获 + 长期存活的容器 = 内存泄漏的经典组合。凡是把匿名函数存进静态字段、单例、长生命周期事件源的代码,都要检查捕获了哪些对象。
:::

### `[UnscopedRef]` 简述

`[UnscopedRef]`(C# 11)用于告诉编译器"返回的引用/`ref struct` 的生命周期不受参数限制",主要出现在高性能 `ref struct` 和 `ref` 返回场景。日常业务代码很少需要,了解它是为了读懂库代码。

## 表达式树

### 数据结构 vs 可执行代码

```csharp
Func<int, bool> compiled = x => x > 10;                    // 委托:可执行
Expression<Func<int, bool>> tree = x => x > 10;            // 表达式树:数据结构
```

`tree` 不是一个可调用的函数,而是一棵描述"参数 x 大于常量 10"的对象树。可以打印它:

```csharp
Console.WriteLine(tree);
// 输出: x => (x > 10)

Console.WriteLine(tree.Body.NodeType);          // 输出: GreaterThan
Console.WriteLine(((BinaryExpression)tree.Body).Right); // 输出: 10
```

### 手工构建表达式树

```csharp
var param = Expression.Parameter(typeof(int), "x");
var body = Expression.GreaterThan(param, Expression.Constant(10));
var lambda = Expression.Lambda<Func<int, bool>>(body, param);

Func<int, bool> fn = lambda.Compile();
Console.WriteLine(fn(15));   // 输出: True
```

### `Compile()` 的用法和开销

`Compile()` 会把表达式树 JIT 成一个真实的委托。它比普通委托调用慢得多(要生成 IL、JIT),所以应该编译一次、缓存复用:

```csharp
var cache = new Dictionary<string, Func<int, bool>>();

Func<int, bool> GetPredicate(string key, Expression<Func<int, bool>> expr)
{
    if (!cache.TryGetValue(key, out var f))
    {
        f = expr.Compile();
        cache[key] = f;
    }
    return f;
}
```

### 为什么 LINQ to SQL / EF Core 需要表达式树

`IEnumerable<T>` 的 `Where` 接收 `Func<T, bool>` —— 那是**已编译的代码**,数据库无法读懂。`IQueryable<T>` 的 `Where` 接收 `Expression<Func<T, bool>>` —— 那是一棵**可分析的数据结构**,EF Core 可以遍历它并翻译成 SQL。

```csharp
IQueryable<User> q = db.Users.Where(u => u.Age > 18);   // 表达式树 -> SQL
IEnumerable<User> e = db.Users.AsEnumerable().Where(u => u.Age > 18); // 拉全表后在内存过滤
```

### `IQueryable<T>` 的 `Expression` 和 `Provider`

```csharp
IQueryable<int> source = new[] { 1, 2, 3 }.AsQueryable();
IQueryable<int> filtered = source.Where(x => x > 1);

Console.WriteLine(filtered.Expression);            // 输出: [1,2,3].Where(x => (x > 1))
Console.WriteLine(filtered.Provider.GetType().Name); // 输出: EnumerableQuery`1
```

`Expression` 是当前查询的表达式树,`Provider` 负责执行它。每条查询算子都会构建新的表达式树而不是立即求值——这正是 LINQ 延迟执行在 `IQueryable` 上的体现。

### 表达式树不能包含什么

- **语句体 Lambda**:`x => { return x > 1; }` 不能转成表达式树。
- **`await`**:无法在表达式树里表达。
- **赋值和自增**:`x => x += 1` 不允许(表达式树理论上可表达赋值,但 C# 编译器禁止 Lambda 中的赋值)。
- **动态 `dynamic` 和某些模式匹配**:视版本而定。

```csharp
// Expression<Func<int, int>> bad = x => { return x + 1; }; // 编译错误
```

::: warning
当你在 `IQueryable<T>` 上写 Lambda 时,它必须能被翻译成表达式树,且下游 Provider 必须能翻译成目标语言(如 SQL)。任何超出 Provider 能力的写法都会在运行时抛异常,而不是编译错误。
:::

## 事件

### `event` 关键字的语义

事件在类内部就是一个委托字段,但对外只暴露 `+=` 和 `-=`:

```csharp
public class Button
{
    // 事件,对外只读(只能订阅/退订)
    public event EventHandler? Clicked;

    public void SimulateClick()
    {
        Clicked?.Invoke(this, EventArgs.Empty);   // 类内部可以触发
    }
}
```

外部只能用 `+=` / `-=`:

```csharp
var button = new Button();
button.Clicked += (sender, e) => Console.WriteLine("clicked");
button.SimulateClick();  // 输出: clicked

// button.Clicked = null;            // 编译错误:事件只能在声明类内赋值
// button.Clicked.Invoke(...);       // 编译错误:外部不能调用
```

### 为什么不能直接调用或赋值

如果 `Clicked` 是普通委托字段,外部可以:

- `button.Clicked = someHandler;` —— 抹掉别人的订阅。
- `button.Clicked.Invoke(...)` —— 伪造事件,让订阅者误以为按钮被点了。
- 读 `button.Clicked` 拿到所有订阅者并逐个调用。

`event` 把委托字段变成"只有 `add` / `remove` 两个操作"的封装,从根本上杜绝这些问题。编译器把 `+=` 翻译成 `add` 访问器、`-=` 翻译成 `remove` 访问器。

### 传统写法与 `add` / `remove`

```csharp
public class Publisher
{
    private EventHandler? _handlers;

    public event EventHandler Changed
    {
        add
        {
            Console.WriteLine("subscribe");
            _handlers += value;
        }
        remove
        {
            Console.WriteLine("unsubscribe");
            _handlers -= value;
        }
    }

    protected virtual void OnChanged() => _handlers?.Invoke(this, EventArgs.Empty);
}
```

现代代码通常用字段式事件(`public event EventHandler? Changed;`),只有需要自定义行为(如弱引用、日志、线程调度)时才手写访问器。

### `EventHandler` 与 `sender` / `e` 约定

约定:

- 第一个参数 `sender` 是触发事件的源(类型 `object?`)。
- 第二个参数 `e` 是事件数据,继承自 `EventArgs`(或内置的 `EventArgs.Empty`)。

```csharp
public class DownloadEventArgs : EventArgs
{
    public string Url { get; }
    public DownloadEventArgs(string url) => Url = url;
}

public class Downloader
{
    public event EventHandler<DownloadEventArgs>? Downloaded;

    public void Finish(string url)
        => Downloaded?.Invoke(this, new DownloadEventArgs(url));
}
```

.NET 的现代事件数据类通常不继承 `EventArgs`(如 `PropertyChangedEventArgs` 就继承),但为了符合 `EventHandler<T>` 的泛型约束,`T` 需继承 `EventArgs`。

### 触发事件的正确写法

```csharp
// 推荐:局部变量快照,避免竞态
var handler = Clicked;
if (handler != null)
    handler(this, EventArgs.Empty);

// 等价且更简洁(C# 6 起)
Clicked?.Invoke(this, EventArgs.Empty);
```

为什么 `?.` 是线程安全的?`?.` 会先把 `Clicked` 读进一个临时变量再判空调用,避免了"判空后、调用前被另一个线程退订置 null"的竞态。

::: warning
不要写 `if (Clicked != null) Clicked(this, ...)`。在多线程下,判空和调用之间事件可能被置 null,导致 `NullReferenceException`。用 `?.Invoke` 或局部快照。
:::

### `protected virtual OnXxx` 模式

派生类通常需要覆写事件触发逻辑,所以把触发封装成受保护的虚方法:

```csharp
public class Control
{
    public event EventHandler? Resized;

    protected virtual void OnResized()
        => Resized?.Invoke(this, EventArgs.Empty);
}

public class MyControl : Control
{
    protected override void OnResized()
    {
        Console.WriteLine("before raise");
        base.OnResized();   // 必须先调 base,再触发
    }
}
```

这是 .NET Framework / WPF / WinForms 的稳定惯例。

### 事件导致的内存泄漏

发布者持有订阅者的强引用。若发布者比订阅者活得久,订阅者(及其整张对象图)就无法回收:

```csharp
public class LongLivedPublisher
{
    public event EventHandler? Tick;
    public void Raise() => Tick?.Invoke(this, EventArgs.Empty);
}

public class ShortLivedSubscriber
{
    private readonly byte[] _big = new byte[10_000_000];

    public void Subscribe(LongLivedPublisher p) => p.Tick += OnTick;

    private void OnTick(object? sender, EventArgs e) { /* ... */ }
}

var publisher = new LongLivedPublisher();
var sub = new ShortLivedSubscriber();
sub.Subscribe(publisher);

sub = null;   // 你以为可以回收了,但 publisher.Tick 仍持有 OnTick 委托 -> sub
GC.Collect();
Console.WriteLine(GC.GetTotalMemory(true));  // 那 10MB 仍在
```

经典事故场景:

- WPF 里 ViewModel 订阅了 `INotifyPropertyChanged`,但 ViewModel 被容器换掉后没退订。
- ASP.NET 里静态缓存/单例订阅了请求级对象的事件。
- 自定义 UI 控件订阅静态 `Timer`。

### 用 `IDisposable` 模式管理订阅

最实用的写法是让订阅方在 `Dispose` 里退订,或用 `using`:

```csharp
public sealed class Subscription : IDisposable
{
    private readonly Action _unsubscribe;
    public Subscription(Action unsubscribe) => _unsubscribe = unsubscribe;
    public void Dispose() => _unsubscribe();
}

public static class PublisherExtensions
{
    public static IDisposable Subscribe(
        this LongLivedPublisher p, EventHandler handler)
    {
        p.Tick += handler;
        return new Subscription(() => p.Tick -= handler);
    }
}

using (publisher.Subscribe(OnTick))
{
    publisher.Raise();
}   // 离开作用域自动退订
```

### 弱事件模式

当订阅者生命周期不确定、又不想手动退订时,`WeakEventManager`(WPF)或第三方弱事件库让发布者只持有**弱引用**,订阅者可以被 GC 回收:

```csharp
// WPF 中的写法
WeakEventManager<LongLivedPublisher, EventArgs>
    .AddHandler(publisher, nameof(LongLivedPublisher.Tick), OnTick);
```

适用场景:发布者生命周期 >> 订阅者,且退订时机难以确定。代价是失去编译期检查和部分性能。普通代码优先用 `IDisposable` 显式退订,弱事件只在必要时引入。

## 委托的性能考量

### 分配

- 每次把 Lambda 赋给委托、或把实例方法转成委托,都可能产生堆分配。
- 捕获变量的闭包还会额外分配一个闭包对象。
- 多播委托的 `+=` 会创建新的委托实例(不可变),频繁增删有成本。

### 缓存委托到字段

在热路径上把委托缓存到静态字段或实例字段,避免重复分配:

```csharp
public class Sorter
{
    // 每次比较都新建委托会很慢,这里缓存一次
    private static readonly Comparison<int> ByValue = (a, b) => a.CompareTo(b);

    public void Sort(List<int> xs) => xs.Sort(ByValue);
}
```

### `static` Lambda 帮助缓存

```csharp
private static readonly Func<int, bool> IsPositive = static x => x > 0;
```

无捕获的 `static` Lambda 可以被编译器缓存为单例,不产生每次调用的闭包分配。

::: tip
高频路径上,如果 Lambda 不捕获任何东西,优先写成 `static x => ...`。这既是性能优化,也是给读者的信号:"这里没有隐藏的捕获"。
:::

## 委托与 `IDisposable`

如果委托的目标实现了 `IDisposable`,委托本身不会替你释放它。常见模式是让持有委托的对象在 `Dispose` 时清空委托列表并释放资源:

```csharp
public sealed class HandlerRegistry : IDisposable
{
    private readonly List<Action> _handlers = new();

    public void Add(Action h) => _handlers.Add(h);

    public void Dispose()
    {
        _handlers.Clear();   // 释放对订阅者的强引用
    }
}
```

## 委托与异步

`async` 方法可以转成 `Func<Task>` / `Action` 等委托,但要注意:

- `async void` 只能转成 `Action`,异常无法被调用方捕获(会直接崩进程),除非是事件处理器。**事件处理器是 `async void` 唯一合理的用途**。
- `async Task` 转成 `Func<Task>` 后,调用方必须 `await` 才能观察到异常。

```csharp
Func<Task> work = async () => await Task.Delay(100);
await work();               // 正确:异常可被捕获

Action fireAndForget = async () => await Task.Delay(100);
fireAndForget();            // 危险:异常无处可去
```

## 常见坑

### 1. `-=` 匿名 Lambda 无效

```csharp
evt += () => Console.WriteLine("x");
evt -= () => Console.WriteLine("x");   // 无效:两个委托不相等
```

必须保存委托引用再退订。

### 2. `for` 循环里捕获循环变量

```csharp
for (int i = 0; i < 3; i++)
    actions.Add(() => Console.WriteLine(i));  // 全是 3
```

在循环体内复制到局部变量。

### 3. 以为 `foreach` 也会共享变量

C# 5 起 `foreach` 每次迭代是新变量,`for` 不是。两者行为不同,不要类推。

### 4. 事件忘记退订导致泄漏

订阅者被发布者强引用,生命周期被延长。用 `IDisposable` 或在 `Dispose` 里退订。

### 5. 触发事件的竞态

`if (Clicked != null) Clicked(...)` 在多线程下有 `NullReferenceException` 风险。用 `?.Invoke`。

### 6. 多播委托的返回值被忽略

`f()` 只返回最后一个处理器的结果。要全部结果就遍历 `GetInvocationList()`。

### 7. 多播委托一个处理器抛异常导致其余不执行

需要隔离异常时手动遍历并 try/catch。

### 8. 误把语句体 Lambda 赋给 `Expression<>`

```csharp
// Expression<Func<int,int>> bad = x => { return x + 1; }; // 编译错误
```

表达式树只能表示表达式。

### 9. `Compile()` 放在热路径

每次 `Compile()` 都要生成 IL 并 JIT。缓存编译结果。

### 10. `async void` 当普通回调用

`async void` 的异常无法被 `await` 捕获,会直接抛出到同步上下文。除事件处理器外,一律用 `async Task`。

### 11. 闭包捕获循环外的可变状态

```csharp
int total = 0;
var fns = Enumerable.Range(0, 3).Select(i => (Func<int>)(() => total += i)).ToList();
```

所有闭包共享同一个 `total`,叠加顺序有副作用。捕获只读快照或改用参数传递。

### 12. 混淆 `Func<T>` 与 `Action<T>` 的参数含义

`Func<int, int, int>` 是"两个 int 参数、返回 int",不是"三个 int"。最后一个是返回类型。
