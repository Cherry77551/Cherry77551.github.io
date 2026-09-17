# 7. LINQ

LINQ(Language Integrated Query,语言集成查询)是 C# 3.0 引入的一组技术,它把"查询"提升为语言的一等公民。你可以在 C# 里用统一的语法查询内存集合、数据库、XML、JSON 甚至远程 API,只要数据源实现了相应的接口。

LINQ 的核心是一组**扩展方法**(定义在 `System.Linq` 的 `Enumerable` 和 `Queryable` 类上),加上两类特殊的语法糖:查询表达式和 Lambda。理解 LINQ 的关键不在于记住所有算子,而在于理解**延迟执行**和 **`IEnumerable<T>` 与 `IQueryable<T>` 的分野**——这两个概念决定了绝大多数 LINQ 事故。

## LINQ 是什么

### 它解决什么问题

在没有 LINQ 之前,把一组 `Person` 按年龄筛选排序并投影出名字,要写循环和临时集合:

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

筛选、投影、排序的意图一目了然,而且这套写法在内存集合、数据库、XML 上是一致的。

### 命名空间

```csharp
using System.Linq;              // Enumerable / Queryable
using System.Collections.Generic;
```

`System.Linq` 是 `Enumerable` 和 `Queryable` 两个静态类所在的命名空间。在较新的 SDK 项目中通常由隐式 using 自动引入,但显式写出来更清楚。

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

`from ... where ... select`:

```csharp
from x in source
where x > 1
select x * 2

// 翻译为:
source.Where(x => x > 1).Select(x => x * 2)
```

`orderby`:

```csharp
from x in source
orderby x.A, x.B descending
select x

// 翻译为:
source.OrderBy(x => x.A).ThenByDescending(x => x.B)
```

多个 `from` 变成 `SelectMany`:

```csharp
from a in listA
from b in listB
select (a, b)

// 翻译为:
listA.SelectMany(a => listB, (a, b) => (a, b))
```

`let` 引入中间变量:

```csharp
from x in source
let y = x * 2
where y > 4
select y

// 翻译为:
source.Select(x => new { x, y = x * 2 })
      .Where(t => t.y > 4)
      .Select(t => t.y)
```

`group` 变成 `GroupBy`:

```csharp
from p in people
group p by p.City

// 翻译为:
people.GroupBy(p => p.City)
```

`join` 变成 `Join`:

```csharp
from p in people
join o in orders on p.Id equals o.PersonId
select new { p.Name, o.Amount }

// 翻译为:
people.Join(orders,
    p => p.Id,
    o => o.PersonId,
    (p, o) => new { p.Name, o.Amount })
```

`into` 用于延续查询(继续对结果操作):

```csharp
from p in people
group p by p.City into g
where g.Count() > 3
select new { City = g.Key, Count = g.Count() }
```

### 什么时候必须用方法语法

- 使用查询语法没有对应关键字的算子:`Skip`、`Take`、`Distinct`、`Count`、`Any`、`First`、`SelectMany` 的某些重载、`Zip` 等。
- 需要自定义比较器或复杂投影时,方法语法更直接。
- 查询语法里想调用普通方法,只能在子句内部调用,不能把整个查询"套壳"。

```csharp
// 查询语法里插入方法调用
var q = (from p in people
         where p.Age > 18
         select p)
        .Distinct()
        .Take(10);
```

### 风格建议

- 简单筛选 / 投影 / 排序 / 连接:查询语法可读性好,尤其 `join` / `group`。
- 链式算子较多(`Distinct`、`Take`、聚合混合):方法语法更自然。
- 团队内保持一致比选哪种更重要。微软内部两种都大量使用。

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

var evens = numbers.Where(n => n % 2 == 0);   // 没有任何输出,也没做筛选
Console.WriteLine("query defined");            // 输出: query defined

numbers.Add(6);                                // 修改源

foreach (var n in evens)                       // 此时才执行
    Console.WriteLine(n);
// 输出: 2 4 6 —— 新加的 6 也被包含
```

### 源被修改后结果不同

```csharp
var source = new List<int> { 1, 2 };
var q = source.Select(x => x * 10);

source.Add(3);                 // 在枚举前修改源
var result = q.ToList();
Console.WriteLine(string.Join(",", result));  // 输出: 10,20,30
```

如果在定义后、枚举前 `ToList()`,则结果固定:

```csharp
var snapshot = source.Select(x => x * 10).ToList();
source.Add(4);
Console.WriteLine(string.Join(",", snapshot)); // 输出: 10,20,30(不含新的)
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

### 数据库场景下的多次枚举尤其昂贵

```csharp
IQueryable<User> q = db.Users.Where(u => u.Age > 18);

var count = q.Count();       // SQL 1:SELECT COUNT(*)
var first = q.First();       // SQL 2:SELECT TOP 1
var list = q.ToList();       // SQL 3:SELECT 全表
```

三条 SQL,三次往返。若数据在两次枚举之间变化,结果还可能不一致。

### 何时 `ToList()` / `ToArray()` 固化

- **要多次枚举**结果时:固化,避免重复计算和重复查询。
- **要切断与延迟源的关系**(如希望在原集合变化后保持不变):固化。
- **`IQueryable` 跨出 `DbContext` 生命周期**时:固化,否则 `Dispose` 后再枚举会抛异常。
- **只枚举一次**且是内存集合时:不要固化,避免多余分配。

::: warning
在 EF Core 里,`IQueryable<T>` 必须在其 `DbContext` 存活期间枚举。写了 `var q = db.Users.Where(...)` 然后把 `q` 传出方法、在 `using` 块外枚举,会抛 `ObjectDisposedException`。要么在方法内 `ToList()`,要么让调用方持有 `DbContext`。
:::

## `IEnumerable<T>` vs `IQueryable<T>`

### `Func<T,bool>` vs `Expression<Func<T,bool>>`

```csharp
IEnumerable<User> memory = users;                        // LINQ to Objects
IQueryable<User> remote = db.Users;                      // LINQ to Entities

memory.Where(u => u.Age > 18);    // 参数类型 Func<User, bool>
remote.Where(u => u.Age > 18);    // 参数类型 Expression<Func<User, bool>>
```

- `IEnumerable<T>` 的算子接收**委托**,即已编译的代码,在进程内执行。
- `IQueryable<T>` 的算子接收**表达式树**,是可分析的数据,能翻译成 SQL 等外部语言。

### 执行位置

```csharp
// 在数据库执行,只拉回满足条件的行
var names = db.Users
    .Where(u => u.Age > 18)
    .Select(u => u.Name)
    .ToList();

// 先拉回所有行,再在内存筛选 —— 典型的性能事故
var names2 = db.Users
    .ToList()                       // SQL:SELECT * FROM Users
    .Where(u => u.Age > 18)         // 内存过滤
    .Select(u => u.Name)
    .ToList();
```

### 判断查询在哪里执行

看变量的静态类型:

- 类型是 `IQueryable<T>`:后续算子构建表达式树,最终由 Provider 翻译执行。
- 类型是 `IEnumerable<T>`:后续算子都在内存执行。

```csharp
IQueryable<User> a = db.Users;                        // IQueryable
IEnumerable<User> b = db.Users;                       // 一旦赋值给 IEnumerable,后续就是内存
var c = db.Users.AsEnumerable();                      // 显式降级为 IEnumerable
```

### `AsEnumerable()` 的作用

`AsEnumerable()` 把 `IQueryable<T>` 静态类型降级为 `IEnumerable<T>`,从而让后续算子**在内存执行**。常见用途:

1. 需要调用 EF Core 无法翻译的 `C#` 方法,先降级到内存:

```csharp
var result = db.Users
    .AsEnumerable()                          // 此后在内存
    .Where(u => MyCustomRule(u))
    .ToList();
```

2. 先用可翻译的条件尽量缩小数据集,再在内存做复杂逻辑:

```csharp
var result = db.Users
    .Where(u => u.IsActive)                  // SQL 侧
    .Select(u => new { u.Id, u.Name })       // SQL 侧,只取需要的列
    .AsEnumerable()                          // 内存侧
    .Where(x => x.Name.Length > 3)
    .ToList();
```

::: danger
`AsEnumerable()` 之后的过滤条件不再翻译成 SQL,而是把已拉取的数据在内存过滤。**必须确保降级之前已经用 `Where` / `Select` 把数据集缩小**,否则就是把整张表拉进内存。这是 EF Core 事故的最常见形态之一。
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
var nums = mixed.OfType<int>();       // 只取 int 元素
```

`Where` 有带索引的重载:

```csharp
var everyOther = items.Where((item, index) => index % 2 == 0);
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

// Select:结果是 IEnumerable<string[]>,仍然是嵌套的
var nested = orders.Select(o => o.Items);

// SelectMany:结果是 IEnumerable<string>,已展平
var flat = orders.SelectMany(o => o.Items);
Console.WriteLine(string.Join(",", flat));    // 输出: a,b,c
```

`SelectMany` 还常用在"父子展开"和"多源笛卡尔积":

```csharp
var combos = new[] { 1, 2 }.SelectMany(
    x => new[] { "a", "b" },
    (x, s) => $"{x}{s}");
// 输出: 1a,1b,2a,2b
```

::: tip
`Select` 不改变元素数量,`SelectMany` 会改变(展平后数量是各子集合之和)。需要"从每个元素产生零到多个结果"时用 `SelectMany`。
:::

### 排序

```csharp
var sorted = people.OrderBy(p => p.Age);
var desc = people.OrderByDescending(p => p.Age);
var multi = people
    .OrderBy(p => p.City)
    .ThenByDescending(p => p.Age);    // 第二排序键
```

`OrderBy` 返回 `IOrderedEnumerable<T>`,只有它才能接 `ThenBy`。这是稳定的排序(stable sort):相等元素保持原始相对顺序。`OrderBy` 是延迟的,但在枚举时必须先读完整个源才能产出第一个元素。

```csharp
var reversed = sorted.Reverse();      // 注意:Reverse 是延迟的
```

### 分组

`GroupBy` 返回 `IEnumerable<IGrouping<TKey, TElement>>`,每个分组有 `Key` 且本身是 `IGrouping`(可枚举):

```csharp
var byCity = people.GroupBy(p => p.City);

foreach (var group in byCity)
{
    Console.WriteLine($"{group.Key}: {group.Count()}");
    foreach (var p in group)
        Console.WriteLine($"  {p.Name}");
}
```

带元素选择器的重载:

```csharp
var namesByCity = people.GroupBy(
    keySelector: p => p.City,
    elementSelector: p => p.Name);

// 带结果选择器
var summary = people.GroupBy(
    p => p.City,
    (city, group) => new { City = city, Count = group.Count() });
```

`ToLookup` 与 `GroupBy` 的区别:

- `GroupBy` **延迟**,`ToLookup` **立即**执行并返回 `ILookup<TKey, TElement>`。
- `ILookup` 支持按键索引:`lookup["Beijing"]` 直接拿到分组,`GroupBy` 的 `IEnumerable` 需要自己找。
- `ToLookup` 可重复查询且不重算;`GroupBy` 每次枚举都重算。

```csharp
var lookup = people.ToLookup(p => p.City);
foreach (var p in lookup["Beijing"])    // 直接按键访问
    Console.WriteLine(p.Name);
```

### 聚合

```csharp
Console.WriteLine(people.Count());                 // 元素个数
Console.WriteLine(people.LongCount());             // 超过 int 范围时
Console.WriteLine(nums.Sum());                     // 和
Console.WriteLine(nums.Min());                     // 最小
Console.WriteLine(nums.Max());                     // 最大
Console.WriteLine(nums.Average());                 // 平均
```

带选择器的重载很实用:

```csharp
var totalAge = people.Sum(p => p.Age);
var oldest = people.Max(p => p.Age);
```

`Aggregate` 有三种重载,是最通用的聚合:

```csharp
// 1. 无种子:用第一个元素做种子
var product = nums.Aggregate((acc, x) => acc * x);

// 2. 带种子
var sum = nums.Aggregate(0, (acc, x) => acc + x);

// 3. 带种子和结果选择器
var joined = words.Aggregate(
    seed: "",
    func: (acc, w) => acc.Length == 0 ? w : acc + ", " + w,
    resultSelector: s => $"[{s}]");
Console.WriteLine(joined);   // 输出: [a, b, c]
```

累加和字符串拼接是 `Aggregate` 的典型用途。注意字符串拼接应优先用 `string.Join`,性能更好。

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

var orEmpty = empty.DefaultIfEmpty();                // 空序列返回一个 default 元素
var orFallback = empty.DefaultIfEmpty(new Person("n/a"));
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

自定义相等比较器:

```csharp
public class PersonByName : IEqualityComparer<Person>
{
    public bool Equals(Person? x, Person? y)
        => string.Equals(x?.Name, y?.Name, StringComparison.Ordinal);
    public int GetHashCode(Person obj)
        => obj.Name.GetHashCode(StringComparison.Ordinal);
}

var unique = people.Distinct(new PersonByName());
```

`Zip` 把两个序列按位置配对:

```csharp
var names = new[] { "a", "b", "c" };
var ages = new[] { 1, 2 };

var pairs = names.Zip(ages, (n, a) => $"{n}={a}");
// 输出: a=1,b=2(以较短序列为准,多余的 c 被丢弃)
```

### 连接

`Join` 是内连接(只保留两边的匹配):

```csharp
var innerJoined =
    from p in people
    join o in orders on p.Id equals o.PersonId
    select new { p.Name, o.Amount };

// 方法语法
var inner2 = people.Join(
    orders,
    p => p.Id,
    o => o.PersonId,
    (p, o) => new { p.Name, o.Amount });
```

`GroupJoin` 保留左边所有元素,右侧是无匹配则为空的分组:

```csharp
var byPerson = people.GroupJoin(
    orders,
    p => p.Id,
    o => o.PersonId,
    (p, os) => new { p.Name, Orders = os });
```

用 `GroupJoin` + `SelectMany` + `DefaultIfEmpty` 写左外连接:

```csharp
var leftOuter =
    from p in people
    join o in orders on p.Id equals o.PersonId into os
    from o in os.DefaultIfEmpty()             // 无匹配时产生一个 default
    select new
    {
        p.Name,
        Amount = o == null ? 0m : o.Amount    // 注意引用类型判断
    };
```

对值类型元素,`DefaultIfEmpty` 会产生零值,无法区分"没有订单"和"金额为 0"。

### 分页

```csharp
int pageSize = 10, page = 2;
var paged = items
    .Skip((page - 1) * pageSize)
    .Take(pageSize);
```

`Chunk`(.NET 6)把序列切成固定大小的批次:

```csharp
foreach (var batch in items.Chunk(100))
{
    Console.WriteLine($"batch size: {batch.Length}");   // 注意返回的是数组 T[]
}
```

C# 13 / .NET 9 的 `CountBy` 和 `AggregateBy`:

```csharp
var counts = words.CountBy(w => w.Length);
foreach (var (key, count) in counts)
    Console.WriteLine($"{key}: {count}");
```

```csharp
var sums = nums.AggregateBy(
    keySelector: x => x % 2,
    seed: 0,
    func: (acc, x) => acc + x);
```

相比 `GroupBy(...).Select(g => ...)`,`CountBy` / `AggregateBy` 分配更少、意图更清晰。

### 转换

```csharp
var list = source.ToList();
var array = source.ToArray();
var set = source.ToHashSet();
var dict = source.ToDictionary(p => p.Id);                 // 键重复抛异常
var dict2 = source.ToDictionary(p => p.Id, p => p.Name);   // 自定义值
var lookup = source.ToLookup(p => p.City);                 // 键可重复
```

键重复时 `ToDictionary` 抛 `ArgumentException`。已知键可能重复时:

- 用 `ToLookup`(允许重复键,按键分组)。
- 或先用 `GroupBy` 归并,再 `ToDictionary(p => p.Key, g => g.ToList())`。
- 或 .NET 8 的 `ToDictionary` 无重复键保证时,考虑先 `DistinctBy`。

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

用法:

```csharp
var evens = new[] { 1, 2, 3, 4 }.WhereNot(x => x % 2 == 1);
foreach (var n in evens)
    Console.WriteLine(n);   // 输出: 2 4
```

关键点:

- `yield return` 让方法返回惰性迭代器,源在枚举时才开始遍历。
- 参数校验(`ThrowIfNull`)会在**调用时**立即执行,因为在进入迭代器之前——这是 BCL 的做法。
- 不要在延迟算子内部预先 `ToList()`,否则破坏延迟语义。

带索引的重载可以这样写:

```csharp
public static IEnumerable<TResult> SelectWithIndex<T, TResult>(
    this IEnumerable<T> source,
    Func<T, int, TResult> selector)
{
    int index = 0;
    foreach (var item in source)
        yield return selector(item, index++);
}
```

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

## LINQ 性能

### 多次枚举的代价

每次枚举延迟查询都会重跑整个管道。把结果缓存到局部变量:

```csharp
var q = source.Where(...).Select(...);

// 差:枚举三次
var c = q.Count();
var f = q.First();
var l = q.ToList();

// 好:固化一次
var list = q.ToList();
var c2 = list.Count;
var f2 = list[0];
```

### `Where().First()` vs `First(predicate)`

```csharp
var a = source.Where(x => x > 10).First();   // 两个算子、两次委托调用
var b = source.First(x => x > 10);           // 一个算子
```

对内存集合,`First(predicate)` 少一层迭代器包装。对 `IQueryable`,两者通常翻译成同样的 SQL。实际差距不大,但优先 `First(predicate)`。

### `Count() > 0` vs `Any()`

```csharp
// 差:遍历(或在数据库 COUNT 全表)
if (source.Count() > 0) { }

// 好:短路(或数据库 EXISTS)
if (source.Any()) { }
```

在 `IQueryable` 上差异尤其显著:`COUNT(*)` 要扫描,`EXISTS` 找到第一行即返回。

### 什么时候该手写循环

LINQ 有迭代器状态机、委托调用和可能闭包分配的固定开销。下列场景考虑手写循环:

- **极热路径**:每帧调用成千上万次,如游戏循环、实时行情处理。
- **需要 `Span<T>` / `stackalloc`**:LINQ 不支持 `Span<T>`。
- **单次遍历能完成多件事**:LINQ 多个算子意味着多次遍历。
- **短小的值类型集合 + 简单变换**:手写循环可能快数倍。

判断标准不是"LINQ 一定慢",而是**先写 LINQ、基准测试、确认是热点再优化**。绝大多数业务代码里可读性更重要。

```csharp
// 手写:单次遍历同时求 min/max/sum
int min = int.MaxValue, max = int.MinValue;
long sum = 0;
foreach (var x in data)
{
    if (x < min) min = x;
    if (x > max) max = x;
    sum += x;
}
```

### 分配问题

- **闭包**:捕获外部变量的 Lambda 会分配闭包对象。无捕获的 Lambda 可被缓存。
- **迭代器状态机**:每个延迟算子在枚举时分配一个状态机对象。
- **装箱**:对值类型使用非泛型算子(如 `Enumerable.Cast<object>`)可能装箱。

```csharp
int threshold = 10;

// 每次调用都分配新的闭包
var q1 = source.Where(x => x > threshold);

// 无捕获,委托可复用
var q2 = source.Where(static x => x > 10);
```

## EF Core / LINQ to SQL 注意事项

- **不能翻译的表达式会抛异常**。`DateTime.Now.AddDays(x)`、自定义方法、`string.Format` 等通常无法翻译,运行时抛 `InvalidOperationException`。
- **客户端求值限制**:EF Core 3.0 起默认禁止隐式客户端求值,无法翻译的查询直接抛异常而不是静默拉全表。需要时显式 `AsEnumerable()` 或 `ToList()`。
- **`AsNoTracking()`**:只读查询时关闭变更跟踪,减少内存和 CPU 开销。

```csharp
var users = await db.Users
    .AsNoTracking()
    .Where(u => u.IsActive)
    .Select(u => new { u.Id, u.Name })
    .ToListAsync();
```

- **投影到匿名类型 / DTO** 通常比查实体更高效,因为只选择需要的列。
- **`Include` / `ThenInclude`** 加载导航属性,注意笛卡尔积导致的重复行。
- **分页要先排序**:SQL 的 `OFFSET/FETCH` 需要确定性顺序。

## PLINQ 与 `AsParallel()`

`AsParallel()` 把 `IEnumerable<T>` 转成 `ParallelQuery<T>`,后续算子可能并行执行:

```csharp
var result = data
    .AsParallel()
    .Where(x => ExpensiveCheck(x))
    .Select(x => Transform(x))
    .ToList();
```

何时不该用:

- **元素很少**:并行开销大于收益(通常阈值在几千个元素以上)。
- **每个元素的工作量很小**:调度成本占主导。
- **有共享可变状态**:并行下需要锁,反而更慢且易错。
- **顺序敏感**:默认不保证顺序,需要 `AsOrdered()`(有额外成本)。
- **IO 密集而非 CPU 密集**:并行线程在等 IO,应该用异步而不是 PLINQ。

PLINQ 适合"CPU 密集、元素多、无副作用"的场景。没有基准数据前不要引入。

## 常见坑

### 1. 延迟执行导致结果随源变化

```csharp
var q = list.Where(...);
list.Add(item);
var result = q.ToList();   // 包含了新 item
```

定义后若要快照,立即 `ToList()`。

### 2. 重复枚举触发重复查询

```csharp
if (q.Any()) { var all = q.ToList(); }   // 两次执行
```

### 3. `FirstOrDefault` 对值类型返回 0

```csharp
var n = new List<int>().FirstOrDefault();   // 0,不是"没有"
```

用 `int?` 或先判断 `Any()`。

### 4. 闭包捕获循环变量

```csharp
var q = items.Select(x => x + offset);   // offset 是共享变量
offset = 100;                            // 枚举时用的是 100
```

理解捕获是"延迟求值时读当前值"。

### 5. 枚举时修改集合

```csharp
foreach (var x in list.Where(x => x > 0))
{
    list.Remove(x);   // InvalidOperationException:集合被修改
}
```

先 `ToList()` 快照再修改。

### 6. `OrderBy` 之后忘记 `ThenBy`

```csharp
// 错误:第二个 OrderBy 会覆盖第一个排序
people.OrderBy(p => p.City).OrderBy(p => p.Age);

// 正确:
people.OrderBy(p => p.City).ThenBy(p => p.Age);
```

### 7. `GroupBy` 后嵌套枚举的低效

```csharp
var g = people.GroupBy(p => p.City);
foreach (var city in g)
    Console.WriteLine($"{city.Key}: {city.Count()}");   // Count() 重新遍历该分组
```

`IGrouping` 已经是可枚举的,但 `.Count()` 对它是立即的、需遍历;若分组很大且反复调用,考虑先物化。

### 8. `ToDictionary` 重复键抛异常

```csharp
var d = items.ToDictionary(x => x.Category);   // 键重复 -> ArgumentException
```

用 `ToLookup` 或先归并。

### 9. EF Core 先 `ToList` 再 `Where`

```csharp
db.Users.ToList().Where(u => u.Age > 18);   // 拉全表后在内存过滤
```

把 `Where` 放前面,让它翻译成 SQL。

### 10. `IQueryable` 跨 `DbContext` 生命周期

```csharp
IQueryable<User> q;
using (var db = new AppDbContext())
    q = db.Users.Where(u => u.Age > 18);

foreach (var u in q) { }   // ObjectDisposedException
```

在 `using` 内 `ToList()`,或让查询的生命周期与 `DbContext` 对齐。

### 11. 用 `==` 比较浮点/自定义类型却没有比较器

```csharp
nums.Distinct();                            // 对浮点 NaN 等有坑
people.Distinct(new PersonByName());        // 需要自定义比较器
```

默认相等对引用类型是引用相等(除非类型重写了 `Equals`)。

### 12. `Select` 与 `SelectMany` 混淆

```csharp
// 每组是数组,结果是 string[][]
var nested = orders.Select(o => o.Items);
// 展平成一维 string[]
var flat = orders.SelectMany(o => o.Items);
```

### 13. 在查询语法中忘了 `into` 才能继续查询

```csharp
// 分组后无法直接 where,需要 into
var q = from p in people
        group p by p.City into g
        where g.Count() > 2
        select g.Key;
```

### 14. `Zip` 被较短序列截断

`Zip` 以较短的序列为准,较长的多余元素被丢弃。若需要保留,先检查长度。

### 15. 认为 `Reverse()` 立即执行

`Reverse()` 是延迟的,且枚举时要读完整个源才能产出;对大集合是内存与时间的双重成本。
