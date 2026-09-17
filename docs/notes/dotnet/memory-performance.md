# 8. 内存、GC 与性能

C# 把内存管理交给运行时,但不意味着可以无视内存。对 Unity 游戏来说,内存问题的表现形式和传统后端服务完全不同:不是吞吐量不够,而是**某一帧突然卡一下**——一次全堆 GC 停顿把帧率打穿。这一章从栈与托管堆讲到 **Unity 的 Boehm GC**(它和 .NET 的分代 GC 是两套东西),再到 `IDisposable`、`Span<T>`、池化,最后落到 Unity Profiler 与零分配实践。

::: warning
本章默认你已经会写 C#,只是在**为 Unity 游戏开发**补内存与性能知识。如果你读过网上那些讲 .NET GC 的文章,请注意:它们的结论**不能直接搬到 Unity**。原因见下面的 GC 一节。
:::

## 内存基础

### 栈与托管堆

每个线程有一个**栈**,方法调用时压入栈帧,存放参数、局部变量、返回地址。栈是 LIFO 的,方法返回时整个栈帧一次弹出,所以栈上数据**不需要 GC**,分配只是移动栈指针。栈容量小(主线程通常约 1MB),深递归或超大 `stackalloc` 会 `StackOverflowException`,该异常**无法捕获**,进程直接终止。

**托管堆**是另一回事:所有 `new` 出来的引用类型实例、数组、闭包、装箱结果都放在这里,由 GC 负责回收。栈上"不用管",堆上"要管",这是整章的分界线。

### 值的存储位置

准确表述是:**值类型在其声明位置存储**,不一定是栈。以下情况它实际在堆上:

```csharp
class Holder { public Point P; }      // 1. 类字段 → 随对象在堆上
Point[] array = new Point[10];        // 2. 数组元素 → 堆上
object boxed = new Point(1, 2);       // 3. 装箱 → 堆上,且产生分配
Func<int> f = () => { var p = new Point(1, 2); return p.X; }; // 4. 闭包捕获 → 提升到堆
```

跨 `await` 存活的局部值类型也会被提升到状态机。**"在栈上"的真正含义是生命周期严格嵌套于调用栈**,这才是它免 GC 的原因。

### Unity 的内存版图

```text
+----------------------------------------------+
| 引擎原生内存(C++ 侧:场景、网格、纹理、音频)  |
+----------------------------------------------+
| 托管堆(Boehm GC 管理:所有 new / 装箱 / 闭包) |
+----------------------------------------------+
| 非托管堆(malloc / P/Invoke / Native Plugin)  |
+----------------------------------------------+
| 图形 / 音频驱动内存(GPU 显存、声卡缓冲)      |
+----------------------------------------------+
```

Unity 里"内存占用高"可能来自上述任意一层。`Profiler.GetMonoUsedSizeLong()` 看的是托管堆,别把它和纹理、网格占用的原生内存混为一谈。

## Unity 的 GC 模型

### Boehm-Demers-Weiser GC

Unity 用的不是 .NET 那套 GC,而是 **Boehm-Demers-Weiser GC**(俗称 Boehm GC),**Mono 和 IL2CPP 两个脚本后端都用它**。Unity 6.0 默认开启**增量模式**(incremental mode)。Unity 支持的语言版本是 **C# 9.0**。

它和 .NET GC 的差异是本章的核心:

- **不分代**:没有 Gen0 / Gen1 / Gen2 的概念,**每次回收都是全堆扫描**,没有"扫描一小块就完事"的便宜回收。
- **不压缩、不移动**:对象地址在分配后固定,所以根本没有"压缩整理"这一步。好处是引用永远有效、P/Invoke 天然安全;代价是**堆会碎片化、只增不减**,峰值内存下不来(游戏里表现为"玩久了内存越来越高")。
- **回收耗时与存活对象数量和堆大小成正比**,而不是像分代 GC 那样 Gen0 很便宜。堆越大、活着的对象越多,单次停顿越长。
- **问题形态是卡顿尖峰**:一次 GC 停顿直接掉帧,而不是吞吐量下降。

### 增量模式:把停顿摊平

增量 GC 把一次完整回收**拆成多个小步分散到多帧**,把原本一次长停顿摊成多个短停顿。这是 Unity 的默认模式,所以你看到的往往是"偶尔掉几帧"而不是"一帧卡死半秒"。

前提是你得给它时间去分步完成。如果分配速度太快,GC 追不上,单帧内被迫做更多工作,停顿又会露头。**降低分配频率才是根本手段**。

### 与 .NET 分代 GC 对比

| 维度 | .NET GC | Unity Boehm GC |
| --- | --- | --- |
| 分代 | Gen0 / Gen1 / Gen2 + LOH | **无分代,每次全堆扫描** |
| 压缩 | 移动存活对象,消除碎片 | **不移动,地址固定** |
| 堆收缩 | 可回缩 | **只增不减** |
| 成本模型 | Gen0 极便宜,与存活量弱相关 | **与存活对象数 + 堆大小成正比** |
| 故障形态 | 吞吐量下降 | **卡顿尖峰(掉帧)** |
| 调优手段 | Server / Workstation / 后台 GC | **增量模式 + `GCMode`** |
| 脚本后端 | CoreCLR | Mono / IL2CPP |

::: danger
网上很多讲 Unity 性能的文章直接套用 .NET 的分代 GC 结论,是错的。典型错误:"把对象用完就丢,GC 会走 Gen0 很快回收"——在 Unity 里没有 Gen0,这些短命对象同样会进入**全堆扫描**的代价模型;"手动 `GC.Collect()` 会破坏分代假设"——在 Unity 里它只是触发一次 Boehm 回收,后果不同;"大对象(>85KB)进 LOH"——**Unity 根本没有 LOH**。理解这一点,你才知道为什么 Unity 优化里"消除每帧分配"如此重要。
:::

### 控制 GC:GCMode 与 GC.Collect

Unity 提供 `UnityEngine.Scripting.GarbageCollector.GCMode` 控制 GC 时机:

- `Enabled`:默认,GC 自行决定何时回收(配合增量模式)。
- `Disabled`:GC 完全停摆,期间**不回收任何内存**。适合对帧率极度敏感但持续时间很短的阶段,内存会持续增长,记得及时恢复。
- `Manual`:GC 只在明确请求时回收,通常配合 `System.GC.Collect()`。

```csharp
using UnityEngine.Scripting;

GarbageCollector.GCMode = GarbageCollector.Mode.Disabled;
// ... 一段不能有 GC 停顿的窗口,注意内存上限 ...
GarbageCollector.GCMode = GarbageCollector.Mode.Enabled;

System.GC.Collect();   // 在 Unity 里对应触发一次 Boehm 回收
```

`System.GC.Collect()` 在 Unity 里就是"触发 Boehm GC",不是 .NET 的分代回收。它会带来一次可感知的停顿,**不要在每帧里调**,通常只在加载完成、切场景等天然空档调用。

::: tip
`Resources.UnloadUnusedAssets()` 与 GC 是**两件事**:前者卸载不再被引用的 Asset(纹理、网格等原生内存),后者回收托管对象。切场景后内存没降,往往缺的是 `UnloadUnusedAssets()` 而不是 `GC.Collect()`。
:::

### 观测 API

```csharp
using UnityEngine.Profiling;

long used  = Profiler.GetMonoUsedSizeLong();          // 托管堆已用
long heap  = Profiler.GetMonoHeapSizeLong();          // 托管堆当前大小(含空闲)
long alloc = Profiler.GetTotalAllocatedMemoryLong();  // Unity 分配器总分配
```

真正定位"哪里分配了"要看 **Unity Profiler 的 GC Alloc 列**(见"度量与诊断"一节)。

## GC 尖峰从哪来

Boehm 不分代,意味着**任何一次分配都在给全堆扫描加压**。每帧固定分配 N 字节,最终都会以卡顿形式还回来。常见源头:

- **`Update()` 里的字符串拼接**:`"HP: " + hp`、插值、`string.Format`。
- **`foreach` 拆箱**:遍历 `object[]`、`IEnumerable` 非泛型接口、字典的键值对结构。
- **`new` 数组 / 集合**:`new int[4]`、`new List<T>()`、`ToArray()`、LINQ 的中间结果。
- **闭包**:lambda 捕获了局部变量或 `this`,每次调用分配一个闭包对象。
- **`GetComponent<T>()` 返回新数组**:`GetComponents<T>()`、`GetComponentsInChildren<T>()` 会分配。
- **tag 字符串比较**:`gameObject.tag == "Player"` 内部访问 `tag` 属性会分配,`CompareTag` 不会。
- **装箱**:把值类型塞进 `object` 容器、非泛型接口、枚举当字典键。
- **`Camera.main`**:内部走 `FindGameObjectsWithTag`,每帧调用就是每帧分配 + 查找。

## 资源管理

### 托管资源 vs 非托管资源

- **托管资源**:由 GC 管理内存的对象(`List<T>`、`string`、`byte[]`、`GameObject` 的托管包装)。GC 会回收内存,**但不执行清理逻辑**——对象持有文件句柄或原生缓冲时,回收内存不代表句柄被关闭。
- **非托管资源**:文件句柄、socket、`malloc` 内存、Native Plugin 句柄、`Texture2D` / `Mesh` 背后的原生资源,必须显式释放。

`IDisposable` 的意义就是给"清理逻辑"一个确定的调用时机。

### 完整的 Dispose 模式

```csharp
public class ResourceHolder : IDisposable
{
    private IntPtr _nativeHandle;           // 非托管资源
    private FileStream? _stream;            // 托管资源(自身也是 IDisposable)
    private bool _disposed;

    public void Dispose()
    {
        Dispose(disposing: true);
        GC.SuppressFinalize(this);          // 关键:已手动清理,不需要终结器
    }

    protected virtual void Dispose(bool disposing)
    {
        if (_disposed) return;

        if (disposing)
        {
            _stream?.Dispose();             // 只在这里释放托管资源
            _stream = null;
        }

        if (_nativeHandle != IntPtr.Zero)   // 无论 disposing 真假都释放非托管资源
        {
            NativeMethods.Destroy(_nativeHandle);
            _nativeHandle = IntPtr.Zero;
        }

        _disposed = true;
    }

    ~ResourceHolder() => Dispose(disposing: false);   // 终结器只释放非托管资源
}
```

- **`disposing` 参数**区分调用来源:`true` 来自用户调用的 `Dispose()`,可安全访问其他托管对象;`false` 来自终结器,那些对象可能已被回收。
- **`GC.SuppressFinalize(this)`** 把对象移出终结器队列。没有它,即使调用了 `Dispose`,对象也要多活一轮 GC。**有终结器的类型必须调用**。
- **终结器**只是用户忘记 `Dispose` 时的安全网,代价是至少两次 GC。

**`sealed` 类可以简化**:没有派生类就不需要 `protected virtual` 扩展点和 `disposing` 区分;没有终结器就不需要 `GC.SuppressFinalize`。

::: tip
多数业务类型不需要完整模式:只持有托管资源时,让 GC 管内存、把非托管资源封装进 `SafeHandle`,然后逐个 `Dispose` 托管字段即可,连终结器都不必写。
:::

### using 与 using 声明

```csharp
using (var stream = File.OpenRead("a.txt"))   // 语句形式,作用域是花括号
{
    ReadAll(stream);
}

using var stream2 = File.OpenRead("b.txt");   // 声明形式(C# 8),作用域是所在代码块
ReadAll(stream2);
```

两者都编译成 `try/finally`,保证异常时也释放;多个 `using` 声明按**逆序**释放。

### IAsyncDisposable 与 await using

```csharp
await using var stream = new FileStream("a.txt", FileMode.Create);
await stream.WriteAsync(data);
// 作用域结束时调用 await stream.DisposeAsync()
```

类型同时实现 `IDisposable` 和 `IAsyncDisposable` 时,`await using` 优先走异步路径。async 方法里遇到异步资源就用 `await using`。

### SafeHandle 为什么更安全

手写终结器容易出问题:可能访问已被卸载的对象、句柄为 0 时误释放、忘记标记状态。`SafeHandle` 由运行时保证引用计数(防止句柄在 P/Invoke 调用中被提前释放)、终结器恰好在正确时机执行一次,并提供 `DangerousAddRef` / `DangerousRelease` 处理临界区。

```csharp
internal sealed class SafeNativeHandle : SafeHandleZeroOrMinusOneIsInvalid
{
    public SafeNativeHandle() : base(ownsHandle: true) { }
    protected override bool ReleaseHandle() => NativeMethods.Close(_handle) != 0;
}
```

P/Invoke 声明用 `SafeHandle` 而不是 `IntPtr`,运行时就能正确钉住对象并处理 GC 竞争。

### 什么时候需要终结器

很少。只在类型**直接**持有无法用 `SafeHandle` 封装的原生资源、且资源贯穿整个生命周期时才写。给每个类加终结器只会让对象多活两轮 GC,在 Unity 里直接变成额外卡顿。**不要为了"保险"加终结器**。

## unsafe 与非托管互操作(简介)

在 Unity 里这主要出现在写 **Native Plugin**、对接 C/C++ 库、操作原生缓冲时。启用需要 `AllowUnsafeBlocks`:

```csharp
unsafe void Copy(byte* dest, byte* src, int length)
{
    for (int i = 0; i < length; i++) dest[i] = src[i];
}

unsafe void UseString(string s)
{
    fixed (char* p = s)                // 钉住,阻止 GC 移动(Boehm 不移动,但语义仍需要)
    {
        Console.WriteLine((int)p[0]);
    }
}
```

`stackalloc` 在栈上分配,零 GC 压力,但大小必须小且不能逃逸。`Marshal` 用于和非托管内存打交道:

```csharp
IntPtr ptr = Marshal.AllocHGlobal(1024);
try
{
    Marshal.WriteInt32(ptr, 42);
    Console.WriteLine(Marshal.ReadInt32(ptr));   // 输出: 42
}
finally
{
    Marshal.FreeHGlobal(ptr);                    // 必须释放
}
```

P/Invoke 用 `[DllImport]` 声明:

```csharp
[DllImport("MyPlugin", CallingConvention = CallingConvention.Cdecl)]
private static extern int MyPlugin_Init(IntPtr data, int length);
```

`GCHandle` 用于让非托管代码持有托管对象引用:

```csharp
GCHandle handle = GCHandle.Alloc(data, GCHandleType.Pinned);
try { IntPtr ptr = handle.AddrOfPinnedObject(); /* 传给原生代码 */ }
finally { handle.Free(); }   // 不释放既泄漏句柄又永远钉住对象
```

## Span 与 ref 系列

### Span`<T>` 与 ReadOnlySpan`<T>`

`Span<T>` 是"一段连续内存的视图",本质是 `(ref T, int length)`,可指向栈、数组、非托管内存或字符串,本身**不拥有**内存。

```csharp
int[] array = { 1, 2, 3, 4, 5 };
Span<int> span = array.AsSpan();

Span<int> slice = span.Slice(1, 3);   // { 2, 3, 4 },零分配
slice[0] = 99;
Console.WriteLine(array[1]);          // 输出: 99
```

它解决的问题:传统 `array.Skip(1).Take(3).ToArray()` 或 `Substring` 做切片会**复制**。`Span<T>` 只记录偏移和长度,零分配,在解析、协议处理、字符串处理等热路径上收益巨大。

::: tip
Unity 在 **.NET Standard 2.1 兼容级别**下可用 `Span<T>` / `ReadOnlySpan<T>` / `Memory<T>`(Unity 2021.2+ 默认即是)。如果你的项目还停在 .NET Standard 2.0 或更旧的 API 兼容级别,这些类型不可用——先升兼容级别,再谈 span 优化。
:::

### 为什么是 ref struct

`Span<T>` 声明为 `ref struct`,带来一系列强制限制:

- **只能在栈上**:不能做类字段、不能装箱、不能当 `object`;
- **不能作为泛型类型参数**;
- **不能跨 `await`**:async 状态机会把局部变量提升到堆上,而 `Span<T>` 不允许上堆;
- **不能跨 `yield`**,不能是 `Task<T>` 的 `T`。

```csharp
async Task Bad()
{
    Span<byte> buffer = stackalloc byte[64];
    await Task.Delay(1);
    Use(buffer);        // 编译错误:不能跨越 await
}
```

需要跨 `await` 就用 `Memory<T>`。

### Span 的常见用法

```csharp
string text = "  hello, world  ";

ReadOnlySpan<char> trimmed = text.AsSpan().Trim();   // 零分配切片
Console.WriteLine(trimmed.ToString());               // 分配:只有 ToString 这一次

bool hasWorld = trimmed.Contains("world", StringComparison.OrdinalIgnoreCase);
int value = int.Parse("12345".AsSpan());              // 直接在 span 上解析

Span<char> result = stackalloc char[32];
trimmed.CopyTo(result);
```

`MemoryExtensions` 提供了在 span 上工作的扩展方法:`Trim`、`StartsWith`、`EndsWith`、`Contains`、`IndexOf`、`SequenceEqual` 等,它们不分配新字符串。比较 span 与字面量用 `span.SequenceEqual("GET".AsSpan())`。

### Memory`<T>` 与 ReadOnlyMemory`<T>`

`Memory<T>` 是 `Span<T>` 的"可上堆"版本:可以是类字段、可以跨 `await`、可以配合 `Task<T>`,用 `.Span` 拿到实际视图。

```csharp
async Task ReadAsync(Memory<byte> buffer)
{
    int read = await stream.ReadAsync(buffer, 0, buffer.Length);
    Process(buffer.Span.Slice(0, read));
}
```

能用 `Span<T>` 就用 `Span<T>`,只有需要字段或跨 `await` 时才退到 `Memory<T>`。

### ref / out / in 与 readonly struct

```csharp
void Double(ref int x) => x *= 2;                     // 可读可写,调用方须初始化
bool TryParse(string s, out int value) { value = 0; return false; }  // 方法内必须赋值
void Print(in BigStruct s) => Console.WriteLine(s.X); // 只读引用

struct BigStruct { public long A, B, C, D, E, F, G, H; }
void ByValue(BigStruct s) { }   // 复制约 64 字节
void ByIn(in BigStruct s) { }   // 只传 8 字节引用
```

`in` 配合 `readonly struct` 效果最好——后者保证方法不修改字段,`in` 参数就不必为防御性拷贝而隐藏复制。Unity 的 `Vector3`、`Quaternion` 都是小结构体,别对它们滥用 `in`。

```csharp
public readonly struct GridPos
{
    public readonly int X, Y;
    public GridPos(int x, int y) => (X, Y) = (x, y);
}
```

::: warning
`in` 只在结构体较大时才值得用。对 `int`、`Vector2` 这类小类型,它增加间接寻址,可能更慢。经验阈值是超过 16~24 字节再考虑。
:::

### ref return

```csharp
public class Buffer
{
    private int[] _data = new int[10];
    public ref int At(int index) => ref _data[index];
}

var buffer = new Buffer();
ref int slot = ref buffer.At(3);
slot = 42;                              // 直接改到数组元素,无拷贝
```

`Span<T>` 的索引器本质就返回 `ref T`,所以 `span[0] = x` 能直接改到底层内存。

## 池化与避免分配

### ArrayPool`<T>`

```csharp
byte[] buffer = ArrayPool<byte>.Shared.Rent(4096);   // 返回的数组可能大于 4096
try
{
    int read = stream.Read(buffer, 0, buffer.Length);
    Process(buffer.AsSpan(0, read));
}
finally
{
    ArrayPool<byte>.Shared.Return(buffer);            // 必须归还
}
```

::: danger
**Rent 出来的数组必须 Return**,否则池退化成不停分配新数组且旧数组无法回收。归还前清理敏感数据用 `Return(buffer, clearArray: true)`。`Rent(4096)` 可能返回更大的数组,永远用 `buffer.Length` 界定有效范围。
:::

### ObjectPool`<T>`(UnityEngine.Pool)

注意这里有两个同名类型,**别搞混**:

- `UnityEngine.Pool.ObjectPool<T>`:**Unity 的**,用于池化 `GameObject`、组件、特效等游戏对象。
- `Microsoft.Extensions.ObjectPool.ObjectPool<T>`:**.NET 的**,Unity 项目里默认不可用,只有在专门引入该包时才有。

Unity 版本的典型用法:

```csharp
using UnityEngine.Pool;

public class BulletSpawner : MonoBehaviour
{
    [SerializeField] private Bullet _prefab;
    private ObjectPool<Bullet> _pool;

    private void Awake()
    {
        _pool = new ObjectPool<Bullet>(
            createFunc:      () => Instantiate(_prefab),
            actionOnGet:     b => b.gameObject.SetActive(true),
            actionOnRelease: b => b.gameObject.SetActive(false),
            actionOnDestroy: b => Destroy(b.gameObject),
            collectionCheck: false,
            defaultCapacity: 32,
            maxSize:         128);
    }

    public Bullet Get()    => _pool.Get();
    public void Release(Bullet b) => _pool.Release(b);
}
```

子弹、特效、UI 元素这类"频繁创建销毁"的对象都应该走池化,替代每帧 `Instantiate` / `Destroy`。

### 避免装箱

```csharp
ArrayList list = new();
list.Add(42);                       // 坏:装箱,一次堆分配

int x = 42;
IComparable c = x;                  // 坏:接口是引用类型,装箱

List<int> numbers = new();
numbers.Add(42);                    // 好:泛型无装箱

if (EqualityComparer<int>.Default.Equals(a, b)) { }   // 好:无装箱比较
```

`EqualityComparer<T>.Default` 在 `T` 实现 `IEquatable<T>` 时走无装箱的强类型比较,否则退化为 `Object.Equals`。自定义 struct 想高效比较就实现 `IEquatable<T>` 并重写 `GetHashCode`。别把 struct 当 `Dictionary` 的键却忘了实现这两个方法。

### 避免闭包分配

```csharp
int threshold = 10;
var a = items.Where(i => i > threshold).ToList();       // 每次调用分配闭包
var b = items.Where(static i => i > 10).ToList();       // 静态 lambda,零分配

for (int i = 0; i < n; i++)
{
    int local = i;                                       // 避免直接捕获循环变量
    tasks.Add(Task.Run(() => Process(local)));
}
```

C# 9 的 `static` lambda 会在编译期检查是否捕获环境,捕获了直接报错,是防止意外分配的有效手段。需要携带状态时,倾向于把状态放进结构体参数,而不是让 lambda 捕获。

### 字符串处理

```csharp
string r1 = "";
foreach (var item in items) r1 += item;          // 坏:O(n²) 且大量分配

var sb = new StringBuilder();
foreach (var item in items) sb.Append(item);     // 好:StringBuilder(可复用清空)
string r2 = sb.ToString();

string csv = string.Join(",", items);            // 好:已知分隔符
```

`string.Format` / 插值走格式化路径,有额外分配成本;`string.Concat` 直接分配一次目标大小的字符串。**每帧 UI 文本**是 Unity 字符串分配的重灾区:能缓存就缓存,数值变化才刷新。

### 结构体 vs 类

| 维度 | struct | class |
| --- | --- | --- |
| 分配 | 通常在栈上 / 内联,**无 GC 压力** | 堆分配,GC 压力 |
| 复制 | 按值复制(大结构体代价高) | 复制引用 |
| 继承 / 多态 | 不支持,需装箱 | 原生支持 |
| 默认比较 | `ValueType.Equals` 反射比较,慢 | `ReferenceEquals`,快 |
| 适用 | 小、不可变、生命周期短、值语义 | 大、需继承 / 引用语义 |

经验法则:结构体控制在 16~24 字节以内,且要**不可变**;超过这个尺寸又频繁传递,维护成本会超过性能收益。

## 零分配实践(Unity)

这一节是最能直接降低卡顿的部分。目标是让 `Update()` / 物理回调 / 每帧协程里**不产生托管分配**。

### 缓存 GetComponent,优先 TryGetComponent

```csharp
// 坏:每帧查找 + 每次分配(找不到时还会分配错误信息)
void Update() => GetComponent<Rigidbody>().AddForce(Vector3.up);

// 好:Awake 缓存一次
private Rigidbody _rb;
void Awake() => _rb = GetComponent<Rigidbody>();
void Update() => _rb.AddForce(Vector3.up);

// 更好:TryGetComponent 不产生分配,失败也不抛
if (TryGetComponent(out Rigidbody rb))
    rb.AddForce(Vector3.up);
```

`TryGetComponent<T>(out var c)` 在找不到时不分配,而 `GetComponent<T>()` 在失败场景可能产生分配。热路径上优先 `TryGetComponent`。

### CompareTag 与 Camera.main

```csharp
if (other.CompareTag("Player")) { }   // 好:无分配
if (other.tag == "Player") { }        // 坏:tag 属性返回字符串,产生分配

// 坏:每帧内部 FindGameObjectsWithTag + 分配
Camera.main.transform.position = p;

// 好:缓存
private Camera _cam;
void Awake() => _cam = Camera.main;
void LateUpdate() => _cam.transform.position = p;
```

### NonAlloc 物理 API

`Physics.Raycast` / `OverlapSphere` 的普通版本返回数组,每次调用都分配。用 `NonAlloc` 版本 + 预分配缓冲:

```csharp
private readonly RaycastHit[] _hits = new RaycastHit[8];

void Scan()
{
    int count = Physics.RaycastNonAlloc(origin, direction, _hits, 100f);
    for (int i = 0; i < count; i++)
        Process(_hits[i]);
}

private readonly Collider[] _overlaps = new Collider[16];
int n = Physics.OverlapSphereNonAlloc(center, radius, _overlaps);
```

同理还有 `Physics2D.*NonAlloc`、`Collider.GetContactsNonAlloc` 等。

### for 还是 foreach

老版本 Mono 的 `foreach` 对 `List<T>` 会产生枚举器装箱,现在 `List<T>` 的枚举器已是 struct,不再装箱。但仍有注意点:

- **遍历数组**用 `for` 更稳(避免枚举器与边界检查开销),尤其热路径。
- **避免用 `IEnumerable<T>` 接口遍历值类型集合**,那会走接口分派并可能装箱。
- 字典遍历 `foreach (var kv in dict)` 的 `KeyValuePair` 是 struct,安全;但别把它当 `object` 用。

### 复用缓冲与预设容量

```csharp
private readonly StringBuilder _label = new();
private readonly List<Enemy> _visible = new(64);   // 预设 Capacity,避免扩容分配

void Refresh()
{
    _label.Clear();                                  // 复用,而不是 new
    _label.Append("HP: ").Append(_hp);
    _text.text = _label.ToString();                  // 只在真正变化时刷新
    _visible.Clear();
}
```

`List<T>` 不预设 `Capacity` 时,添加元素会触发多次扩容(每次都分配新数组并复制)。对已知规模的集合,一开始就给定容量。

### 对象池替代 Instantiate / Destroy

子弹、特效、飘字、列表项 UI 都应池化(见 `ObjectPool<T>` 一节)。`Instantiate` 与 `Destroy` 本身就有可观开销,叠加随之而来的托管分配,是持续卡顿的常见来源。

## 什么时候该故意不管 GC

不是所有分配都值得优化。以下场景请大胆分配:

- **原型期**:先做出来再谈性能,过早优化会拖慢验证速度。
- **编辑器工具代码**:只在 Editor 运行,不进包体、不影响玩家帧率。
- **启动 / 加载阶段**:一次性、可接受停顿的地方,不值得为省几个字节把代码写复杂。
- **每帧只跑一次、分配量极小的代码**:如果你的 `Update` 每帧只分配几十字节,优化的优先级远低于消除那次 4KB 的 `ToArray()`。

判断依据是 **Profiler 里的 GC Alloc 数据**,不是直觉。先找到占比最大的分配点,而不是所有分配点。

## 度量与诊断

### Unity Profiler

**GC Alloc 列**是首要工具:它显示每帧在托管堆上分配了多少字节。目标是在游戏稳定运行阶段把它压到接近 0。使用方法:打开 Profiler,选 CPU Usage 模块,开启 Deep Profile 或对具体标记采样,按 GC Alloc 排序找热点。

### ProfilerMarker 自定义标记

```csharp
using Unity.Profiling;

static readonly ProfilerMarker s_Scan = new ProfilerMarker("Enemy.Scan");

void Scan()
{
    using (s_Scan.Auto())
    {
        // 会被 Profiler 计时并显示在时间轴上
    }
}
```

把可疑的每帧逻辑包上 `ProfilerMarker`,就能在 Profiler 时间轴上看到它占用的时间与分配,比盲猜高效得多。

### Memory Profiler 与 Frame Debugger

- **Memory Profiler 包**:抓取托管堆快照,查看对象类型、数量、引用树,定位"谁在持有这些对象导致内存下不来"。
- **Frame Debugger**:逐 Draw Call 查看渲染状态,排查渲染相关的性能与内存问题。
- **Deep Profile**:对每个方法都注入采样,数据最全但开销极大,只适合在小场景里定位问题。

### 为什么 BenchmarkDotNet 在 Unity 用不了

BenchmarkDotNet 是独立的 .NET 命令行工具,它在独立进程里用 CoreCLR 跑基准,**依赖 .NET 运行时而非 Unity 的 Mono/IL2CPP 与 Boehm GC**,测出来的分配模型与 GC 行为都不是 Unity 的。在 Unity 里做微基准应:

- 用 `ProfilerMarker` 标注 + 自定义计时,在真机 / 目标平台上跑;
- 用 `Profiler.GetMonoUsedSizeLong()` 前后差值粗测分配(可参考 `GC.GetAllocatedBytesForCurrentThread()`,但它不是主线的 Unity 观测手段);
- 固定帧率、关闭编辑器干扰,用同一场景重复对比。

### 优化方法论

1. **先用 Profiler 定位**,再动手;人的直觉在性能问题上错得离谱。
2. **优先砍掉每帧分配**,GC Alloc 是 Unity 卡顿最直接的来源。
3. **一次改一个变量**并重新测量,确认收益超出噪声。
4. **区分频率**:每帧热路径值得重写,加载期一次性代码不值得。
5. **关注分配而非只有耗时**,减少分配往往同时改善停顿与内存峰值。
6. **真机验证**,编辑器的性能数据不能代表发布版本。

::: tip
常见优化顺序(从易到难):缓存组件与 `Camera.main` → 用 `TryGetComponent` / `CompareTag` / `NonAlloc` → 复用 `StringBuilder` 与集合 → 消除闭包与装箱 → 对象池替代 `Instantiate` / `Destroy` → 用 `Span<T>` 处理解析与切片 → 最后才考虑 `GCMode.Disabled` 这类激进手段。
:::

## IL2CPP 与代码剥离

发布版通常用 **IL2CPP** 把 IL 转成 C++,性能更好、更难反编译,但它是 **AOT**(提前编译),与运行时 JIT 有本质区别:

- **部分反射受限**:依赖运行时反射发现类型 / 调方法的代码可能被剥离掉,表现为真机上莫名其妙地失败(编辑器里正常)。
- **泛型实例化**:值类型泛型组合需要在编译期确定,某些完全靠反射构造的泛型实例可能不被生成。
- **托管代码剥离**:未从代码路径静态引用的类型 / 方法会被移除以减小包体。

用 **`link.xml`** 显式保留不能被剥离的内容:

```xml
<linker>
  <assembly fullname="MyGame.Core">
    <type fullname="MyGame.Core.SaveData" preserve="all" />
  </assembly>
</linker>
```

## 常见性能陷阱清单

| 陷阱 | 正确做法 |
| --- | --- |
| `Update()` 里 `"HP: " + hp` 或字符串插值 | 缓存 `StringBuilder`,`Clear()` 后复用;仅在值变化时刷新 UI |
| 每帧 LINQ(`Where` / `Select` / `ToList`) | 改 `for` / `foreach`;确需 LINQ 时用 `static` lambda |
| 每帧 `GetComponent<T>()` | `Awake` 缓存引用,或 `TryGetComponent<T>(out var c)` |
| 每帧访问 `Camera.main` | `Awake` 缓存到字段(内部是 `FindGameObjectsWithTag`) |
| `gameObject.tag == "Player"` | `gameObject.CompareTag("Player")` |
| `foreach` 遍历值类型集合走接口造成装箱 | 用 `List<T>` 泛型枚举器;热路径用 `for` |
| 每帧 `new List<T>()` / `ToArray()` / `ToArray` 物化 LINQ | 复用字段级集合,`Clear()` 而非 `new`;预设 `Capacity` |
| lambda 捕获局部变量或 `this` 产生闭包 | 改 `static` lambda,或把状态放进结构体 / 字段 |
| 每帧 `Instantiate` / `Destroy` 子弹、特效 | 用 `UnityEngine.Pool.ObjectPool<T>` 池化 |
| `SendMessage` / `BroadcastMessage` | 用接口、事件或直接引用调用(名字查找 + 反射开销) |
| `GameObject.Find` / `FindWithTag` 在运行期反复调用 | 初始化时查找并缓存,或通过引用 / 单例传递 |
| 把 struct 丢进 `object`、`ArrayList`、非泛型接口 | 用泛型容器;实现 `IEquatable<T>` + `GetHashCode` |
| 每帧 `Resources.Load` | 预加载并缓存,或用 Addressables 异步加载 |
| 协程里每次 `new WaitForSeconds(t)` | 缓存 `WaitForSeconds` / `WaitForEndOfFrame` 实例并复用 |
| `Physics.Raycast` / `OverlapSphere` 每帧调用 | 用 `RaycastNonAlloc` / `OverlapSphereNonAlloc` + 预分配缓冲 |
| 每帧 `.ToString()` 刷新数字文本 | 只在数值变化时刷新;用缓存字符串或 `StringBuilder` |
| 为"保险"给每个类加终结器 | 只有直接持有非托管资源时才加;优先用 `SafeHandle` |
| 热路径里频繁 `foreach` 数组 + 闭包捕获 | 用 `for`,把状态放进结构体参数 |
| 频繁手动 `GC.Collect()` | 找到每帧分配源头;只在加载 / 切场景空档调用 |
| 无 Profiler 数据凭感觉优化 | 用 Profiler 的 GC Alloc 列 + `ProfilerMarker` 定位 |
