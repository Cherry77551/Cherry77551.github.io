# 4. 面向对象:类、接口与继承

C# 是单继承、多实现的面向对象语言。与 Java 相比，它把"成员默认不虚"写进了语言设计，又通过 `interface` 的默认成员、`record`、模式匹配等机制逐步补上表达力。本篇覆盖类的组成、属性与构造函数、访问控制、继承与多态、抽象类与接口、扩展方法、`IDisposable` 模式与运算符重载。

## 类的基本结构

一个类可以包含以下成员：

```csharp
public class Sample
{
    public const int Max = 10;          // 常量（编译期）
    private readonly int _id;           // 只读字段
    private static int _counter;        // 静态字段
    public int Id => _id;               // 表达式体属性
    public string Name { get; set; } = ""; // 自动属性
    public int this[int i] => i * 2;    // 索引器

    static Sample() { _counter = 0; }   // 静态构造函数
    public Sample(int id) { _id = id; } // 实例构造函数
    ~Sample() { }                       // 终结器

    public void Print() => Console.WriteLine(_id);
    public static Sample operator +(Sample a, Sample b) => new(a._id + b._id);
    public event EventHandler? Changed; // 事件
    public class Nested { }             // 嵌套类型
}
```

### 字段

```csharp
public class Config
{
    public const string Version = "1.0";       // 编译期常量，内联到调用处
    public static readonly DateTime Start = DateTime.UtcNow; // 运行期初始化
    public readonly int Limit;                  // 构造期赋值后不可改

    public Config(int limit) => Limit = limit;
}
```

`const` 与 `static readonly` 的区别：

| | `const` | `static readonly` |
| --- | --- | --- |
| 求值时机 | 编译期 | 运行期（静态构造/字段初始化器） |
| 可用类型 | 基元、`string`、`enum`、`null` | 任意类型 |
| 跨程序集 | 值被内联进调用方 | 运行时读取 |
| 影响 | 改值需重编译所有引用方 | 改值只需替换定义方程序集 |

::: danger
`const` 的值会被**内联**到调用方的 IL 中。发布一个改了 `const` 值的库，依赖方若不重新编译，用的还是旧值。要跨版本热更新，用 `static readonly` 或属性。
:::

`volatile` 告诉编译器该字段可能被其他线程修改，禁止对它做缓存优化。它只保证可见性，不保证原子性；复杂同步仍要用 `Interlocked` 或 `lock`。

### 属性全解

属性是"方法对"的语法糖，外部看起来像字段。

```csharp
public class User
{
    public string Name { get; set; } = "";      // 自动属性
    public int Age { get; private set; }         // 外部只读，内部可写
    public string Email { get; init; } = "";     // 只能在初始化时设值
    public required string Id { get; set; }       // 调用方必须初始化
    public string Display => $"{Name} ({Age})";   // 表达式体，计算属性

    public void Birthday() => Age++;
}
```

**自动实现属性的本质**：编译器生成一个隐藏后备字段 `<Name>k__BackingField` 以及 `get_Name`/`set_Name` 方法。因此属性不是字段，不能 `ref` 传递。

**`init` 访问器**（C# 9）：只能在对象初始化器或构造函数中赋值，之后不可变，适合打造不可变对象。

```csharp
var u = new User { Name = "Alice", Email = "a@x.com", Id = "u1" };
// u.Email = "b@x.com";  // 编译错误
```

**`required` 成员**（C# 11）：标记调用方必须通过初始化器赋值，编译器强制检查，避免漏设关键字段。

```csharp
var u2 = new User { Name = "Bob", Id = "u2" };
// 缺少 Id 会编译错误；缺少 Name 因为默认值可以省略
// required 成员即使有默认值也必须在初始化器里出现或由构造函数满足
```

**计算属性与缓存**：计算每次访问都执行，开销大时手动缓存：

```csharp
private string? _cached;
public string Cached => _cached ??= ExpensiveCompute();
private string ExpensiveCompute() => new string('x', 1000);
```

**C# 14 的 `field` 关键字**：在属性访问器里用 `field` 直接引用编译器生成的后备字段，不用再手写 `_name`。

```csharp
// C# 14 之前
private string _name = "";
public string Name
{
    get => _name;
    set => _name = value ?? throw new ArgumentNullException(nameof(value));
}

// C# 14
public string Name
{
    get => field;
    set => field = value ?? throw new ArgumentNullException(nameof(value));
}
```

**属性 vs 字段的取舍**：对外成员一律用属性——它支持版本演进（可加逻辑/校验）、接口成员、数据绑定、序列化框架约定。字段只用于 `private` 内部状态；即便是内部状态，`readonly` 字段优先。

### 构造函数

```csharp
public class Animal
{
    public string Name { get; }
    public int Legs { get; }

    public Animal(string name) : this(name, 4) { }   // this() 链
    public Animal(string name, int legs)
    {
        Name = name;
        Legs = legs;
    }
}
```

`base()` 调用基类构造：

```csharp
public class Dog : Animal
{
    public string Breed { get; }
    public Dog(string name, string breed) : base(name, 4)
    {
        Breed = breed;
    }
}
```

**对象初始化器**允许在不写对应构造函数的情况下设置可访问的 `set`/`init` 成员：

```csharp
var dog = new Dog("Rex", "Husky") { Breed = "Malamute" }; // Breed 若 init 则可
```

`required` 与 `SetsRequiredMembers`（C# 11）：构造函数若通过特性声明"我已经设置了所有 required 成员"，调用方就不必再在初始化器里补：

```csharp
[SetsRequiredMembers]
public User(string id) => Id = id;
```

**静态构造函数**：在类型**首次被使用前**由运行时调用一次，无参数、无访问修饰符、不可直接调用，用于初始化静态状态。

```csharp
public class Singleton
{
    public static Singleton Instance { get; } = new();
    static Singleton() => Console.WriteLine("静态构造只执行一次");
    private Singleton() { }
}
```

CLR 保证静态构造函数在其他线程访问该类型前完成，天然线程安全。但它也会引入一次性的锁开销，且若初始化抛异常，类型会永久不可用。

**构造函数执行顺序**（实例化 `Derived` 时）：

1. 派生类字段初始化器
2. 基类字段初始化器
3. 基类构造函数体
4. 派生类构造函数体

::: warning
字段初始化器在**基类构造函数之前**执行，但虚方法调用会分派到派生类实现。若基类构造函数调用了虚方法，而该方法依赖还没初始化的派生类字段，会读到默认值。不要在构造函数里调用可被重写的虚方法。
:::

### 对象初始化器、集合初始化器、索引初始化器

```csharp
var p = new Point { X = 1, Y = 2 };                 // 对象初始化器
var list = new List<int> { 1, 2, 3 };               // 集合初始化器（调 Add）
var dict = new Dictionary<string, int>
{
    ["a"] = 1,                                       // 索引初始化器
    ["b"] = 2,
};
```

集合初始化器要求类型实现 `IEnumerable` 且有可访问的 `Add`（扩展方法也算）。

### 索引器

索引器让实例能像数组一样用 `[]` 访问，本质是带参数的属性。

```csharp
public class Matrix
{
    private readonly int[,] _data = new int[3, 3];

    public int this[int r, int c]              // 多参数索引器
    {
        get => _data[r, c];
        set => _data[r, c] = value;
    }
}

var m = new Matrix();
m[1, 2] = 5;
Console.WriteLine(m[1, 2]); // 输出: 5
```

配合 `Index` / `Range` 类型支持 `^`（末尾）与 `..`（范围）：

```csharp
public class Buffer
{
    private readonly int[] _items = { 0, 1, 2, 3, 4, 5 };

    public int this[Index i] => _items[i.GetOffset(_items.Length)];
    public int[] this[Range r]
    {
        get
        {
            var (start, len) = r.GetOffsetAndLength(_items.Length);
            return _items[start..(start + len)];
        }
    }
}

var buf = new Buffer();
Console.WriteLine(buf[^1]);     // 输出: 5
Console.WriteLine(string.Join(',', buf[1..4])); // 输出: 1,2,3
```

### 访问修饰符完整表

| 修饰符 | 可见范围 |
| --- | --- |
| `public` | 任何代码 |
| `private` | 仅当前类型内部 |
| `protected` | 当前类型及其派生类型 |
| `internal` | 当前程序集 |
| `protected internal` | 当前程序集 **或** 派生类型（并集） |
| `private protected` | 当前程序集中 **的** 派生类型（交集） |
| `file`（C# 11） | 仅当前源文件 |

默认可见性：**类成员默认 `private`**，顶层类型默认 `internal`，接口成员默认 `public`。

```csharp
file class Helper { }   // 只在本 .cs 文件可见，适合源生成器产物
```

### this 与 base

```csharp
public class Base
{
    public virtual void Run() => Console.WriteLine("base");
}

public class Child : Base
{
    public void Run() => Console.WriteLine("child");  // 隐藏，不是重写
    public void CallBase() => base.Run();
    public void CallSelf() => this.Run();

    public Child() : base() { }        // 调用基类构造
}
```

- `this`：引用当前实例，可用于 `this()` 构造链、区分参数与字段。
- `base`：访问基类成员（构造、方法、属性）。

## 继承与多态

### 方法默认不虚

与 Java 相反，C# 的方法**默认不可重写**。要么显式 `virtual`，要么不参与多态。

```csharp
public class A
{
    public virtual void Foo() => Console.WriteLine("A.Foo");
    public void Bar() => Console.WriteLine("A.Bar");
}

public class B : A
{
    public override void Foo() => Console.WriteLine("B.Foo");  // 重写
    public new void Bar() => Console.WriteLine("B.Bar");        // 隐藏
}

A obj = new B();
obj.Foo();   // 输出: B.Foo（多态）
obj.Bar();   // 输出: A.Bar（静态绑定到 A.Bar）
B b = new B();
b.Bar();     // 输出: B.Bar
```

`new` 隐藏的是"按静态类型解析"的成员，不参与多态。它极易造成困惑，除非有明确理由，否则用 `override`。

`override` 的成员，其可见性必须与基类一致，且不能改访问级别。要覆盖基类的 `protected` 方法，就写 `protected override`。

### abstract 与 sealed

```csharp
public abstract class Shape
{
    public abstract double Area { get; }        // 无实现的抽象属性
    public abstract void Draw();                // 抽象方法
    public virtual string Describe() => "shape"; // 有默认实现，可被重写
}

public sealed class Circle : Shape
{
    public override double Area => 3.14 * 1 * 1;
    public sealed override void Draw() { }      // 到此为止，后代不能再重写
}
```

- `abstract` 成员没有方法体，只能在抽象类中；派生类必须实现（除非自己也是抽象类）。
- `sealed` 修饰类：不能被继承。修饰 `override` 方法：不能再被重写。

### 返回类型协变（C# 9）

重写方法可以返回更派生的类型：

```csharp
public class Factory
{
    public virtual object Create() => new object();
}
public class CatFactory : Factory
{
    public override Cat Create() => new();   // 协变返回
}
```

### Object 的四个方法

```csharp
public override bool Equals(object? obj)
    => obj is Money m && Amount == m.Amount && Currency == m.Currency;

public override int GetHashCode() => HashCode.Combine(Amount, Currency);

public override string ToString() => $"{Amount} {Currency}";

// GetType() 不可重写，返回运行时精确类型（非虚，但 sealed）
Console.WriteLine(new Money(1, "CNY").GetType().Name); // 输出: Money
```

- `Equals`：默认引用相等，重写实现值相等。
- `GetHashCode`：与 `Equals` 保持一致。
- `ToString`：调试/日志友好，不应用于序列化。
- `GetType`：返回 `Type`，不可重写。

### 浅拷贝与深拷贝

`MemberwiseClone` 是 `protected` 的，做**浅拷贝**（复制值类型字段和引用字段的引用，不复制引用指向的对象）。

```csharp
public class Node : ICloneable
{
    public int Value;
    public List<int> Data = new();

    public object Clone()
    {
        var copy = (Node)MemberwiseClone();  // 浅拷贝
        copy.Data = new List<int>(Data);     // 手动深拷贝引用字段
        return copy;
    }
}
```

没有自动深拷贝；嵌套引用需要逐层处理或借助序列化。

## 抽象类 vs 接口

| 维度 | 抽象类 | 接口 |
| --- | --- | --- |
| 继承数量 | 单个 | 多个 |
| 实例字段 | 可以 | 不可以 |
| 构造函数 | 有 | 无 |
| 访问修饰 | 任意 | 成员默认 public |
| 默认实现 | 有 | C# 8 起有（默认接口成员） |
| 版本演进 | 加抽象成员破坏派生类 | 加默认成员不破坏实现类 |
| 状态 | 可持有状态 | 通常无状态 |

判断清单：

- 需要**共享状态**或**共享实现代码**、且是"is-a"关系 → 抽象类。
- 需要**多继承式能力组合**、描述"能做什么" → 接口。
- 需要**跨程序集版本演进不破坏实现方** → 接口（配合默认成员）。
- 类型层次天然存在共同基类 → 抽象类；否则接口。

## 接口深入

接口成员默认为 `public`，不能有实例字段（可以有静态字段、常量）。可以有方法、属性、索引器、事件、静态抽象成员。

### 显式接口实现

当类实现多个接口出现同名成员，或想隐藏实现细节时，用"接口名.成员名"：

```csharp
public interface IReader { string Get(); }
public interface IWriter { string Get(); }

public class Both : IReader, IWriter
{
    string IReader.Get() => "reader";
    string IWriter.Get() => "writer";
}

var b = new Both();
Console.WriteLine(((IReader)b).Get()); // 输出: reader
Console.WriteLine(((IWriter)b).Get()); // 输出: writer
// b.Get();  // 编译错误：必须转成接口
```

显式实现的成员不能加访问修饰符，且**只能通过接口调用**，因此常用来"对外隐藏"某些能力。

### 默认接口成员（C# 8）

接口方法可以带实现，实现类不强制重写：

```csharp
public interface ILogger
{
    void Log(string msg);
    void LogError(string msg) => Log($"[ERROR] {msg}"); // 默认实现
}
```

用途是 **API 演进**：给已有接口添加成员而不用改所有实现类。但要注意菱形继承问题——一个类通过多条接口路径继承到不同默认实现，编译器会强制你在类里显式重写以消除歧义（或者必须指定 `InterfaceName.Member`）。

调用限制：默认成员**不进入类的成员表**，只有通过接口引用才能调用：

```csharp
ILogger logger = concrete;
logger.LogError("boom");   // 可以
// concrete.LogError("boom"); // 不行
```

::: warning
默认接口成员无法访问实现类的实例状态，且需要运行时支持（.NET Core 3.0+）。它们适合小改动，不要指望用它来替代抽象类。
:::

### 静态抽象成员（C# 11）

接口可以声明必须在实现类型上提供的静态成员，泛型约束里可据此调用：

```csharp
public interface IParseable<TSelf> where TSelf : IParseable<TSelf>
{
    static abstract TSelf Parse(string s);
}

public struct Celsius : IParseable<Celsius>
{
    public double Value;
    public static Celsius Parse(string s) => new() { Value = double.Parse(s) };
}

T Parse<T>(string s) where T : IParseable<T> => T.Parse(s);
Console.WriteLine(Parse<Celsius>("12.5").Value); // 输出: 12.5
```

这是"静态虚成员"的落地方式，泛型数学（generic math）依赖此机制。详见第 5 篇。

### 接口继承与成员冲突

接口可以继承多个接口；类实现多个接口时，同名同签名的成员只要语义兼容可以一个实现满足所有接口；语义不同则显式实现。

## 静态类、静态成员与线程安全

```csharp
public static class MathUtil
{
    public static int Square(int x) => x * x;
}
// MathUtil m = new();  // 编译错误：静态类不能实例化
```

静态类不能被继承、不能有实例成员。扩展方法必须放在**非嵌套、非泛型的静态类**中。静态字段的初始化分两种：

- 有静态构造函数：在首次访问前执行，线程安全但有锁开销。
- 无静态构造函数：运行时可能在类型加载时提前初始化（`beforefieldinit`），时机不确定但更快。

```csharp
public static readonly DateTime Start = DateTime.UtcNow; // 无静态构造，可能提前
```

多线程下的延迟初始化用 `Lazy<T>`：

```csharp
private static readonly Lazy<Heavy> _heavy =
    new(() => new Heavy(), LazyThreadSafetyMode.ExecutionAndPublication);
```

## 扩展方法

```csharp
public static class StringExtensions
{
    public static bool IsPalindrome(this string s)
    {
        int i = 0, j = s.Length - 1;
        while (i < j)
        {
            if (s[i] != s[j]) return false;
            i++; j--;
        }
        return true;
    }
}

Console.WriteLine("level".IsPalindrome()); // 输出: True
```

规则与注意：

- `this` 参数标识被扩展的类型，方法必须在静态类的静态方法上。
- 只能访问目标类型的 **public** 成员。
- **优先级**：实例方法优先于扩展方法；同名扩展方法按命名空间 `using` 的顺序与作用域解析，容易冲突。
- 不能扩展 `static` 成员，也不能做真正的多态（编译期静态分派）。
- 滥用会污染智能提示。适合的场景是"给第三方类型加便利方法"，不适合替代自己的类型设计。

C# 14 引入**扩展成员**（extension blocks），可以扩展属性、索引器甚至静态成员：

```csharp
public static class EnumerableExtensions
{
    extension<T>(IEnumerable<T> source)
    {
        public bool IsEmpty => !source.Any();
    }
}

// Console.WriteLine(list.IsEmpty);
```

## 部分类与部分方法

`partial` 把一个类型的定义拆到多个文件，常用于源生成器与 UI 代码：

```csharp
// File1.cs
public partial class Widget
{
    public void A() => B();     // 调用 File2 中的部分方法
    partial void OnCreated();   // 声明
}

// File2.cs
public partial class Widget
{
    partial void OnCreated() => Console.WriteLine("created"); // 实现
}
```

要点：

- 部分方法必须返回 `void` 且默认 `private`（C# 9 之前）；C# 9 起可以有返回值、`out` 参数和访问修饰符，此时**必须有实现**（否则编译错误），且可以是 `static`。
- C# 13 支持**部分属性**（`partial` 属性，声明与实现分离），配合源生成器尤其有用。
- 所有 `partial` 片段必须有相同访问级别与类型名称。

## 嵌套类

```csharp
public class Outer
{
    private int _secret = 42;

    public class Inner
    {
        public int Reveal(Outer o) => o._secret; // 可访问外围私有成员
    }
}
```

嵌套类可以访问外围类型的 `private` 成员（需持有实例引用），但外围类也能访问嵌套类的 `private` 成员。适合"仅服务外围类的辅助类型"，能有效缩小作用域。

## IDisposable 模式

封装非托管资源或需要确定性释放的对象时实现 `IDisposable`。正确实现包含 `Dispose(bool)`、终结器兜底、`GC.SuppressFinalize`：

```csharp
public class ResourceHolder : IDisposable
{
    private bool _disposed;

    ~ResourceHolder() => Dispose(false);      // 仅当被 GC 回收时兜底

    public void Dispose()
    {
        Dispose(true);
        GC.SuppressFinalize(this);            // 已手动释放，通知 GC 别再调终结器
    }

    protected virtual void Dispose(bool disposing)
    {
        if (_disposed) return;
        if (disposing)
        {
            // 释放托管资源（这里可以安全访问其他托管对象）
        }
        // 释放非托管资源（此处无论 disposing 真假都可执行）
        _disposed = true;
    }
}
```

若类型不需要终结器且不会被继承，可简化并 `sealed`：

```csharp
public sealed class Simple : IDisposable
{
    public void Dispose() { /* 释放资源 */ }
}
```

调用方有两种语法：

```csharp
using (var r = new ResourceHolder())   // using 语句（块）
{
    // 作用域结束调用 Dispose
}

using var r2 = new ResourceHolder();   // using 声明（C# 8），方法结束释放
```

::: tip
`using` 展开为 `try/finally`，即使抛异常也保证 `Dispose`。多个 `using` 声明按**逆序**释放，符合资源依赖关系。
:::

## 运算符重载

可重载的运算符包括算术、比较、`!`、位运算、`true`/`false`、`++`/`--` 以及转换运算符；`=`、`&&`、`||`、`?:`、`.`、`->`、`new` 不可重载。

```csharp
public readonly struct Money
{
    public decimal Amount { get; }
    public string Currency { get; }
    public Money(decimal amount, string currency) => (Amount, Currency) = (amount, currency);

    public static Money operator +(Money a, Money b)
    {
        if (a.Currency != b.Currency) throw new InvalidOperationException();
        return new(a.Amount + b.Amount, a.Currency);
    }

    public static bool operator ==(Money a, Money b) => a.Equals(b);
    public static bool operator !=(Money a, Money b) => !a.Equals(b);

    public override bool Equals(object? o) => o is Money m && Amount == m.Amount && Currency == m.Currency;
    public override int GetHashCode() => HashCode.Combine(Amount, Currency);

    public static implicit operator decimal(Money m) => m.Amount;      // 隐式转换
    public static explicit operator Money(decimal d) => new(d, "CNY"); // 显式转换
}
```

规则：

- 重载 `==` 必须同时重载 `!=`，反之亦然；并应与 `Equals`/`GetHashCode` 保持一致。
- `implicit` 转换应"绝不会失败且不丢信息"，否则用 `explicit`。
- `operator true`/`false` 用于让类型出现在 `if` 条件中（`&&`/`||` 无法重载，但可借 `true`/`false` 参与短路逻辑）。

## 类设计准则

- **优先组合而非继承**：继承耦合基类实现，组合更容易替换与测试。
- **优先不可变**：`init` + `readonly` + `record` 让并发与推理都更简单。
- **让类型默认正确**：构造函数强制必要参数，用 `required` 堵住漏设。
- **最小化可变状态**：可变状态是 bug 与并发问题的温床。
- **类默认 `sealed`**：除非为继承设计，否则封死它，防止别人依赖你的实现细节。
- **公开 API 用接口或只读抽象**：`IReadOnlyList<T>` 优于暴露 `List<T>`。
- **`record` 用于值语义数据**：自动 `Equals`/`GetHashCode`/`ToString`/`with`，见第 5 篇。

## 常见坑

1. **以为方法默认可重写**。C# 默认不可重写，忘写 `virtual`/`override` 会导致多态失效。
2. **错用 `new` 隐藏基类方法**。静态类型不同结果不同，几乎总是应该用 `override`。
3. **在构造函数里调用虚方法**。派生类字段尚未初始化，读到默认值。
4. **重写 `Equals` 不重写 `GetHashCode`**。破坏相等性契约，哈希集合出错。
5. **`const` 跨程序集被内联**。改值后依赖方不重编译仍用旧值，改用 `static readonly`。
6. **`using` 与 `IDisposable` 忘记释放**。资源泄漏；`IDisposable` 对象一律 `using`。
7. **终结器里访问托管对象**。GC 回收顺序不定，终结器应只碰非托管资源。
8. **扩展方法期望多态分派**。它是编译期静态绑定，`IEnumerable` 上的扩展调用取决于静态类型。
9. **显式接口实现后直接调用**。成员只能通过接口引用访问，类引用调用会编译错误。
10. **默认接口成员当成抽象类用**。它无法访问实例状态，且继承链有歧义时编译强制消解。
11. **属性里做重活**。属性应廉价、无副作用，重活放方法；否则调试、绑定、序列化都会意外触发。
12. **`readonly` 字段指向可变对象**。`readonly` 只锁定引用，不锁定对象内容，集合仍可改。
