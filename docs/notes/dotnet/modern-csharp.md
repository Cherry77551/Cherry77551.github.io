# 10. 现代 C# 特性(按版本)

C# 不是那种"十年不变"的语言。自 2002 年随 .NET Framework 1.0 发布以来,它几乎每年都在增加新语法与新能力。对已经掌握 Java、Python、JavaScript 或 C++ 的开发者来说,真正的难点不在于单个关键字,而在于**辨认出哪些特性属于哪个版本、为什么引入、以及它们如何组合在一起**。

这篇笔记按版本顺序梳理 C# 1 到 C# 14 的演进,再把两个最重要的横切主题(模式匹配、`record`)单独展开,最后讲语言版本控制与常见陷阱。

## 版本总览

| C# 版本 | 发布年份 | 对应 .NET | 代表性特性 |
| --- | --- | --- | --- |
| C# 1.0 | 2002 | .NET Framework 1.0 | 类、结构体、接口、委托、事件、属性 |
| C# 2.0 | 2005 | .NET Framework 2.0 | 泛型、可空值类型、匿名方法、迭代器 `yield`、分部类 |
| C# 3.0 | 2007 | .NET Framework 3.5 | `var`、对象/集合初始化器、自动属性、匿名类型、Lambda、扩展方法、LINQ、表达式树 |
| C# 4.0 | 2010 | .NET Framework 4.0 | `dynamic`、命名/可选参数、泛型协变与逆变 |
| C# 5.0 | 2012 | .NET Framework 4.5 | `async` / `await`、调用方信息特性 |
| C# 6.0 | 2015 | .NET Framework 4.6( Roslyn ) | 字符串插值、`?.`、`nameof`、表达式体成员、`when` 筛选器 |
| C# 7.0 | 2017 | .NET Framework 4.7 / .NET Core 2.0 | `out var`、元组与解构、模式匹配初版、本地函数、`ref` 返回 |
| C# 7.2 | 2017 | 同上 | `in` 参数、`readonly struct`、`ref struct`、`private protected` |
| C# 8.0 | 2019 | .NET Core 3.0 / .NET Standard 2.1 | 可空引用类型、`switch` 表达式、异步流、`^` / `..`、默认接口成员 |
| C# 9.0 | 2020 | .NET 5 | `record`、`init`、顶级语句、目标类型 `new()`、关系/逻辑模式 |
| C# 10.0 | 2021 | .NET 6 | `record struct`、`global using`、文件范围命名空间、Lambda 天然类型 |
| C# 11.0 | 2022 | .NET 7 | 原始字符串、`required`、泛型数学、列表模式、`u8` 字面量 |
| C# 12.0 | 2023 | .NET 8 | 主构造函数、集合表达式、内联数组、`using` 别名任意类型 |
| C# 13.0 | 2024 | .NET 9 | `params` 支持集合、`System.Threading.Lock`、`\e`、部分属性、`ref struct` 泛型 |
| C# 14.0 | 2025 | .NET 10 | 扩展成员、空条件赋值、`field` 关键字、部分事件/构造函数、用户定义复合赋值 |

C# 14.0 于 2025 年 11 月随 .NET 10 正式发布,是当前最新稳定版本。语言版本号与 .NET 主版本号自 .NET 5 起形成一年一更的节奏,但**语言版本与运行时版本是解耦的**:你可以在 .NET 8 项目里用 `LangVersion 12`,也可以在 .NET Framework 上(通过新版编译器)使用部分新语法。

## C# 1.0 与 2.0

C# 1.0 建立了基本的面向对象模型:类、结构体、接口、委托、事件、属性、`foreach`、`using`。2.0 补上了泛型与可空值类型,这是两个影响深远的设计:

```csharp
// C# 2.0:泛型与可空值类型
List<int> numbers = new List<int> { 1, 2, 3 };
int? maybeNull = null;                 // Nullable<int> 的语法糖
Console.WriteLine(maybeNull.HasValue); // 输出: False

// 匿名方法:委托的内联写法,lambda 的前身
Action<string> print = delegate (string s) { Console.WriteLine(s); };
```

2.0 还引入了 `yield return` 迭代器、分部类 `partial`,以及静态类。这些构成了后续所有特性的地基,本文后面不再赘述。

## C# 3.0

C# 3.0 是分水岭。它一次性引入了 `var`、初始化器、匿名类型、Lambda、扩展方法、表达式树和 LINQ,把语言从"纯面向对象"推向"面向对象 + 函数式 + 数据查询"的混合风格。这一版之后的 C# 大多数特性,本质都是在补齐这套体系的短板。

### `var` 隐式类型局部变量

`var` 不是动态类型,它只是让编译器根据初始化表达式**推断静态类型**:

```csharp
var name = "cherry";      // 编译器推断为 string
var count = 42;           // int
// name = 1;              // 编译错误:cannot convert int to string
```

```text
推论:var 只在编译期起作用,生成的 IL 与显式写类型完全一致,没有运行时开销。
```

### 对象与集合初始化器

```csharp
var person = new Person { Name = "Ada", Age = 36 };
var dict = new Dictionary<string, int>
{
    ["one"] = 1,
    ["two"] = 2,
};
```

初始化器省去了临时变量与重复赋值,也让 LINQ 的投影表达式更简洁。

### 自动实现属性

```csharp
public class Person
{
    public string Name { get; set; }
    public int Age { get; set; }
}
```

编译器自动生成一个隐藏的后备字段。你无法直接访问该字段,直到 C# 14 的 `field` 关键字出现。

### 匿名类型

```csharp
var point = new { X = 10, Y = 20 };
Console.WriteLine(point.X); // 输出: 10
```

匿名类型的属性是只读的,且它的相等性基于属性值(见后文 `record` 专题的对比)。

### Lambda 表达式

```csharp
Func<int, int, int> add = (a, b) => a + b;
Console.WriteLine(add(2, 3)); // 输出: 5

// 表达式 Lambda 与语句 Lambda
Func<int, int> abs = n => n < 0 ? -n : n;
```

Lambda 让委托的书写从 `delegate` 关键字简化成一行,它是 LINQ 可读性的关键。

### 扩展方法

扩展方法允许在不修改类型、不继承类型的前提下"追加"实例方法:

```csharp
public static class StringExtensions
{
    public static bool IsNullOrBlank(this string? s)
        => string.IsNullOrWhiteSpace(s);
}

Console.WriteLine("  ".IsNullOrBlank()); // 输出: True
```

扩展方法必须定义在**静态非泛型类**中,且方法本身是 `static`、第一个参数带 `this`。它只在编译期生效,不能访问类型的私有成员,也无法被派生类重写。

### LINQ 与查询表达式

```csharp
var nums = new[] { 5, 3, 8, 1, 9, 2 };

// 方法语法
var evens = nums.Where(n => n % 2 == 0).OrderBy(n => n).ToList();
Console.WriteLine(string.Join(",", evens)); // 输出: 2,8

// 查询表达式语法,编译器会翻译成方法调用
var query =
    from n in nums
    where n > 3
    orderby n descending
    select n * 10;
Console.WriteLine(string.Join(",", query)); // 输出: 90,80,50
```

查询表达式是纯粹的语法糖:`from ... where ... select` 会被编译成 `Where` / `OrderByDescending` / `Select`。它唯一的非糖成分是 `let`、`join ... into` 等无法直接用一次方法调用表达的结构。

### 表达式树

当 Lambda 被赋给 `Expression<TDelegate>` 而非委托时,编译器不会生成可执行代码,而是生成一棵描述代码结构的对象树:

```csharp
Expression<Func<int, bool>> expr = n => n > 5;
Console.WriteLine(expr.Body);      // 输出: (n > 5)
Console.WriteLine(expr.Parameters[0].Name); // 输出: n
```

表达式树是 `IQueryable<T>` 的基础:EF Core、LINQ to SQL 都靠它把 C# 表达式翻译成 SQL。这是 C# 与 Java Stream、Python 生成器的根本差异之一。

::: tip 为什么 C# 3.0 重要
理解 C# 3.0 就能理解现代 C# 一半的"语气"。`var`、初始化器、Lambda、扩展方法、表达式树这五件套组合起来,才有了 `record`、模式匹配、集合表达式等后续特性的表达力。
:::

## C# 4.0

### `dynamic`

`dynamic` 把类型检查从编译期推迟到运行期,底层依赖 `System.Dynamic` 与 DLR:

```csharp
dynamic d = "hello";
Console.WriteLine(d.Length); // 输出: 5
d = 42;
Console.WriteLine(d + 1);    // 输出: 43
// d.Foo();                  // 运行期抛 RuntimeBinderException
```

`dynamic` 适合 COM 互操作、动态语言桥接,不应作为日常写法,因为它放弃编译期检查且性能更差。

### 命名参数与可选参数

```csharp
void Log(string message, string level = "Info", bool writeToFile = false)
    => Console.WriteLine($"[{level}] {message}");

Log("started");                          // 输出: [Info] started
Log("failed", level: "Error");           // 输出: [Error] failed
Log(writeToFile: true, message: "hi");   // 命名参数可任意换序
```

### 泛型协变与逆变

```csharp
IEnumerable<string> strings = new List<string>();
IEnumerable<object> objects = strings; // 协变:out T,string 可当 object

Action<object> actObj = o => Console.WriteLine(o);
Action<string> actStr = actObj;        // 逆变:in T
```

协变用 `out T`(只能输出),逆变用 `in T`(只能输入),不变(既进又出)则不能变。

## C# 5.0

### `async` / `await`

C# 5.0 引入 `async` / `await`,把基于回调的异步流程改写成看起来同步的代码。它不是"开线程",而是基于状态机的可等待模型:

```csharp
public async Task<int> DownloadLengthAsync(string url, HttpClient client)
{
    string text = await client.GetStringAsync(url);
    return text.Length;
}
```

编译器把方法体改写成一个实现了 `IAsyncStateMachine` 的状态机。`await` 之后的代码会被注册为 continuation,在任务完成后继续执行。调用方因此获得了"同步的书写体验 + 异步的执行模型"。

`await` 的语义要点:

- 遇到 `await` 时,若任务尚未完成,当前方法会**提前返回**给调用方,不阻塞线程。
- 若任务已完成,则同步继续执行,不产生额外调度。
- `await` 会捕获 `SynchronizationContext`(除非用 `ConfigureAwait(false)`),这在 UI 与 ASP.NET 老版本中决定了回到哪个线程。

```csharp
async Task Main()
{
    var client = new HttpClient();
    int len = await DownloadLengthAsync("https://example.com", client);
    Console.WriteLine(len); // 输出: 页面字符数
}
```

### 调用方信息特性

```csharp
void Trace(string message,
    [CallerMemberName] string member = "",
    [CallerFilePath] string file = "",
    [CallerLineNumber] int line = 0)
    => Console.WriteLine($"{file}:{line} {member} {message}");
```

编译器会在调用点自动填入这些值,常用于日志与 `INotifyPropertyChanged`。

## C# 6.0

C# 6.0 的主题是"少写样板代码"。

### 字符串插值

```csharp
string name = "Ada";
int age = 36;
Console.WriteLine($"{name} is {age} years old.");
Console.WriteLine($"{age,5:D3}");        // 输出:  036(右对齐宽度 5)
Console.WriteLine($"{Math.PI:F2}");      // 输出: 3.14
```

### 空条件运算符 `?.` 与空合并 `??`

```csharp
string? s = null;
Console.WriteLine(s?.Length);      // 输出: (空,类型为 int?)
Console.WriteLine(s?.Length ?? 0); // 输出: 0
```

### `nameof`

```csharp
Console.WriteLine(nameof(Person.Name)); // 输出: Name
```

`nameof` 在编译期求值,重命名重构时不会失效,优于硬编码字符串。

### 表达式体成员

```csharp
public class Circle
{
    public double Radius { get; }
    public Circle(double r) => Radius = r;
    public double Area => Math.PI * Radius * Radius;
}
```

### 自动属性初始化器与只读自动属性

```csharp
public class Config
{
    public string Host { get; set; } = "localhost";
    public int Port { get; } = 8080;  // 只能在构造函数/初始化器里赋值
}
```

### 异常筛选器 `when`

```csharp
try
{
    Risky();
}
catch (HttpRequestException ex) when (ex.StatusCode == null)
{
    Console.WriteLine("网络层错误");
}
```

`when` 在**捕获过滤器**阶段判断,不会像 `catch` 后再 `if` 抛那样破坏堆栈,也不会被当作已处理异常统计。

### `using static`

```csharp
using static System.Math;
Console.WriteLine(Sqrt(16)); // 输出: 4
```

### 索引初始化器

```csharp
var m = new Dictionary<string, int> { ["a"] = 1, ["b"] = 2 };
```

## C# 7.x

### `out var` 与元组

```csharp
if (int.TryParse("42", out var n))
    Console.WriteLine(n + 1); // 输出: 43

var point = (X: 1, Y: 2);
Console.WriteLine(point.X); // 输出: 1

// 解构
var (x, y) = point;
Console.WriteLine($"{x},{y}"); // 输出: 1,2
```

`ValueTuple` 是结构体,元组相等性基于逐元素比较。自定义类型实现 `Deconstruct` 后也能被解构。

### 模式匹配(初版)

```csharp
object o = 42;
if (o is int i)
    Console.WriteLine(i + 1); // 输出: 43

string Describe(object o) => o switch
{
    int n when n > 0 => "正整数",
    int _ => "整数",
    null => "空",
    _ => "其他",
};
```

### 本地函数

```csharp
int Factorial(int n)
{
    return Local(n);
    int Local(int k) => k <= 1 ? 1 : k * Local(k - 1);
}
```

本地函数可以捕获外层变量、支持迭代器与异步,且不分配委托,优于 `Action` / `Func` 写法。

### `ref` 局部变量与 `ref` 返回

```csharp
int[] arr = { 1, 2, 3 };
ref int first = ref arr[0];
first = 100;
Console.WriteLine(arr[0]); // 输出: 100
```

### 丢弃 `_`

```csharp
_ = int.TryParse("x", out _);
```

### 二进制字面量与数字分隔符

```csharp
int mask = 0b1010_1010;
int big = 1_000_000;
```

### `throw` 表达式

```csharp
string Name { get; set; } = throw new InvalidOperationException();
string First(IEnumerable<string> items) =>
    items.FirstOrDefault() ?? throw new ArgumentException("空集合");
```

## C# 8.0

### 可空引用类型

这是 C# 8.0 最重要的特性。它把"引用可能为 null"从约定变成编译器可检查的注解:

```csharp
#nullable enable
public class User
{
    public string Name { get; set; }        // 不可为 null,构造时必须赋值
    public string? Nickname { get; set; }   // 可为 null
}

void Print(User user)
{
    Console.WriteLine(user.Name.Length);
    // Console.WriteLine(user.Nickname.Length); // 警告:可能为 null
    Console.WriteLine(user.Nickname?.Length ?? 0);
}
```

警告不是错误,运行时行为不变;可空性只影响**静态分析**。项目级可通过 `<Nullable>enable</Nullable>` 全局开启。

### `switch` 表达式

```csharp
string Grade(int score) => score switch
{
    >= 90 => "A",
    >= 80 => "B",
    >= 60 => "C",
    _ => "F",
};
```

表达式形式的 `switch` 必须"穷尽",编译器会检查所有情况是否被覆盖(通过合法路径),`_` 与 `null` 是常见兜底。

### 属性模式、元组模式、位置模式

```csharp
var p = (3, 4);
bool onDiagonal = p is (1, 1) or (2, 2) or (3, 3);

var user = new { Name = "Ada", Age = 36 };
bool isAdultNamedAda = user is { Name: "Ada", Age: >= 18 };
```

### `using` 声明

```csharp
using var stream = File.OpenRead("data.txt"); // 离开作用域时自动 Dispose
```

### 静态本地函数

```csharp
int AddOne(int n)
{
    return Local(n);
    static int Local(int k) => k + 1; // 不能捕获外层变量,避免闭包分配
}
```

### 默认接口成员

```csharp
interface ILogger
{
    void Log(string msg);
    void LogError(string msg) => Log($"[ERROR] {msg}"); // 默认实现
}
```

### 索引与范围

```csharp
int[] a = { 1, 2, 3, 4, 5 };
Console.WriteLine(a[^1]);      // 输出: 5(最后一个)
foreach (var x in a[1..3])
    Console.WriteLine(x);      // 输出: 2 3
```

### 异步流 `IAsyncEnumerable<T>`

```csharp
async IAsyncEnumerable<int> RangeAsync(int n)
{
    for (int i = 0; i < n; i++)
    {
        await Task.Delay(10);
        yield return i;
    }
}

await foreach (var i in RangeAsync(3))
    Console.WriteLine(i); // 输出: 0 1 2
```

### 空合并赋值 `??=`

```csharp
string? cache = null;
cache ??= "default";
Console.WriteLine(cache); // 输出: default
```

### `Dispose` ref struct

`ref struct` 可实现 `Dispose` 并由 `using` 调用,配合 `stackalloc` 用于零分配场景。

## C# 9.0

### `record`

```csharp
public record Point(int X, int Y);

var a = new Point(1, 2);
var b = new Point(1, 2);
Console.WriteLine(a == b);            // 输出: True(值相等)
Console.WriteLine(a with { X = 5 });  // 输出: Point { X = 5, Y = 2 }
```

`record` 自动生成构造函数、只读/init 属性、`Deconstruct`、`ToString`、值相等与哈希。详细内容见后文 `record` 专题。

### `init` 访问器

```csharp
public class Person
{
    public string Name { get; init; } = "";
}

var p = new Person { Name = "Ada" };
// p.Name = "Bob"; // 编译错误:init 之后只读
```

### 顶级语句

```csharp
// Program.cs 的全部内容
using System;

Console.WriteLine("Hello, World!");
```

编译器会把它包进隐式的 `Main`。一个项目只能有一个文件使用顶级语句。

### 目标类型 `new()`

```csharp
Dictionary<string, List<int>> map = new();
Point p = new(1, 2);
```

### 关系模式与逻辑模式

```csharp
bool IsLeap(int year) =>
    year is (> 1582) and ((int)0 == year % 4) &&
    (year % 100 != 0 || year % 400 == 0);
```

### 其他

- 协变返回类型:重写方法可返回更具体的类型。
- `static` 匿名函数,如 `static () => 1`。
- 原生大小整数 `nint` / `nuint`(平台相关位宽)。
- 模块初始化器:`[ModuleInitializer]` 标记的方法在程序集加载时运行。
- `foreach` 支持扩展 `GetEnumerator`。

## C# 10.0

### `record struct`

```csharp
public readonly record struct Temperature(double Celsius);
```

位置 `record struct` 默认是可变结构体,加 `readonly` 后属性只读。它的相等性同样是值相等,但**不能继承**。

### 结构体改进

```csharp
public struct Point
{
    public int X { get; set; }
    public int Y { get; set; }
    public Point(int x, int y) { X = x; Y = y; } // 参数化构造
}

var p = new Point();     // 无参构造也合法,字段零初始化
```

### `global using` 与文件范围命名空间

```csharp
// GlobalUsings.cs
global using System;
global using System.Linq;

// 文件范围命名空间,省去一层大括号
namespace MyApp.Services;
```

### 扩展属性模式

```csharp
var order = new { Customer = new { Name = "Ada" } };
bool match = order is { Customer.Name: "Ada" };
```

### Lambda 的天然类型与显式返回类型

```csharp
var f = (int x) => x + 1;                 // 天然类型:Funct<int,int>
var g = string (int x) => x.ToString();   // 显式返回类型
```

### `CallerArgumentExpression`

```csharp
void Assert(bool condition, [CallerArgumentExpression(nameof(condition))] string? expr = null)
{
    if (!condition) throw new Exception($"断言失败:{expr}");
}
```

## C# 11.0

### 原始字符串字面量

```csharp
string json = """
    {
      "name": "Ada",
      "age": 36
    }
    """;
```

规则如下:

- 起始与结束定界符的引号数量必须相同,至少三个 `"""`。
- 结束定界符所在行的**缩进**决定了所有内容行被剥离的公共缩进。
- 内容里可以出现一到两个连续引号,直到与定界符数量相同才需转义。
- 若内容需要以引号结尾或包含长引号串,可以增加引号数量(最多可到很多个)。

```csharp
string s = """他说:"你好"。""";
Console.WriteLine(s); // 输出: 他说:"你好"。
```

### `required` 成员

```csharp
public class Config
{
    public required string Host { get; init; }
    public int Port { get; init; } = 8080;
}

var c = new Config { Host = "localhost" }; // Port 有默认值
// var bad = new Config();                 // 编译错误:Host 未赋值
```

### 泛型数学(`static abstract` 成员)

```csharp
static T Sum<T>(IEnumerable<T> items) where T : INumber<T>
{
    T total = T.Zero;
    foreach (var item in items) total += item;
    return total;
}

Console.WriteLine(Sum(new[] { 1, 2, 3 }));     // 输出: 6
Console.WriteLine(Sum(new[] { 1.5, 2.5 }));    // 输出: 4
```

### 其他

- 泛型特性:特性类型可以是泛型。
- UTF-8 字符串字面量:`ReadOnlySpan<byte> b = "hi"u8;`
- 列表模式:`arr is [1, 2, .. var rest]`
- 文件局部类型:`file sealed class Helper {}`,仅本文件可见。
- 自动默认结构体:结构体字段自动零初始化,减少 `default` 样板。
- 字符串插值内换行:插值表达式中可以换行,提升可读性。
- `nameof` 作用域扩展:可在方法参数默认值中使用。

## C# 12.0

### 主构造函数

```csharp
public class UserService(ILogger<UserService> logger, IUserRepository repo)
{
    public void Save(User u)
    {
        logger.LogInformation("saving");
        repo.Save(u);
    }
}
```

类的主构造函数参数若只在字段初始化或属性初始化中使用,则会成为隐藏字段;若被别处捕获则成为捕获字段。结构体的主构造函数必须初始化所有字段。

### 集合表达式

```csharp
int[] a = [1, 2, 3];
List<string> names = ["Ada", "Bob"];
Span<int> s = [1, 2, 3];

int[] combined = [0, .. a, 4, .. a[1..]];
Console.WriteLine(string.Join(",", combined)); // 输出: 0,1,2,3,4,2,3
```

集合表达式根据目标类型决定生成 `T[]`、`List<T>`、`Span<T>`、`ImmutableArray<T>` 或自定义集合。展开运算符 `..` 可插入任意 `IEnumerable`。

```csharp
int[] FromEnumerable(IEnumerable<int> src) => [.. src]; // 一次枚举
```

### 内联数组

```csharp
[System.Runtime.CompilerServices.InlineArray(10)]
public struct Buffer
{
    private int _element0; // 编译器生成索引访问
}
```

### Lambda 默认参数

```csharp
var add = (int a, int b = 1) => a + b;
Console.WriteLine(add(5)); // 输出: 6
```

### `ref readonly` 参数

```csharp
void Show(ref readonly int value) => Console.WriteLine(value);
```

### `using` 别名任意类型

```csharp
using IntList = System.Collections.Generic.List<int>;
using Point = (int X, int Y);
```

### `[Experimental]`

标记 API 为实验性,调用方会产生诊断,便于库作者逐步演进接口。

## C# 13.0

### `params` 支持任意集合类型

```csharp
void PrintAll(params IEnumerable<int> values)
{
    foreach (var v in values) Console.Write(v);
}

PrintAll(1, 2, 3);          // 输出: 123
PrintAll([1, 2, 3]);        // 也可以直接传集合
```

### 新的 `System.Threading.Lock`

```csharp
private readonly Lock _gate = new();

void Increment()
{
    lock (_gate)
    {
        _counter++;
    }
}
```

`System.Threading.Lock` 提供了专门的 `EnterScope` 语义,`lock` 会优先使用它,减少对 `Monitor` 的间接开销。

### 转义符 `\e`

```csharp
Console.WriteLine("\e[31m红色\e[0m"); // ANSI 转义序列,等价于 \u001b
```

### 隐式索引访问

```csharp
// 对象初始化器中可对 Count 等属性使用隐式索引器语法
var list = new List<int> { [0] = 1 }; // 部分场景可用
```

### 迭代器与 async 方法中的 `ref` / `unsafe`

C# 13 放宽了 `ref struct` 的使用限制,允许 `ref`、`unsafe` 出现在更多场景。

### `ref struct` 实现接口

```csharp
public ref struct Cursor : IDisposable
{
    public void Dispose() { }
}
```

### `ref struct` 作为泛型参数

`where T : allows ref struct` 允许类型参数在实例化时传入 `ref struct`。

### 部分属性与索引器

```csharp
public partial class Widget
{
    public partial string Name { get; set; }
}

public partial class Widget
{
    private string _name = "";
    public partial string Name
    {
        get => _name;
        set => _name = value ?? "";
    }
}
```

### 重载解析优先级

```csharp
[OverloadResolutionPriority(1)]
void Handle(IEnumerable<int> items) { }
```

## C# 14.0

### 扩展成员

C# 14 把扩展方法升级为"扩展成员",不只是方法,还能扩展属性、静态成员与运算符:

```csharp
public static class EnumerableExtensions
{
    extension<TSource>(IEnumerable<TSource> source)
    {
        public IEnumerable<TSource> WhereNot(Func<TSource, bool> predicate)
            => source.Where(x => !predicate(x));

        public int CountWhen(Func<TSource, bool> predicate)
            => source.Count(predicate);

        public static IEnumerable<TSource> Empty => [];
    }
}
```

与旧式扩展方法相比:

```csharp
// 旧写法:每个方法都要重复 this 参数与泛型约束
public static class OldExtensions
{
    public static bool IsEmpty<T>(this IEnumerable<T> source) => !source.Any();
}

// 新写法:类型参数与接收者在 extension 块上声明一次
public static class NewExtensions
{
    extension<T>(IEnumerable<T> source)
    {
        public bool IsEmpty => !source.Any(); // 扩展属性
    }
}
```

扩展块语法 `extension(接收者)` 里可以写方法、属性、甚至 `static` 成员与运算符。这解决了长期以来"扩展属性"只能靠 `GetXxx()` 方法的尴尬。

### 空条件赋值

```csharp
Person? p = null;
p?.Name = "Ada";       // p 为 null 时整个赋值被跳过,不抛异常
Console.WriteLine(p?.Name); // 输出: (空)
```

这是 C# 14 最实用的小特性之一,消除了大量 `if (x != null) x.Y = z;` 样板。

### `nameof` 支持开放泛型

```csharp
Console.WriteLine(nameof(List<>)); // 输出: List
```

### `Span<T>` 的更多隐式转换

更多集合类型可隐式转换为 `Span<T>` / `ReadOnlySpan<T>`,简化零分配 API 的调用。

### 简单 Lambda 参数上的修饰符

```csharp
var f = (ref int x) => x++;
var g = (scoped Span<int> s) => s.Length;
```

无需显式写参数类型即可使用 `ref` / `scoped` 等修饰符。

### `field` 关键字

`field` 允许在属性访问器内部直接引用编译器生成的后备字段,不再需要手写 `_name`:

```csharp
// 以前必须手写后备字段
public class OldStyle
{
    private string _name = "";
    public string Name
    {
        get => _name;
        set => _name = value ?? throw new ArgumentNullException(nameof(value));
    }
}

// C# 14:交给编译器生成
public class NewStyle
{
    public string Name
    {
        get;
        set => field = value ?? throw new ArgumentNullException(nameof(value));
    }
}
```

`field` 引用的是自动生成的后备字段,可以在 `get` / `set` / `init` 中读写。

### 部分事件与构造函数

```csharp
public partial class Widget
{
    public partial event EventHandler? Clicked;
}
```

### 用户定义复合赋值运算符

类型可以自定义 `+=` 等复合赋值的行为,避免有时不必要的中间分配。

## 模式匹配专题

模式匹配是现代 C# 最核心的能力之一。它把"判断形状 + 提取数据"合并成单个表达式。

### 基本模式

```csharp
object value = 42;

if (value is int) { }              // 类型模式
if (value is int i) { }            // 声明模式:同时声明变量 i
if (value is 42) { }               // 常量模式
if (value is var v) { }            // var 模式:总能匹配,常用于 switch 兜底
if (value is not null) { }         // not + null,比 != null 更安全
if (value is _) { }                // 丢弃模式
```

### 属性模式

```csharp
record Address(string City, string Zip);
record Customer(string Name, Address Address, int Age);

bool eligible = customer is { Address.City: "Beijing", Age: >= 18 };

// 嵌套属性模式
bool isBeijing = customer is { Address: { City: "Beijing" } };
```

C# 10 起支持扩展属性模式 `{ Address.City: "..." }`,C# 8 则需要嵌套写法。

### 位置模式与解构

```csharp
var (x, y) = point;          // 解构
bool origin = point is (0, 0); // 位置模式

// 位置模式可与属性模式混用
bool special = point is (0, > 0);
```

### 关系模式与逻辑模式

```csharp
bool isTeen = age is >= 13 and <= 19;
bool notWeekend = day is not ("Sat" or "Sun");
bool ok = value is (> 0 and < 100) or 999;
```

`and` 优先级高于 `or`,建议显式加括号。

### 列表模式与切片模式

```csharp
int[] a = [1, 2, 3, 4];

bool startsWithOneTwo = a is [1, 2, ..];
bool hasMiddle = a is [1, .. var rest, 4];
Console.WriteLine(string.Join(",", rest)); // 输出: 2,3
```

空列表用 `[]` 匹配,至少一个元素用 `[..]`。

### `switch` 表达式与 `switch` 语句的取舍

```csharp
// 表达式:适合"每个分支产生一个值"
string Label(Shape s) => s switch
{
    Circle { Radius: > 10 } => "大圆",
    Circle => "小圆",
    Rectangle { Width: var w, Height: var h } when w == h => "正方形",
    Rectangle => "矩形",
    null => "无",
    _ => "未知",
};
```

选择建议:

- 需要返回/赋值 → 用 `switch` 表达式,更紧凑且强制穷尽检查。
- 需要执行多条语句、`break` / `continue` / `goto` → 用 `switch` 语句。
- 带 `when` 的分支保证顺序求值,**从上到下**匹配,把更具体的放前面。

### 用模式匹配重写 `if-else` 链

```csharp
// 传统写法
string Describe(object o)
{
    if (o is null) return "null";
    if (o is int i)
    {
        if (i > 0) return "正数";
        if (i < 0) return "负数";
        return "零";
    }
    if (o is string s && s.Length > 0) return "非空字符串";
    return "其他";
}

// 模式匹配写法
string DescribeModern(object o) => o switch
{
    null => "null",
    int i when i > 0 => "正数",
    int i when i < 0 => "负数",
    0 => "零",
    string { Length: > 0 } => "非空字符串",
    _ => "其他",
};
```

::: tip 穷尽性检查
`switch` 表达式对**密封类型 / 枚举 / 布尔**是穷尽的,编译器会在缺少分支时报警告。对开放类型(如 `object`)则必须提供 `_` 兜底。开启可空引用类型后,`null` 也需要显式分支。
:::

## `record` 专题

### `record class` 与 `record struct`

```csharp
public record class Person(string Name, int Age);   // 引用类型,支持继承
public record struct Point(int X, int Y);            // 值类型,不支持继承
public readonly record struct Temp(double C);        // 只读值类型
```

`record class` 是引用类型,`record struct` 是值类型。两者都生成值相等,但语义边界不同:结构体的相等是不含装箱的逐字段比较,且没有继承带来的相等性契约复杂度。

### 编译器自动生成什么

对 `public record Point(int X, int Y)`:

```csharp
// 编译器生成(简化):
public int X { get; init; }
public int Y { get; init; }
public Point(int X, int Y);                 // 主构造函数
public void Deconstruct(out int X, out int Y);
public override string ToString();          // Point { X = 1, Y = 2 }
public override bool Equals(object? obj);
public bool Equals(Point? other);
public override int GetHashCode();
protected Point(Point original);            // 复制构造函数,供 with 使用
public static bool operator ==(Point left, Point right);
public static bool operator !=(Point left, Point right);
```

### `with` 表达式

```csharp
var a = new Point(1, 2);
var b = a with { X = 5 };
Console.WriteLine(b); // 输出: Point { X = 5, Y = 2 }
```

`with` 通过对复制构造函数的结果应用对象初始化器实现,是**浅拷贝**:

```csharp
public record Bag(List<int> Items);
var b1 = new Bag([1, 2]);
var b2 = b1 with { };
b2.Items.Add(3);
Console.WriteLine(string.Join(",", b1.Items)); // 输出: 1,2,3(共享同一个 List)
```

对 `record struct` 使用 `with` 会先复制整个结构体,再应用修改,行为类似但意义不同。

### 位置记录与显式属性记录

```csharp
// 位置记录:属性由参数列表决定
public record Person(string Name, int Age);

// 显式属性:可加验证、计算属性、不同可见性
public record Money
{
    public required decimal Amount { get; init; }
    public string Currency { get; init; } = "CNY";
    public decimal InUsd => Amount / 7.2m;
}
```

两者可以混用。位置记录适合 DTO,显式属性记录适合需要校验或派生成员的领域对象。

### 记录的继承规则

```csharp
public record Person(string Name);
public record Employee(string Name, string Title) : Person(Name);
```

派生记录必须调用基类主构造函数。`record` 的相等性要求**运行时类型相同**,因此 `new Person("a") != new Employee("a", "dev")`。

### 相等性的坑

`record` 的相等性是逐字段调用 `Equals`。当字段是集合时,`List<T>` 用的是引用相等:

```csharp
var a = new Bag([1, 2]);
var b = new Bag([1, 2]);
Console.WriteLine(a == b); // 输出: False(List 引用不同)
```

如果希望集合参与值相等,需要换成自定义的不可变集合并实现逐元素比较。

::: warning 可变状态与哈希
把可变对象放进 `HashSet` 或作为 `Dictionary` 键后再修改其字段,会导致哈希值改变、查找失败。`record` 也不能豁免这一点:它自动生成的 `GetHashCode` 基于字段值。
:::

### 适用场景

- DTO 与 API 请求/响应模型。
- 领域事件与消息(值相等便于测试与去重)。
- 不可变数据与配置对象。
- 需要 `with` 做非破坏性修改的场景。

不适合:需要可变状态且以引用身份为核心的对象、需要继承层次且不关心值相等的行为型对象。

## 语言版本控制

### `LangVersion`

```xml
<PropertyGroup>
  <LangVersion>latest</LangVersion>
</PropertyGroup>
```

| 取值 | 含义 |
| --- | --- |
| `default` | 由当前 TFM 决定(通常是该 TFM 对应的最新稳定语言版本) |
| `latest` | 编译器支持的最新**稳定**语言版本 |
| `preview` | 包含尚未稳定的预览特性,可能随编译器更新而变化 |
| `12` / `13` / `14` | 锁定到某个具体版本 |
| `latestMajor` | 最新的主版本 |

::: danger 预览特性的风险
`LangVersion=preview` 允许你使用未定稿的语法,但同一份代码在下一次 SDK 升级后可能编译失败,依赖它们的库也不适合发布。生产项目应显式锁定语言版本(如 `<LangVersion>14</LangVersion>`),仅在实验分支使用 `preview`。
:::

### 语言版本与 TFM 的对应关系

语言版本由**编译器**决定,而不是运行时。较新的 SDK 可以编译较旧的 TFM:

```xml
<TargetFramework>netstandard2.0</TargetFramework>
<LangVersion>latest</LangVersion>
```

但某些特性依赖运行时类型或特性标记,在旧 TFM 上会因为缺少这些类型而编译失败。常见需要 polyfill 的场景:

- `init` / `record` 需要 `System.Runtime.CompilerServices.IsExternalInit`。
- `required` 需要 `RequiredMemberAttribute` 及配套特性。
- `record struct` / `with` 需要 `IsExternalInit`。
- 集合表达式可能在部分目标上需要 `CollectionBuilderAttribute`。

做法是定义一个内部类型:

```csharp
namespace System.Runtime.CompilerServices
{
    internal static class IsExternalInit { }
}
```

或引用官方 polyfill 包 `PolySharp`。

### 多目标与条件编译

```xml
<TargetFrameworks>net8.0;net10.0</TargetFrameworks>
```

```csharp
#if NET8_0_OR_GREATER
    // .NET 8 及以上可用的 API
    builder.Services.AddKeyedSingleton<ICache, RedisCache>("redis");
#else
    builder.Services.AddSingleton<ICache, RedisCache>();
#endif
```

常用符号:`NET8_0_OR_GREATER`、`NETSTANDARD2_0`、`NETFRAMEWORK`、`DEBUG`、`RELEASE`。它们由 SDK 自动定义,不需要手写。自定义符号用 `<DefineConstants>`。

### 启用预览特性

```xml
<PropertyGroup>
  <LangVersion>preview</LangVersion>
</PropertyGroup>
```

某些特性还需要运行时开关(如早期版本的可空引用类型需要 `Nullable` 上下文),或者需要 SDK 达到特定版本。

## 常见坑

1. **`record` 的集合字段不参与值相等**。`List<T>` 用引用相等,两个内容相同但不同的 `List` 会让 `==` 返回 `False`。需要值语义时改用逐元素比较或不可变集合。

2. **`with` 对引用字段是浅拷贝**。`record` 复制的是字段里的引用,内部集合仍被共享。修改复制体的集合会影响原对象。

3. **主构造函数参数的捕获时机**。类的主构造函数参数若参与字段初始化,会在构造时求值一次;若在成员方法里使用,则每次访问都读取捕获字段。把它当"惰性"来用会出错。

4. **集合表达式可能重复枚举 `IEnumerable`**。`[.. GetItems()]` 对一次性序列只会枚举一次,但把同一个 `IEnumerable` 用于多个集合表达式会各自枚举,产生意外副作用。必要时先 `.ToList()`。

5. **`required` 与 JSON 反序列化**。`required` 是编译期约束,`System.Text.Json` 在 .NET 7+ 反序列化时会把缺失的 `required` 成员视为错误;若用旧版本或忽略 null 的配置,可能绕过检查,导致运行时 `NullReferenceException`。

6. **`field` 关键字与既有标识符冲突**。旧代码里若存在名为 `field` 的变量或字段,升级到 C# 14 后属性访问器内的 `field` 会解析为上下文关键字。用 `@field` 转义或重命名。

7. **可空引用类型不是运行时保护**。`string?` 与 `string` 在 IL 里完全相同,`null!` 或反射仍可注入 `null`。可空分析只是静态提示。

8. **`switch` 表达式对开放类型不穷尽**。对 `object`、抽象基类等,忘记写 `_` 会得到警告而非错误,运行期落到 `_` 之外会抛 `SwitchExpressionException`。

9. **模式匹配的分支顺序会被改变**。`case int i when i > 0` 必须在 `case int` 之前,否则后者永远命中。`switch` 表达式从上到下求值,顺序即语义。

10. **`dynamic` 绕过编译期检查且性能差**。把 `dynamic` 当"万能类型"用会带来 `RuntimeBinderException` 与明显的反射开销,应限于互操作场景。

11. **原始字符串的缩进剥离容易误判**。结束定界符的缩进是基准线,内容行缩进少于它会导致编译错误。混用制表符与空格时尤其容易出问题。

12. **`init` 属性的反射赋值**。`init` 只在编译期限制,反射/序列化器仍可写入。不要把 `init` 当作安全边界。

13. **`record` 继承要求运行时类型相同**。`Person` 与派生 `Employee` 即便字段一致也不相等,写成集合去重时要注意。

14. **`LangVersion` 与 TFM 不匹配**。目标 `netstandard2.0` 却使用 `required` / `record`,会因缺少运行时类型而编译失败,需要 polyfill。
