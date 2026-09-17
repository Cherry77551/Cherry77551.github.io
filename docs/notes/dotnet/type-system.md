# 1. 类型系统与值/引用类型

C# 是**静态类型**语言,而且类型系统的表达能力相当强。对写 Unity 脚本的人来说,这一篇有两个必须吃透的地基:**值类型 / 引用类型的内存模型**,以及**装箱带来的 GC 压力**——它们直接决定了 `Update()` 里能不能每帧平稳跑下去。其余部分(字面量、转换、`struct`、枚举、元组、NRT)按 Unity 里实际用得到的程度展开。

## 内置类型完整表格

C# 的关键字类型是 .NET 类型的别名。下面这张表建议记住关键几行,尤其是 `decimal` 和 `double` 的区别。

| C# 关键字 | .NET 类型 | 范围 / 说明 | 默认值 | 字节数 |
| --- | --- | --- | --- | --- |
| `sbyte` | `System.SByte` | -128 到 127 | 0 | 1 |
| `byte` | `System.Byte` | 0 到 255 | 0 | 1 |
| `short` | `System.Int16` | -32,768 到 32,767 | 0 | 2 |
| `ushort` | `System.UInt16` | 0 到 65,535 | 0 | 2 |
| `int` | `System.Int32` | -2,147,483,648 到 2,147,483,647 | 0 | 4 |
| `uint` | `System.UInt32` | 0 到 4,294,967,295 | 0 | 4 |
| `long` | `System.Int64` | ±9.22 × 10^18 | 0 | 8 |
| `ulong` | `System.UInt64` | 0 到 1.84 × 10^19 | 0 | 8 |
| `nint` | `System.IntPtr` | 与平台指针同宽(32 位平台 4 字节,64 位 8 字节) | 0 | 4/8 |
| `nuint` | `System.UIntPtr` | 同上,无符号 | 0 | 4/8 |
| `float` | `System.Single` | ±1.5 × 10^-45 到 ±3.4 × 10^38,约 7 位有效数字 | 0f | 4 |
| `double` | `System.Double` | ±5.0 × 10^-324 到 ±1.7 × 10^308,约 15–17 位有效数字 | 0d | 8 |
| `decimal` | `System.Decimal` | ±1.0 × 10^-28 到 ±7.9 × 10^28,28–29 位有效数字 | 0m | 16 |
| `bool` | `System.Boolean` | `true` / `false` | false | 1 |
| `char` | `System.Char` | UTF-16 码元,U+0000 到 U+FFFF | `'\0'` | 2 |
| `string` | `System.String` | 不可变 UTF-16 字符串序列,引用类型 | `null` | 引用 |
| `object` | `System.Object` | 所有类型的基类 | `null` | 引用 |

### `float`、`double`、`decimal` 与 `nint`

Unity 里日常只有 `float`(约 7 位有效数字,`Vector3` 就是 `float`)和偶尔的 `double`(物理高精度、`System.DateTime`)。`decimal` 是十进制浮点,能精确表示 `0.1` 这类小数,但运算慢、占 16 字节,**游戏运行时基本不用**,只在离线算金额/账单时才考虑。`double d = 0.1 + 0.2` 得不到 `0.3`,比较浮点务必留容差(见文末「常见坑」)。

`nint` / `nuint`(本机宽度整数,对应 `IntPtr` / `UIntPtr`)只在与非托管代码互操作、指针运算时出现,Unity 业务代码里用不到——知道表格里那两行即可。

## 字面量写法

```csharp
int dec = 1_000_000;          // 下划线只是分隔符,不影响值
int hex = 0xFF;               // 255
int bin = 0b1010_1010;        // 170
long big = 9_000_000_000L;    // 需要 L 后缀,否则默认 int 会溢出

float f = 1.5f;               // 不加 f 会报错: 1.5 默认是 double
double d = 1.5;               // 默认就是 double
decimal m = 1.5m;             // m 后缀必须加
```

字符转义常用的有 `'\t'`、`'\n'`、`'\''`、`'\\'`、`'\u0041'`(即 `'A'`)。`char` 是 UTF-16 码元,一个 emoji 往往占两个 `char`(代理对),要按用户感知的字符处理得用 `Rune`(见文末「常见坑」)。

原始字符串字面量(C# 11)适合 JSON / 正则 / 路径,可完全避免转义;结束引号所在行的缩进会从内容中裁掉:

```csharp
string json = """
    { "name": "C#", "path": "C:\\temp" }
    """;
```

## 转换:隐式、显式、Convert、Parse

### 隐式转换

不需要写任何东西,编译器保证安全(不会丢信息)。安全方向大致是:

```text
byte → short → int → long ─┬─→ float → double
                           └─→ decimal
char → int → ...
```

```csharp
int i = 42;
long l = i;              // int → long,安全
double d = i;            // int → double,安全
int small = (int)100L;   // 反过来要显式
```

### 显式转换(强制类型转换)

```csharp
double d = 9.99;
int i = (int)d;             // 截断小数,不是四舍五入 → 9

long big = 3_000_000_000;
int wrapped = (int)big;     // 溢出,静默回绕 → -1294967296
```

::: warning
默认 `unchecked` 上下文中,整数溢出**不会抛异常**,只会回绕。需要检查时用 `checked` 语句块或 `checked(a + b)`,溢出抛 `OverflowException`;项目级可在 `.csproj` 设 `<CheckForOverflowUnderflow>true</CheckForOverflowUnderflow>`。Unity 里溢出通常来自帧计数、时间累加。
:::

### `Convert` 类

`Convert` 处理从 `string` / `object` 的转换,按**四舍五入**而非截断转换小数,`null` 变成默认值而不是抛异常:

```csharp
int i = Convert.ToInt32(3.9);           // 4,注意和 (int)3.9 == 3 不同
int fromNull = Convert.ToInt32(null);   // 0
```

### `Parse` / `TryParse`

```csharp
int n = int.Parse("123");               // 失败抛 FormatException

// 推荐: TryParse 一次完成"判断 + 取值"
if (int.TryParse("abc", out int value))
{
    Console.WriteLine(value);
}
else
{
    Console.WriteLine("不是合法整数");   // 输出: 不是合法整数
}

// out var 内联声明
if (DateTime.TryParse("2026-09-17", out var date))
{
    Console.WriteLine(date.Year);       // 输出: 2026
}
```

`TryParse` 的模式叫 **Try 模式**,BCL 里到处在用(`Dictionary.TryGetValue`、`DateTime.TryParse`、`Guid.TryParse`),自定义类型也推荐遵循这个命名和 `out` 参数约定。

## 值类型与引用类型

### 定义与分类

**值类型**的变量直接包含数据本身;**引用类型**的变量存储一个指向堆上对象的引用(类似指针,但被 GC 管理)。

属于**值类型**:所有数值类型、`bool`、`char`、`enum`、`Nullable<T>`、元组 `(int, string)`(`ValueTuple` 结构体)、`struct` 及其衍生形式(`readonly struct`、`ref struct`、`record struct`)、指针(unsafe)。

属于**引用类型**:`class`、`interface`、`delegate`、`string`、`object`、数组、`record`(class 形式)、匿名类型,以及**装箱后的值类型**。

### 赋值行为差异

```csharp
// 值类型: 复制数据
int a = 10;
int b = a;
b = 20;
Console.WriteLine(a);    // 输出: 10
Console.WriteLine(b);    // 输出: 20

// 引用类型: 复制引用,指向同一个对象
var list1 = new List<int> { 1, 2 };
var list2 = list1;
list2.Add(3);
Console.WriteLine(list1.Count);   // 输出: 3

// struct 里包含引用字段时,行为是"浅拷贝"
struct Wrapper { public List<int> Items; }
var w1 = new Wrapper { Items = new List<int>() };
var w2 = w1;
w2.Items.Add(99);
Console.WriteLine(w1.Items.Count);  // 输出: 1,因为 List 引用被复制了
```

### 内存布局:澄清"值类型一定在栈上"

这是被传播最广的错误说法之一。准确的规则是:

> 值类型的**存储位置取决于它被声明在哪里**,而不是"值类型天然在栈上"。

具体规则:

| 声明位置 | 存储位置 |
| --- | --- |
| 方法里的局部变量 | 栈(如果该变量被 lambda 或迭代器捕获,则被提升到**堆**上的闭包对象里) |
| 类的字段 | **堆**(跟着所属对象走) |
| struct 的字段 | 跟着外层 struct 走,外层在哪它就在哪 |
| 数组元素 | **堆**(数组对象本身在堆上) |
| `async` 方法里跨 `await` 存活的局部变量 | 被提升到状态机对象,**堆** |
| 装箱后的值类型 | **堆** |
| `ref struct`(如 `Span<T>`) | 强制栈,不能装箱、不能当字段 |

```csharp
class Holder
{
    public int Value;     // 堆上,随 Holder 实例
}

void Demo()
{
    int local = 1;                      // 栈
    Holder h = new Holder();            // h 引用在栈,对象在堆
    int[] arr = new int[10];            // arr 引用在栈,10 个 int 在堆
    int captured = 5;
    Action act = () => Console.WriteLine(captured);  // captured 被提升到堆
}
```

::: warning
"值类型在栈上"这个说法在 90% 的场景下不会造成 bug,但它会误导你对闭包分配、数组访问性能、`async` 状态机开销的判断。记住正确的判断标准:**看它是不是某个堆对象的字段、是不是被捕获、是不是装箱了**。
:::

::: tip
Unity 视角:类字段和数组元素是值类型最常"上堆"的地方——`Vector3[]`、`Transform[]` 数组自己在堆上;`Update()` 里被 lambda 捕获的局部 `int` / `Vector3` 也会被提升到堆上的闭包。这些就是 Profiler 里要盯的分配点。
:::

## `struct` 完整讲解

### 什么时候该用 struct

判断标准(官方建议,基本可以直接照用):

1. 实例很小,通常不超过 16 字节。
2. 生命周期短,通常是临时值。
3. 语义上是一组**不可变**的数据,行为上像数值(比如 `Point`、`Money`、`RgbColor`)。
4. **不需要**继承和多态。

反面例子:一个带 20 个字段的"实体"、需要被频繁装箱放进 `object` 的东西、需要引用语义共享状态的东西——都该用 class。

```csharp
public readonly struct Point
{
    public double X { get; }
    public double Y { get; }

    public Point(double x, double y) => (X, Y) = (x, y);

    public double DistanceTo(Point other)
    {
        var dx = X - other.X;
        var dy = Y - other.Y;
        return Math.Sqrt(dx * dx + dy * dy);
    }

    public override string ToString() => $"({X}, {Y})";
}
```

::: tip
Unity 视角:Unity 的序列化系统只认特定类型——`public` 字段、`[SerializeField]` 的普通字段、`enum`,以及标了 `[Serializable]` 的 class/struct。`readonly struct` 的只读自动属性 Inspector 里看不到,想让 struct 出现在 Inspector 里,就用普通可写字段并标 `[Serializable]`。
:::

### 构造规则

- 每个构造函数**必须**给所有字段赋值,否则编译错误;无参构造函数 C# 10 起可声明,同样要赋值。
- 不能有字段初始化器(除非 C# 10+ 且有显式构造函数)。
- struct 不能有析构函数,不能继承(但可以实现接口)。

```csharp
public struct Version
{
    public int Major { get; set; }
    public Version() => Major = 1;   // C# 10+,必须赋初值
}

Console.WriteLine(default(Version).Major);   // 0,default 绕过构造函数,直接全零
Console.WriteLine(new Version().Major);      // 1
```

### `default` 初始化全零

任何值类型的 `default` 都是"所有字节置零":数值是 0,`bool` 是 `false`,`char` 是 `'\0'`,引用字段是 `null`。

```csharp
Point p = default;
Console.WriteLine(p.X);         // 输出: 0

// 数组、集合里的元素天然就是 default
Point[] points = new Point[3];
Console.WriteLine(points[0].X); // 输出: 0
```

这也解释了为什么 struct 里的引用字段可能是 `null`——如果你没显式构造它,`default` 就是 `null`。

### `readonly struct`

加 `readonly` 后,所有实例字段和自动属性必须是只读的,而且所有实例方法都不能修改状态(编译器会验证)。

```csharp
public readonly struct Temperature
{
    public double Celsius { get; }
    public Temperature(double c) => Celsius = c;
    public double ToFahrenheit() => Celsius * 9 / 5 + 32;
}
```

为什么要加 `readonly`?因为调用非 readonly struct 的方法时,如果这个 struct 是通过 `in` 参数或 `readonly` 字段访问的,编译器必须**先复制一份**再调用,防止方法修改原值。加上 `readonly` 就免掉了这次复制。

```csharp
public double Sum(in Point a, in Point b)
{
    // 如果 Point 不是 readonly struct,a.AreaX() 这类调用会触发防御性拷贝
    return a.X + b.X;
}
```

### `ref struct`

`ref struct` 强制只在栈上,**不能装箱、不能当字段、不能用在 `async` / 迭代器里**。`Span<T>` 就是 `ref struct`,用于零分配的栈上数据视图:

```csharp
Span<int> span = stackalloc int[3] { 1, 2, 3 };
```

代价是它不能逃逸出当前栈帧,所以不能从方法里 `return` 一个指向局部内存的 `Span`。

### `record struct`

`record struct` 是值类型版的 `record`,自动生成值相等性、`ToString`、`with` 表达式等:

```csharp
public record struct Money(decimal Amount, string Currency);

var a = new Money(10m, "CNY");
var b = a with { Amount = 20m };
Console.WriteLine(a == new Money(10m, "CNY"));   // 输出: True
Console.WriteLine(b);                            // 输出: Money { Amount = 20, Currency = CNY }
```

`readonly record struct` 可以同时获得值语义和不可变性,是定义"小数据载体"的常用写法。

### 默认 `Equals` 的性能问题

`ValueType.Equals` 的默认实现是**反射式逐字段比较**——这是个性能陷阱,而且对含引用字段的 struct 会做字段的 `Equals` 调用,可能语义上也不是你要的:

```csharp
struct BadPoint { public int X; public int Y; }

var a = new BadPoint { X = 1, Y = 2 };
var b = new BadPoint { X = 1, Y = 2 };
Console.WriteLine(a.Equals(b));   // True,但内部走反射,慢
Console.WriteLine(a == b);        // 编译错误!struct 默认不支持 ==
```

正确做法:实现 `IEquatable<T>` 并重写 `Equals` / `GetHashCode`(`HashCode.Combine` 组合字段),再补上 `==` / `!=`:

```csharp
struct GoodPoint : IEquatable<GoodPoint>
{
    public readonly int X, Y;
    public GoodPoint(int x, int y) => (X, Y) = (x, y);

    public bool Equals(GoodPoint other) => X == other.X && Y == other.Y;
    public override int GetHashCode() => HashCode.Combine(X, Y);
    public static bool operator ==(GoodPoint l, GoodPoint r) => l.Equals(r);
    public static bool operator !=(GoodPoint l, GoodPoint r) => !l.Equals(r);
}
```

这还有第二个好处:放进 `Dictionary<TKey, TValue>` / `HashSet<T>` 时,泛型容器直接调用强类型 `Equals`,**避免装箱**。

## `class` 简述

`class` 是引用类型,支持继承、多态、虚方法、抽象成员、接口实现。这里只给最小示例,细节见第 3 篇。

```csharp
public abstract class Shape
{
    public string Name { get; init; } = "shape";
    public abstract double Area();
}

public sealed class Circle : Shape
{
    public required double Radius { get; init; }
    public override double Area() => Math.PI * Radius * Radius;
}

Shape s = new Circle { Radius = 2 };
Console.WriteLine(s.Area());     // 输出: 12.566370614359172
```

## 装箱与拆箱

### 什么是装箱

**装箱(boxing)** 是把值类型转成 `object` 或接口引用的过程:CLR 在**堆上**分配一个新对象,把值复制进去。**拆箱(unboxing)** 是把那个堆对象里的值复制回来。

```csharp
int i = 42;
object o = i;            // 装箱: 堆分配 + 复制
int j = (int)o;          // 拆箱: 复制回来
```

### 什么时候发生

1. 值类型赋给 `object`、`dynamic`、`ValueType`。
2. 值类型赋给接口引用,且该接口**不是**由泛型约束指定的(比如 `IComparable` 而非 `IComparable<T>`)。
3. 非泛型集合:`ArrayList`、`Hashtable`。
4. 在值类型上调用 `object` 的虚方法(除非该类型重写了它),比如 `GetHashCode`、`ToString`。
5. `string.Format` / 字符串插值里,如果插值参数是值类型且没有走泛型重载。

```csharp
var list = new System.Collections.ArrayList();
list.Add(1);             // 装箱
list.Add(2);             // 装箱
int first = (int)list[0]; // 拆箱

// 泛型集合不装箱
var generic = new List<int> { 1, 2 };
int g = generic[0];      // 无装箱
```

### 性能代价

每次装箱都是一次托管堆分配:对象头约 16 字节 + 值本身,并直接增加 GC 压力。用 `GC.GetAllocatedBytesForCurrentThread()` 能量出差异——循环 `object boxed = i;` 十万次约分配 2.4 MB,而 `sum += i;` 是 0。

::: danger
Unity 视角:装箱是游戏卡顿最常见的托管分配来源之一。`Update()` / 物理回调里每帧装箱(把值类型塞进 `object`、非泛型集合、`Enum.HasFlag` 的参数、`string.Format` 等),会持续触发 GC,表现为周期性掉帧。热路径优先泛型集合、`IEquatable<T>` 和插值字符串处理器。
:::

### 如何避免

1. **优先用泛型集合**:`List<T>`、`Dictionary<TKey,TValue>`、`HashSet<T>`,而不是 `ArrayList`、`Hashtable`。
2. **实现 `IEquatable<T>`**:让泛型容器调用强类型比较,同时顺便避免 `ValueType.Equals` 的反射开销。
3. **用 `string.Create` / 插值处理器的重载**:C# 10 的插值字符串处理器 `DefaultInterpolatedStringHandler` 已经在常见场景下避免了装箱,但显式 `string.Format` 仍然会装箱。
4. **用 `Span<T>` / `ReadOnlySpan<T>` / `Memory<T>`** 处理数据切片,避免数组拷贝和中间对象。
5. **尽量避免把值类型当 `object` 传参**,能加泛型约束就加。
6. `ValueTuple` 作为多返回值时不装箱,这比返回 `object[]` 好得多。

::: tip
.NET 对小的整数值(-1 到 8 之类)有**装箱缓存**,`object o = 5;` 这类小常量可能复用同一个对象,但这只是实现细节,不能当优化依据——不要依赖它,更不要写 `ReferenceEquals` 比较装箱值。
:::

## `Nullable<T>`:值类型可空

`int?` 是 `System.Nullable<int>` 的语法糖,它是一个 struct,有两个成员:`bool HasValue` 和 `T Value`。

```csharp
int? maybe = 42;
if (maybe.HasValue)
{
    Console.WriteLine(maybe.Value);      // 输出: 42
}
Console.WriteLine(maybe.GetValueOrDefault());      // 输出: 42
Console.WriteLine(maybe.GetValueOrDefault(-1));    // 输出: 42
maybe = null;
Console.WriteLine(maybe.GetValueOrDefault(-1));    // 输出: -1
```

### 与 `null` 比较

```csharp
int? x = null;
Console.WriteLine(x == null);       // 输出: True
Console.WriteLine(x.HasValue);      // 输出: False
Console.WriteLine(x < 5);           // 输出: False,null 的比较总是 false

// 注意: 直接读 Value 会抛异常
try { _ = x.Value; }
catch (InvalidOperationException) { Console.WriteLine("InvalidOperationException"); }
```

这个"null 参与的关系比较总是 false"的行为在 `Where` 里会有意外效果:

```csharp
int?[] nums = { 1, null, 3, null, 5 };
var filtered = nums.Where(n => n > 2).ToArray();
Console.WriteLine(string.Join(",", filtered));    // 输出: 3,5
```

### 提升运算符与 LINQ

C# 会自动为 `int?` 提升 `+`、`-`、`==` 等运算符:任一操作数为 null,结果就是 null(`a + b` 为 null,`a + 1` 为 6)。LINQ 的 `Sum` / `Average` / `Max` 会**跳过** null 元素。注意 `null < 5` 恒为 `false`,所以 `Where(n => n > 2)` 会自然过滤掉 null。

::: warning
`int?` 不等于 `int`,不能直接赋给 `int` 参数,必须 `.Value`(可能抛异常)或者 `?? 0`(指定默认值)。最常见的选择是显式给出业务默认值,而不是盲目 `.Value`。
:::

## 可空引用类型(Nullable Reference Types)

### 为什么需要它

`null` 是最常见的运行时错误来源。**NRT(Nullable Reference Types)** 让编译器对引用类型的可空性做静态检查,2019 年随 .NET Core 3.0 引入。

关键点:**NRT 是编译期静态分析,运行时没有任何行为变化**——`string` 和 `string?` 在 IL 里是同一个类型。在 `.csproj` 里 `<Nullable>enable</Nullable>` 开启,或在文件内用 `#nullable enable` / `#nullable restore` 局部开关。

::: tip
Unity 视角:Unity 默认模板不开 NRT,自己写脚本不必强求;但读第三方库、官方包或较新项目的代码时会大量遇到 `string?`、`!` 和 `[NotNullWhen]`,需要能看懂。下面按"看别人代码够用"的深度介绍。
:::

```csharp
#nullable enable

string notNull = "hello";
string? maybeNull = null;

Console.WriteLine(notNull.Length);      // OK
Console.WriteLine(maybeNull.Length);    // CS8602: 解引用可能为 null 的引用
```

常见警告码:CS8600(把可能为 null 的值赋给非可空变量)、CS8602(解引用可能为 null)、CS8618(构造函数退出时不可空字段可能为 null,常用 `required`、`string?` 或 `= null!` 处理)、CS8625(传 null 给不可空参数)、CS8629(Nullable 的 `Value` 可能无效)。

### `!` 抑制符

当你比编译器更确定某个值不是 `null` 时,用 `null-forgiving operator` 让它闭嘴:

```csharp
string? config = GetConfig();
Console.WriteLine(config!.Length);   // 你确定这里不为 null,并承担风险
```

::: danger
`!` 不做任何运行时检查,只是让编译器**不再报警**,判断错了照样 `NullReferenceException`。只在外部框架保证非空(如 DI)并写注释说明原因时使用,生产逻辑能显式判空就别用。
:::

### 空条件运算符与空合并

```csharp
string? name = null;

int? length = name?.Length;             // ?. 在 null 时短路,返回 null
int[]? arr = null;
int? first = arr?[0];                   // ?[] 是索引器版本

string display = name ?? "(未命名)";    // ?? 提供默认值
string? cache = null;
cache ??= "computed";                   // ??= 只在左侧为 null 时赋值

string city = order?.Buyer?.Home?.City ?? "未知";   // 链式处理深层嵌套
```

### 在属性/参数/返回值上标注

标注可以更精确:`User? Find(int id)` 表示返回值可能为 null,`void Save(User? user)` 表示参数允许 null。`[NotNullWhen(true)] out User? user` 这类叫**流分析特性**,让编译器知道"返回 true 时 user 一定非 null";同类还有 `[MaybeNullWhen]`、`[NotNull]` / `[MaybeNull]`、`[AllowNull]` / `[DisallowNull]`。

在泛型约束里,`where T : notnull` 表示"不允许可为 null 的类型实参":它接受 `int`、`string`,但不接受 `int?`、`string?`。

## 类型检查与转换:`is`、`as`、`typeof`、`GetType`

```csharp
object obj = "hello";

// is 判断类型,不抛异常;模式可组合属性与条件
if (obj is string s)
{
    Console.WriteLine(s.Length);        // 输出: 5
}
if (obj is string { Length: > 3 } str)
{
    Console.WriteLine(str);             // 输出: hello
}

object value = 42;
if (value is int n and > 0 and < 100)
{
    Console.WriteLine($"小的正整数: {n}");   // 输出: 小的正整数: 42
}
```

### 为什么 `as` 不抛异常

`as` 在类型不兼容时返回 `null`,而非抛 `InvalidCastException`。代价是**它只能用于引用类型和可空值类型**:值类型不可能是 `null`,所以 `someObj as int` 编译不过,要写 `someObj as int?`。

```csharp
object obj = "hello";
string? s = obj as string;             // 成功
int? i = obj as int?;                  // 失败,返回 null
```

选择建议:`as` 用于"怀疑类型可能不对,想自己处理失败";强制转换用于"类型绝对正确,错了就是要炸"。

### `typeof` 与 `GetType()`

```csharp
Type t1 = typeof(string);          // 编译期就知道的类型
Type t2 = "hello".GetType();       // 运行时对象的实际类型
Console.WriteLine(t1 == t2);       // 输出: True
Console.WriteLine(t1.IsValueType); // 输出: False
```

::: warning
`GetType()` **不是 `virtual`**,不能被重写,任何对象返回的都是它的**真实运行时类型**。另外 `obj is T` 与 `obj.GetType() == typeof(T)` 语义不同:`is` 会匹配子类,后者只在**完全相等**时成立——例如 `"hello".GetType() == typeof(object)` 是 `False`。
:::

## 枚举 `enum`

枚举是值类型,底层默认是 `int`,可以显式指定为任意整数类型。

```csharp
public enum Status
{
    Pending,      // 0
    Active,       // 1
    Suspended,    // 2
    Deleted = 99  // 显式赋值
}

public enum Priority : byte
{
    Low = 1,
    High = 2
}
```

### `[Flags]` 位标志

```csharp
[Flags]
public enum Permissions
{
    None    = 0,
    Read    = 1 << 0,   // 1
    Write   = 1 << 1,   // 2
    Execute = 1 << 2,   // 4
    All     = Read | Write | Execute
}

var perms = Permissions.Read | Permissions.Write;
Console.WriteLine(perms);                              // 输出: Read, Write
Console.WriteLine(perms.HasFlag(Permissions.Read));    // 输出: True
Console.WriteLine(perms.HasFlag(Permissions.Execute)); // 输出: False

// 添加与移除
perms |= Permissions.Execute;
perms &= ~Permissions.Write;
Console.WriteLine(perms);                              // 输出: Read, Execute
```

`[Flags]` 的价值在于 `ToString()` 会输出逗号分隔的标志名;没有它只会输出数字。`HasFlag` 有轻微装箱开销(参数是 `Enum`),性能敏感处可以直接位运算:

```csharp
bool canRead = (perms & Permissions.Read) == Permissions.Read;
```

### 与字符串互转

```csharp
Status s = Enum.Parse<Status>("Active");                        // 失败抛异常
bool ok = Enum.TryParse<Status>("nope", out var parsed);        // false
Console.WriteLine(Status.Deleted.ToString());                  // 输出: Deleted
Console.WriteLine((int)Status.Deleted);                        // 输出: 99

foreach (Status v in Enum.GetValues<Status>())                  // 遍历所有值
{
    Console.WriteLine($"{v} = {(int)v}");
}
```

::: warning
`Enum.TryParse` 对**任何数字字符串**都会返回 `true`,即使该数字不是已定义的值(它还会忽略大小写、接受逗号组合)。验证外部输入时还要用 `Enum.IsDefined` 确认:

```csharp
if (Enum.TryParse<Status>("123", out var st) && Enum.IsDefined(st)) { }
```
:::

## 匿名类型

`new { ... }` 在编译期生成一个只读的引用类型,属性名、类型、顺序完全一致时视为同一类型,`Equals` 按值比较:

```csharp
var a = new { X = 1, Y = 2 };
var b = new { X = 1, Y = 2 };
Console.WriteLine(a.Equals(b));                 // 输出: True
// a.X = 3;                                     // 编译错误: 属性只读
```

LINQ 投影里很常用:

```csharp
var summary = orders
    .GroupBy(o => o.Customer)
    .Select(g => new { Customer = g.Key, Sum = g.Sum(o => o.Total) })
    .ToList();
```

局限:不能作为方法返回值(那样要转 `object`,从而装箱)、不能跨程序集、属性不可变、不能加方法。需要这些能力就用 `record`。

## 元组

### `ValueTuple` vs `Tuple`

| | `ValueTuple`(`(int, string)`) | `Tuple<int, string>` |
| --- | --- | --- |
| 类型 | 值类型(struct) | 引用类型(class) |
| 分配 | 栈上,无 GC 压力 | 堆分配 |
| 命名元素 | 支持 | 不支持 |
| 相等性 | 按值 `==` 可用 | 引用相等,需要 `.Equals` |
| 可变性 | 字段可变 | 属性只读 |
| 推荐 | 是 | 否(历史遗留) |

```csharp
var modern = (Id: 1, Name: "a");       // ValueTuple,带命名
Console.WriteLine(modern.Name);        // 输出: a
Console.WriteLine(modern.Item2);       // 输出: a,ItemN 依然可用
```

### 解构与相等性

```csharp
(int id, string name) = GetUser();     // 解构
var (first, _) = GetPair();            // 用弃元忽略不关心的值

int x = 1, y = 2;
(x, y) = (y, x);                       // 交换,不需要临时变量

var t1 = (1, "a");
var t2 = (1, "a");
Console.WriteLine(t1 == t2);           // 输出: True,ValueTuple 按值比较
```

### 用元组返回多值

```csharp
public (bool Success, string? Error) Validate(string input)
{
    if (string.IsNullOrWhiteSpace(input))
        return (false, "输入为空");
    return (true, null);
}

var (ok, error) = Validate("");
if (!ok)
{
    Console.WriteLine(error);           // 输出: 输入为空
}
```

超过 3 个返回值时,元组的可读性会下降,这时考虑定义一个 `record`。元组返回多值比 `out` 参数更清晰,也能用于异步方法(`async Task<(int, string)>`)。

## `var` 与显式类型

`var` 是**编译期类型推断**,不是动态类型。IL 里类型是确定的,运行时没有区别。

```csharp
var list = new List<int>();          // List<int>
var count = 10;                      // int
var name = "x";                      // string
var tuple = (1, "a");                // (int, string)
```

适合用:右侧类型显而易见(`var users = new List<User>();`)、匿名类型(**必须**用)、LINQ 链式结果、泛型嵌套很深时。
**不要**用:右侧看不出类型(`var x = Get();` 应写成 `User x = Get();`)、数值字面量(`var total = 0;` 掩盖了它该是 `decimal` 还是 `int`)。

```csharp
var total = 0;          // 危险: 推断为 int,后面 += 0.1m 会编译错误
decimal total2 = 0m;    // 清楚
```

团队约定常用 `.editorconfig` 的 `csharp_style_var_*` 规则约束。

## 类型别名

`using` 别名在文件顶部声明,作用域是整个文件;C# 12 起还能指向元组、数组、`nullable` 等任意类型:

```csharp
using IntPair = (int X, int Y);
using Matrix = double[][];
using CustomerId = System.Guid;
using MaybeInt = int?;

CustomerId id = Guid.NewGuid();
```

::: warning
别名是**编译器特性**,不会创建新类型:`CustomerId` 和 `Guid` 完全等价,做不到类型安全包装(那要用 `record struct CustomerId(Guid Value)`)。别名只在当前文件有效。
:::

## `default` 值表

| 类型 | `default` 值 |
| --- | --- |
| 所有整数类型 | `0` |
| `float` / `double` / `decimal` | `0` |
| `bool` | `false` |
| `char` | `'\0'`(U+0000) |
| `enum` | 底层类型的 `0`(即使没定义值为 0 的成员) |
| `struct` | 所有字段为各自 `default`,即全零 |
| `Nullable<T>` | `null`(`HasValue == false`) |
| 引用类型(`string`、数组、class) | `null` |
| 元组 | 每个元素各自的 `default` |
| 指针 | `null` |

```csharp
Console.WriteLine(default(int));            // 输出: 0
Console.WriteLine(default(bool));           // 输出: False
Console.WriteLine(default(char) == '\0');   // 输出: True
Console.WriteLine(default(string) is null); // 输出: True
Console.WriteLine(default(int?));           // 输出: (空行)

// 也可以在表达式里用
int[] nums = new int[3];                    // 全为 0
```

## 常见坑

**1. 浮点相等比较。**
永远不要写 `if (a == b)` 比较 `double`。用容差:

```csharp
double a = 0.1 + 0.2;
double b = 0.3;
Console.WriteLine(a == b);                          // 输出: False
Console.WriteLine(Math.Abs(a - b) < 1e-10);         // 输出: True
```

**2. `decimal` 除法丢精度。**
`decimal` 能精确表示十进制小数,但除法可能产生无限小数,会被截断到 28 位;金额计算要显式 `decimal.Round(price, 2, MidpointRounding.ToEven)`。

**3. `int` 除法截断。**
`int / int` 结果还是 `int`,小数部分直接丢掉:

```csharp
Console.WriteLine(5 / 2);               // 输出: 2
Console.WriteLine(5 / 2.0);             // 输出: 2.5(有一个 double 就提升)
Console.WriteLine((double)5 / 2);       // 输出: 2.5
Console.WriteLine(5 % 2);               // 输出: 1
```

计算百分比时尤其要注意:`done / total * 100` 如果两个都是 `int`,结果几乎永远是 0 或 100。

**4. 数值与字符串互转的文化差异。**
`"1,234.5"` 在 en-US 下能解析,在 de-DE 下 `.` 是千分位、`,` 是小数点,结果完全不同。

::: danger
`double.Parse(s)` / `Convert.ToDouble(s)` 默认用 `CurrentCulture`,同一份输入在不同机器上可能解析出不同结果。**解析机器可读数据(存档、配置、网络协议)永远传 `CultureInfo.InvariantCulture`;只在面向最终用户显示/输入时用 `CurrentCulture`。**
:::

**5. `GetHashCode` 与 `Equals` 契约。**
两个对象 `Equals` 为 `true` 时,`GetHashCode` **必须**相等(反之不要求)。只重写 `Equals` 不重写 `GetHashCode`,会让 `HashSet` / `Dictionary` 查不到本该命中的元素;用 `HashCode.Combine` 组合参与比较的字段即可。

**6. 字符串 `==` 与 `object` 上 `==` 的区别。**
`string` 重载了 `==`,做的是**值比较**;但字符串装进 `object` 后就变成引用比较:

```csharp
string a = new string("hello");
string b = new string("hello");
Console.WriteLine(a == b);                                        // True
Console.WriteLine((object)a == (object)b);                        // False
Console.WriteLine(string.Equals(a, b, StringComparison.Ordinal)); // True
```

需要明确语义时用 `string.Equals(x, y, StringComparison.Ordinal)` 或 `OrdinalIgnoreCase`,不要依赖 `==` 的隐式选择。

**7. 值类型做字典键忘记实现 `IEquatable<T>`。**
默认的 `ValueType.Equals` 走反射,放进 `Dictionary` 会慢一个数量级,而且可能因为装箱产生额外分配。自定义 struct 作为键时,一定实现 `IEquatable<T>` 并重写 `GetHashCode`。

**8. 可空值类型参与算术后被当成非空。**
`int? a = null; int b = a.Value;` 会抛 `InvalidOperationException`,不是编译错误。用显式合并或 `GetValueOrDefault` 更安全。

**9. `default` 枚举值可能不存在。**
`(Status)12345` 是完全合法的,`Enum.IsDefined` 才是判断依据。反序列化外部数据后一定要校验。

**10. `char` 不等于"一个字符"。**
`char` 是 UTF-16 码元,一个 emoji 往往占两个 `char`(代理对)。要按"用户感知的字符"处理,用 `System.Globalization.StringInfo` 或者 `Rune`:

```csharp
string surrogate = "\uD842\uDFB7";                          // U+20BB7,CJK 扩展 B 区汉字
Console.WriteLine(surrogate.Length);                        // 输出: 2,不是 1
Console.WriteLine(surrogate.EnumerateRunes().Count());      // 输出: 1
```

**11. `UnityEngine.Object` 的 `==` 是重载过的。**
Unity 的 `Object` 重载了 `==` / `!=`,用来判断"底层原生对象是否已销毁"。被 `Destroy` 的组件 `comp == null` 会返回 `true`,这是 Unity 的特殊语义,不是 .NET 的引用相等。销毁判断永远用 `== null`,别用 `ReferenceEquals` 或 `?.`。

**12. 把 struct 当引用类型用。**
`Vector3 a = b;` 复制的是值,改 `a` 不影响 `b`;从 `List<Vector3>` 取出元素修改,改的是副本,必须写回 `list[i] = v`。`struct` 内部的引用字段(如一个 `List`)则是浅拷贝,两边共享同一个对象。
