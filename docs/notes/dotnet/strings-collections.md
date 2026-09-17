# 3. 字符串、数组与集合

C# 把字符串、数组和集合这三类数据结构都做成了语言级或 BCL 级的一等公民。理解它们的语义（尤其是字符串的不可变性与集合的接口层次）是写不出性能陷阱的前提。本篇按字符串、数组、集合、迭代与相等性四个部分展开。

## 字符串

### string 是不可变引用类型

`string` 是引用类型（`System.String`），但它是**不可变**的：任何看起来"修改"字符串的操作，实际都会分配一个新的 `string` 对象并返回，原对象永不改变。

```csharp
string a = "hello";
string b = a.ToUpper();      // b 是新对象
Console.WriteLine(a);        // 输出: hello
Console.WriteLine(b);        // 输出: HELLO
Console.WriteLine(object.ReferenceEquals(a, b)); // 输出: False
```

不可变带来的后果：

- **线程安全**：多个线程随意共享同一个字符串引用，无需加锁。
- **可作为字典键**：哈希值在生命周期内不会变化。
- **性能开销**：循环里拼接字符串会不断分配新对象，产生大量垃圾。

```csharp
// 反面教材：循环内拼接，每次都新建对象
string s = "";
for (int i = 0; i < 10000; i++)
{
    s += i.ToString();   // 第 n 次迭代分配长度约 n 的新字符串
}
```

::: warning
字符串相加的时间复杂度由表面上的"一次操作"变成 O(n)，循环拼接总体是 O(n²)。数据量大时必须改用 `StringBuilder`。
:::

### 字符串驻留（intern pool）

CLR 维护一个进程级的字符串池。**代码中的字符串字面量**会被自动驻留，内容相同的字面量共享同一个对象。

```csharp
string x = "abc";
string y = "abc";
Console.WriteLine(object.ReferenceEquals(x, y)); // 输出: True

string z = new string(new[] { 'a', 'b', 'c' });
Console.WriteLine(object.ReferenceEquals(x, z)); // 输出: False
Console.WriteLine(x == z);                        // 输出: True（值相等）
```

`string.Intern` 可以手动把运行时构造的字符串加入池；`IsInterned` 查询是否已驻留，未驻留返回 `null`。

```csharp
string runtime = string.Concat("ab", "c");   // 运行时拼接，不自动驻留
Console.WriteLine(string.IsInterned(runtime) is null); // 输出: True
string interned = string.Intern(runtime);
Console.WriteLine(object.ReferenceEquals(interned, "abc")); // 输出: True
```

::: tip
驻留池不会被 GC 回收（在 .NET Core 之前的行为尤其明显），因此**不要对大量动态生成的、唯一性高的字符串调用 `Intern`**，否则内存只增不减。驻留只对"重复出现的少量字符串"有意义。仅靠池来做相等比较判断也是坏习惯，因为池的命中不是语言保证。
:::

### 字符串比较

C# 的字符串比较有两个维度：**用不用文化规则**，以及**是否区分大小写**。默认的重载往往不是你想要的。

| 方式 | 含义 | 典型场景 |
| --- | --- | --- |
| `Ordinal` | 逐字节（UTF-16 码元）比较，最快 | 内部标识符、协议解析、哈希键 |
| `OrdinalIgnoreCase` | 序数比较但忽略 ASCII 大小写 | 文件扩展名、配置键 |
| `CurrentCulture` | 跟随当前线程区域，结果随机器/用户变化 | 面向用户展示的排序 |
| `CurrentCultureIgnoreCase` | 同上，忽略大小写 | 用户可见的模糊匹配 |
| `InvariantCulture` | 固定区域，跨平台稳定 | 存储、日志、序列化 |

```csharp
string u = "straße";
Console.WriteLine(u.Contains("STRASSE", StringComparison.OrdinalIgnoreCase));      // 输出: False
Console.WriteLine(u.Contains("STRASSE", StringComparison.CurrentCultureIgnoreCase)); // 输出: True

// 土耳其语问题：'i' 的大写在 tr-TR 下是 'İ'
var tr = new System.Globalization.CultureInfo("tr-TR");
string lower = "i".ToUpper(tr);
Console.WriteLine(lower == "I");    // 输出: False
```

**`==` 运算符的行为**：`string` 重载了 `==`/`!=`，执行的是 `Ordinal` 值比较，而非引用比较。

```csharp
string p = "hello";
string q = "hel" + "lo";
Console.WriteLine(p == q); // 输出: True（编译器常量折叠后同一字面量）
object op = p;
object oq = q;
Console.WriteLine(op == oq); // 输出: False（object 上的 == 是引用比较）
```

::: danger
当变量静态类型是 `object` 时，`==` 退化为引用比较。这是常见 bug：把字符串塞进 `object` 或非泛型集合后再比较。需要值比较时显式用 `Equals` 或 `string.Equals(a, b, StringComparison.Ordinal)`。
:::

`string.Compare` 返回负/零/正表示排序先后，用于排序；`CompareOrdinal` 是纯序数版本。排序时若要稳定结果，应始终传 `StringComparison`（或 `StringComparer`）。

### 常用方法逐个示例

```csharp
string s = "  Hello, World  ";

Console.WriteLine(s.Length);                 // 输出: 16
Console.WriteLine(s.Substring(2, 5));        // 输出: Hello
Console.WriteLine(s.IndexOf("World"));       // 输出: 9
Console.WriteLine(s.IndexOf("world", StringComparison.OrdinalIgnoreCase)); // 输出: 9
Console.WriteLine(s.IndexOf('o', 5));        // 从索引 5 起找，输出: 9
Console.WriteLine(s.LastIndexOf('o'));       // 输出: 11

Console.WriteLine(s.Contains("World"));                     // 输出: True
Console.WriteLine(s.StartsWith("  He"));                    // 输出: True
Console.WriteLine(s.EndsWith("  "));                        // 输出: True
Console.WriteLine(s.Replace("World", "C#"));                // 输出:   Hello, C#  
Console.WriteLine(s.Trim());                                // 输出: Hello, World
Console.WriteLine(s.TrimStart());                           // 输出: Hello, World  
Console.WriteLine("xxHelloxx".Trim('x'));                   // 输出: Hello
Console.WriteLine("12".PadLeft(5, '0'));                    // 输出: 00012
Console.WriteLine("12".PadRight(5, '.'));                   // 输出: 12...
Console.WriteLine("abcdef".Remove(3));                      // 输出: abc
Console.WriteLine("abcdef".Remove(1, 2));                   // 输出: adef
Console.WriteLine("abc".Insert(1, "XY"));                   // 输出: aXYbc
Console.WriteLine("ABC".ToLowerInvariant());                // 输出: abc
```

`Split` 有多种重载：

```csharp
string csv = "a,,b, c ,";
string[] parts1 = csv.Split(',');                              // ["a", "", "b", " c ", ""]
string[] parts2 = csv.Split(',', StringSplitOptions.RemoveEmptyEntries);
string[] parts3 = csv.Split(',', StringSplitOptions.TrimEntries);
string[] parts4 = csv.Split(',',
    StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
// parts4: ["a", "b", "c"]

// 多字符分隔符 + 限制数量
string[] parts5 = "k1=v1;k2=v2;k3=v3".Split(';', 2);
// parts5: ["k1=v1", "k2=v2;k3=v3"]

string[] byString = "a::b::c".Split("::", StringSplitOptions.None); // ["a","b","c"]
```

`string.Join` 把序列拼起来，是 `Split` 的逆操作：

```csharp
Console.WriteLine(string.Join(", ", new[] { 1, 2, 3 })); // 输出: 1, 2, 3
Console.WriteLine(string.Join('-', "abc"));               // 输出: a-b-c
```

空判断永远用框架方法，不要自己写 `s == null || s.Length == 0`：

```csharp
Console.WriteLine(string.IsNullOrEmpty(null));       // 输出: True
Console.WriteLine(string.IsNullOrWhiteSpace(" \t\n"));// 输出: True
```

::: warning
`string.IsNullOrEmpty` 对于只含空白的字符串返回 `False`。校验用户输入时应优先用 `IsNullOrWhiteSpace`。
:::

### StringBuilder

`StringBuilder` 内部维护一个可变的字符缓冲区，追加时只在容量不足时扩容，避免每次拼接都分配。

```csharp
using System.Text;

var sb = new StringBuilder();
sb.Append("Hello");
sb.Append(' ');
sb.Append("World");
sb.AppendLine("!");
sb.Insert(0, ">> ");
sb.Replace("World", "C#");
Console.WriteLine(sb.ToString()); // 输出: >> Hello C#!
Console.WriteLine(sb.Length);     // 输出: 14
Console.WriteLine(sb.Capacity);   // 输出: 16（默认初始容量）
```

容量从 16 开始，不足时**翻倍**（`Capacity * 2`），并按需向上取整。如果能预估最终长度，构造时传入容量可以避免中途多次扩容与复制。

```csharp
var sb2 = new StringBuilder(capacity: 8192);
```

**判断标准**：如果在循环里做**固定次数以上**（经验值约 5 次以上）的拼接，或拼接发生在编译期无法确定的循环中，就用 `StringBuilder`。少量、固定的拼接（如 `$"{a}{b}"`）编译器会优化成 `string.Concat`，直接用 `+` 或插值即可。

### 字符串插值

`$"..."` 是插值字符串，`{}` 内可以放表达式，支持对齐和格式说明符：

```csharp
decimal price = 1234.5m;
DateTime now = new(2026, 9, 17);
Console.WriteLine($"{price,12:N2}|");   // 输出:     1,234.50|
Console.WriteLine($"{price,-12:N2}|");  // 输出: 1,234.50    |
Console.WriteLine($"{now:yyyy-MM-dd}"); // 输出: 2026-09-17
Console.WriteLine($"{3.14159:F2}");     // 输出: 3.14
Console.WriteLine($"{(price > 0 ? "正" : "负")}"); // 括号内可放三元表达式
```

`$@""` 组合了逐字字符串（不转义反斜杠）与插值：

```csharp
string path = @"C:\temp";
Console.WriteLine($@"路径是 {path}\file.txt");
```

C# 8 起还支持**逐字插值原始字符串** `$@"""..."""`，而 C# 11 引入的原始字符串字面量对多行与内嵌引号非常友好：

```csharp
// C# 11 原始字符串：开头的三个引号后必须换行，结尾三个引号独占一行
string json = """
    {
        "name": "Cherry",
        "path": "C:\\temp"
    }
    """;
// 结果中公共缩进（由结尾引号的位置决定）会被去掉

// 内容含引号时，用更多引号定界
string quoted = """He said "hi" and "bye".""";
```

引号数量规则：定界符至少 3 个引号，内容里出现的连续引号数量必须**少于**定界符数量。三引号可容纳最多两个连续引号，需要三个连续引号时用四引号定界。去掉前导空白时，以**闭合定界符所在行的缩进**为基准，移除每行相同数量的前导空白。

C# 11 允许插值中的换行（换行不再被迫写成 `\n`）：

```csharp
Console.WriteLine($"""
    第一行
    第二行
    """);
```

::: tip
原始字符串是写 SQL、JSON、正则、XML 的最佳选择——不用转义反斜杠，缩进自动对齐。插值原始字符串里若内容需要 `{`，按定界符数量用多个 `$`，会相应减少需要转义的 `{` 个数。
:::

### UTF-8 字符串字面量

C# 11 起，字符串后缀 `u8` 会产生 `ReadOnlySpan<byte>` 形式的 UTF-8 字节序列，编译期生成，无运行时编码开销：

```csharp
ReadOnlySpan<byte> utf8 = "héllo"u8;
Console.WriteLine(utf8.Length); // 输出: 6（é 占 2 字节）

// 适合直接喂给面向 UTF-8 的 API，如 System.Text.Json
```

适用场景：作为 `ReadOnlySpan<byte>` 传给 `Utf8JsonReader`、`Encoding.UTF8.GetBytes` 的替代、网络协议解析等需要字节而非 UTF-16 的场合。

### char 与 Rune

`char` 是 16 位 UTF-16 **码元**，不是"一个字符"。基本多文种平面之外的字符（如大量 emoji、生僻汉字）需要两个 `char` 组成**代理对**。

```csharp
string emoji = "😀";          // U+1F600
Console.WriteLine(emoji.Length); // 输出: 2（两个 char）
Console.WriteLine(emoji[0]);     // 输出代理对的高位，无意义

var rune = System.Text.Rune.GetRuneAt(emoji, 0);
Console.WriteLine(rune.Value);   // 输出: 128512
foreach (Rune r in emoji.EnumerateRunes())
{
    Console.WriteLine(r.ToString()); // 输出: 😀（整体）
}
```

需要正确处理"字符"边界时（计数、截断、反转），用 `System.Text.Rune` 或 `StringInfo`（字素簇，处理组合字符）：

```csharp
var info = new System.Globalization.StringInfo("a\u0301b"); // a + 组合重音符 + b
Console.WriteLine(info.LengthInTextElements); // 输出: 2
```

### 编码

`System.Text.Encoding` 负责 `string`（UTF-16 内存表示）与字节序列的转换：

```csharp
using System.Text;

byte[] bytes = Encoding.UTF8.GetBytes("你好");
Console.WriteLine(bytes.Length);                 // 输出: 6（每字 3 字节）
string back = Encoding.UTF8.GetString(bytes);
Console.WriteLine(back);                          // 输出: 你好

// Encoding.Default 在 .NET Core 里始终是 UTF-8（不再是系统 ANSI 代码页）
Console.WriteLine(ReferenceEquals(Encoding.Default, Encoding.UTF8)); // 输出: True

// 用 GBK 等代码页需显式注册
Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
var gbk = Encoding.GetEncoding("GBK");
```

**BOM**：`Encoding.UTF8` 的 `GetBytes` **不写 BOM**；带 BOM 的版本是 `new UTF8Encoding(encoderShouldEmitUTF8Identifier: true)`。写文件时指定编码：

```csharp
File.WriteAllText("a.txt", "内容", new UTF8Encoding(false)); // 不写 BOM
File.WriteAllText("b.txt", "内容", Encoding.UTF8);           // File 系列默认也不写 BOM
```

::: danger
读取带 BOM 的文件时，如果调用方把 BOM 当成内容，字符串开头会出现 `\uFEFF`，导致比较失败。用 `File.ReadAllText` 会自动识别并剥离 BOM，但用 `StreamReader` 配错编码则可能保留。处理 BOM 的稳妥做法是统一用 `StreamReader` 的 BOM 检测（默认开启）。
:::

### 格式化与 IFormatProvider

`ToString` 的格式字符串与 `IFormatProvider` 决定输出。**数值和日期序列化时必须传 `CultureInfo.InvariantCulture`**，否则在 `de-DE` 等区域下小数点会变成逗号。

```csharp
double v = 1234567.891;
Console.WriteLine(v.ToString("N2", System.Globalization.CultureInfo.InvariantCulture));
// 输出: 1,234,567.89
Console.WriteLine(v.ToString("F3", System.Globalization.CultureInfo.InvariantCulture));
// 输出: 1234567.891
Console.WriteLine(v.ToString("E2", System.Globalization.CultureInfo.InvariantCulture));
// 输出: 1.23E+006

DateTime d = new(2026, 9, 17, 13, 5, 0);
Console.WriteLine(d.ToString("yyyy-MM-dd HH:mm:ss",
    System.Globalization.CultureInfo.InvariantCulture)); // 输出: 2026-09-17 13:05:00
Console.WriteLine(d.ToString("O")); // 往返格式，输出: 2026-09-17T13:05:00.0000000
```

自定义类型实现 `IFormattable` 可支持 `$"{value:fmt}"`：

```csharp
public readonly struct Temperature : IFormattable
{
    private readonly double _celsius;
    public Temperature(double celsius) => _celsius = celsius;

    public string ToString(string? format, IFormatProvider? provider)
        => format?.ToUpperInvariant() switch
        {
            "F" => $"{_celsius * 9 / 5 + 32:F1}°F",
            _   => $"{_celsius:F1}°C",
        };

    public override string ToString() => ToString(null, null);
}

Console.WriteLine($"{new Temperature(100):F}"); // 输出: 212.0°F
```

## 数组

### 声明与初始化

```csharp
int[] a = new int[5];                    // 5 个 0
int[] b = new int[] { 1, 2, 3 };
int[] c = { 1, 2, 3 };                   // 简化写法
int[] d = [1, 2, 3];                     // C# 12 集合表达式
int[] e = new int[3] { 1, 2, 3 };        // 长度与元素都写
string[] f = new string[2];              // 默认 null

int[] g = new int[4];                    // 默认值: 0
bool[] h = new bool[4];                  // 默认值: false
double[] i2 = new double[4];             // 默认值: 0.0

Console.WriteLine(g[0]);                 // 输出: 0
```

引用类型元素的默认值是 `null`；值类型元素是 `default(T)`（数值 0、`false`、结构体全零）。数组一经创建长度固定。

### Array 静态方法

```csharp
int[] nums = { 5, 2, 8, 1, 9 };

Console.WriteLine(nums.Length);     // 输出: 5
Console.WriteLine(nums.LongLength); // 输出: 5（long 类型，超大数组用）
Console.WriteLine(nums.Rank);       // 输出: 1（维度数）

Array.Sort(nums);                   // 原地排序
Console.WriteLine(string.Join(',', nums)); // 输出: 1,2,5,8,9
Array.Reverse(nums);                // 原地反转
Console.WriteLine(string.Join(',', nums)); // 输出: 9,8,5,2,1

Console.WriteLine(Array.IndexOf(nums, 5)); // 输出: 2

int[] copy = new int[5];
Array.Copy(nums, copy, 3);          // 复制前 3 个
Array.Fill(copy, 7);                // 全部填 7

int[] resized = nums;
Array.Resize(ref resized, 10);      // 注意：创建了新数组！
Console.WriteLine(resized.Length);  // 输出: 10

int[] empty = Array.Empty<int>();   // 缓存的零长度数组，避免重复分配
```

::: warning
`Array.Resize(ref arr, n)` **不是**在原有数组上扩容，它内部 `new` 一个新数组、复制旧内容、再把它赋回 `arr`。所有指向旧数组的引用不受影响，性能与显式新建相同。频繁扩容应改用 `List<T>`。
:::

### 多维数组 vs 交错数组

```csharp
int[,] rect = new int[2, 3];        // 矩形多维数组，一块连续内存
rect[0, 0] = 1;
Console.WriteLine(rect.Rank);       // 输出: 2
Console.WriteLine(rect.GetLength(0)); // 输出: 2
Console.WriteLine(rect.GetLength(1)); // 输出: 3

int[][] jagged = new int[2][];      // 交错数组，元素是数组引用
jagged[0] = new int[] { 1, 2, 3 };
jagged[1] = new int[] { 4, 5 };
Console.WriteLine(jagged[1].Length); // 输出: 2
```

- `int[,]`：单个对象、内存连续，缓存友好，但每行长度必须相同。
- `int[][]`：数组的数组，每行长度可不同，访问需两次解引用，但可单独替换某一行。

数学/矩阵计算用 `int[,]`；表示"键到不定长列表"之类的结构用 `int[][]`。

### 数组协变

数组在 C# 里是**协变**的：`string[]` 可以赋给 `object[]`，甚至接口数组。这是从 Java 时代继承下来的历史设计，但会破坏类型安全，所以写入时做运行时检查。

```csharp
string[] strings = { "a", "b" };
object[] objects = strings;         // 编译通过
objects[0] = "c";                   // 正常
try
{
    objects[1] = 42;                // 运行时抛异常
}
catch (ArrayTypeMismatchException ex)
{
    Console.WriteLine("写入失败: " + ex.GetType().Name);
    // 输出: 写入失败: ArrayTypeMismatchException
}
```

::: danger
数组协变只允许"读取方向的兼容赋值"，写入靠运行时检查兜底。泛型 `List<T>` 是不变的，`List<string>` 不能赋给 `List<object>`——这反而更安全。要协变地传递数据，用 `IEnumerable<out T>` 这类只读接口。
:::

### 数组与 Span`<T>`

`T[]` 可以隐式转换为 `Span<T>`（可写）或 `ReadOnlySpan<T>`，从而获得切片、零分配访问：

```csharp
int[] arr = { 1, 2, 3, 4, 5 };
Span<int> span = arr;
Span<int> middle = span.Slice(1, 3); // 无拷贝，{2,3,4}
Console.WriteLine(middle[0]);        // 输出: 2
```

详见第 9 篇。

### 集合表达式（C# 12）

```csharp
int[] a = [1, 2, 3];
List<int> b = [4, 5, 6];
Span<int> c = [7, 8];
int[] combined = [.. a, 0, .. b];    // 展开：1,2,3,0,4,5,6
Console.WriteLine(string.Join(',', combined)); // 输出: 1,2,3,0,4,5,6

// 空集合
List<int> empty = [];
```

展开运算符 `..` 要求被展开对象可枚举，结果会构造目标类型。集合表达式是**目标类型**推断的，没有目标类型时不能使用。

## 集合

### 接口层次

```text
IEnumerable<T>
    └── ICollection<T>
            ├── IList<T>        （有序、可按索引）
            ├── ISet<T>         （无重复）
            └── IDictionary<TKey,TValue>  （键值对）
```

- `IEnumerable<T>`：只能遍历（`GetEnumerator`）。
- `ICollection<T>`：增加 `Count`、`Add`、`Remove`、`Contains`、`Clear`。
- `IList<T>`：增加索引访问 `this[int]`、`Insert`、`RemoveAt`、`IndexOf`。
- `IDictionary<TKey,TValue>`：键值访问 `this[TKey]`、`Keys`、`Values`、`TryGetValue`。
- `IReadOnlyCollection<T>` / `IReadOnlyList<T>` / `IReadOnlyDictionary<TKey,TValue>`：只读视图接口，公开 API 优先用它们。

### List`<T>`

```csharp
var list = new List<int> { 1, 2, 3 };
list.Add(4);
list.Insert(0, 0);                       // O(n)，后面元素后移
Console.WriteLine(list.IndexOf(3));      // 输出: 3
list.Remove(3);                          // 按值删除，O(n)
list.RemoveAt(0);                        // 按下标删除，O(n)
int removed = list.Find(x => x > 2);     // 返回第一个匹配
List<int> found = list.FindAll(x => x > 1);
list.RemoveAll(x => x % 2 == 0);         // 返回删除个数
```

`List<T>` 内部就是 `T[]` + `Count`。添加时若容量不足，扩容为原来的 **2 倍**（至少到所需大小），并把旧数组复制过去。默认初始容量为 0，第一次 `Add` 才分配 4。

```csharp
var l = new List<int>(capacity: 100);    // 预估容量，避免反复扩容
Console.WriteLine(l.Capacity);           // 输出: 100
l.TrimExcess();                          // 收缩到实际 Count
```

`Remove` 是 O(n)：先 `IndexOf`（O(n)），再移动后续元素（O(n)）。按下标 `RemoveAt` 也是 O(n)，因为要移位。若需要频繁从中间删除，考虑 `LinkedList<T>` 或"标记 + 批量清理"。

排序与二分查找：

```csharp
var nums = new List<int> { 5, 1, 3, 2, 4 };
nums.Sort();                             // 原地排序
Console.WriteLine(string.Join(',', nums)); // 输出: 1,2,3,4,5
int idx = nums.BinarySearch(3);           // 要求已排序，O(log n)
Console.WriteLine(idx);                   // 输出: 2

// 自定义比较
nums.Sort((x, y) => y.CompareTo(x));      // 降序
```

### Dictionary`<TKey,TValue>`

基于哈希表，平均查找/插入/删除 O(1)。核心是"**一次查找**"模式：

```csharp
var ages = new Dictionary<string, int>
{
    ["alice"] = 30,
    ["bob"] = 25,
};

// 推荐：TryGetValue 只查一次
if (ages.TryGetValue("alice", out int age))
{
    Console.WriteLine(age);            // 输出: 30
}

// 不推荐：ContainsKey + 索引器 = 两次哈希查找
if (ages.ContainsKey("bob"))
{
    Console.WriteLine(ages["bob"]);    // 两次查找
}

// 键不存在时给默认值
int missing = ages.GetValueOrDefault("carol", -1); // 输出: -1

// 只在不存在时添加
bool added = ages.TryAdd("carol", 40);  // 输出: True
ages.TryAdd("carol", 50);               // 失败，保留 40

// 删除并拿到被删的值
if (ages.Remove("bob", out int removedAge))
{
    Console.WriteLine(removedAge);      // 输出: 25
}

// 累加计数惯用法
ages["dave"] = ages.GetValueOrDefault("dave") + 1;
```

键的相等性：默认用 `EqualityComparer<TKey>.Default`，即 `Equals` + `GetHashCode`。**重写 `Equals` 必须同时重写 `GetHashCode`**，否则字典查不到。也可以在构造时传自定义比较器：

```csharp
var ignoreCase = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
{
    ["Name"] = 1,
};
Console.WriteLine(ignoreCase["name"]); // 输出: 1
```

::: warning
不要在字典里用可变对象作键，或者作键后不要修改其影响 `GetHashCode` 的字段。哈希桶位置在插入时就定了，键变了就再也找不到。字符串作键最安全，因为不可变。
:::

C# 13 / .NET 9 起，`Dictionary<TKey,TValue>` 提供 `GetAlternateLookup`，可以用 `ReadOnlySpan<char>` 直接查找字符串键，避免为查找临时分配字符串：

```csharp
var dict = new Dictionary<string, int> { ["hello"] = 1 };
var lookup = dict.GetAlternateLookup<ReadOnlySpan<char>>();
ReadOnlySpan<char> key = "hello".AsSpan();
Console.WriteLine(lookup[key]); // 输出: 1
```

### `HashSet<T>` 与 `SortedSet<T>`

```csharp
var a = new HashSet<int> { 1, 2, 3, 4 };
var b = new HashSet<int> { 3, 4, 5 };

a.UnionWith(b);            // 并集，a = {1,2,3,4,5}
a.IntersectWith(new[]{ 4, 5, 6 }); // 交集，a = {4,5}
a.ExceptWith(new[]{ 5 });  // 差集，a = {4}
Console.WriteLine(a.IsSubsetOf(new[]{ 4, 5, 6 })); // 输出: True

var sorted = new SortedSet<int> { 3, 1, 2 };
Console.WriteLine(string.Join(',', sorted)); // 输出: 1,2,3
```

`HashSet<T>` 操作平均 O(1)，`SortedSet<T>` 基于红黑树，操作 O(log n) 但保持有序，支持 `GetViewBetween`、`Min`/`Max`。

### Queue / Stack / LinkedList

```csharp
var q = new Queue<int>();
q.Enqueue(1); q.Enqueue(2);
Console.WriteLine(q.Dequeue());  // 输出: 1（FIFO）

var st = new Stack<int>();
st.Push(1); st.Push(2);
Console.WriteLine(st.Pop());     // 输出: 2（LIFO）

var ll = new LinkedList<int>();
var node = ll.AddLast(2);
ll.AddFirst(1);
ll.AddAfter(node, 3);            // O(1)，前提是已有节点引用
Console.WriteLine(ll.First!.Value); // 输出: 1
```

- `Queue<T>`：任务排队、BFS。
- `Stack<T>`：撤销栈、DFS、表达式求值。
- `LinkedList<T>`：已持有节点引用时的 O(1) 插入删除；但随机访问 O(n)，缓存不友好，多数场景 `List<T>` 更快。

### SortedDictionary vs SortedList

两者都按键排序，都是 O(log n) 查找。区别在底层结构与内存：

| | SortedDictionary | SortedList |
| --- | --- | --- |
| 底层 | 红黑树 | 有序数组 |
| 插入/删除 | O(log n) | O(n)（需移动元素） |
| 按索引访问 | 不支持高效索引 | 支持 O(1) 索引 |
| 内存 | 每节点有额外指针开销 | 更紧凑 |

频繁增删选 `SortedDictionary`；构建后以查询为主、需要按索引访问选 `SortedList`。

### 不可变集合

`System.Collections.Immutable`（NuGet 包，.NET Core 3.0+ 内置于运行时）提供持久化数据结构，每次"修改"返回新实例，原实例不变。

```csharp
using System.Collections.Immutable;

var arr = ImmutableArray.Create(1, 2, 3);
var arr2 = arr.Add(4);           // arr 仍是 {1,2,3}
Console.WriteLine(arr.Length);   // 输出: 3
Console.WriteLine(arr2.Length);  // 输出: 4

var list = ImmutableList.Create("a");
var list2 = list.Add("b");

var dict = ImmutableDictionary<string, int>.Empty.Add("k", 1);
```

- `ImmutableArray<T>`：值类型包装的数组，最省内存、访问快，但每次修改都整块复制（O(n)）。
- `ImmutableList<T>`：平衡树，修改 O(log n)，共享大部分结构。
- `ImmutableDictionary<TKey,TValue>`：持久化哈希树。

值得用的场景：多线程共享的只读快照、需要保留历史版本、函数式风格。若只是"构建后不再改"，`ReadOnlyCollection<T>` 或直接暴露 `IReadOnlyList<T>` 更省事。

### 只读包装

```csharp
var list = new List<int> { 1, 2, 3 };
IReadOnlyList<int> ro = list.AsReadOnly(); // ReadOnlyCollection<int>

// 底层 list 一变，视图也跟着变
list.Add(4);
Console.WriteLine(ro.Count);     // 输出: 4
```

::: warning
`AsReadOnly()` 返回的是**活的只读视图**，不是快照。原集合被修改，视图内容会变。要快照用 `list.ToArray()` 或 `ImmutableArray.CreateRange(list)`。
:::

### 选型对照表

| 类型 | 索引访问 | 查找 | 插入/删除 | 适用 |
| --- | --- | --- | --- | --- |
| `T[]` | O(1) | O(n) | 不支持 | 定长、连续、性能敏感 |
| `List<T>` | O(1) | O(n) | 尾部 O(1)，中间 O(n) | 通用有序序列 |
| `Dictionary<K,V>` | — | O(1) | O(1) | 键值映射、去重计数 |
| `HashSet<T>` | — | O(1) | O(1) | 去重、集合运算 |
| `SortedSet<T>` | — | O(log n) | O(log n) | 有序去重、范围查询 |
| `SortedDictionary<K,V>` | — | O(log n) | O(log n) | 有序映射、频繁增删 |
| `Queue<T>` / `Stack<T>` | — | — | 端点 O(1) | FIFO / LIFO |
| `LinkedList<T>` | O(n) | O(n) | 持节点时 O(1) | 频繁中间增删 |

### LINQ 与集合的分工

集合类型负责**存储与复杂度保证**，LINQ 负责**查询与变换**。`Where`、`Select` 等返回的是延迟执行的 `IEnumerable<T>`，每次枚举都会重新执行查询链——需要缓存结果时用 `ToList()` / `ToArray()`。详见第 7 篇。

## 迭代与相等性

### foreach 的编译结果

`foreach` 是语法糖。对实现了 `IEnumerable<T>` 的类型，大致等价于：

```csharp
IEnumerator<int> e = list.GetEnumerator();
try
{
    while (e.MoveNext())
    {
        int item = e.Current;
        // 循环体
    }
}
finally
{
    e.Dispose();   // IEnumerator<T> 继承 IDisposable
}
```

对数组，编译器会直接生成按下标访问的循环，不做接口调用。对实现了"模式枚举器"（有公开 `GetEnumerator` 返回带 `MoveNext`/`Current` 的结构体）的类型，会直接用结构体以**避免装箱**。

`IEnumerable<T>` 与 `IEnumerator<T>` 的职责区分：

- `IEnumerable<T>`：可枚举的"数据源"，`GetEnumerator()` 返回一个枚举器。可以被多次枚举。
- `IEnumerator<T>`：枚举的"游标"，持有当前位置，`MoveNext()` / `Current` / `Reset()` / `Dispose()`。

### yield return 迭代器

手写迭代器时编译器把方法体变成状态机：

```csharp
public static IEnumerable<int> Fibonacci(int count)
{
    int a = 0, b = 1;
    for (int i = 0; i < count; i++)
    {
        yield return a;
        (a, b) = (b, a + b);
    }
}

foreach (int n in Fibonacci(6))
{
    Console.Write(n + " ");   // 输出: 0 1 1 2 3 5
}
```

要点：

- **延迟执行**：调用迭代器方法只是创建状态机，不执行方法体；直到第一次 `MoveNext()` 才运行到第一个 `yield return`。
- **`yield break`** 提前结束序列。
- 迭代器内可以 `try/finally`，`finally` 在枚举器被 `Dispose`（`foreach` 结束或被 `break`）时执行。
- 迭代器方法**不能有 `ref` / `out` 参数**，也不能是 `async`；要异步用 `IAsyncEnumerable<T>`。

::: tip
因为延迟执行，迭代器方法里的参数校验不会在调用时发生：

```csharp
IEnumerable<int> Bad(string source) { _ = source.Length; yield return 1; }
var seq = Bad(null!);    // 此刻不抛异常
// foreach (var x in seq) { }  // 枚举时才抛 NullReferenceException
```
把参数校验拆到一个非迭代器的外壳方法里，能更早失败。
:::

```csharp
public static IEnumerable<int> Good(string source)
{
    ArgumentNullException.ThrowIfNull(source);
    return Core(source);
    static IEnumerable<int> Core(string s) { yield return s.Length; }
}
```

### 相等性契约

- `Equals(object)` 默认是引用相等（`ReferenceEquals`），值类型默认按字段逐位比较。
- `GetHashCode()` 默认基于引用（引用类型）或字段组合。
- **契约**：若 `a.Equals(b)` 为真，则 `a.GetHashCode() == b.GetHashCode()` 必须成立。反之不要求。重写一个必须重写另一个。
- `IEquatable<T>` 提供强类型的 `Equals(T other)`，泛型集合会优先调用它，**避免装箱**（否则会把值类型装箱成 `object` 再调用）。

```csharp
public readonly struct Point : IEquatable<Point>
{
    public int X { get; }
    public int Y { get; }
    public Point(int x, int y) => (X, Y) = (x, y);

    public bool Equals(Point other) => X == other.X && Y == other.Y;
    public override bool Equals(object? obj) => obj is Point p && Equals(p);
    public override int GetHashCode() => HashCode.Combine(X, Y);
    public static bool operator ==(Point a, Point b) => a.Equals(b);
    public static bool operator !=(Point a, Point b) => !a.Equals(b);
}
```

`ReferenceEquals(a, b)` 永远比较引用（对值类型会装箱，永远 `false`）。`==` 是运算符，行为取决于是否被重载；`Equals` 是虚方法，行为取决于类型实现。字符串两者都是值比较，但 `object` 上的 `==` 是引用比较。

### IComparable / IComparer / Comparison

- `IComparable<T>.CompareTo(T)`：类型**自身**实现，定义"我"与其他实例的默认顺序。
- `IComparer<T>.Compare(T, T)`：**外部**比较器对象，用于替代默认排序。
- `Comparison<T>`：`(T, T) => int` 的委托，最轻量。

```csharp
var people = new List<Person>
{
    new("Bob", 25), new("Alice", 30), new("Carol", 25),
};

people.Sort();                                   // 用 IComparable<Person>
people.Sort((x, y) => x.Age.CompareTo(y.Age));   // Comparison<Person>
people.Sort(Comparer<Person>.Create((x, y) => y.Age.CompareTo(x.Age))); // 自定义

public record Person(string Name, int Age) : IComparable<Person>
{
    public int CompareTo(Person? other) => Age.CompareTo(other?.Age);
}
```

`List<T>.Sort` / `Array.Sort` **不稳定**（相等元素相对顺序不保证）。需要稳定排序用 LINQ 的 `OrderBy`（稳定）。`OrderBy` 是稳定的，`List.Sort` 不是，这是排序 API 选择的一个关键差异。

### 相等性比较器 vs 排序比较器

`IEqualityComparer<T>` 与 `IComparer<T>` 服务于不同目的，签名也不同：

```csharp
public interface IEqualityComparer<T>
{
    bool Equals(T? x, T? y);
    int GetHashCode(T obj);   // 供哈希集合使用
}

public interface IComparer<in T>
{
    int Compare(T? x, T? y);  // 返回负/零/正
}
```

`IEqualityComparer<T>` 用于 `Dictionary`、`HashSet`、`Distinct`、`GroupBy` 等；`IComparer<T>` 用于 `SortedSet`、`SortedDictionary`、`OrderBy`、`BinarySearch`。`StringComparer.Ordinal` 同时实现两者，所以同一实例既能作字典键比较器又能排序。

## 常见坑

1. **循环中用 `+=` 拼接字符串**。O(n²) 分配。改为 `StringBuilder` 或 `string.Join`。
2. **比较字符串不传 `StringComparison`**。跨区域、跨平台行为不一致；内部标识务必用 `Ordinal`。
3. **对 `object` 变量用 `==` 比较字符串**。退化为引用比较。显式用 `Equals` 或 `string.Equals(..., StringComparison)`。
4. **`ContainsKey` + 索引器两次查找**。用 `TryGetValue` 一次搞定。
5. **`Array.Resize` 当成原地扩容**。它创建新数组并返回通过 `ref` 回写，旧引用仍指向旧数组。
6. **数组协变后写入错误类型**。运行时抛 `ArrayTypeMismatchException`，尽量用泛型集合。
7. **`Dictionary` 键用可变对象**。插入后修改键字段导致再也查不到。
8. **重写 `Equals` 忘了 `GetHashCode`**。哈希集合行为错误，查不到或重复。
9. **误以为 `AsReadOnly()` 是快照**。它是活视图，原集合改动会透传。
10. **对 `IEnumerable<T>` 重复枚举**。LINQ 查询延迟执行，多次 `foreach` 会重复计算甚至重复 IO；确定要缓存时 `ToList()`。
11. **`char` 当成完整字符**。emoji 与辅助平面字符占两个 `char`，计数、切片、反转都会踩坑，用 `Rune` / `StringInfo`。
12. **序列化数值/日期不传 `InvariantCulture`**。不同区域下小数点、月份名不同，导致解析失败。固定用不变文化。
