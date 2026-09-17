# 6. LINQ

LINQ(Language Integrated Query,语言集成查询)是 C# 3.0 引入的一组技术,它把"查询"提升为语言的一等公民。你用统一的语法查询数组、`List<T>` 等内存集合,只要数据源实现了相应接口。

LINQ 的核心是一组**扩展方法**(定义在 `System.Linq` 的 `Enumerable` 和 `Queryable` 类上),加上查询表达式和 Lambda 两类语法糖。理解 LINQ 的关键不在于记住所有算子,而在于理解**延迟执行**和 **`IEnumerable<T>` 与 `IQueryable<T>` 的分野**——这两个概念决定了绝大多数 LINQ 事故。

## LINQ 是什么

没有 LINQ 时,把一组 `Person` 按年龄筛选排序并投影出名字,要写循环和临时集合:

```csharp
var result = new List<string>();
foreach (var p in people)
{
    if (p.Age > 18)
        result.Add(p.Name);
}
result.Sort();
```

LINQ 把意图和实现分开:

```csharp
var result = people
    .Where(p => p.Age > 18)
    .Select(p => p.Name)
    .OrderBy(name => name)
    .ToList();
```

筛选、投影、排序的意图一目了然。对 Unity 开发者,这是处理配置表、背包、关卡数据等集合时最顺手的工具。

### 命名空间

```csharp
using System.Linq;              // Enumerable / Queryable
using System.Collections.Generic;
```

`System.Linq` 在较新的 SDK 项目中通常由隐式 using 自动引入,但显式写出来更清楚。

## 查询语法 vs 方法语法

### 两种写法的等价性

```csharp
// 查询语法
var q1 = from p in people
         where p.Age > 18
         orderby p.Name
         select p.Name;

// 方法语法(等价)
var q2 = people
    .Where(p => p.Age > 18)
    .OrderBy(p => p.Name)
    .Select(p => p.Name);
```

查询语法在编译期被**翻译成方法调用**,两者生成的 IL 基本相同。查询语法只支持一部分算子(where / select / orderby / group / join / let / into),方法语法支持全部。

### 各子句的翻译

查询语法的每个子句都有对应的方法调用,编译器就是这样翻译的:

| 查询语法 | 翻译为 |
| --- | --- |
| `from x in src where x > 1 select x * 2` | `src.Where(x => x > 1).Select(x => x * 2)` |
| `orderby x.A, x.B descending` | `OrderBy(x => x.A).ThenByDescending(x => x.B)` |
| 多个 `from a in A from b in B select (a,b)` | `A.SelectMany(a => B, (a, b) => (a, b))` |
| `let y = x * 2` | `Select(x => new { x, y = x * 2 })` |
| `group p by p.City` | `GroupBy(p => p.City)` |
| `join o in orders on p.Id equals o.PersonId` | `Join(orders, p => p.Id, o => o.PersonId, ...)` |
| `... into g` | 延续查询,继续对结果操作 |

`let` 与 `into` 的完整例子:

```csharp
// let 引入中间变量
var q = from x in source
        let y = x * 2
        where y > 4
        select y;

// into 延续查询
var g = from p in people
        group p by p.City into grp
        where grp.Count() > 3
        select new { City = grp.Key, Count = grp.Count() };
```

### 什么时候必须用方法语法

- 查询语法没有对应关键字的算子:`Skip`、`Take`、`Distinct`、`Count`、`Any`、`First`、`Zip` 等。
- 需要自定义比较器或复杂投影时,方法语法更直接。
- 想在查询语法之外继续链式调用,可以给整个查询套上括号:

```csharp
var q = (from p in people
         where p.Age > 18
         select p)
        .Distinct()
        .Take(10);
```

### 风格建议

- 筛选 / 投影 / 排序 / 连接:查询语法可读性好,尤其 `join` / `group`。
- 链式算子较多(`Distinct`、`Take`、聚合混合):方法语法更自然。
- 团队内保持一致比选哪种更重要。

## 延迟执行 vs 立即执行

这是 LINQ 最需要吃透的概念。

### 哪些算子延迟、哪些立即

延迟执行(deferred)的算子只是**构建一个迭代器**,直到你枚举它才真正工作:

| 类别 | 算子 | 执行时机 |
| --- | --- | --- |
| 筛选 | `Where`、`OfType` | 延迟 |
| 投影 | `Select`、`SelectMany` | 延迟 |
| 排序 | `OrderBy`、`ThenBy`、`Reverse` | 延迟(但枚举时需读完整个源) |
| 分组 | `GroupBy`、`ToLookup` | 延迟(枚举时需读完整个源) |
| 连接 | `Join`、`GroupJoin` | 延迟 |
| 集合运算 | `Distinct`、`Union`、`Intersect`、`Except`、`Concat` | 延迟 |
| 量词 | `Any`、`All`、`Contains` | 立即 |
| 元素 | `First`、`Single`、`ElementAt`、`Last` | 立即(短路) |
| 聚合 | `Count`、`Sum`、`Min`、`Max`、`Average`、`Aggregate` | 立即 |
| 转换 | `ToList`、`ToArray`、`ToDictionary`、`ToHashSet` | 立即 |
| 分页 | `Skip`、`Take` | 延迟 |
| 生成 | `Range`、`Repeat`、`Empty` | 延迟 |

::: tip
判断口诀:凡是返回 `IEnumerable<T>` / `IOrderedEnumerable<T>` / `IQueryable<T>` 的,几乎都是延迟;凡是返回 `T`、`int`、`List<T>`、`T[]`、`Dictionary<...>` 的,几乎都是立即。例外是 `ToLookup`,它返回 `ILookup` 但立即执行。
:::

### 查询变量在定义时不执行

```csharp
var numbers = new List<int> { 1, 2, 3, 4, 5 };
var evens = numbers.Where(n => n % 2 == 0);   // 未执行任何筛选

numbers.Add(6);                                // 修改源
foreach (var n in evens)                       // 此时才执行
    Console.WriteLine(n);                      // 输出: 2 4 6,新加的 6 也被包含
```

若想固定结果,必须在枚举前固化:

```csharp
var snapshot = numbers.Where(n => n % 2 == 0).ToList();
numbers.Add(8);                                // snapshot 仍是 2 4 6,不含 8
```

### 多次枚举导致重复计算

```csharp
var expensive = data
    .Where(x => ExpensiveCheck(x));   // 每次枚举都会重新执行 ExpensiveCheck

Console.WriteLine(expensive.Count());   // 第一次枚举
Console.WriteLine(expensive.First());   // 第二次枚举
```

若 `ExpensiveCheck` 是数据库查询或复杂计算,这里等于做了两遍。修复:先固化。

```csharp
var cheap = data.Where(x => ExpensiveCheck(x)).ToList();
Console.WriteLine(cheap.Count);
Console.WriteLine(cheap[0]);
```

### 多次枚举在 `IQueryable` 上尤其昂贵

对 `IQueryable`,每次枚举都可能生成一条新查询:下面三段代码等于三条 SQL、三次往返;数据若在两次枚举之间变化,结果还可能不一致。

```csharp
IQueryable<User> q = db.Users.Where(u => u.Age > 18);
var count = q.Count();       // SQL 1
var first = q.First();       // SQL 2
var list = q.ToList();       // SQL 3
```

### 何时 `ToList()` / `ToArray()` 固化

- **要多次枚举**结果时:固化,避免重复计算和重复查询。
- **要切断与延迟源的关系**(如希望在原集合变化后保持不变):固化。
- **`IQueryable` 跨出提供程序生命周期**时:固化,否则 `Dispose` 后再枚举会抛异常。
- **只枚举一次**且是内存集合时:不要固化,避免多余分配。

## `IEnumerable<T>` vs `IQueryable<T>`

两者定义了同名算子,区别在算子接收什么:

- `IEnumerable<T>` 的算子接收**委托** `Func<T,bool>`,即已编译的代码,在**进程内**执行。这是 LINQ to Objects,也是 Unity 里唯一会遇到的形态。
- `IQueryable<T>` 的算子接收**表达式树** `Expression<Func<T,bool>>`,是可被分析的数据,能翻译成 SQL 等外部语言。

```csharp
IEnumerable<User> memory = users;                        // LINQ to Objects
IQueryable<User> remote = db.Users;                      // LINQ to Entities

memory.Where(u => u.Age > 18);    // 参数类型 Func<User, bool>
remote.Where(u => u.Age > 18);    // 参数类型 Expression<Func<User, bool>>
```

### 执行位置

看变量的静态类型即可判断查询在哪里执行:`IQueryable<T>` 后续算子构建表达式树交 Provider 翻译;`IEnumerable<T>` 后续算子都在内存执行。

```csharp
// 在数据库执行,只拉回满足条件的行
var names = db.Users.Where(u => u.Age > 18).Select(u => u.Name).ToList();

// 先拉回所有行,再在内存筛选 —— 典型的性能事故
var names2 = db.Users.ToList().Where(u => u.Age > 18).Select(u => u.Name).ToList();
```

### `AsEnumerable()` 的作用

`AsEnumerable()` 把 `IQueryable<T>` 的静态类型降级为 `IEnumerable<T>`,让后续算子**在内存执行**:例如提供程序无法翻译的 C# 方法,可以先降级再调用。降级前务必用可翻译的 `Where` / `Select` 把数据集缩小。

::: danger
`AsEnumerable()` 之后的过滤条件不再翻译成 SQL,而是把已拉取的数据在内存过滤。**降级之前必须已经用 `Where` / `Select` 缩小数据集**,否则就是把整张表拉进内存。Unity 里没有 EF Core,但只要你接入了任何 `IQueryable` 数据层,这条同样成立。
:::

## 迭代器与 `yield return`

LINQ 的延迟执行靠**迭代器**实现。`yield return` 让方法返回惰性序列:代码在每次 `MoveNext` 时推进到下一个 `yield`。你自定义的 LINQ 算子也返回迭代器。迭代器与集合的深入展开见集合那一篇,这里只需记住:

- 一个 `yield return` 方法在**被枚举之前不会执行**。
- 每次枚举都创建新的迭代器状态机,所以可重复。
- LINQ 的 `Where` / `Select` 内部就是 `yield return`。

## 算子分类详解

### 筛选

```csharp
var adults = people.Where(p => p.Age >= 18);
var nums = mixed.OfType<int>();                          // 只取 int 元素
var everyOther = items.Where((item, index) => index % 2 == 0);  // 带索引重载
```

### 投影

`Select` 一对一映射:

```csharp
var names = people.Select(p => p.Name);
var rows = people.Select(p => new { p.Name, p.Age });   // 匿名类型
var indexed = items.Select((item, i) => $"{i}: {item}");
```

`SelectMany` 把嵌套集合展平(一对多):

```csharp
var orders = new[]
{
    new { Id = 1, Items = new[] { "a", "b" } },
    new { Id = 2, Items = new[] { "c" } },
};

var nested = orders.Select(o => o.Items);      // IEnumerable<string[]>,仍嵌套
var flat = orders.SelectMany(o => o.Items);    // IEnumerable<string>,已展平:a,b,c
```

带结果选择器的重载等价于"对每个元素产生零到多个结果":

```csharp
var combos = new[] { 1, 2 }.SelectMany(
    x => new[] { "a", "b" },
    (x, s) => $"{x}{s}");     // 1a,1b,2a,2b
```

::: tip
`Select` 不改变元素数量,`SelectMany` 会改变(展平后数量是各子集合之和)。需要"从每个元素产生零到多个结果"时用 `SelectMany`。
:::

### 排序

```csharp
var sorted = people.OrderBy(p => p.Age);
var desc = people.OrderByDescending(p => p.Age);
var multi = people.OrderBy(p => p.City).ThenByDescending(p => p.Age);  // 第二排序键
```

`OrderBy` 返回 `IOrderedEnumerable<T>`,只有它才能接 `ThenBy`。它是稳定排序:相等元素保持原始相对顺序。`OrderBy` 延迟,但枚举时必须先读完整个源才能产出第一个元素;`Reverse()` 同样延迟。

### 分组

`GroupBy` 返回 `IEnumerable<IGrouping<TKey, TElement>>`,每个分组有 `Key` 且本身可枚举:

```csharp
var byCity = people.GroupBy(p => p.City);
foreach (var group in byCity)
    Console.WriteLine($"{group.Key}: {group.Count()}");

// 带元素选择器 / 结果选择器
var namesByCity = people.GroupBy(p => p.City, p => p.Name);
var summary = people.GroupBy(p => p.City,
    (city, group) => new { City = city, Count = group.Count() });
```

`ToLookup` 与 `GroupBy` 的区别:

- `GroupBy` **延迟**,`ToLookup` **立即**执行并返回 `ILookup<TKey, TElement>`。
- `ILookup` 支持按键索引 `lookup["Beijing"]`,无需遍历;且可重复查询不重算。

```csharp
var lookup = people.ToLookup(p => p.City);
foreach (var p in lookup["Beijing"]) Console.WriteLine(p.Name);
```

### 聚合

```csharp
people.Count();                // 元素个数
people.LongCount();            // 超过 int 范围时
nums.Sum(); nums.Min(); nums.Max(); nums.Average();   // 和 / 最小 / 最大 / 平均

// 带选择器的重载
var totalAge = people.Sum(p => p.Age);
```

`Aggregate` 是最通用的聚合,常用两种重载:

```csharp
var product = nums.Aggregate((acc, x) => acc * x);   // 无种子:用第一个元素做种子
var sum = nums.Aggregate(0, (acc, x) => acc + x);    // 带种子
```

累加和字符串拼接是 `Aggregate` 的典型用途;字符串拼接应优先用 `string.Join`,性能更好。

### 量词

```csharp
bool any = people.Any();                    // 是否非空
bool hasAdult = people.Any(p => p.Age >= 18);
bool allAdult = people.All(p => p.Age >= 18);
bool contains = nums.Contains(3);           // 使用默认相等比较器
bool containsByAge = people.Contains(target, comparer);
```

`Any()` 优于 `Count() > 0`:前者找到第一个元素就短路返回,后者必须遍历完整个序列。对 `IQueryable`,`Any()` 翻译成 `EXISTS`,`Count()` 翻译成 `COUNT`,前者通常快得多。

### 元素

```csharp
var first = people.First();                          // 空序列抛异常
var firstAdult = people.First(p => p.Age >= 18);     // 带条件
var firstSafe = people.FirstOrDefault();             // 空序列返回 default
var firstAdultSafe = people.FirstOrDefault(p => p.Age >= 18);

var last = people.Last();
var lastSafe = people.LastOrDefault();

var single = people.Single();                        // 恰好一个,否则抛异常
var singleSafe = people.SingleOrDefault();           // 0 个返回 default,2+ 个仍抛异常

var third = people.ElementAt(2);                     // 越界抛异常
var thirdSafe = people.ElementAtOrDefault(2);        // 越界返回 default
```

`First` 与 `Single` 的语义区别:

| 方法 | 0 个 | 1 个 | 多个 |
| --- | --- | --- | --- |
| `First` | 抛异常 | 返回 | 返回第一个 |
| `FirstOrDefault` | `default` | 返回 | 返回第一个 |
| `Single` | 抛异常 | 返回 | 抛异常 |
| `SingleOrDefault` | `default` | 返回 | 抛异常 |

用 `Single` 表达"我确信这里有且仅有一个"的断言;用 `First` 表达"我只要第一个"。

::: warning
对值类型,`FirstOrDefault` 在空序列时返回 `default(T)`,对 `int` 是 `0`、对 `bool` 是 `false`,可能与合法值混淆。需要区分"没有"和"是零"时,返回 `int?` 或先 `Any()` 判断。
:::

### 集合运算

```csharp
var distinct = nums.Distinct();
var union = a.Union(b);            // 并集,去重
var intersect = a.Intersect(b);    // 交集
var except = a.Except(b);          // 差集
var concat = a.Concat(b);          // 拼接,不去重
```

这些算子都接受可选的 `IEqualityComparer<T>`(用法见后文专节),例如 `people.Distinct(new PersonByName())`。

`Zip` 把两个序列按位置配对,以较短序列为准:

```csharp
var pairs = names.Zip(ages, (n, a) => $"{n}={a}");   // a=1,b=2,多余的 c 被丢弃
```

### 连接

`Join` 是内连接(只保留两边的匹配),`GroupJoin` 保留左边所有元素、右侧是无匹配则为空的分组:

```csharp
var inner =
    from p in people
    join o in orders on p.Id equals o.PersonId
    select new { p.Name, o.Amount };

// 方法语法等价于 people.Join(orders, p => p.Id, o => o.PersonId, (p, o) => ...)
```

用 `GroupJoin` + `SelectMany` + `DefaultIfEmpty` 写左外连接:

```csharp
var leftOuter =
    from p in people
    join o in orders on p.Id equals o.PersonId into os
    from o in os.DefaultIfEmpty()           // 无匹配时产生一个 default
    select new { p.Name, Amount = o == null ? 0m : o.Amount };
```

对值类型元素,`DefaultIfEmpty` 会产生零值,无法区分"没有订单"和"金额为 0"。

### 分页

```csharp
int pageSize = 10, page = 2;
var paged = items
    .Skip((page - 1) * pageSize)
    .Take(pageSize);
```

`Chunk`(.NET 6)把序列切成固定大小的批次,返回的是数组 `T[]`:

```csharp
foreach (var batch in items.Chunk(100))
    Console.WriteLine($"batch size: {batch.Length}");
```

### 转换

```csharp
var list = source.ToList();
var array = source.ToArray();
var set = source.ToHashSet();
var dict = source.ToDictionary(p => p.Id);                 // 键重复抛异常
var dict2 = source.ToDictionary(p => p.Id, p => p.Name);   // 自定义值
var lookup = source.ToLookup(p => p.City);                 // 键可重复
```

键重复时 `ToDictionary` 抛 `ArgumentException`;已知键可能重复时用 `ToLookup`,或先 `DistinctBy` / `GroupBy` 归并。

### 生成

```csharp
var range = Enumerable.Range(1, 5);        // 1,2,3,4,5
var repeated = Enumerable.Repeat("x", 3);  // x,x,x
var empty = Enumerable.Empty<int>();       // 空序列(单例)
```

### 其他

```csharp
bool same = a.SequenceEqual(b);            // 逐元素比较
var cast = objects.Cast<int>();            // 强制转换所有元素,失败抛异常
var atEnd = items.Append(99);              // 末尾追加
var atStart = items.Prepend(0);            // 开头插入
var byKey = items.DistinctBy(x => x.Id);   // .NET 6+,按键去重
var chunked = items.MaxBy(x => x.Score);   // .NET 6+
```

## 自定义 LINQ 算子

LINQ 算子在 `IEnumerable<T>` 上是扩展方法。写一个延迟执行的 `Where` 风格算子:

```csharp
public static class MyLinq
{
    public static IEnumerable<T> WhereNot<T>(
        this IEnumerable<T> source,
        Func<T, bool> predicate)
    {
        ArgumentNullException.ThrowIfNull(source);
        ArgumentNullException.ThrowIfNull(predicate);

        foreach (var item in source)
        {
            if (!predicate(item))
                yield return item;      // 延迟产出,不预分配
        }
    }
}
```

用法:`new[] { 1, 2, 3, 4 }.WhereNot(x => x % 2 == 1)` 得到 `2 4`。

关键点:

- `yield return` 让方法返回惰性迭代器,源在枚举时才开始遍历。
- 参数校验(`ThrowIfNull`)会在**调用时**立即执行,因为在进入迭代器之前——这是 BCL 的做法。
- 不要在延迟算子内部预先 `ToList()`,否则破坏延迟语义。
- 需要带索引时,在 `foreach` 前声明 `int index = 0`,把 `selector(item, index++)` 交给调用方即可。

## `IEqualityComparer<T>` 的用法

很多算子的去重 / 分组 / 查找依赖相等比较器。默认用 `EqualityComparer<T>.Default`,它优先用 `IEquatable<T>` 实现。

```csharp
public class CaseInsensitiveComparer : IEqualityComparer<string>
{
    public bool Equals(string? x, string? y)
        => string.Equals(x, y, StringComparison.OrdinalIgnoreCase);
    public int GetHashCode(string obj)
        => obj.ToUpperInvariant().GetHashCode();
}

var unique = words.Distinct(new CaseInsensitiveComparer());
var groups = words.GroupBy(w => w, new CaseInsensitiveComparer());
var map = words.ToDictionary(w => w, new CaseInsensitiveComparer());
```

::: warning
实现 `IEqualityComparer<T>` 时,`Equals` 和 `GetHashCode` 必须一致:`Equals` 认为相等的两个对象,`GetHashCode` 必须返回相同值。否则 `Distinct` / `GroupBy` 会行为异常(哈希桶与比较结果矛盾)。
:::

## LINQ 性能(Unity 视角)

### 每次调用都有分配

LINQ 的便利不是免费的。对 `IEnumerable<T>` 的每次调用都会产生**堆分配**:

- **闭包**:捕获外部变量的 Lambda 会分配一个闭包对象。
- **迭代器状态机**:每个延迟算子在被枚举时分配一个状态机对象。
- **结果容器**:`ToList` / `ToArray` 本身还要分配 `List<T>` / 数组。

```csharp
int threshold = 10;
var q1 = source.Where(x => x > threshold);   // 捕获 threshold,分配闭包
var q2 = source.Where(static x => x > 10);   // 无捕获,委托可被缓存复用
```

### Unity 的 GC 代价

Unity 6 用的是 **Boehm-Demers-Weiser GC**:不分代、默认不压缩、增量模式。它对短命的小对象回收效率不高,一旦触发会造成**掉帧**(帧时间尖峰)。所以"每秒产生多少垃圾"在 Unity 里是硬指标,而 LINQ 恰好是垃圾的稳定来源。

::: danger
**绝对不要在 `Update()` / `FixedUpdate()` / `LateUpdate()` 或任何每帧执行的循环里用 LINQ。** 这些代码每秒跑几十上百次,每次调用都会累加 GC 压力,最终以周期性卡顿的形式爆发。
:::

### 什么时候用 `for` + 预分配 `List`

判断标准只有一个:**这段代码每帧跑吗?**

| 场景 | 建议 |
| --- | --- |
| `Update` / `FixedUpdate` / 每帧 UI 刷新 | 手写 `for` 循环,复用预分配的 `List<T>` / 数组 |
| 每帧遍历大量敌人 / 弹幕 / 粒子 | 手写循环,避免任何 LINQ 与闭包 |
| 编辑器工具、Inspector 按钮 | 放心用 LINQ,人点一次不差这点分配 |
| 启动初始化、加载配置表、关卡生成 | 可以放心用,一次性开销可忽略 |
| 玩家点一次按钮触发的逻辑 | 通常可以,除非集合极大 |

```csharp
// 好:单次遍历同时求 min/max/sum,零额外分配
int min = int.MaxValue, max = int.MinValue;
long sum = 0;
foreach (var x in data)
{
    if (x < min) min = x;
    if (x > max) max = x;
    sum += x;
}
```

需要临时列表时,复用成员字段而不是每次 `new`:

```csharp
private readonly List<Enemy> _visible = new();

void RefreshVisible()
{
    _visible.Clear();
    for (int i = 0; i < _enemies.Count; i++)
        if (_enemies[i].IsOnScreen) _visible.Add(_enemies[i]);
}
```

### 其他原则

- **多次枚举**:每次枚举延迟查询都会重跑整个管道,缓存到局部变量固化一次。
- **`Count() > 0` vs `Any()`**:`Any()` 找到第一个元素就短路,永远优先。
- **`Where().First()` vs `First(predicate)`**:后者少一层迭代器包装,优先使用。
- **先写 LINQ、确认是热点再优化**:编辑器工具和初始化代码里,可读性远比这点开销重要。

## 关于 EF Core / LINQ to SQL

Unity 里没有 EF Core,也不会用 `IQueryable` 查数据库。但这些概念值得知道:数据库 LINQ 把表达式树翻译成 SQL,无法翻译的表达式会抛异常,所以常见做法是只投影需要的列、分页前先排序、最后 `ToList()` 固化。真正要记住的还是它和内存 LINQ 的分野(见上一节)。

## PLINQ 与 `AsParallel()`

`AsParallel()` 把 `IEnumerable<T>` 转成 `ParallelQuery<T>`,后续算子可能并行执行。它只适合"CPU 密集、元素多、无副作用"的场景;元素少、顺序敏感或含 I/O 时反而更慢。**Unity 里尤其危险**:工作线程不能触碰 `UnityEngine` 对象,渲染相关回调必须在主线程执行。没有基准数据前不要引入。

## 常见坑

### 1. 延迟执行导致结果随源变化

```csharp
var q = list.Where(...);
list.Add(item);
var result = q.ToList();   // 包含了新 item
```

定义后若要快照,立即 `ToList()`。

### 2. 重复枚举触发重复查询

`if (q.Any()) { var all = q.ToList(); }` 会执行两次。

### 3. `FirstOrDefault` 对值类型返回 0

`new List<int>().FirstOrDefault()` 返回 `0`,不是"没有"。用 `int?` 或先判断 `Any()`。

### 4. 闭包捕获外部变量

```csharp
var q = items.Select(x => x + offset);   // offset 是共享变量
offset = 100;                            // 枚举时用的是 100
```

延迟执行意味着"求值时读当前值";要特别注意复用的变量被后续改动。

### 5. 枚举时修改集合

```csharp
foreach (var x in list.Where(x => x > 0))
    list.Remove(x);   // InvalidOperationException:集合被修改
```

先 `ToList()` 快照再修改。

### 6. `OrderBy` 之后忘记 `ThenBy`

```csharp
people.OrderBy(p => p.City).OrderBy(p => p.Age);   // 错误:第二个覆盖第一个
people.OrderBy(p => p.City).ThenBy(p => p.Age);    // 正确
```

### 7. `GroupBy` 后嵌套枚举的低效

`foreach (var city in people.GroupBy(p => p.City)) city.Count();` 里的 `.Count()` 会重新遍历该分组;分组很大且反复调用时先物化。

### 8. `ToDictionary` 重复键抛异常

`items.ToDictionary(x => x.Category)` 在键重复时抛 `ArgumentException`;用 `ToLookup` 或先归并。

### 9. 用默认相等比较器处理自定义类型

`nums.Distinct()` 对浮点 NaN 等有坑;引用类型(如 `Person`)默认是引用相等(除非类型重写了 `Equals`),需要自定义 `IEqualityComparer<T>`。

### 10. `Select` 与 `SelectMany` 混淆

`Select(o => o.Items)` 得到 `string[][]`,`SelectMany(o => o.Items)` 才展平成 `string[]`。

### 11. 在查询语法中忘了 `into` 才能继续查询

```csharp
var q = from p in people
        group p by p.City into g
        where g.Count() > 2
        select g.Key;
```

### 12. `Zip` 被较短序列截断

`Zip` 以较短的序列为准,较长的多余元素被丢弃。

### 13. 认为 `Reverse()` 立即执行

`Reverse()` 是延迟的,且枚举时要读完整个源才能产出;对大集合是内存与时间的双重成本。
