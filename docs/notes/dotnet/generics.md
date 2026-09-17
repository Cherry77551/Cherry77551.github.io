# 4. 泛型

泛型(generics)让类、方法、接口、委托、结构体都"类型参数化",不必预先绑定具体类型。它解决三件事:类型安全、避免装箱拆箱和强制转换的性能损耗、代码复用。**在 Unity 里,避免装箱直接等于减少 GC 压力。**

C# 的泛型是**具现化(reified)**的,运行时保留完整类型信息;Java 是**类型擦除(erasure)**的,编译后 `List<String>` 和 `List<Integer>` 运行时都是同一个 `ArrayList`。这个差异决定了两门语言泛型能力的边界。

## 为什么需要泛型

C# 1.0 用 `object` 做通用容器(所有类型都派生自 `object`):

```csharp
public class ObjectBox
{
    private object _value;
    public void Set(object value) => _value = value;
    public object Get() => _value;
}

var box = new ObjectBox();
box.Set(42);              // 装箱:值类型复制到堆对象
int n = (int)box.Get();   // 拆箱:类型检查 + 复制回栈
box.Set("hello");
// int bad = (int)box.Get();  // 运行时抛 InvalidCastException
```

每次值类型进出都是一次**装箱(boxing)/拆箱(unboxing)**,也就是一次 GC 堆分配。循环里反复装箱会造成明显的 GC 压力:

```csharp
long sum = 0;
for (int i = 0; i < 1_000_000; i++)
{
    object o = i;   // 每次循环分配一个堆对象(装箱)
    sum += (int)o;  // 拆箱
}
```

`System.Collections.ArrayList` 是这种容器的典型代表,它同时把类型安全的责任推给了运行时:

```csharp
using System.Collections;

var list = new ArrayList();
list.Add(1);          // 装箱
list.Add("three");    // 编译通过!语义错误

foreach (object item in list)
    Console.WriteLine((int)item);  // 处理第三个元素时抛 InvalidCastException
```

问题归纳为三类:**类型不安全**、**装箱开销**、**强制转换散落各处**。

用 `List<int>` 则编译期强制类型一致,运行时对值类型使用特化存储,不产生装箱:

```csharp
using System.Collections.Generic;

var list = new List<int>();
list.Add(1);
// list.Add("three");  // 编译错误

foreach (int item in list)  // 无需强制转换
    Console.WriteLine(item);
```

::: tip Unity 里这是实打实的 GC 压力
Unity 的 GC 分配几乎全部来自装箱和 `new`。`List<int>`、`Dictionary<K,V>` 这类泛型容器不会为值类型元素装箱,而 `ArrayList`、`Hashtable` 会。写游戏逻辑时,**避免把值类型塞进非泛型容器**是最直接的减 GC 手段。
:::

## C# 泛型是具现化的

对比 Java 的类型擦除:C# 里 `List<int>` 和 `List<string>` 在运行时是**两个不同的类型**,CLR 为它们分别创建运行时类型。因此下面这些写法在 C# 合法、在 Java 做不到:

```csharp
public class Container<T>
{
    public Type ElementType => typeof(T);   // 运行时能拿到 T 的 Type
    public T[] ToArray(int size) => new T[size];
    public T Default => default(T);
}
```

对**值类型**类型参数,CLR 会生成**特化代码**,内部直接存放 `int`,无需装箱:

```csharp
var numbers = new List<int>();
numbers.Add(1);     // 直接存入 int[],无装箱
int x = numbers[0]; // 直接读取,无拆箱
```

对**引用类型**,所有引用大小相同,CLR 共享同一份 JIT 代码以控制体积。

::: warning 代码膨胀
每用一个不同的值类型实例化泛型,CLR 都要生成一份特化代码。参数种类极多、方法体又大时,移动端 AOT 的代码体积会增加。但不要因此退回 `object`——那通常是过早优化。
:::

## 泛型类型全家桶

### 泛型类

```csharp
public class Pair<TFirst, TSecond>
{
    public TFirst First { get; }
    public TSecond Second { get; }

    public Pair(TFirst first, TSecond second) { First = first; Second = second; }

    public Pair<TSecond, TFirst> Swap() => new(Second, First);
}

var p = new Pair<string, int>("age", 30);
Console.WriteLine(p.Swap());          // 输出: (30, age)
```

类型参数可以有多个,并且可以互相引用(例如 `Swap` 返回一个新的实例化)。

### 泛型方法

方法可以引入自己的类型参数,与所在类无关:

```csharp
public static void Swap<T>(ref T a, ref T b)
{
    T tmp = a; a = b; b = tmp;
}

int x = 1, y = 2;
Swap(ref x, ref y);   // 推断 T = int
```

### 泛型接口

泛型接口是抽象能力最强的形式,BCL 里大量使用,例如 `IComparer<T>`、`IEnumerable<T>`、`IEqualityComparer<T>`:

```csharp
public interface IEntity { int Id { get; } }

public interface IRepository<T> where T : IEntity
{
    T? FindById(int id);
    void Add(T entity);
    IReadOnlyList<T> All();
}
```

实现时既可以固定具体类型,也可以继续泛型:

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
```

绝大多数场景不需要自定义委托,直接用 BCL 的 `Func` / `Action` 即可。

### 泛型结构体

结构体也可以泛型化,适合做轻量的值语义容器,**完全避免堆分配**:

```csharp
public readonly struct Optional<T>
{
    private readonly bool _hasValue;
    private readonly T _value;

    private Optional(bool hasValue, T value) { _hasValue = hasValue; _value = value; }

    public static Optional<T> Some(T value) => new(true, value);
    public static Optional<T> None => default;

    public bool TryGet(out T value) { value = _value!; return _hasValue; }
}
```

::: tip
`readonly struct` + 泛型非常适合高频、短生命周期的小对象(游戏循环里的向量、解析器里的 token),完全不进堆。
:::

## 类型参数的命名约定

微软官方约定,遵循即可:`T`(唯一类型参数)、`TKey` / `TValue`(字典键值)、`TResult`(返回类型)、`TItem` / `TElement`(集合元素)、`TSource` / `TArgs`(数据源、事件参数)、`TInput` / `TOutput`(转换两端)。类型参数一律用 `T` 前缀,有意义的名称优于裸 `T`,但不要长到像普通变量。

## 类型推断与显式指定

调用泛型方法时,编译器会从**实参**推断类型参数:

```csharp
static T Max<T>(T a, T b) where T : IComparable<T>
    => a.CompareTo(b) >= 0 ? a : b;

int m1 = Max(3, 7);         // 推断 T = int
long m3 = Max<long>(3, 7L); // 实参不一致,显式指定 T = long
```

要点:推断只看**实参**,**不看返回值的赋值目标**;推断结果不满足约束同样是编译错误。

## 约束(where)全表

约束限制类型参数可以是哪些类型,同时解锁对该类型的更多操作。

### `class` / `struct` / `notnull` / `unmanaged`

```csharp
static void RefOnly<T>(T value) where T : class { }        // 引用类型
static void ValueOnly<T>(T value) where T : struct { }     // 非可空值类型
static void NotNullOnly<T>(T value) where T : notnull { }  // 非空(值类型或非空引用)
static unsafe void PtrOnly<T>(T value) where T : unmanaged // 非托管:值类型且无引用字段
{
    T* p = &value;
}
```

`unmanaged` 意味着该类型可用于 `stackalloc`、指针和 P/Invoke。

### `new()` 约束

要求类型有**公开无参构造函数**,这样才能 `new T()`:

```csharp
static T Create<T>() where T : new() => new T();
static T CreateEntity<T>() where T : Entity, new() => new T();
```

::: warning
约束顺序有语法规定:主约束(`class` / `struct` / `notnull` / `unmanaged` / 基类)在前,接口约束居中,`new()` 必须在**最后**。
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
static void Register<TBase, TDerived>(TDerived item) where TDerived : TBase { }
```

### `class?` 与 `notnull` 的差别

- `where T : class` 在可空上下文中表示**非空**引用类型。
- `where T : class?` 允许可为空的引用类型。
- `where T : notnull` 接受非空引用类型和值类型,拒绝可为空引用类型。

### 约束的继承规则

派生类**不能放宽**基类或接口已声明的约束,只能收紧或保持不变:

```csharp
public interface IStore<T> where T : class { }

// public class Bad<T> : IStore<T> { }                              // 非法:放宽了约束
public class Good<T> : IStore<T> where T : class { }
public class Good2<T> : IStore<T> where T : class, IDisposable { } // 收紧 OK
```

::: danger
不要在公共 API 上省略约束。约束是契约的一部分,应当精确表达真实需求。
:::

## `default(T)` 与泛型里的 null

`default(T)` 的语义取决于 `T`:

- 值类型:返回该类型的**零值**(`int` 是 `0`,`bool` 是 `false`,结构体是所有字段的零值)。
- 引用类型:返回 `null`。

```csharp
Console.WriteLine(default(int));             // 0
Console.WriteLine(default(bool));            // False
Console.WriteLine(default(string) == null);  // True
```

### `T?` 的两种含义

打开可空引用类型后,`T?` 在泛型上下文里的含义取决于约束:

- `T` 无约束时,`T?` 表示"可能为 null 的引用类型"。
- `where T : struct` 时,`T?` 表示 `Nullable<T>`(即 `int?`)。

```csharp
static T? NullableRef<T>(T value) where T : class => null;    // 引用可空
static int? NullableVal<T>(T value) where T : struct => null; // Nullable<T>
```

## 泛型里做不到的事

对 `T` 能做什么,取决于你声明了哪些约束。

### 不能直接做算术运算

`T + T` 非法——编译器不知道 `T` 是否支持 `+`。(C# 11 的泛型数学解决了它,但 Unity 只支持 C# 9,用不了。)

```csharp
// static T Add<T>(T a, T b) => a + b; // 编译错误
```

### `new T()` 需要 `new()` 约束

```csharp
// static T Make<T>() => new T(); // 编译错误
static T Make<T>() where T : new() => new T();
```

### 不能对 `T` 直接用 `==`

无约束下的 `==` 语义不确定,即使 `T` 是引用类型也可能只是引用比较,编译器直接禁止:

```csharp
// static bool Same<T>(T a, T b) => a == b;          // 编译错误
// static bool IsNull<T>(T v) => v == null;          // 编译错误
static bool IsNull<T>(T v) where T : class => v == null; // 可以
```

### 正确比较泛型值

需要值相等用 `EqualityComparer<T>.Default`,需要大小比较用 `Comparer<T>.Default`:

```csharp
static bool Same<T>(T a, T b) => EqualityComparer<T>.Default.Equals(a, b);
static int Compare<T>(T a, T b) => Comparer<T>.Default.Compare(a, b);

Console.WriteLine(Same(1, 1));      // True
Console.WriteLine(Compare(3, 7));   // -1
Console.WriteLine(Same("a", "a"));  // True(值相等)
```

`EqualityComparer<T>.Default` 的聪明之处:若 `T` 实现了 `IEquatable<T>` 就用它(无装箱),否则退化到 `object.Equals`——你**不必**强制调用方实现 `IEquatable<T>`。

::: tip
`EqualityComparer<T>.Default` 对值类型不装箱。`Dictionary<TKey, TValue>` 等 BCL 容器默认就用它,性能很好。
:::

## 协变与逆变

变型(variance)描述:类型参数之间有继承关系时,泛型类型之间是否也有方向一致的继承关系。

- **协变 `out`**:`IEnumerable<string>` 可以赋给 `IEnumerable<object>`,因为 `IEnumerable<T>` 只**产出** `T`。
- **逆变 `in`**:`Action<object>` 可以赋给 `Action<string>`,因为 `Action<T>` 只**消费** `T`。

```csharp
IEnumerable<string> strings = new List<string> { "a", "b" };
IEnumerable<object> objects = strings;   // 协变:正例

Action<object> printObj = o => Console.WriteLine(o!.GetType().Name);
Action<string> printStr = printObj;      // 逆变:正例
```

变型只对接口和委托有效,且要求类型参数**只出现在输出位置**(才能 `out`)或**只出现在输入位置**(才能 `in`)。`IList<T>` 同时有 `Add(T)` 和 `this[int]`,所以不能协变;否则下面这段就能把 `int` 塞进 `List<string>`——这正是编译器要防的类型漏洞:

```csharp
// 假设 IList<T> 协变(实际上不是):
IList<object> objs = new List<string>();
objs.Add(42);   // 就会写坏底层 string[]
```

`IReadOnlyList<out T>` 只输出,因此可以协变。数组协变是 C# 1.0 的历史特例,靠**运行时检查**,写错类型会在运行时抛 `ArrayTypeMismatchException`——优先用 `IEnumerable<T>` / `IReadOnlyList<T>`。

## 泛型与反射

运行时保留了类型参数,所以可以反射地观察和构造泛型类型:

```csharp
Type openType = typeof(List<>);                          // 开放泛型
Type closedType = openType.MakeGenericType(typeof(int)); // 构造为 List<int>
Console.WriteLine(closedType == typeof(List<int>));      // True
Console.WriteLine(typeof(List<int>).GetGenericArguments()[0]); // System.Int32
```

::: warning Unity / IL2CPP
`MakeGenericType` / `MakeGenericMethod` 有可观开销,且 AOT 下无法对未预生成的组合内联。**不要放进热路径**;必须动态调用泛型时,缓存构造好的委托(如 `Delegate.CreateDelegate`)。
:::

## 继承与特殊组合

泛型类继承泛型基类,必须固定类型参数或保持同样约束:

```csharp
public class UserRepository : RepositoryBase<User> { }                      // 固定 T
public class GenericRepository<T> : RepositoryBase<T> where T : IEntity { } // 继续泛型
```

约束到 `IDisposable` 才能对 `T` 调用 `Dispose`;不确定时用模式匹配 `if (value is IDisposable d) d.Dispose();`。

## 设计最佳实践

- **约束尽量小而精确**:只要求你真正需要的接口。多加一个约束就缩小了可复用范围。
- **优先接口约束而不是基类约束**:接口约束不限制单继承。
- **不要要求 `IEquatable<T>` 来比较值**:用 `EqualityComparer<T>.Default`,它已经优化处理了 `IEquatable<T>`。
- **公开 API 的泛型要保持简单**:超过两三个类型参数或超过三行约束,通常意味着抽象泄漏,考虑拆分为多个方法或引入专门的类型。
- **用 `notnull` 明确字典键**:`Dictionary<TKey, TValue>` 或自定义容器要求键非空时,加上 `where TKey : notnull` 能让可空分析器帮你抓 bug。
- **避免约束到密封具体类**,除非确实需要它特有的成员;那通常是过度耦合。

## Unity 视角

`GetComponent<T>()` 是泛型最常见的用处:它返回确定的组件类型,不需要强转,也就不会把组件塞进 `object`。更重要的是 **`TryGetComponent<T>(out T)`**:找不到组件时**不产生 GC 分配**,而 `GetComponent<T>()` 失败时会分配(用于构造异常)。每帧轮询组件时优先用它:

```csharp
// 不推荐:每帧调用,失败时产生分配
var rb = GetComponent<Rigidbody>();

// 推荐:无分配
if (TryGetComponent(out Rigidbody rb))
    rb.AddForce(Vector3.up);
```

泛型容器同样是减 GC 的关键:`List<T>`、`Dictionary<K,V>` 对值类型元素不装箱,`ArrayList`、`Hashtable` 会。别把 `Vector3`、`int` 这类值类型放进非泛型容器。

泛型也是 Unity 序列化与事件系统的基础:`GetComponents<T>()`、`EventSystem`、`UnityEvent<T>` 都靠它保证类型安全。

## Unity 用不了(只支持 C# 9)

下面这些新特性在 Unity 里用不了,遇到别照抄:

| 特性 | 版本 | 替代方案 |
| --- | --- | --- |
| 泛型数学(`INumber<T>`、`IAdditionOperators` 等) | C# 11 | 为具体类型写重载,或装箱后运算 |
| 静态抽象 / 静态虚成员(`static abstract`) | C# 11 | 普通接口方法或具体类型 |
| `allows ref struct` 约束 | C# 13 | 泛型 API 无法接受 `Span<T>` |

## 常见坑

### 1. 无约束下对 `T` 使用 `==`

```csharp
// static bool Eq<T>(T a, T b) => a == b;             // 编译错误
static bool Eq<T>(T a, T b) => EqualityComparer<T>.Default.Equals(a, b);
```

### 2. 以为 `default(T)` 一定是 `null`

对值类型它是零值。要表达"可能缺失",用 `Nullable<T>` 或自定义 `Optional<T>`。

### 3. 有 `struct` 约束时误用 `T?`

`where T : struct` 时 `T?` 是 `Nullable<T>`(如 `int?`),不是 `T`,语义与无约束时完全不同。

### 4. 给重写方法放宽约束

重写不能放宽基方法的约束,只能保持一致(或省略,等效继承约束)。

### 5. 以为数组协变是安全的

```csharp
object[] a = new string[1];
a[0] = 1;  // ArrayTypeMismatchException
```

只读协变容器用 `IEnumerable<T>` / `IReadOnlyList<T>`。

### 6. 混淆 `new T[]` 与 `new T()`

`new T[]` 不需要 `new()` 约束,`new T()` 需要。

### 7. 中间退化为 `object` 导致反复装箱

```csharp
void Add<T>(List<T> list, T item) => list.Add(item); // 无装箱
void AddObj(object item) { /* 传值类型时装箱 */ }
```

尽量让泛型一路保持类型参数。

### 8. 用反射动态构造泛型却不缓存

`MakeGenericType` 每次调用都有成本。类型组合有限时缓存结果。

### 9. 在泛型类型上声明静态字段的共享假设

```csharp
class Counter<T> { public static int Count; }
Counter<int>.Count = 1;
Counter<string>.Count = 2; // 与 Counter<int> 是不同的静态字段
```

每个封闭泛型类型有**独立**的静态字段。要共享就放到非泛型基类里。
