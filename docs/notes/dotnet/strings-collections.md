# 2. 字符串、数组与集合

C# 把字符串、数组和集合都做成了语言级或 BCL 级的一等公民。理解它们的语义（尤其是字符串的不可变性与集合的接口层次）是写不出性能陷阱的前提。本篇按字符串、数组、集合、迭代与相等性展开，并贯穿 Unity 视角：**Unity 目前的 C# 版本上限是 C# 9**，凡高于 C# 9 的语法都会标注"Unity 用不了"。

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
- **性能陷阱（Unity 重点）**：任何"修改"都会分配一个新的 `string` 对象，在 Unity 里这些对象全部变成 **GC 垃圾**，频繁修改会持续推高托管堆、触发 GC 卡顿（帧率尖刺）。

```csharp
// 反面教材：循环内拼接，每次都新建对象
string s = "";
for (int i = 0; i < 10000; i++)
{
    s += i.ToString();   // 第 n 次迭代分配长度约 n 的新字符串 → 1 万个垃圾对象
}
```

::: warning
字符串相加的时间复杂度由表面上的"一次操作"变成 O(n)，循环拼接总体是 O(n²)。**在 Unity 的逐帧代码（`Update`）里更是灾难**：数据量大时必须改用 `StringBuilder`，并复用实例。
:::

### 字符串驻留（intern pool）

CLR 维护一个进程级字符串池，**字面量**会自动驻留，内容相同的字面量共享同一对象；运行时拼接（如 `string.Concat`）不会自动驻留。`string.Intern` 可手动加入，`IsInterned` 查询是否已驻留（未驻留返回 `null`）。

::: tip
驻留池不会被 GC 回收，**不要对大量动态生成的唯一字符串调用 `Intern`**，否则内存只增不减。Unity 里更该关心少产生字符串，而不是把字符串塞进池。
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
Console.WriteLine(u.Contains("STRASSE", StringComparison.OrdinalIgnoreCase));        // False
Console.WriteLine(u.Contains("STRASSE", StringComparison.CurrentCultureIgnoreCase)); // True
```

**`==` 运算符**：`string` 重载了 `==`/`!=`，执行 `Ordinal` 值比较；但当变量静态类型是 `object` 时会退化为引用比较（把字符串塞进 `object` 或非泛型集合后就中招）。

::: danger
**Unity 场景**：`gameObject.tag` 是 `string`，直接 `tag == "Enemy"` 不具备确定的区域/大小写语义；应统一用 `gameObject.CompareTag("Enemy")`（内部走序数比较、不分配）。自定义字符串比较一律显式传 `StringComparison.Ordinal`。
:::

排序用 `string.Compare`（返回负/零/正）；要结果跨平台稳定，始终显式传 `StringComparison` / `StringComparer`。

### 常用方法

```csharp
string s = "  Hello, World  ";

Console.WriteLine(s.Length);            // 16
Console.WriteLine(s.Substring(2, 5));   // "Hello"（越界会抛异常）
Console.WriteLine(s.IndexOf("World"));  // 9，可传 StringComparison 忽略大小写
Console.WriteLine(s.LastIndexOf('o'));  // 11
Console.WriteLine(s.Contains("World")); // True
Console.WriteLine(s.StartsWith("  He"));// True
Console.WriteLine(s.EndsWith("  "));    // True
Console.WriteLine(s.Replace("World", "C#")); // 返回新字符串
Console.WriteLine(s.Trim());            // "Hello, World"
Console.WriteLine("12".PadLeft(5, '0'));// "00012"
Console.WriteLine("abcdef".Remove(3));  // "abc"
Console.WriteLine("abc".Insert(1, "XY")); // "aXYbc"
Console.WriteLine("ABC".ToLowerInvariant()); // "abc"
```

`Split` 与 `Join` 互为逆操作：

```csharp
"a,,b, c ,".Split(',');                                     // ["a", "", "b", " c ", ""]
"a,,b, c ,".Split(',', StringSplitOptions.TrimEntries |
                        StringSplitOptions.RemoveEmptyEntries); // ["a", "b", "c"]
"k1=v1;k2=v2;k3=v3".Split(';', 2);                          // 限制数量: ["k1=v1", "k2=v2;k3=v3"]
string.Join(", ", new[] { 1, 2, 3 });                       // "1, 2, 3"
```

**注意**：`Replace`、`Substring`、`Trim`、`Split`、`Join` 全部会分配新字符串，在 Unity 的逐帧循环里要警惕。

空判断用框架方法，不要自己写 `s == null || s.Length == 0`：`string.IsNullOrEmpty(s)` 对纯空白返回 `False`，校验用户输入优先用 `string.IsNullOrWhiteSpace(s)`。

### StringBuilder

`StringBuilder` 内部维护可变字符缓冲区，只在容量不足时扩容。容量从 16 开始、不足时翻倍，能预估长度就构造时传 `capacity`，避免中途多次扩容与复制。

```csharp
using System.Text;

var sb = new StringBuilder(capacity: 256);
sb.Append("Hello").Append(' ').Append("World").AppendLine("!");
sb.Replace("World", "C#");
Console.WriteLine(sb.ToString()); // 输出: Hello C#!
```

**Unity 做法**：把 `StringBuilder` 存成字段**反复复用**，用完调 `sb.Clear()`（保留容量、不重新分配），不要每帧新建。判断标准：循环里拼接 5 次以上，或拼接次数编译期未知，就用它；少量固定拼接（`$"{a}{b}"`）编译器会优化成 `string.Concat`。

### 字符串插值 / 逐字 / 原始字符串

`$"..."` 插值支持对齐与格式说明符；`@"..."` 是逐字字符串（反斜杠不转义）；`$@""` 二者组合：

```csharp
decimal price = 1234.5m;
Console.WriteLine($"{price,12:N2}|");   // 输出:     1,234.50|
Console.WriteLine($"{price,-12:N2}|");  // 输出: 1,234.50    |
Console.WriteLine($"{(price > 0 ? "正" : "负")}"); // 括号内可放表达式

string path = @"C:\temp";
Console.WriteLine($@"路径是 {path}\file.txt");
```

::: warning Unity 用不了
C# 11 的**原始字符串** `"""..."""` 在 Unity（C# 9）中编译不过，写 JSON/SQL/正则时只能用 `$@""` 加转义。下面仅作了解：

```csharp
// C# 11 only —— Unity 中不可用
string json = """
    { "name": "Cherry" }
    """;
```
:::

### char 不等于一个字符

`char` 是 16 位 UTF-16 **码元**，不是"一个字符"。辅助平面字符（大量 emoji、生僻汉字）由两个 `char` 组成**代理对**，因此 `Length`、按下标切片、反转都会踩坑。需要正确数"字符"边界时用 `Rune` 或 `StringInfo`（字素簇）：

```csharp
string emoji = "😀";                                            // U+1F600
Console.WriteLine(emoji.Length);                                // 2（两个 char）
Console.WriteLine(System.Text.Rune.GetRuneAt(emoji, 0).Value);  // 128512，整体一个码点

var info = new System.Globalization.StringInfo("a\u0301b");     // a + 组合重音符 + b
Console.WriteLine(info.LengthInTextElements);                   // 2（字素簇计数）
```

### 编码

`Encoding` 负责 `string`（UTF-16）与字节序列互转：`Encoding.UTF8.GetBytes` / `GetString`。.NET Core 起 `Encoding.Default` 就是 UTF-8；GBK 等代码页需 `Encoding.RegisterProvider(CodePagesEncodingProvider.Instance)`。

`Encoding.UTF8.GetBytes` **不写 BOM**，要写 BOM 用 `new UTF8Encoding(true)`。读带 BOM 的文件时若把 BOM 当内容，字符串开头会出现 `\uFEFF` 导致比较失败——用 `File.ReadAllText` 或开启 BOM 检测的 `StreamReader` 可自动剥离。

### 格式化与 IFormatProvider

**数值和日期序列化时必须传 `CultureInfo.InvariantCulture`**，否则在 `de-DE` 等区域下小数点会变成逗号，导致解析失败。

```csharp
double v = 1234567.891;
v.ToString("N2", CultureInfo.InvariantCulture); // 1,234,567.89
v.ToString("F3", CultureInfo.InvariantCulture); // 1234567.891
new DateTime(2026, 9, 17).ToString("O");        // 往返格式 2026-09-17T00:00:00.0000000
```

自定义类型实现 `IFormattable` 即可支持 `$"{value:fmt}"`（Unity 里少用，了解即可）。

## 数组

### 声明与初始化

```csharp
int[] a = new int[5];                    // 5 个 0
int[] b = new int[] { 1, 2, 3 };
int[] c = { 1, 2, 3 };                   // 简化写法
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

数组是**协变**的：`string[]` 可赋给 `object[]`，但写入时靠运行时检查兜底，类型不符会抛 `ArrayTypeMismatchException`。泛型 `List<T>` 不变（`List<string>` 不能赋给 `List<object>`），反而更安全。Unity 里尽量用泛型集合，少用数组协变。

### 数组与 Span`<T>`

`T[]` 可隐式转成 `Span<T>` / `ReadOnlySpan<T>`，获得切片、零分配访问（如 `arr.AsSpan().Slice(1, 3)`），Unity 里适合解析字节流。详见第 8 篇。

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

### 哪些集合操作会产生垃圾（Unity 重点）

集合相关的分配在 Unity 里同样会变成 GC 垃圾：

- **`List<T>` 扩容**：`Add` 超出容量时新建约 2 倍大小的数组并复制。预设 `new List<T>(capacity)` 可避免。
- **`ToArray()` / `ToList()`**：每次都新建一份。需要缓冲时复用同一个列表，而不是反复转数组。
- **LINQ**：`Where`/`Select`/`OrderBy` 会产生迭代器对象与闭包，`ToList` 再分配一个新集合；逐帧路径上改用 `for` 手写循环。
- **`foreach` 遍历非泛型集合**（`ArrayList`、`IEnumerable`）会触发装箱；泛型集合的 `foreach` 无装箱，但热点代码仍可用 `for` 按下标遍历 `List<T>` / 数组以避免枚举器开销。
- **字符串拼接、`string.Format`、`Substring`** 等（见前文）。

Unity 做法：预设 `Capacity`、把列表存成字段并 `Clear()` 复用（不清容量）、热点循环用 `for`。

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
Console.WriteLine(q.Dequeue());  // 输出: 1（FIFO，任务排队、BFS）

var st = new Stack<int>();
st.Push(1); st.Push(2);
Console.WriteLine(st.Pop());     // 输出: 2（LIFO，撤销栈、DFS）
```

`LinkedList<T>` 仅在已持有节点引用时插入删除为 O(1)，但随机访问 O(n)、缓存不友好，多数场景 `List<T>` 更快，Unity 里基本用不到。

### SortedDictionary vs SortedList

两者都按键排序、查找 O(log n)：`SortedDictionary` 是红黑树、增删 O(log n)；`SortedList` 是有序数组、增删 O(n) 但支持 O(1) 索引访问。频繁增删选前者，查询为主且需按索引访问选后者。

### 只读包装

```csharp
var list = new List<int> { 1, 2, 3 };
IReadOnlyList<int> ro = list.AsReadOnly(); // ReadOnlyCollection<int>

// 底层 list 一变，视图也跟着变
list.Add(4);
Console.WriteLine(ro.Count);     // 输出: 4
```

::: warning
`AsReadOnly()` 返回的是**活的只读视图**，不是快照。原集合被修改，视图内容会变。要快照用 `list.ToArray()`。
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

- **延迟执行**：调用迭代器方法只是创建状态机，直到第一次 `MoveNext()` 才运行到第一个 `yield return`。因此参数校验要拆到非迭代器的外壳方法里，否则要等到枚举时才抛异常。
- **`yield break`** 提前结束序列；迭代器内可用 `try/finally`，`finally` 在枚举器被 `Dispose`（`foreach` 结束或被 `break`）时执行。
- 迭代器方法**不能有 `ref` / `out` 参数**，也不能是 `async`。

::: tip Unity 联系
**Unity 的协程 `IEnumerator` + `yield return` 就是建立在迭代器之上的**：`yield return null` 等到下一帧，`yield return new WaitForSeconds(...)` 等到时间到。理解迭代器的延迟执行，就理解了协程为什么能在中间"暂停"。
:::

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

### 比较与相等性比较器

排序与相等性由两组接口区分：

- `IComparable<T>.CompareTo(T)`：类型**自身**实现，定义默认顺序。
- `IComparer<T>.Compare(T, T)`：**外部**排序比较器，返回负/零/正；`Comparison<T>` 是 `(T, T) => int` 的轻量委托。
- `IEqualityComparer<T>.Equals` + `GetHashCode`：供 `Dictionary`、`HashSet`、`Distinct`、`GroupBy` 做相等性判断。

```csharp
var people = new List<Person> { new("Bob", 25), new("Alice", 30) };

people.Sort();                                 // IComparable<Person>
people.Sort((x, y) => x.Age.CompareTo(y.Age)); // Comparison<Person>

public record Person(string Name, int Age) : IComparable<Person>
{
    public int CompareTo(Person? other) => Age.CompareTo(other?.Age);
}
```

`IComparer<T>` 用于 `SortedSet`、`SortedDictionary`、`OrderBy`、`BinarySearch`；`IEqualityComparer<T>` 用于哈希集合。`StringComparer.Ordinal` 同时实现两者，同一实例既能作字典键比较器又能排序。

`List<T>.Sort` / `Array.Sort` **不稳定**（相等元素相对顺序不保证），需要稳定排序用 LINQ 的 `OrderBy`。

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
