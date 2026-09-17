# 2. 类型系统与值/引用类型

C# 是**静态类型**语言,而且类型系统的表达能力相当强:既有值类型/引用类型的两分,又有可空标注、模式匹配、元组、匿名类型。这一篇从内置类型表开始,一路讲到装箱、可空引用类型、`struct` 的语义,最后收在几个日常最容易翻车的转换和相等性问题上。

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

### `decimal` 还是 `double`

这是新手做业务最容易做错的选择。两者的差异不是精度高低,而是**表示方式**:

- `double` 是 IEEE 754 二进制浮点。`0.1` 用二进制**无法精确表示**,只能存一个近似值。
- `decimal` 是十进制浮点(内部按 10 的幂次存储尾数),能精确表示 `0.1`、`0.2` 这类十进制小数。

```csharp
double d = 0.1 + 0.2;
Console.WriteLine(d);                  // 输出: 0.30000000000000004
Console.WriteLine(d == 0.3);           // 输出: False

decimal m = 0.1m + 0.2m;
Console.WriteLine(m);                  // 输出: 0.3
Console.WriteLine(m == 0.3m);          // 输出: True
```

**结论:任何涉及金额、税率、账单、库存数量的计算,一律用 `decimal`。** `double` 留给科学计算、图形、机器学习、几何——这些场景里速度和动态范围比十进制精确更重要。

代价:`decimal` 的运算比 `double` 慢(软件实现,没有 FPU 指令加速),内存占用是两倍。所以不要在循环里拿它做上亿次运算。

### `nint` / `nuint` 是什么

这两个类型从 C# 9 起有了正式关键字(之前只能写 `IntPtr`),代表**本机大小的整数**,宽度等于当前平台的指针宽度。主要用于:

1. 与非托管代码互操作(设备驱动、C API)。
2. 高性能数学库、`Span` 索引运算。
3. 需要"和指针一样宽"的计数,避免 32 位溢出。

```csharp
nint size = IntPtr.Size;
Console.WriteLine(size);        // 64 位进程输出: 8

// 支持算术运算
nint a = 10;
nint b = a * 2;
Console.WriteLine(b);           // 输出: 20
```

::: warning
`nint` 不是 `int`。虽然它支持算术、比较,但 `int` 到 `nint` 的隐式转换只在安全方向存在,反过来需要显式转换。把 `nint` 用在普通业务逻辑里会降低可读性,除非你确实在处理指针宽度。
:::

## 字面量写法

### 整数进制与分隔符

```csharp
int dec = 1_000_000;          // 十进制,下划线只是分隔符,不影响值
int hex = 0xFF;               // 255
int bin = 0b1010_1010;        // 170
int oct = 0o777;              // 511

long big = 9_000_000_000L;    // 需要 L 后缀,否则默认 int 会溢出
uint u = 42U;
ulong ul = 42UL;
```

下划线可以放在数字之间任意位置,但不能在开头(那是标识符)、结尾或紧邻小数点。`0x` 后也可以用。

### 浮点后缀

```csharp
float f = 1.5f;      // 不加 f 会报错: 1.5 默认是 double
double d = 1.5;      // 默认就是 double
double d2 = 1.5d;    // d 后缀可选
decimal m = 1.5m;    // m 后缀必须加
decimal m2 = 1e10m;  // 科学计数法 + m
```

### 字符转义

```csharp
char tab = '\t';
char newline = '\n';
char quote = '\'';
char backslash = '\\';
char unicode = '\u0041';       // 'A'
char surrogate = '\uD83D';     // 代理项的高半部分
char escape = '\e';            // C# 13 新增: ESC 字符,等价于 \u001B
```

C# 13 加入的 `\e` 简化了 ANSI 转义序列的写法(以前要写 `\u001B` 或 `\x1B`):

```csharp
Console.WriteLine("\e[31m红色\e[0m");   // 终端里输出红色文字
```

原始字符串字面量(C# 11)可以完全避免转义,尤其适合 JSON / 正则 / 路径:

```csharp
string json = """
    {
        "name": "C#",
        "path": "C:\\temp"
    }
    """;
```

`"""` 的缩进规则:结束引号所在行的缩进会被从所有内容行中裁掉。单行原始字符串用 `"""..."""` 即可:

```csharp
string path = """C:\Users\nobody""";
```

## 转换:隐式、显式、Convert、Parse

### 隐式转换

不需要写任何东西,编译器保证安全(不会丢信息):

```csharp
int i = 42;
long l = i;          // int → long,安全
double d = i;        // int → double,安全
decimal m = i;       // int → decimal,安全
long back = 100;
int small = (int)back;  // 反过来要显式
```

数值隐式转换的"安全方向":

```text
byte → short → int → long ─┬─→ float → double
                           └─→ decimal
char → int → ...
```

### 显式转换(强制类型转换)

```csharp
double d = 9.99;
int i = (int)d;           // 截断小数部分,不是四舍五入
Console.WriteLine(i);     // 输出: 9

long big = 3_000_000_000;
int wrapped = (int)big;   // 溢出,静默回绕
Console.WriteLine(wrapped); // 输出: -1294967296
```

::: danger
在默认的 `unchecked` 上下文中,整数溢出**不会抛异常**,只会回绕。上面的 `-1294967296` 就是 `3_000_000_000` 超出的部分绕回来的结果。业务代码里如果数值来自外部输入或大数运算,一定要用 `checked` 或 `TryParse`,否则可能悄悄产生错误数据。
:::

### `checked` / `unchecked`

```csharp
try
{
    checked
    {
        int max = int.MaxValue;
        int overflow = max + 1;    // 抛 OverflowException
    }
}
catch (OverflowException)
{
    Console.WriteLine("捕获到溢出");
}

unchecked
{
    int max = int.MaxValue;
    Console.WriteLine(max + 1);    // 输出: -2147483648
}
```

可以在项目级别默认启用检查:

```xml
<PropertyGroup>
  <CheckForOverflowUnderflow>true</CheckForOverflowUnderflow>
</PropertyGroup>
```

也可以在表达式级别用 `checked(...)`,而不只是语句块:

```csharp
int sum = checked(a + b);
```

### `Convert` 类

`Convert` 主要处理**类型之间的转换**,尤其是从 `string` 或 `object`,以及数值类型之间的四舍五入(不是截断):

```csharp
int i = Convert.ToInt32(3.9);
Console.WriteLine(i);            // 输出: 4 (四舍五入,注意和 (int)3.9 不同)

int fromString = Convert.ToInt32("123");
bool b = Convert.ToBoolean("true");
string s = Convert.ToString(42);

// null 会转成默认值,而不是抛异常
int fromNull = Convert.ToInt32(null);
Console.WriteLine(fromNull);     // 输出: 0
```

### `Parse` / `TryParse`

```csharp
int n = int.Parse("123");                 // 失败抛 FormatException
int n2 = int.Parse("1,234", NumberStyles.AllowThousands, CultureInfo.InvariantCulture);

// 推荐: TryParse 一次完成"判断 + 取值"
if (int.TryParse("abc", out int value))
{
    Console.WriteLine(value);
}
else
{
    Console.WriteLine("不是合法整数");     // 输出: 不是合法整数
}
```

`TryParse` 的模式叫 **Try 模式**,BCL 里到处在用(`Dictionary.TryGetValue`、`DateTime.TryParse`、`Guid.TryParse`)。自定义类型也推荐遵循这个命名和 `out` 参数约定。

```csharp
// 现代写法: out var 内联声明
if (DateTime.TryParse("2026-09-17", out var date))
{
    Console.WriteLine(date.Year);         // 输出: 2026
}
```

::: tip
`int.TryParse` 从 .NET 7 起还实现了 `IParsable<T>`,`T.TryParse(s, provider, out result)`。这让泛型代码可以统一调用,不用为每种数值类型写重复的解析逻辑:

```csharp
static T ParseOr<T>(string s, T fallback) where T : IParsable<T>
    => T.TryParse(s, CultureInfo.InvariantCulture, out var v) ? v : fallback;
```
:::

## 值类型与引用类型

### 定义与分类

**值类型**的变量直接包含数据本身;**引用类型**的变量存储一个指向堆上对象的引用(类似指针,但被 GC 管理)。

属于值类型的有:

- 所有数值类型(`int`、`double`、`decimal`…)、`bool`、`char`
- `struct` 及其所有衍生形式:`readonly struct`、`ref struct`、`record struct`
- `enum`(底层就是整数)
- `Nullable<T>`
- 元组 `(int, string)`(其实是 `ValueTuple` 结构体)
- 指针类型(unsafe)

属于引用类型的有:

- `class`、`interface`、`delegate`
- `string`、`object`、数组(`int[]`、`string[,]` 都是)
- `record`(class 形式的 record)
- 匿名类型
- 装箱后的值类型

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

### 构造规则

- struct **不能**声明无参构造函数(历史上不行,C# 10 起可以声明,但必须给所有字段赋值,而且 `default` 依然可以绕过它直接全零)。
- 不能有字段初始化器(除非 C# 10+ 且该 struct 有显式构造函数)。
- 每个构造函数**必须**给所有字段赋值,否则编译错误。
- struct 不能有析构函数,不能继承(但可以实现接口)。

```csharp
// C# 10+ 允许显式无参构造函数
public struct Version
{
    public int Major { get; set; }

    public Version()
    {
        Major = 1;    // 必须赋初值
    }
}

// 但 default 依然给出全零,不调用上面的构造函数
var v = default(Version);
Console.WriteLine(v.Major);      // 输出: 0
v = new Version();
Console.WriteLine(v.Major);      // 输出: 1
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

`ref struct` 只能存在于栈上,**不能装箱、不能作为字段、不能用在 `async` / 迭代器里、不能是泛型参数**。它存在的目的是让 `Span<T>` 这样的类型有安全的"栈上视图"语义。

```csharp
public ref struct StackOnly
{
    public Span<int> Data;
}

// Span<T> 本身就是 ref struct
Span<int> span = stackalloc int[3] { 1, 2, 3 };
```

好处是零分配、越界检查可被 JIT 消除;限制是它不能逃逸出当前栈帧,所以不能从方法里 `return` 一个 `Span`(除非它指向堆上内存且你清楚生命周期)。

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

### 不能继承

struct 隐式继承自 `System.ValueType`,而 `ValueType` 继承自 `object`,但你**不能**让一个 struct 继承另一个 struct 或 class,也不能被继承。它只能实现接口。

### 默认 `Equals` 的性能问题

`ValueType.Equals` 的默认实现是**反射式逐字段比较**——这是个性能陷阱,而且对含引用字段的 struct 会做字段的 `Equals` 调用,可能语义上也不是你要的:

```csharp
struct BadPoint { public int X; public int Y; }

var a = new BadPoint { X = 1, Y = 2 };
var b = new BadPoint { X = 1, Y = 2 };
Console.WriteLine(a.Equals(b));   // True,但内部走反射,慢
Console.WriteLine(a == b);        // 编译错误!struct 默认不支持 ==
```

正确做法:实现 `IEquatable<T>` 并重写 `Equals` / `GetHashCode`

```csharp
struct GoodPoint : IEquatable<GoodPoint>
{
    public readonly int X;
    public readonly int Y;

    public GoodPoint(int x, int y) => (X, Y) = (x, y);

    public bool Equals(GoodPoint other) => X == other.X && Y == other.Y;
    public override bool Equals(object? obj) => obj is GoodPoint p && Equals(p);
    public override int GetHashCode() => HashCode.Combine(X, Y);

    public static bool operator ==(GoodPoint l, GoodPoint r) => l.Equals(r);
    public static bool operator !=(GoodPoint l, GoodPoint r) => !l.Equals(r);
}
```

实现 `IEquatable<T>` 还有第二个好处:放进 `Dictionary<TKey, TValue>` 或 `HashSet<T>` 时,泛型容器会直接调用强类型 `Equals`,**避免装箱**。

## `class` 简述

`class` 是引用类型,支持继承、多态、虚方法、抽象成员、接口实现。这里只给最小示例,细节见第 4 篇。

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

每次装箱都是一次托管堆分配,会带来 GC 压力和额外的内存(对象头约 16 字节 + 值本身)。在热路径里每帧几千次装箱会显著影响吞吐。

```csharp
long before = GC.GetAllocatedBytesForCurrentThread();
for (int i = 0; i < 100_000; i++)
{
    object boxed = i;             // 每次循环装箱
}
long after = GC.GetAllocatedBytesForCurrentThread();
Console.WriteLine(after - before);   // 输出: 约 2400000 (24 字节 × 10 万)
```

对比不装箱的版本:

```csharp
long before = GC.GetAllocatedBytesForCurrentThread();
int sum = 0;
for (int i = 0; i < 100_000; i++)
{
    sum += i;                     // 无分配
}
long after = GC.GetAllocatedBytesForCurrentThread();
Console.WriteLine(after - before);   // 输出: 0(或很小的固定值)
```

也可以用 `ReferenceEquals` 直观验证装箱产生了新对象:

```csharp
int a = 128;
object box1 = a;
object box2 = a;
Console.WriteLine(object.ReferenceEquals(box1, box2));   // 输出: False,两次装箱是两个对象

object box3 = box1;
Console.WriteLine(object.ReferenceEquals(box1, box3));   // 输出: True,只是复制引用
```

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

### 在 LINQ 中的行为

`Enumerable.Sum`、`Average` 等聚合会**跳过** null 元素,而 `Max` / `Min` 也是:

```csharp
int?[] nums = { 1, null, 3 };
Console.WriteLine(nums.Sum());          // 输出: 4
Console.WriteLine(nums.Average());      // 输出: 2
Console.WriteLine(nums.Max());          // 输出: 3
Console.WriteLine(nums.Max() ?? -1);    // 输出: 3
```

### 提升运算符(lifted operators)

C# 会自动为 `int?` 生成相应版本的 `+`、`-`、`==` 等:任一操作数为 null,结果就是 null。

```csharp
int? a = 5;
int? b = null;
Console.WriteLine(a + b);       // 输出: (空行,即 null)
Console.WriteLine(a + 1);       // 输出: 6
```

::: warning
`int?` 不等于 `int`,不能直接赋给 `int` 参数,必须 `.Value`(可能抛异常)或者 `?? 0`(指定默认值)。最常见的选择是显式给出业务默认值,而不是盲目 `.Value`。
:::

## 可空引用类型(Nullable Reference Types)

### 为什么需要它

`null` 是 C# 里最常见的运行时错误来源——.NET Framework 之前所有引用类型都可以是 `null`,编译器完全不提醒。2019 年 .NET Core 3.0 引入 **NRT(Nullable Reference Types)**,让编译器对引用类型的可空性做静态检查。

关键点:**NRT 是编译期的静态分析,运行时没有任何行为变化**。`string` 和 `string?` 在 IL 里是同一个类型。它纯粹是给编译器和给读代码的人看的注解。

```xml
<PropertyGroup>
  <Nullable>enable</Nullable>
</PropertyGroup>
```

也可以在文件里局部开启:

```csharp
#nullable enable
// 这个文件里启用
#nullable restore
```

### `?` 标注与告警

```csharp
#nullable enable

string notNull = "hello";
string? maybeNull = null;

Console.WriteLine(notNull.Length);      // OK
Console.WriteLine(maybeNull.Length);    // CS8602: 解引用可能为 null 的引用
```

常见警告码及其含义:

| 警告码 | 触发场景 |
| --- | --- |
| CS8600 | 把可能为 null 的值赋给非可空变量 |
| CS8601 | 可能为 null 的引用赋值 |
| CS8602 | 解引用可能为 null 的引用 |
| CS8618 | 不可空字段/属性在构造函数退出时可能为 null |
| CS8625 | 把 null 字面量传给不可空参数 |
| CS8629 | Nullable 值类型的 `Value` 可能无效 |

```csharp
#nullable enable

// CS8618: 构造函数没有初始化 Name
public class User
{
    public string Name { get; set; }
}

// 变通方式一: 用 required(C# 11)
public class User2
{
    public required string Name { get; set; }
}

// 变通方式二: 用 ? 明确表示"可能为 null"
public class User3
{
    public string? Name { get; set; }
}

// 变通方式三: 用 = null! 抑制(仅当你知道外部一定会赋值,比如 DI 或 ORM)
public class User4
{
    public string Name { get; set; } = null!;
}
```

### `!` 抑制符

当你比编译器更确定某个值不是 `null` 时,用 `null-forgiving operator` 告诉它闭嘴:

```csharp
string? config = GetConfig();
// 你确定这里不为 null,并愿意承担风险
Console.WriteLine(config!.Length);
```

::: danger
`!` 不会做任何运行时检查,它只是让编译器**不再报警**。如果判断错了,程序照样 `NullReferenceException`。建议只在两种情况下用:(1) 外部框架保证非空(比如 `[NotNull]` 标注的 DI),并且你要在旁边写注释说明原因;(2) 单元测试里构造测试数据。生产逻辑里能重构成显式判空就不要用 `!`。
:::

### 空条件运算符与空合并

```csharp
string? name = null;

// ?. 在 null 时短路,返回 null
int? length = name?.Length;             // null
Console.WriteLine(length);              // 输出: (空行)

// ?[] 数组/索引器版本
int[]? arr = null;
int? first = arr?[0];
Console.WriteLine(first);               // 输出: (空行)

// ?? 提供默认值
string display = name ?? "(未命名)";
Console.WriteLine(display);             // 输出: (未命名)

// ??= 只在左侧为 null 时赋值
string? cache = null;
cache ??= "computed";
Console.WriteLine(cache);               // 输出: computed
cache ??= "ignored";
Console.WriteLine(cache);               // 输出: computed
```

链式写法可以优雅地处理深层嵌套:

```csharp
public class Order { public Customer? Buyer { get; set; } }
public class Customer { public Address? Home { get; set; } }
public class Address { public string? City { get; set; } }

Order? order = null;
string city = order?.Buyer?.Home?.City ?? "未知";
Console.WriteLine(city);                // 输出: 未知
```

C# 14 引入了**空条件赋值**,可以在 `?.` 左侧直接赋值:

```csharp
// C# 14: 如果 order?.Buyer 不为 null,则给它的 Home 赋值
order?.Buyer?.Home = new Address { City = "Beijing" };
// 等价于
if (order?.Buyer is not null)
{
    order.Buyer.Home = new Address { City = "Beijing" };
}
```

### 在属性/参数/返回值上标注

```csharp
public class Repository
{
    // 返回值可能为 null
    public User? Find(int id) => null;

    // 参数允许为 null
    public void Save(User? user) { }

    // 输出参数在方法返回后一定非 null
    public bool TryGet(int id, [NotNullWhen(true)] out User? user)
    {
        user = null;
        return false;
    }
}
```

`[NotNullWhen(true)]` 这类特性叫**流分析特性**,常配套:

- `[NotNullWhen(bool)]`
- `[MaybeNullWhen(bool)]`
- `[NotNull]` / `[MaybeNull]`
- `[DisallowNull]` / `[AllowNull]`

### `notnull` 约束

在泛型约束里用 `notnull` 表示"不允许可为 null 的类型实参":

```csharp
public static T FirstOrDefaultChecked<T>(IEnumerable<T> source, string name)
    where T : notnull
{
    foreach (var item in source) return item;
    throw new InvalidOperationException($"{name} 为空");
}
```

`notnull` 与 `class` 不同:它允许 `int`、`string` 等非可空类型,但不允许 `string?`、`int?`。

## 类型检查与转换:`is`、`as`、`typeof`、`GetType`

```csharp
object obj = "hello";

// is 判断类型,不抛异常
if (obj is string s)
{
    Console.WriteLine(s.Length);        // 输出: 5
}

// is 模式可以组合条件
if (obj is string { Length: > 3 } str)
{
    Console.WriteLine(str);             // 输出: hello
}

// 属性模式 + 常量模式
object value = 42;
if (value is int n and > 0 and < 100)
{
    Console.WriteLine($"小的正整数: {n}");   // 输出: 小的正整数: 42
}
```

### 为什么 `as` 不抛异常

`as` 在类型不兼容时返回 `null`,而非抛 `InvalidCastException`。代价是**它只能用于引用类型和可空值类型**——因为值类型不可能是 `null`,所以 `int x = someObj as int;` 编译不过,要写成 `someObj as int?`。

```csharp
object obj = "hello";
string? s = obj as string;             // 成功
int? i = obj as int?;                  // 失败,返回 null
Console.WriteLine(s is null);          // 输出: False
Console.WriteLine(i is null);          // 输出: True

// 对比: 强制转换会抛
try { _ = (string)obj; }
catch (InvalidCastException) { }
```

选择建议:`as` 用于"我怀疑类型可能不对,想自己处理失败";强制转换用于"类型绝对正确,错了就是要炸"。

### `typeof` 与 `GetType()`

```csharp
Type t1 = typeof(string);          // 编译期就知道的类型
Type t2 = "hello".GetType();       // 运行时对象的实际类型

Console.WriteLine(t1 == t2);       // 输出: True
Console.WriteLine(t1.Name);        // 输出: String
Console.WriteLine(t1.FullName);    // 输出: System.String
Console.WriteLine(t1.IsValueType); // 输出: False
Console.WriteLine(typeof(int).IsValueType);  // 输出: True
```

::: warning
`GetType()` **不是 `virtual`**,不能被重写,所以任何对象返回的都是它的**真实运行时类型**。这和 `Equals`、`ToString` 可以被重写不同。另外 `obj is T` 和 `obj.GetType() == typeof(T)` 语义不同:`is` 会匹配子类,后者只在**完全相等**时成立。

```csharp
object s = "hello";
Console.WriteLine(s is object);                    // 输出: True
Console.WriteLine(s.GetType() == typeof(object));  // 输出: False
```
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
// 字符串 → 枚举
Status s = Enum.Parse<Status>("Active");
Console.WriteLine(s);                          // 输出: Active

if (Enum.TryParse<Status>("nope", out var parsed))
{
    Console.WriteLine(parsed);
}
else
{
    Console.WriteLine("解析失败");              // 输出: 解析失败
}

// 默认 TryParse 对数字字符串也会成功!
Enum.TryParse<Status>("123", out var num);
Console.WriteLine(num);                        // 输出: 123,虽然没定义

// 枚举 → 字符串
Console.WriteLine(Status.Deleted.ToString());  // 输出: Deleted
Console.WriteLine(((int)Status.Deleted));      // 输出: 99

// 遍历所有值
foreach (Status v in Enum.GetValues<Status>())
{
    Console.WriteLine($"{v} = {(int)v}");
}
```

::: warning
`Enum.TryParse` 对**任何数字字符串**都会返回 `true`,即使该数字不是已定义的枚举值。它还会忽略大小写并接受逗号组合。所以验证外部输入时,需要额外用 `Enum.IsDefined` 确认:

```csharp
if (Enum.TryParse<Status>("123", out var st) && Enum.IsDefined(st))
{
    // 才是真正合法的值
}
```
:::

## 匿名类型

```csharp
var person = new { Name = "Alice", Age = 30 };
Console.WriteLine(person.Name);        // 输出: Alice
Console.WriteLine(person);             // 输出: { Name = Alice, Age = 30 }

// 属性是只读的
// person.Age = 31;   // 编译错误
```

相等性:两个匿名类型如果**属性名、类型、顺序完全一致**,则被认为是同一个类型,且 `Equals` 按值比较。

```csharp
var a = new { X = 1, Y = 2 };
var b = new { X = 1, Y = 2 };
Console.WriteLine(a.Equals(b));        // 输出: True
Console.WriteLine(a.GetType() == b.GetType());  // 输出: True
```

LINQ 里匿名类型非常实用:

```csharp
var orders = new[]
{
    new { Id = 1, Customer = "A", Total = 100m },
    new { Id = 2, Customer = "B", Total = 250m },
};

var summary = orders
    .GroupBy(o => o.Customer)
    .Select(g => new { Customer = g.Key, Sum = g.Sum(o => o.Total) })
    .ToList();

foreach (var row in summary)
{
    Console.WriteLine($"{row.Customer}: {row.Sum}");
}
// 输出:
// A: 100
// B: 250
```

局限:不能作为方法返回值(除非返回 `object`,那就要装箱)、不能跨程序集传递、属性不可变、不能添加方法。需要这些能力时改用 `record`。

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
var old = Tuple.Create(1, "a");
Console.WriteLine(old.Item1);          // 输出: 1

var modern = (Id: 1, Name: "a");       // ValueTuple,带命名
Console.WriteLine(modern.Name);        // 输出: a
Console.WriteLine(modern.Item2);       // 输出: a,ItemN 依然可用
```

### 解构

```csharp
(int id, string name) = GetUser();
Console.WriteLine($"{id} {name}");

// 用弃元忽略不关心的值
var (first, _) = GetPair();

// 交换变量
int x = 1, y = 2;
(x, y) = (y, x);
Console.WriteLine($"{x} {y}");          // 输出: 2 1
```

### 元组相等性

```csharp
var t1 = (1, "a");
var t2 = (1, "a");
Console.WriteLine(t1 == t2);            // 输出: True
Console.WriteLine(t1.Equals(t2));       // 输出: True

// 注意: 嵌套元组也是按值比较
var n1 = ((1, 2), 3);
var n2 = ((1, 2), 3);
Console.WriteLine(n1 == n2);            // 输出: True
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

超过 3 个返回值时,元组的可读性会下降,这时考虑定义一个 `record`。

::: tip
元组作为方法返回多值,比 `out` 参数更清晰,而且不影响异步方法(`async Task<(int, string)>` 完全可用)。唯一的坑是元组的 `==` 在**包含 `null` 的可空引用**上依然按值比较,但比较的是引用;要小心 `(null, 1) == (null, 1)` 是 `True` 还是 `False` —— 实际返回 `True`,因为都走 `EqualityComparer<T>.Default`。
:::

## `var` 与显式类型

`var` 是**编译期类型推断**,不是动态类型。IL 里类型是确定的,运行时没有区别。

```csharp
var list = new List<int>();          // List<int>
var count = 10;                      // int
var name = "x";                      // string
var tuple = (1, "a");                // (int, string)
```

什么时候用 `var` 更合适:

- 右侧类型显而易见的场合:`var users = new List<User>();`
- 匿名类型**必须**用 `var`(没有类型名可写)。
- LINQ 链式结果,写全名极其冗长。
- 泛型类型嵌套很深时。

什么时候**不要**用:

- 右侧看不出类型:`var x = Get();` 应该写成 `User x = Get();`。
- 数值字面量:`var total = 0;` 掩盖了它应该是 `decimal` 还是 `int`,金额场景尤其危险。

```csharp
// 危险: total 被推断为 int,后面 += 0.1m 会编译错误
var total = 0;

// 清楚
decimal total2 = 0m;
```

团队约定上,很多代码库用 `.editorconfig` 强制某些场景必须显式类型:

```text
csharp_style_var_for_built_in_types = false:suggestion
csharp_style_var_when_type_is_apparent = true:suggestion
csharp_style_var_elsewhere = false:suggestion
```

## 类型别名

`using` 别名在文件顶部声明,作用域是整个文件:

```csharp
using IntPair = (int X, int Y);
using Matrix = double[][];
using Handler = System.Func<string, System.Threading.Tasks.Task<int>>;
using CustomerId = System.Guid;

CustomerId id = Guid.NewGuid();
Matrix m = [[1.0, 2.0], [3.0, 4.0]];
```

C# 12 起别名可以指向**任意类型**,包括前面提到的元组、数组、nullable:

```csharp
using MaybeInt = int?;
using Json = System.Text.Json.JsonSerializer;
```

::: warning
`using` 别名是**编译器特性**,不会创建一个新类型。所以 `CustomerId` 和 `Guid` 完全等价,不能借此实现类型安全包装(那是 `record struct CustomerId(Guid Value)` 干的事)。别名只在当前文件有效,别的文件看不到。
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
`decimal` 能精确表示十进制小数,但**除法可能产生无限小数**,会被截断到 28 位:

```csharp
decimal a = 1m / 3m;
Console.WriteLine(a);                   // 输出: 0.3333333333333333333333333333
Console.WriteLine(a * 3m);              // 输出: 0.9999999999999999999999999999

// 金额计算应该显式舍入
decimal price = 10m / 3m;
Console.WriteLine(decimal.Round(price, 2, MidpointRounding.ToEven));   // 输出: 3.33
```

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
`"1,234.5"` 在 en-US 下能解析,在 de-DE 下 `.` 是千分位`,` 是小数点,结果完全不同。

```csharp
using System.Globalization;

string s = "1,234.5";
Console.WriteLine(double.Parse(s, CultureInfo.InvariantCulture));   // 输出: 1234.5

// 解析外部数据、配置文件、网络协议时,一律用 InvariantCulture
// 只在面向最终用户显示/输入时用 CurrentCulture
Console.WriteLine(1234.5.ToString("N2", CultureInfo.InvariantCulture));  // 输出: 1,234.50
```

::: danger
`double.Parse(s)` 和 `Convert.ToDouble(s)` 默认使用 `CurrentCulture`。服务器上的区域设置可能是任何值,同一份输入在不同机器上解析结果不同,这是非常隐蔽的生产事故来源。**解析机器可读数据,永远传 `CultureInfo.InvariantCulture`。**

```csharp
// 正确
decimal amount = decimal.Parse(raw, CultureInfo.InvariantCulture);
// 错误(取决于服务器区域)
decimal wrong = decimal.Parse(raw);
```
:::

**5. `GetHashCode` 与 `Equals` 契约。**
规则:如果两个对象 `Equals` 返回 `true`,它们的 `GetHashCode` **必须**相等。反过来不要求(哈希相等但对象不等是允许的冲突)。

```csharp
// 错误: 只重写 Equals,哈希不一致 → HashSet/Dictionary 行为异常
class Bad
{
    public int Id;
    public override bool Equals(object? obj) => obj is Bad b && b.Id == Id;
    // 没有 GetHashCode!
}

var set = new HashSet<Bad>();
set.Add(new Bad { Id = 1 });
Console.WriteLine(set.Contains(new Bad { Id = 1 }));   // 输出: False(期望 True)
```

正确做法是用 `HashCode.Combine` 组合所有参与相等比较的字段:

```csharp
public override int GetHashCode() => HashCode.Combine(Id, Name);
```

**6. 字符串 `==` 与 `object` 上 `==` 的区别。**
`string` 重载了 `==` 运算符,做的是**值比较**(先比引用,不同再逐字符比)。但如果你把字符串装进 `object`,就会走 `object.` 的引用比较:

```csharp
string a = new string("hello");
string b = new string("hello");

Console.WriteLine(a == b);                      // 输出: True(字符串重载)
Console.WriteLine((object)a == (object)b);      // 输出: False(引用比较)
Console.WriteLine(object.ReferenceEquals(a, b));// 输出: False

// 安全的字符串比较应该用 string.Equals 并指定比较规则
Console.WriteLine(string.Equals(a, b, StringComparison.Ordinal));   // 输出: True
```

建议:需要明确语义时用 `string.Equals(x, y, StringComparison.Ordinal)`(区分大小写)或 `StringComparison.OrdinalIgnoreCase`(不区分),不要依赖 `==` 的隐式选择。涉及用户输入排序/比较时,考虑 `CurrentCulture`。

**7. 值类型做字典键忘记实现 `IEquatable<T>`。**
默认的 `ValueType.Equals` 走反射,放进 `Dictionary` 会慢一个数量级,而且可能因为装箱产生额外分配。自定义 struct 作为键时,一定实现 `IEquatable<T>` 并重写 `GetHashCode`。

**8. 可空值类型参与算术后被当成非空。**
`int? a = null; int b = a.Value;` 会抛 `InvalidOperationException`,不是编译错误。用显式合并或 `GetValueOrDefault` 更安全。

**9. `default` 枚举值可能不存在。**
`(Status)12345` 是完全合法的,`Enum.IsDefined` 才是否则判断。反序列化外部数据后一定要校验。

**10. `char` 不等于"一个字符"。**
`char` 是 UTF-16 码元,一个 emoji 往往占两个 `char`(代理对)。要按"用户感知的字符"处理,用 `System.Globalization.StringInfo` 或者 `Rune`:

```csharp
string surrogate = "\uD842\uDFB7";                          // U+20BB7,CJK 扩展 B 区汉字
Console.WriteLine(surrogate.Length);                        // 输出: 2,不是 1
Console.WriteLine(surrogate.EnumerateRunes().Count());      // 输出: 1
```
