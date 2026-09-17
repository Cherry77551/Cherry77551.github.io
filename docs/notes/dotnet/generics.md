# 5. 泛型

泛型(generics)是 C# 类型系统的核心机制之一,它允许你编写"类型参数化"的类、方法、接口、委托和结构体,而不必事先绑定具体类型。它同时解决三个问题:类型安全、避免装箱拆箱和强制转换的性能损耗、以及代码复用。

对从 Java 转过来的读者来说,最重要的一点是:C# 的泛型是**具现化(reified)**的,运行时保留完整的类型信息;而 Java 的泛型是**类型擦除(erasure)**的,编译后 `List<String>` 和 `List<Integer>` 在运行时都是同一个 `ArrayList`。这个根本差异决定了两门语言泛型能力的不同边界。

## 为什么需要泛型

### 用 `object` 做通用容器的问题

在没有泛型的年代,C# 1.0 用 `object` 做通用容器,因为所有类型都派生于 `object`。先看一个朴素实现:

```csharp
public class ObjectBox
{
    private object _value;

    public void Set(object value) => _value = value;

    public object Get() => _value;
}
```

它能装任意类型,但代价是每次取出都要强制转换,并且值类型进出会发生**装箱(boxing)**和**拆箱(unboxing)**:

```csharp
var box = new ObjectBox();

// 装箱:int -> object,在堆上分配,复制 4 字节到堆对象中
box.Set(42);

// 拆箱:object -> int,检查类型后把堆上的值复制回栈
int n = (int)box.Get();

// 编译器不阻止你把错误类型塞进去,错误只在运行时暴露
box.Set("hello");
// int bad = (int)box.Get();  // 运行时抛 InvalidCastException
```

装箱意味着在 GC 堆上分配内存,拆箱意味着类型检查和内存复制。在一个循环里反复装箱,会带来可观的时间开销和 GC 压力:

```csharp
long sum = 0;
for (int i = 0; i < 1_000_000; i++)
{
    object o = i;      // 装箱:每次循环分配一个堆对象
    sum += (int)o;     // 拆箱
}
```

这段代码会分配一百万个只存活极短的小对象,它们会迅速升入 Gen0 并增加 GC 次数。

### 非泛型集合 `ArrayList` 的实际问题

`System.Collections` 里的 `ArrayList` 就是 `object` 容器的典型代表:

```csharp
using System.Collections;

var list = new ArrayList();
list.Add(1);          // 装箱
list.Add(2);          // 装箱
list.Add("three");    // 编译通过!但语义错误

foreach (object item in list)
{
    Console.WriteLine((int)item);  // 处理第三个元素时抛 InvalidCastException
}
```

问题归纳为三类:

1. **类型不安全**:`Add("three")` 编译期不报错,错误被推迟到运行时。
2. **装箱开销**:值类型元素存取都产生装箱/拆箱。
3. **可读性差**:`(int)item` 这类强制转换散落各处,意图不清晰。

### 泛型的解法

```csharp
using System.Collections.Generic;

var list = new List<int>();
list.Add(1);
list.Add(2);
// list.Add("three");  // 编译错误:无法从 string 转换为 int

foreach (int item in list)  // 无需强制转换
{
    Console.WriteLine(item);
}
```

`List<int>` 在编译期强制类型一致,在运行时对值类型使用**特化后的存储**,不产生装箱。对于引用类型,`List<string>` 内部就是 `string[]`,也没有额外转换。

## C# 泛型是具现化的

### 与 Java 类型擦除的对比

Java 的泛型在编译期做类型检查,编译后类型参数被**擦除**为 `Object`(或上界),并在必要位置插入强制转换。这意味着:

- 运行时无法知道 `List<String>` 的实际元素类型。
- `new T()`、`new T[]`、`typeof(T)`、对 `instanceof T` 的检查等在 Java 中都不可用(除非反射绕过)。
- 静态字段不能在泛型类型的不同实例化之间共享,但反过来也无法为每个实例化维护独立状态。

C# 相反,`List<int>` 和 `List<string>` 在运行时是**两个不同的类型**,CLR 为它们分别创建运行时类型。这带来一组在 Java 中做不到的写法:

```csharp
public class Container<T>
{
    // 合法:运行时 T 是具体类型,可以取它的 Type 对象
    public Type ElementType => typeof(T);

    // 合法:需要 new() 约束才能 new T(),见下文
    public T[] ToArray(int size) => new T[size];

    // 合法:default(T) 对值类型是零值,对引用类型是 null
    public T Default => default(T);
}
```

```csharp
var c = new Container<int>();
Console.WriteLine(c.ElementType);   // 输出: System.Int32
Console.WriteLine(c.Default);       // 输出: 0

var s = new Container<string>();
Console.WriteLine(s.ElementType);   // 输出: System.String
Console.WriteLine(s.Default == null); // 输出: True
```

### 值类型泛型会生成专用代码

因为运行时保留了类型信息,CLR 对值类型类型参数会生成**特化代码**,内部可以直接存放 `int`,无需装箱:

```csharp
var numbers = new List<int>();
numbers.Add(1);     // 直接存入 int[],无装箱
int x = numbers[0]; // 直接读取,无拆箱
```

对引用类型,CLR 则共享同一份 JIT 代码(因为所有引用大小相同),以控制代码体积。这是具现化与性能之间的折中。

### 代码膨胀的代价

具现化不是免费的。每用一个不同的值类型实例化一个泛型类型,CLR 就要生成一份特化代码。若用很多不同的结构体去实例化 `List<T>`,生成的本地代码总量会增加。这在大多数业务代码里不成问题,但在对启动时间和代码体积敏感的场合(如移动端 AOT)需要留意。

::: warning
值类型泛型特化会带来代码膨胀,但换来的是零装箱的性能。只有在泛型类型参数数量极多(几十上百种值类型)且方法体很大时,膨胀才可能成为问题。不要因为这个原因退回 `object`,那通常是过早优化。
:::

## 泛型类型全家桶

### 泛型类

```csharp
public class Pair<TFirst, TSecond>
{
    public TFirst First { get; }
    public TSecond Second { get; }

    public Pair(TFirst first, TSecond second)
    {
        First = first;
        Second = second;
    }

    public Pair<TSecond, TFirst> Swap() => new(Second, First);

    public override string ToString() => $"({First}, {Second})";
}

var p = new Pair<string, int>("age", 30);
Console.WriteLine(p);                 // 输出: (age, 30)
Console.WriteLine(p.Swap());          // 输出: (30, age)
```

类型参数可以有多个,并且可以互相引用(例如 `Swap` 返回一个新的实例化)。

### 泛型方法

方法可以直接引入自己的类型参数,与所在类无关:

```csharp
public static class Util
{
    public static T[] Repeat<T>(T value, int count)
    {
        var result = new T[count];
        for (int i = 0; i < count; i++)
            result[i] = value;
        return result;
    }

    public static void Swap<T>(ref T a, ref T b)
    {
        T tmp = a;
        a = b;
        b = tmp;
    }
}

var xs = Util.Repeat("hi", 3);       // 推断 T = string
Util.Swap(ref xs[0], ref xs[1]);     // 交换
Console.WriteLine(string.Join(",", xs)); // 输出: hi,hi,hi
```

### 泛型接口

泛型接口是抽象能力最强的形式,BCL 里大量使用,例如 `IComparer<T>`、`IEnumerable<T>`、`IEqualityComparer<T>`:

```csharp
public interface IRepository<T>
    where T : IEntity
{
    T? FindById(int id);
    void Add(T entity);
    IReadOnlyList<T> All();
}

public interface IEntity
{
    int Id { get; }
}
```

实现泛型接口时,可以给出具体类型,也可以继续泛型:

```csharp
public class InMemoryRepository<T> : IRepository<T> where T : IEntity
{
    private readonly List<T> _items = new();

    public T? FindById(int id) => _items.FirstOrDefault(e => e.Id == id);
    public void Add(T entity) => _items.Add(entity);
    public IReadOnlyList<T> All() => _items;
}
```

### 泛型委托

```csharp
public delegate TResult Transformer<TInput, TResult>(TInput input);

Transformer<string, int> length = s => s.Length;
Console.WriteLine(length("hello")); // 输出: 5
```

绝大多数场景不需要自定义委托,直接用 BCL 的 `Func` / `Action` 即可,详见委托那一篇。

### 泛型结构体

结构体也可以泛型化,适合做轻量的值语义容器,避免堆分配:

```csharp
public readonly struct Optional<T>
{
    private readonly bool _hasValue;
    private readonly T _value;

    private Optional(bool hasValue, T value)
    {
        _hasValue = hasValue;
        _value = value;
    }

    public static Optional<T> Some(T value) => new(true, value);
    public static Optional<T> None => default;

    public bool TryGet(out T value)
    {
        value = _value!;
        return _hasValue;
    }
}
```

::: tip
`readonly struct` 配合泛型非常适合高频、短生命周期的小对象(比如解析器中的 token、游戏循环里的向量),可以完全避免堆分配。
:::

## 类型参数的命名约定

微软官方约定(遵循即可,不必自创):

| 名称 | 含义 |
| --- | --- |
| `T` | 只有一个类型参数时的通用名称 |
| `TKey` / `TValue` | 字典、映射类结构中的键和值 |
| `TResult` | 方法或委托的返回类型 |
| `TItem` | 集合中的单个元素 |
| `TElement` | 与 `TItem` 类似,常见于 LINQ 风格 API |
| `TSource` / `TArgs` | 数据源、事件参数 |
| `TInput` / `TOutput` | 转换的两端 |

有意义的名称(`TKey`)优于多个裸 `T`,但不要长到像普通变量名。类型参数前缀统一用 `T`。

## 类型推断与显式指定

泛型方法调用时,编译器会尝试从实参推断类型参数:

```csharp
static T Max<T>(T a, T b) where T : IComparable<T>
    => a.CompareTo(b) >= 0 ? a : b;

int m1 = Max(3, 7);        // 推断 T = int
string m2 = Max("a", "z"); // 推断 T = string
```

推断规则要点:

- 编译器只根据**实参**推断,**不会**根据返回值的赋值目标反推(与某些语言不同)。
- 如果实参类型不一致,推断可能失败:

```csharp
// long m3 = Max(3, 7L);  // 编译错误:无法从 int 和 long 推断出 T
```

此时需要显式指定:

```csharp
long m3 = Max<long>(3, 7L); // 显式指定 T = long,int 会隐式转换为 long
```

如果推断的结果不满足约束,也是编译错误:

```csharp
// Max(new object(), new object()); // 编译错误:object 未实现 IComparable<object>
```

::: details 类型推断为什么不看返回值
方法的类型参数必须在**方法调用表达式**本身就能确定,否则会在重载解析和泛型实例化之间形成循环依赖。赋值目标的类型是调用之后才结合上下文得到的,语言设计上刻意不参与推断,以保持规则可判定。
:::

## 约束(where)全表

约束用来限制类型参数可以为哪些类型,同时解锁对该类型的更多操作。

### `class` / `struct` / `notnull` / `unmanaged`

```csharp
// 引用类型约束(不能是值类型)
static void RefOnly<T>(T value) where T : class { }

// 非可空值类型约束
static void ValueOnly<T>(T value) where T : struct { }

// 非空引用类型(可以是值类型,但不能是可为空的引用类型)
static void NotNullOnly<T>(T value) where T : notnull { }

// 非托管类型:值类型且不含任何引用类型字段
static unsafe void UnmanagedOnly<T>(T value) where T : unmanaged
{
    T* p = &value; // 可以做指针操作
}
```

`unmanaged` 意味着该类型可以安全地用于 `stackalloc`、指针和 P/Invoke。

### `new()` 约束

要求类型必须有**公开无参构造函数**,这样才能 `new T()`:

```csharp
static T Create<T>() where T : new() => new T();

// 或同时指定基类,常用:先具体类型,后 new()
static T CreateEntity<T>() where T : Entity, new() => new T();
```

::: warning
`new()` 约束必须写在约束列表的**最后**。约束之间用逗号分隔,顺序有语法规定:主约束(基类/`class`/`struct`/`unmanaged`/`notnull`)在前,接口约束居中,`new()` 在最后。`default` 约束(用于重写)又另当别论。
:::

### 基类和接口约束

```csharp
static int CompareById<T>(T a, T b) where T : IEntity
    => a.Id.CompareTo(b.Id);

abstract class Animal { public abstract string Sound(); }
static string Speak<T>(T a) where T : Animal => a.Sound();
```

### 裸类型约束 `where T : U`

约束一个类型参数必须是另一个类型参数或其派生类型:

```csharp
// TDerived 必须与 TBase 相同或是其派生
static void Register<TBase, TDerived>(TDerived item) where TDerived : TBase { }
```

### `allows ref struct`(C# 13)

C# 之前 `ref struct`(如 `Span<T>`)不能作为类型参数。C# 13 起用 `allows ref struct` 显式允许:

```csharp
static int Total<T>(T values) where T : allows ref struct
{
    // 这里 T 可能是 ref struct
    return values.GetHashCode(); // 仅示意
}
```

这个特性主要用于让你的泛型 API 能接受 `Span<T>` 之类只存在于栈上的类型。

### `default` 约束(C# 9)

用于**重写或显式接口实现**中,表示"不添加约束,也不继承基方法的约束":

```csharp
public class Base
{
    public virtual void M<T>() where T : class { }
}

public class Derived : Base
{
    // 用 default 表示这个方法不要求 T : class(但也不放宽——见下)
    public override void M<T>() { }
}
```

实际上,重写时约束必须与基方法一致,`default` 主要出现在显式接口实现里,表示"这个实现不声明任何约束"。

### `class?` 与 `notnull` 的细微差别

- `where T : class` 在可空引用类型上下文中,意味着**非空**引用类型。
- `where T : class?` 允许 `T` 是可为空的引用类型(即运行时类型可以是 `string` 或 `string?` 这类可空注解,前提是打开可空上下文)。
- `where T : notnull` 既接受非空引用类型,也接受值类型,但拒绝可为空引用类型。

```csharp
#nullable enable
static void A<T>(T value) where T : class { }        // 不接受 string?
static void B<T>(T value) where T : class? { }       // 接受 string?
static void C<T>(T value) where T : notnull { }      // 接受 string 和 int,拒绝 string?
```

### 约束的顺序规则

一个 `where` 子句里,下列顺序是强制的:

1. 主约束:`class` / `class?` / `struct` / `notnull` / `unmanaged` / 基类名 / `allows ref struct`
2. 次要约束:零个或多个接口或裸类型约束
3. 构造函数约束:`new()`,只能放最后

```csharp
static T Build<TKey, TValue, T>()
    where TKey : notnull
    where TValue : class, IComparable<TValue>
    where T : Base, IDisposable, new()
    => new T();
```

### 约束的继承规则

派生类**不能放宽**基类或接口已经声明的约束,只能收紧或保持不变:

```csharp
public interface IStore<T> where T : class { }

// 非法:放宽了基接口的约束
// public class Bad<T> : IStore<T> { }   // 编译错误:T 未约束为 class

public class Good<T> : IStore<T> where T : class { }

// 收紧是允许的
public class Good2<T> : IStore<T> where T : class, IDisposable { }
```

理由:任何使用 `IStore<T>` 的代码都依赖 `T : class` 成立;如果实现放宽约束,就可能出现 `T` 是值类型的情况,破坏契约。

::: danger
不要为了省事在公共 API 上省略约束。省略会让调用方传任意类型,并且你无法在实现内部调用需要该约束的成员。约束是契约的一部分,应当精确表达你的真实需求。
:::

## `default(T)` 与泛型里的 null

`default(T)` 的语义取决于 `T`:

- 值类型:返回该类型的**零值**(`int` 是 `0`,`bool` 是 `false`,`DateTime` 是 `0001-01-01`,结构体是所有字段的零值)。
- 引用类型:返回 `null`。

```csharp
static T GetOrDefault<T>(T value) => value; // 仅示意

Console.WriteLine(default(int));        // 输出: 0
Console.WriteLine(default(bool));       // 输出: False
Console.WriteLine(default(string) == null); // 输出: True
Console.WriteLine(default(Pair<int,int>));  // 输出: (0, 0)
```

### `T?` 的两种含义

在打开可空引用类型时,`T?` 在泛型上下文里有两种截然不同的含义,取决于 `T` 是否受 `struct` 约束:

- 如果 `T` 是**无约束**的,`T?` 表示"可能为 null 的引用类型"(对值类型无效,需要额外条件)。
- 如果 `where T : struct`,`T?` 表示 `Nullable<T>`,即 `Nullable<int>`。

```csharp
static T? NullableRef<T>(T value) where T : class => null;   // 引用 T?

static int? NullableVal<T>(T value) where T : struct
    => null;  // 返回 Nullable<T> 的 null
```

对于无约束的 `T`,C# 9 起 `T?` 会同时携带两种可能性,由编译器在实例化时决定用引用可空还是 `Nullable<T>`:

```csharp
static T? FirstOrNull<T>(IList<T> items) where T : struct
    => items.Count > 0 ? items[0] : (T?)null;
```

## 泛型里做不到的事

泛型不是万能的,受约束限制,C# 对 `T` 能做的事情取决于你声明了哪些约束。

### 不能直接做算术运算

在没有泛型数学之前,`T + T` 非法,因为编译器不知道 `T` 是否支持 `+`:

```csharp
// static T Add<T>(T a, T b) => a + b; // 编译错误
```

C# 11 的泛型数学解决了这个问题,见下文。

### `new T()` 需要 `new()` 约束

```csharp
// static T Make<T>() => new T(); // 编译错误:没有 new() 约束
static T Make<T>() where T : new() => new T();
```

### 不能对 `T` 直接用 `==`

即使 `T` 是引用类型,无约束下的 `==` 也可能是引用比较,语义不确定,因此编译器禁止:

```csharp
// static bool Same<T>(T a, T b) => a == b; // 编译错误
```

### `default(T) == null` 的编译限制

无约束时不能把 `T` 与 `null` 比较:

```csharp
// static bool IsNull<T>(T value) => value == null; // 编译错误
static bool IsNull<T>(T value) where T : class => value == null; // 可以
```

### 正确比较泛型值

需要值相等语义时,用 `EqualityComparer<T>.Default`;需要大小比较,用 `Comparer<T>.Default`:

```csharp
static bool Same<T>(T a, T b)
    => EqualityComparer<T>.Default.Equals(a, b);

static int Compare<T>(T a, T b)
    => Comparer<T>.Default.Compare(a, b);

Console.WriteLine(Same(1, 1));              // 输出: True
Console.WriteLine(Compare(3, 7));           // 输出: -1
Console.WriteLine(Same("a", "a"));          // 输出: True(值相等)
```

`EqualityComparer<T>.Default` 的聪明之处:如果 `T` 实现了 `IEquatable<T>`,就用它(无装箱);否则退化到 `object.Equals`。这样你**不必**强制要求调用方实现 `IEquatable<T>`。

::: tip
`EqualityComparer<T>.Default` 对值类型不装箱(因为它内部对 `IEquatable<T>` 做了特化)。所以 `Dictionary<TKey, TValue>` 等 BCL 容器在无自定义比较器时就是用它,性能很好。
:::

## 协变与逆变

变型(variance)描述的是:当类型参数之间有继承关系时,泛型类型之间是否也有方向一致的继承关系。

### 协变 `out`

`IEnumerable<string>` 可以赋给 `IEnumerable<object>`,因为 `string` 是 `object` 的子类型,且 `IEnumerable<T>` 只**产出** `T`:

```csharp
IEnumerable<string> strings = new List<string> { "a", "b" };
IEnumerable<object> objects = strings; // 协变:合法

foreach (object o in objects)
    Console.WriteLine(o); // 输出: a 然后 b
```

直觉:`IEnumerable<out T>` 只把 `T` 拿出来,所以你得到的对象"至少是 `T`",当期望 `object` 时给 `string` 是安全的。

### 逆变 `in`

`Action<object>` 可以赋给 `Action<string>`,因为 `Action<in T>` 只**消费** `T`:

```csharp
Action<object> printObj = o => Console.WriteLine(o!.GetType().Name);
Action<string> printStr = printObj; // 逆变:合法

printStr("hello"); // 输出: String
```

直觉:一个能处理任意 `object` 的方法,当然也能处理 `string`,所以 `Action<object>` 可以当作 `Action<string>` 用。

### 变型只对接口和委托有效

类不能声明变型。而且要求类型参数**只出现在输出位置**(才能 `out`)或**只出现在输入位置**(才能 `in`)。

```csharp
// 自定义协变接口:只产出 T
public interface IProducer<out T>
{
    T Produce();
    // void Consume(T item); // 编译错误:协变类型参数不能用于输入位置
}

// 自定义逆变接口:只消费 T
public interface IConsumer<in T>
{
    void Consume(T item);
    // T Produce(); // 编译错误:逆变类型参数不能用于输出位置
}
```

使用示例:

```csharp
IProducer<string> stringProducer = ...;
IProducer<object> objectProducer = stringProducer; // 协变

IConsumer<object> objectConsumer = ...;
IConsumer<string> stringConsumer = objectConsumer;  // 逆变
```

### `IList<T>` 为什么不能协变

`IList<T>` 同时有输入(`Add(T)`)和输出(`T this[int]`),因此无法声明变型:

```csharp
// 假设 IList<T> 是协变的(实际上不是),那么:
IList<string> strs = new List<string>();
IList<object> objs = strs;   // 若合法...
objs.Add(42);                // 就会把 int 塞进 List<string>!
```

编译器正是为了避免这种类型漏洞,才禁止 `IList<T>` 协变。`IReadOnlyList<out T>` 只输出,因此可以协变。

### 委托的变型与方法组转换

委托类型支持变型,并且方法组可以转换到"更宽"的委托:

```csharp
static object Describe(string s) => s.Length;

Func<object, object> f1 = Describe;   // 参数逆变 + 返回协变
Func<string, object> f2 = Describe;   // 参数类型一致
// Func<string, string> f3 = Describe; // 非法:返回 object 不能当 string 用
```

### 数组协变是不安全的特例

数组从 C# 1.0 起就支持协变,但这是**运行时检查**的不安全设计:

```csharp
object[] arr = new string[3];  // 编译通过
arr[0] = "ok";
try
{
    arr[1] = 42;               // 运行时抛 ArrayTypeMismatchException
}
catch (ArrayTypeMismatchException)
{
    Console.WriteLine("数组拒绝写入 int");
}
```

对比安全的 `IEnumerable<T>` 协变:后者是编译期检查 + 只读访问,根本不可能写坏。**优先用 `IEnumerable<T>` 而不是数组来做协变容器。**

## 泛型数学(C# 11)

### 为什么需要

传统上写一个通用的求和函数只能这样:

```csharp
// 只能对实现了运算符的具体类型逐个重载,或者装箱
static double Sum(IEnumerable<int> xs) => xs.Sum(x => (double)x);
```

C# 11 引入**静态抽象接口成员**(static abstract members),让接口可以声明静态虚方法,类型参数通过接口约束获得运算符能力:

```csharp
static T Sum<T>(IEnumerable<T> xs) where T : IAdditionOperators<T, T, T>, IAdditiveIdentity<T, T>
{
    T sum = T.AdditiveIdentity;
    foreach (var x in xs)
        sum += x;
    return sum;
}
```

`IAdditionOperators<T, T, T>` 声明了 `static T operator +(T left, T right)`,而 `+=` 会基于 `+` 自动工作。

### `INumber<T>` 接口族

BCL 提供了一套数值接口族,`INumber<T>` 是其中最综合的,同时继承了大量算术、比较、转换接口:

```csharp
static T Average<T>(IEnumerable<T> xs) where T : INumber<T>
{
    T sum = T.Zero;
    int count = 0;
    foreach (var x in xs)
    {
        sum += x;
        count++;
    }
    return sum / T.CreateChecked(count);
}

var ints = new[] { 1, 2, 3, 4 };
var doubles = new[] { 1.5, 2.5, 3.0 };

Console.WriteLine(Average(ints));    // 输出: 2
Console.WriteLine(Average(doubles)); // 输出: 2.3333333333333335
```

常用接口一览:

| 接口 | 提供的能力 |
| --- | --- |
| `INumber<T>` | 综合数值运算(`+ - * / %`、`Zero`、`One` 等) |
| `IBinaryInteger<T>` | 整数特有能力(位运算、`<<` `>>`) |
| `IFloatingPoint<T>` | 浮点特有能力(`NaN`、`Infinity`、舍入) |
| `IAdditionOperators<TSelf,TOther,TResult>` | `+` 运算符 |
| `IMinMaxValue<TSelf>` | `MinValue` / `MaxValue` 静态属性 |
| `IParsable<TSelf>` | `Parse` / `TryParse` |
| `IComparable<T>` | `CompareTo`(BCL 老接口) |

### 静态抽象成员的作用

`static abstract` 让接口可以要求实现类型提供**静态**成员,这正是运算符和 `Zero`/`One` 这类无实例状态成员的载体:

```csharp
public interface IShape<TSelf> where TSelf : IShape<TSelf>
{
    static abstract TSelf CreateUnit();
    double Area { get; }
}
```

注意 `IShape<TSelf>` 这种"自引用"约束模式,它让静态抽象成员有明确的返回类型,是泛型数学类设计的常见手法。

::: details 泛型数学的运行时开销
对值类型使用泛型数学,CLR 会做特化,通常能内联并达到接近手写代码的性能。但要注意接口约束下的调用在未特化场景可能不是零成本;高频热点路径仍建议基准测试。
:::

## 泛型与反射

运行时保留了类型参数,所以可以反射地观察和构造泛型类型:

```csharp
Type openType = typeof(List<>);          // 开放泛型
Type closedType = openType.MakeGenericType(typeof(int)); // 构造为 List<int>
Console.WriteLine(closedType == typeof(List<int>));       // 输出: True
Console.WriteLine(typeof(List<int>).IsGenericType);       // 输出: True
Console.WriteLine(typeof(List<int>).GetGenericArguments()[0]); // 输出: System.Int32
```

泛型方法:

```csharp
var method = typeof(Util).GetMethod(nameof(Util.Repeat))!; // Repeat<T>
var closed = method.MakeGenericMethod(typeof(string));
var result = (string[])closed.Invoke(null, new object[] { "x", 2 })!;
Console.WriteLine(string.Join(",", result)); // 输出: x,x
```

::: warning
`MakeGenericType` / `MakeGenericMethod` 有可观开销,且无法被 AOT 友好地内联。不要把它们放进热路径;若必须动态调用泛型,考虑缓存构造好的委托(如 `Delegate.CreateDelegate`)。
:::

## 继承与特殊组合

### 泛型与继承

泛型类可以继承泛型基类,但必须固定类型参数或保持同样的约束:

```csharp
public abstract class RepositoryBase<T> where T : IEntity
{
    public abstract T? Find(int id);
}

public class UserRepository : RepositoryBase<User>   // 固定 T = User
{
    public override User? Find(int id) => null;
}

public class GenericRepository<T> : RepositoryBase<T> where T : IEntity // 继续泛型
{
    public override T? Find(int id) => default;
}
```

### 泛型与 `IDisposable`

约束到 `IDisposable` 才能对 `T` 调用 `Dispose`:

```csharp
static void UseAndDispose<T>(T resource) where T : IDisposable
{
    try { /* ... */ }
    finally { resource.Dispose(); }
}
```

如果 `T` 可能没有实现 `IDisposable`,可以模式匹配:

```csharp
static void DisposeIfPossible<T>(T value)
{
    if (value is IDisposable d)
        d.Dispose();
}
```

## 设计最佳实践

- **约束尽量小而精确**:只要求你真正需要的接口。多加一个约束就缩小了可复用范围。
- **优先接口约束而不是基类约束**:接口约束不限制单继承。
- **不要要求 `IEquatable<T>` 来比较值**:用 `EqualityComparer<T>.Default`,它已经优化处理了 `IEquatable<T>`。
- **公开 API 的泛型要保持简单**:超过两三个类型参数或超过三行约束,通常意味着抽象泄漏,考虑拆分为多个方法或引入专门的类型。
- **用 `notnull` 明确字典键**:`Dictionary<TKey, TValue>` 或自定义容器要求键非空时,加上 `where TKey : notnull` 能让可空分析器帮你抓 bug。
- **避免约束到密封具体类**,除非确实需要它特有的成员;那通常是过度耦合。

## 常见坑

### 1. 无约束下对 `T` 使用 `==`

```csharp
// 编译错误
// static bool Eq<T>(T a, T b) => a == b;

// 正确
static bool Eq<T>(T a, T b) => EqualityComparer<T>.Default.Equals(a, b);
```

### 2. 以为 `default(T)` 一定是 `null`

对值类型它是零值。若用 `default(T) == null` 判断"空",对 `int` 会得到 `0` 而不是"未设置"。需要表达"可能缺失"时用 `Nullable<T>` 或自定义 `Optional<T>`。

### 3. 在有 `struct` 约束时误用 `T?`

```csharp
static T? FindOrNull<T>(IList<T> xs) where T : struct
    => xs.Count > 0 ? xs[0] : null; // 返回 Nullable<T>,不是 T
```

调用方拿到的是 `int?` 而不是 `int`,不加 `where T : struct` 时语义又完全不同。

### 4. 给重写方法放宽约束

重写不能放宽基方法的约束,只能保持一致(或用 `default` 表示不声明额外约束):

```csharp
class Base { public virtual void M<T>() where T : class { } }
class Derived : Base
{
    // public override void M<T>() { } // 编译错误:约束不一致
    public override void M<T>() { }     // C# 9+ 允许在重写中省略,等效继承约束
}
```

### 5. 以为数组协变是安全的

```csharp
object[] a = new string[1];
a[0] = 1;  // ArrayTypeMismatchException
```

需要只读协变容器时用 `IEnumerable<T>` / `IReadOnlyList<T>`。

### 6. 用 `T` 直接 new 数组却忘了 `new T[]` 的合法前提

`new T[]` 本身是合法的(不需要 `new()` 约束),但 `new T()` 需要 `new()`。不要混淆两者。

### 7. 反复装箱使用无约束泛型集合

```csharp
void Add<T>(List<T> list, T item) => list.Add(item); // 无装箱
void AddObj(object item) { ... }                      // 传值类型时会装箱
```

尽量让泛型一路保持类型参数,不要在中间退化为 `object`。

### 8. 用反射动态构造泛型却不缓存

`MakeGenericType` 每次调用都有成本,并且会阻止某些 JIT 优化。若类型组合有限,缓存结果。

### 9. 混淆协变与数组协变

`IEnumerable<object> e = new List<string>()` 是安全协变;`object[] a = new string[1]` 是不安全的历史特例。两者机制不同,不要类推。

### 10. 在泛型类型上声明静态字段的共享假设

```csharp
class Counter<T> { public static int Count; }
Counter<int>.Count = 1;
Counter<string>.Count = 2; // 与 Counter<int> 是不同的静态字段
```

每个封闭泛型类型有**独立**的静态字段。若你期望共享,应把静态状态放到非泛型基类里。
