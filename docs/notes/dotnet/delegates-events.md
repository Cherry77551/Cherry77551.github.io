# 5. 委托、Lambda 与事件

委托(delegate)是 C# 里表示"对方法的引用"的类型,是回调、事件、LINQ、异步等地基。Lambda 是创建委托最常用的语法糖;事件是基于委托的发布-订阅机制,通过访问器限制外部对委托字段的破坏性访问。

**对 Unity 开发来说,这一篇有两个重点**:闭包会带来 GC 分配;事件忘记退订会让 `MonoBehaviour` 无法回收。

## 委托的本质

C++ 的函数指针只记录一个地址,C# 的委托是一个**对象**,至少包含两项信息:

1. 目标对象(`Target`),即方法所属的实例;静态方法则为 `null`。
2. 方法描述(`Method`),即要调用的方法。

委托还是**类型安全**的:编译器知道签名,调用时参数和返回值都受检查。

```csharp
public delegate int Calculator(int a, int b);

int Add(int x, int y) => x + y;

Calculator calc = Add;
Console.WriteLine(calc(2, 3));        // 输出: 5
Console.WriteLine(calc.Target);        // 输出: (空,静态方法)
Console.WriteLine(calc.Method.Name);   // 输出: Add
```

`delegate` 声明等价于编译器生成一个继承 `System.MulticastDelegate` 的类(含构造函数、`Invoke`、`Combine` / `Remove` 等)。因此:

- 委托实例是堆上对象,创建它有分配成本。
- 委托的 `==` 是**值相等**(目标对象和方法都相同才相等),不是引用相等。

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
```

`f.Target` 就是 `g`。**只要委托还活着,它就持有目标对象的强引用**,目标无法被 GC 回收。这是后面"事件内存泄漏"的根源。

## 自定义委托声明与使用

```csharp
public delegate void Notify(string message);

void PrintToConsole(string msg) => Console.WriteLine($"[console] {msg}");

Notify n = PrintToConsole;
n("done");
```

同一个方法可以转换到任何签名兼容的委托。但绝大多数情况下不需要自定义委托,直接用 BCL 提供的类型。

## 内置委托类型

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

`Action` 和 `Func` 各有 0 到 16 个参数的重载。选择:执行动作用 `Action`,产出结果用 `Func`,判断布尔用 `Predicate<T>`(或 `Func<T, bool>`),比较两个元素用 `Comparison<T>`,事件用 `EventHandler<TEventArgs>`。

```csharp
Action log = () => Console.WriteLine("tick");
Action<string, int> log2 = (s, n) => Console.WriteLine($"{s}:{n}");
Func<int, int, int> mul = (a, b) => a * b;
Predicate<int> isEven = x => x % 2 == 0;
Comparison<int> byAbs = (a, b) => Math.Abs(a).CompareTo(Math.Abs(b));
Converter<string, int> parse = int.Parse;
```

注意 `Func<int, int, int>` 的最后一个是**返回类型**,前面都是参数。

## 多播委托

`+=` 追加到调用列表,`-=` 移除,底层是 `MulticastDelegate.Combine` / `Remove`。

```csharp
Action a = () => Console.WriteLine("A");
Action b = () => Console.WriteLine("B");

Action multi = a + b;
multi();                 // 输出: A 然后 B

multi -= a;
multi();                 // 输出: B
```

### 返回值只取最后一个

有返回值的多播委托,每个方法都执行,但只返回**最后一个**的结果:

```csharp
Func<int> f = () => 1;
f += () => 2;
f += () => 3;
Console.WriteLine(f());  // 输出: 3

foreach (Func<int> item in f.GetInvocationList())
    Console.WriteLine(item());  // 输出: 1 2 3
```

### 异常会中断后续调用

多播链里任何一个方法抛异常,后面的方法都不执行。需要容错时手动遍历并逐个 try/catch:

```csharp
foreach (Action item in g.GetInvocationList())
{
    try { item(); }
    catch (Exception ex) { Console.WriteLine($"handler failed: {ex.Message}"); }
}
```

::: warning
多播委托的返回值和处理异常都需要手动遍历 `GetInvocationList()`。事件触发时若某个订阅者抛异常,会一并中断其他订阅者。**调试事件时,`GetInvocationList()` 还能列出当前所有订阅者,是排查"到底谁挂上了"的利器。**
:::

## 委托相等性与移除

`-=` 依赖**值相等**:目标对象和方法都相同才相等。

```csharp
Action h1 = Print;
Action h2 = Print;
Console.WriteLine(h1 == h2);  // 输出: True

Action x = () => Console.WriteLine("hi");
Action y = () => Console.WriteLine("hi");
Console.WriteLine(x == y);    // 输出: False(匿名函数每次是新实例)
```

所以用匿名 lambda 去 `-=` 往往**无效**:

```csharp
Action evt = null!;
evt += () => Console.WriteLine("once");
evt -= () => Console.WriteLine("once");   // 什么也没移除
evt();                                     // 仍然输出: once
```

正确做法是把委托保存到字段或变量:

```csharp
Action handler = () => Console.WriteLine("once");
evt += handler;
evt -= handler;      // 有效
```

同样的规则适用于 `List<T>.Remove` 或以委托为键的 `Dictionary`。

## Lambda 全解

### 表达式体与语句体

```csharp
Func<int, int> f1 = x => x + 1;                 // 表达式体
Func<int, int> f2 = (x) => { return x + 1; };   // 语句体
Action f3 = () => Console.WriteLine("no args");
Action<int, int> f4 = (a, b) => Console.WriteLine(a + b);
```

### 丢弃参数 `_`

```csharp
Action<int, int> ignoreBoth = (_, _) => Console.WriteLine("ignored");
```

C# 9 起,多个 `_` 是各自独立的丢弃参数;只有一个参数时 `_` 就只是普通参数名。

### 匿名方法(历史写法)

C# 2.0 的匿名方法 `delegate(int x) { return x * x; }` 是 Lambda 的前身,能力更少,现代代码一律用 Lambda。

::: tip
赋给 `Expression<Func<...>>` 时,Lambda 被编译成**数据结构**;赋给 `Func<...>` 时编译成委托。同一个语法,两种目标类型,产物完全不同。
:::

## 闭包与变量捕获

### 捕获的原理

Lambda 引用外部变量时,这些变量被打包进一个编译器生成的闭包类,成为它的**字段**:

```csharp
int threshold = 10;
Func<int, bool> above = x => x > threshold;

// 编译器大致生成:
// sealed class Closure { public int threshold; public bool Method(int x) => x > threshold; }
```

因此捕获是**按引用共享**的:闭包看到的是变量的当前值,而不是捕获那一刻的快照。

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
foreach (int i in new[] { 0, 1, 2 })
    list.Add(() => Console.WriteLine(i));   // 输出: 0 1 2
```

C# 5 之前 `foreach` 也共享变量(输出 `2 2 2`),这是语言规范的一次破坏性修复,专门为 `await` 在循环里的场景服务。

### `static` Lambda(C# 9)

```csharp
Func<int, int> pure = static x => x + 1;   // 不允许捕获任何外部变量
// Func<int, int> bad = static x => x * factor; // 编译错误
```

写成 `static` 后任何捕获都会编译错误,因此可以被缓存为单例,避免不必要的闭包分配。

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
闭包捕获 + 长期存活的容器 = 内存泄漏的经典组合。凡是把匿名函数存进静态字段、单例、长生命周期事件源的代码,都要检查捕获了哪些对象。**在 Unity 里,这个"长期存活容器"经常就是某个 `static` 单例或 `DontDestroyOnLoad` 的对象。**
:::

## 表达式树

Lambda 赋给 `Expression<Func<...>>` 时是**数据结构**,不是可调用代码:

```csharp
Func<int, bool> compiled = x => x > 10;            // 委托:可执行
Expression<Func<int, bool>> tree = x => x > 10;    // 表达式树:数据结构

Console.WriteLine(tree);                           // x => (x > 10)
Console.WriteLine(tree.Body.NodeType);             // GreaterThan
```

`Compile()` 会把表达式树 JIT 成真实委托,开销不小,应编译一次、缓存复用。它的主要用途是让框架"读懂"你的代码再翻译成别的语言:`IQueryable<T>` 的 `Where` 接收 `Expression<Func<T,bool>>`,EF Core 才能翻译成 SQL;而 `IEnumerable<T>` 的 `Where` 接收已编译的 `Func<T,bool>`,数据库无法读懂。

表达式树不能包含语句体 Lambda、`await`、赋值自增等,只能表示表达式。

::: warning 为什么 Unity 里基本用不到
表达式树主要服务于 LINQ to SQL / EF Core 这类 ORM,而 Unity 里用不到 ORM。更关键的是 **IL2CPP 会把 C# 编译成 C++**,`Compile()` 依赖的运行时 IL 生成在 AOT 下会失败或被裁剪,所以即便某个库用了 `Expression`,在 IL2CPP 构建里也常常直接跑不起来。Unity 里要做数据驱动逻辑,优先用数据表 + 委托。
:::

## 事件

### `event` 关键字的语义

事件在类内部就是一个委托字段,但对外只暴露 `+=` 和 `-=`:

```csharp
public class Button
{
    public event EventHandler? Clicked;   // 对外只能订阅/退订

    public void SimulateClick()
        => Clicked?.Invoke(this, EventArgs.Empty);   // 类内部才能触发
}

var button = new Button();
button.Clicked += (sender, e) => Console.WriteLine("clicked");
button.SimulateClick();  // 输出: clicked

// button.Clicked = null;         // 编译错误:事件只能在声明类内赋值
// button.Clicked.Invoke(...);    // 编译错误:外部不能调用
```

如果 `Clicked` 是普通委托字段,外部就能把它置空抹掉别人的订阅、或伪造触发。`event` 把委托字段变成只有 `add` / `remove` 两个操作的封装,从根本上杜绝这些问题。编译器把 `+=` / `-=` 分别翻译成 `add` / `remove` 访问器:

```csharp
public event EventHandler Changed
{
    add    { _handlers += value; }
    remove { _handlers -= value; }
}
```

现代代码通常用字段式事件,只有需要自定义行为(弱引用、日志、线程调度)时才手写访问器。

### `EventHandler` 与 `sender` / `e` 约定

- 第一个参数 `sender` 是触发事件的源(类型 `object?`)。
- 第二个参数 `e` 是事件数据,继承自 `EventArgs`(或 `EventArgs.Empty`)。

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

### 触发事件的正确写法

```csharp
Clicked?.Invoke(this, EventArgs.Empty);   // 先取局部快照再判空调用
```

不要写 `if (Clicked != null) Clicked(...)`:多线程下判空和调用之间事件可能被置 null,导致 `NullReferenceException`。`?.` 会先把 `Clicked` 读进临时变量,天然避开竞态。Unity 是单线程,虽无此竞态,但 `?.Invoke` 仍是统一写法。

### `protected virtual OnXxx` 模式

派生类通常需要覆写事件触发逻辑,把触发封装成受保护的虚方法:

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
        base.OnResized();   // 先调 base,再触发
    }
}
```

这是 .NET Framework / WPF / WinForms 的稳定惯例。

### 事件导致的内存泄漏

发布者持有订阅者的强引用。发布者比订阅者活得久时,订阅者(及其整张对象图)无法回收:

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
    private void OnTick(object? sender, EventArgs e) { }
}

var publisher = new LongLivedPublisher();
var sub = new ShortLivedSubscriber();
sub.Subscribe(publisher);

sub = null;   // 你以为可以回收了,但 publisher.Tick 仍持有 OnTick 委托 -> sub
GC.Collect();
Console.WriteLine(GC.GetTotalMemory(true));  // 那 10MB 仍在
```

经典事故:WPF 的 ViewModel 订阅了 `INotifyPropertyChanged` 却没退订,或自定义控件订阅了静态 `Timer`。

### Unity 里事件泄漏尤其严重

`MonoBehaviour` 由引擎管理生命周期,被 `Destroy` 后 C# 对象不一定立即回收;而事件源(单例、管理器、`static` 事件)往往活得比它久。面板订阅了管理器的事件、被销毁后事件还挂着,既泄漏内存,下次触发时还会调用到已销毁对象,抛 `MissingReferenceException`。

**规则:在 `OnEnable` 订阅,就在 `OnDisable`(或 `OnDestroy`)退订。**

```csharp
public class HealthBar : MonoBehaviour
{
    [SerializeField] private PlayerHealth _health;

    void OnEnable()  => _health.Changed += OnHealthChanged;
    void OnDisable() => _health.Changed -= OnHealthChanged;

    void OnHealthChanged(object sender, EventArgs e) { /* 更新 UI */ }
}
```

::: danger
`-=` 必须用**同一个方法组**(如 `OnHealthChanged`),不要用匿名 lambda,否则退订不掉。见"委托相等性与移除"。
:::

### 用 `IDisposable` 模式管理订阅

让订阅方在 `Dispose` 里退订,配合 `using` 自动清理:

```csharp
public static IDisposable Subscribe(this LongLivedPublisher p, EventHandler handler)
{
    p.Tick += handler;
    return new Subscription(() => p.Tick -= handler);
}

using (publisher.Subscribe(OnTick))
{
    publisher.Raise();
}   // 离开作用域自动退订
```

弱事件模式(WPF 的 `WeakEventManager` / 第三方库)让发布者只持有弱引用,适合订阅者生命周期不确定的场景。Unity 里通常用不到,显式退订更简单可控。

## 委托的性能考量

- 每次把 Lambda 赋给委托、或把实例方法转成委托,都可能产生堆分配;捕获变量还会额外分配一个闭包对象。
- 多播委托的 `+=` 会创建新的委托实例,频繁增删有成本。
- **热路径上必须缓存委托**,避免重复分配:

```csharp
public class Sorter
{
    // 每次比较都新建委托会很慢,这里缓存一次
    private static readonly Comparison<int> ByValue = (a, b) => a.CompareTo(b);
    private static readonly Func<int, bool> IsPositive = static x => x > 0;

    public void Sort(List<int> xs) => xs.Sort(ByValue);
}
```

无捕获的 `static` Lambda 可以被编译器缓存为单例,不产生每次调用的闭包分配。高频路径上优先写 `static x => ...`。

## 委托与 `IDisposable`

委托不会替你释放目标。持有委托的对象应在 `Dispose` 时清空委托列表(如 `_handlers.Clear()`),解除对订阅者的强引用,否则订阅者会一直被持有。

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

## Unity 视角:`UnityEvent` vs C# `event`

Unity 有自己的事件系统 `UnityEvent`,它和 C# 的 `event` 不是一回事:

| | C# `event` | `UnityEvent` |
| --- | --- | --- |
| 编辑器可视化 | 否 | 是,可在 Inspector 拖拽绑定 |
| 序列化 | 否 | 是,随场景/预制体保存 |
| 性能 | 直接调用,几乎零开销 | 内部用列表/反射,开销更大 |
| 退订 | 手动 `-=` | `RemoveListener`,同样要记得 |

怎么选:

- **需要在 Inspector 连线、策划能改** → `UnityEvent`。
- **纯代码内部、性能敏感、每帧触发的回调** → C# `event`。
- `UnityEvent.AddListener` 传匿名 lambda 同样退订不掉,而且它会持有目标对象引用,销毁前记得 `RemoveListener`。

调试 C# `event` 时,`GetInvocationList()` 能列出当前所有订阅者,排查"事件被谁挂住""为什么退订没生效"很有用;`UnityEvent` 没有对应 API,只能靠编辑器面板观察。

## Unity 用不了(只支持 C# 9)

Lambda 的下面这些新特性 Unity 里用不了,遇到别照抄:

| 特性 | 版本 | 替代 |
| --- | --- | --- |
| 天然类型 `var f = (int x) => x * 2;` | C# 10 | 显式写 `Func<...>` / `Action<...>` |
| 显式返回类型 `int? (string s) => ...` | C# 10 | 改用语句体 |
| Lambda 特性 `[Obsolete] () => ...` | C# 10 | 不支持 |
| Lambda 默认参数 `(string s = "x") => ...` | C# 12 | 用重载或外部变量代替 |
| 简单 lambda 参数上的 `ref` / `out` 修饰符 | C# 14 | 显式写参数类型,或用匿名方法 |

表达式树在 IL2CPP 下的反射 / `Compile()` 限制见上文。

## 常见坑

### 1. `-=` 匿名 Lambda 无效

```csharp
evt += () => Console.WriteLine("x");
evt -= () => Console.WriteLine("x");   // 无效:两个委托不相等
```

必须保存委托引用再退订。

### 2. `for` 循环里捕获循环变量

`for (int i = 0; i < 3; i++) actions.Add(() => Console.WriteLine(i));` 会全部输出 3,要在循环体内复制到局部变量。`foreach` 每次迭代是新变量,不受影响。

### 3. 事件忘记退订导致泄漏

订阅者被发布者强引用,生命周期被延长。在 `OnDisable` / `Dispose` 里退订。

### 4. 触发事件的竞态

`if (Clicked != null) Clicked(...)` 在多线程下有 `NullReferenceException` 风险,用 `?.Invoke`。

### 5. 多播委托的返回值被忽略

`f()` 只返回最后一个处理器的结果,要全部结果就遍历 `GetInvocationList()`。

### 6. 一个处理器抛异常导致其余不执行

需要隔离异常时手动遍历并 try/catch。

### 7. 误把语句体 Lambda 赋给 `Expression<>`

表达式树只能表示表达式,`x => { return x + 1; }` 是编译错误。

### 8. `Compile()` 放在热路径

每次 `Compile()` 都要生成 IL 并 JIT,要缓存结果。

### 9. `async void` 当普通回调用

`async void` 的异常无法被 `await` 捕获,除事件处理器外一律用 `async Task`。

### 10. 闭包捕获循环外的可变状态

多个闭包共享同一个外部变量会有叠加副作用,捕获只读快照或改用参数传递。

### 11. 混淆 `Func<T>` 与 `Action<T>` 的参数含义

`Func<int, int, int>` 是"两个 int 参数、返回 int",最后一个是返回类型。
