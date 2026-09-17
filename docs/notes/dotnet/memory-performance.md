# 9. 内存、GC 与性能

C# 把内存管理交给运行时,但不意味着可以无视内存。GC 停顿、大对象堆碎片、装箱分配、未释放的非托管句柄,都会以"诡异的延迟抖动"和"内存缓慢增长"的形式出现在生产环境。这一章从内存布局讲到 GC、资源释放、`Span<T>` 与池化,最后落到度量工具和优化方法论。

## 内存基础

### 进程内存布局

```text
+----------------------------------------------+
| 代码段 / 只读数据                             |
+----------------------------------------------+
| 线程栈(每线程一个,默认约 1MB 预留)          |
+----------------------------------------------+
| 托管堆 Gen0 | Gen1 | Gen2(小对象分代)       |
+----------------------------------------------+
| 大对象堆 LOH(>= 85000 字节)                  |
+----------------------------------------------+
| 非托管堆(malloc / VirtualAlloc / P/Invoke)   |
+----------------------------------------------+
| JIT 代码、运行时结构、GC 自身数据             |
+----------------------------------------------+
```

托管堆由 GC 管理,非托管堆由你或你调用的原生库管理,后者是内存泄漏的常见来源。

### 栈帧、局部变量与参数

每次方法调用在线程栈上压入栈帧,存放参数(部分在寄存器)、局部变量、返回地址、保存的寄存器。栈是 LIFO 的,方法返回时整个栈帧一次弹出,所以栈上的数据**不需要 GC**,分配就是移动栈指针。

限制也很明显:

- 容量小(默认约 1MB),深递归或大 `stackalloc` 会 `StackOverflowException`,该异常**无法捕获**,进程直接终止。
- 生命周期与调用栈绑定,不能跨方法返回存活。

```csharp
void Foo()
{
    int x = 42;                              // 栈上
    Span<byte> buf = stackalloc byte[256];   // 栈上,零 GC 压力
    var p = new Point(1, 2);                 // struct 且未逃逸时通常也在栈上
}
```

### 托管堆上的对象布局

```text
+-----------------------------+  ← 对象起始地址
| 对象头 Object Header (8B)   |  同步块索引、锁信息、GC 标记位
+-----------------------------+
| 方法表指针 MethodTable (8B) |  → 类型元数据,虚分派靠它
+-----------------------------+
| 字段 1 / 字段 2 / ...       |
+-----------------------------+
| 填充到 8 字节对齐           |
+-----------------------------+
```

- `object` 引用指向方法表指针所在的位置(不是对象头)。
- 引用类型实例最小 24 字节(头部 16 + 字段或对齐)。
- 字段按大小与对齐要求排列以减少填充。

### 澄清"值类型一定在栈上"

准确表述是:**值类型在其声明位置存储**。以下情况它实际在堆上:

```csharp
class Holder { public Point P; }     // 1. 类字段 → 随对象在堆上
Point[] array = new Point[10];       // 2. 数组元素 → 堆上
object boxed = new Point(1, 2);      // 3. 装箱 → 堆上
Func<int> f = () => { var p = new Point(1, 2); return p.X; };  // 4. 闭包捕获 → 提升到堆
```

跨 `await` 存活的局部值类型也会被提升到状态机。反之,引用类型在逃逸分析后也可能栈分配,但那是 JIT 的优化,不能依赖。**"在栈上"的真正含义是生命周期严格嵌套于调用栈**,这才是性能优势的来源。

## 垃圾回收

### 基本原理

.NET 的 GC 是**追踪式**的,不是引用计数:

1. **标记**:从根(栈上引用、静态字段、GC 句柄、寄存器)出发递归遍历可达对象。
2. **清除 / 压缩**:回收不可达对象;压缩阶段把存活对象向一端移动,消除空洞。

压缩让分配变成一次指针加法,极快,但对象地址会变化,所以需要更新所有引用,且"钉住"(pinned)的对象无法移动。

### 分代回收

GC 基于**弱分代假说**把堆分成三代:

```text
分配 → Gen0 ──存活──→ Gen1 ──存活──→ Gen2
        ↑回收快        ↑回收中         ↑回收慢
        频繁           较频繁          很少
```

- **Gen0**:新对象都放这里,体积最小,回收最频繁最快。
- **Gen1**:Gen0 存活对象的晋升目标,作为缓冲。
- **Gen2**:长期存活对象,回收要遍历整个堆,成本最高。

意义在于:每次 Gen0 回收只扫描很小区域,绝大多数临时对象(临时字符串、闭包、LINQ 中间结果)在那里就死掉,不必付 Gen2 全堆扫描的代价。

```csharp
Console.WriteLine(GC.CollectionCount(0));   // Gen0 回收次数
Console.WriteLine(GC.CollectionCount(2));   // Gen2 回收次数
```

### 大对象堆(LOH)

**大于等于 85000 字节**的对象直接进 LOH:

- 大对象复制成本高,放进分代压缩堆会拖慢 GC,所以单独放。
- .NET Core 2.1 起 LOH 只在第 2 代回收时收集。
- **默认不压缩 LOH**,反复分配不同大小的数组会造成碎片,可能"还有大量空闲内存却 OutOfMemoryException"。

```csharp
GCSettings.LargeObjectHeapCompactionMode = GCLargeObjectHeapCompactionMode.CompactOnce;
GC.Collect();   // 下一次 GC 会压缩 LOH(代价高,谨慎)
```

`byte[85000]` 会进 LOH,`byte[84999]` 不会。缓冲区设计要留意这个临界值。

### 终结器与终结器队列

`~ClassName()` 用于释放**非托管**资源,执行模型很特殊:

- 有终结器的对象死亡时进入**终结器队列**,由专门的终结器线程执行 `Finalize`;
- 要等**下一次 GC** 才回收内存,即有终结器的对象至少需要两次 GC;
- 终结器线程串行执行,大量终结器会造成堆积;
- 对象可能在终结器里"复活"(把 `this` 存到静态字段)。

因此实现终结器的类型通常提供 `Dispose`,并在其中调用 `GC.SuppressFinalize(this)` 把对象移出终结器队列。

::: warning
终结器里绝不能抛异常:异常会终止终结器线程,在 .NET Core 之后这会导致**整个进程崩溃**。也不能访问其他托管对象(它们可能已被回收),只能碰 `SafeHandle` 这类自身有保障的类型。
:::

### GC 模式

| 模式 | 说明 | 适用 |
| --- | --- | --- |
| 工作站 GC | 每核心一个堆,单线程回收(可后台并发) | 客户端,关注延迟 |
| 服务器 GC | 每逻辑核心一个独立堆,多线程并行回收 | 服务端,关注吞吐 |
| 后台 GC | Gen2 回收在后台线程进行,减少暂停 | 多数配置默认开启 |

```xml
<PropertyGroup>
  <ServerGarbageCollection>true</ServerGarbageCollection>
  <ConcurrentGarbageCollection>true</ConcurrentGarbageCollection>
</PropertyGroup>
```

```bash
DOTNET_gcServer=1
DOTNET_GCHeapCount=4          # 限制服务器 GC 的堆数量,容器里很重要
DOTNET_GCLOHThreshold=16384   # 调低 LOH 阈值,谨慎使用
```

服务器 GC 吞吐更高,但每堆都有独立段和 GC 线程,内存占用明显更大。

### 为什么不要手动 GC.Collect

它会触发一次完整(通常阻塞)回收,并且:

- 破坏分代假设,把短命对象直接推到 Gen2,之后回收代价剧增;
- 打乱 GC 的自我调节;
- 造成明显暂停。

只有极端场景才考虑:基准测定的精确基线、LOH 明确碎片化后的整理、内存敏感窗口结束后的主动释放。生产代码里的 `GC.Collect()` 通常意味着别处有问题。

### 延迟模式与无 GC 区域

```csharp
GCSettings.LatencyMode = GCLatencyMode.LowLatency;   // 尽量少做 Gen2 回收
// ... 低延迟敏感的短暂窗口 ...
GCSettings.LatencyMode = GCLatencyMode.Interactive;  // 恢复

if (GC.TryStartNoGCRegion(16 * 1024 * 1024))
{
    try { /* 期间不产生 GC 暂停 */ }
    finally { GC.EndNoGCRegion(); }
}
```

这些是高吞吐 / 实时场景的专门工具,普通应用不需要。

### 观测分配

```csharp
long before = GC.GetAllocatedBytesForCurrentThread();
var list = Enumerable.Range(0, 1000).Select(i => i.ToString()).ToList();
long after = GC.GetAllocatedBytesForCurrentThread();
Console.WriteLine($"本次分配 {after - before} 字节");
```

`GetAllocatedBytesForCurrentThread()` 是**当前线程**的累计分配量,基准测试里很好用;正式测量请用 BenchmarkDotNet。

## 资源管理

### 托管资源 vs 非托管资源

- **托管资源**:由 GC 管理内存的对象(`List<T>`、`string`、`byte[]`)。GC 会回收内存,**但不会执行清理逻辑**——对象持有文件句柄时,回收内存不代表句柄被关闭。
- **非托管资源**:文件句柄、socket、数据库连接、GDI 句柄、`malloc` 内存、原生库句柄,必须显式释放。

`IDisposable` 的意义就是给"清理逻辑"一个确定的调用时机。

### 完整的 Dispose 模式

```csharp
public class ResourceHolder : IDisposable
{
    private IntPtr _nativeHandle;           // 非托管资源
    private FileStream? _stream;            // 托管资源(自身也是 IDisposable)
    private bool _disposed;

    public ResourceHolder()
    {
        _nativeHandle = NativeMethods.Create();
        _stream = new FileStream("data.bin", FileMode.Open);
    }

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
- **终结器**只是用户忘记 `Dispose` 时的安全网,代价是两次 GC。

**`sealed` 类可以简化**:没有派生类就不需要 `protected virtual` 扩展点和 `disposing` 区分;没有终结器就不需要 `GC.SuppressFinalize`。

```csharp
public sealed class FastResource : IDisposable
{
    private IntPtr _handle;

    public void Dispose()
    {
        if (_handle != IntPtr.Zero)
        {
            NativeMethods.Destroy(_handle);
            _handle = IntPtr.Zero;
        }
    }
}
```

::: tip
多数业务类型不需要完整模式:只持有托管资源时,让 GC 管内存、把非托管资源封装进 `SafeHandle`,然后逐个 `Dispose` 托管字段即可,连终结器都不必写。
:::

### using 语句与 using 声明

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

类型同时实现 `IDisposable` 和 `IAsyncDisposable` 时,`await using` 优先走异步路径。async 方法里遇到异步资源就用 `await using`,同步 `Dispose` 可能阻塞线程。

### 为什么 SafeHandle 更安全

手写终结器容易出问题:可能访问已被卸载的对象、句柄为 0 时误释放、忘记标记状态。`SafeHandle` 由运行时保证引用计数(防止句柄在 P/Invoke 调用中被提前释放)、终结器恰好在正确时机执行一次,并提供 `DangerousAddRef` / `DangerousRelease` 处理临界区。

```csharp
internal sealed class SafeFileHandleNative : SafeHandleZeroOrMinusOneIsInvalid
{
    public SafeFileHandleNative() : base(ownsHandle: true) { }
    protected override bool ReleaseHandle() => NativeMethods.Close(_handle) != 0;
}
```

P/Invoke 声明用 `SafeHandle` 而不是 `IntPtr`,运行时就能正确钉住对象并处理 GC 竞争。

### 什么时候需要终结器

很少。只在类型**直接**持有无法用 `SafeHandle` 封装的原生资源(原始 `IntPtr`、`AllocHGlobal` 内存)、且资源贯穿整个生命周期时。非托管资源已被 `SafeHandle` 包好就不需要终结器。不要为了"保险"给每个类加终结器。

### 常见必须释放的资源

| 资源 | 是否必须显式释放 |
| --- | --- |
| `FileStream` / `StreamReader` | 是,否则句柄泄漏或缓冲数据丢失 |
| `Socket` / `TcpClient` | 是 |
| `DbConnection` | 是,连接池需要归还,否则池会耗尽 |
| `DbDataReader` / `Timer` | 是 |
| `CancellationTokenRegistration` | 是,`Register` 的返回值 |
| `HttpClient` | **不是**,应长期复用 |

::: warning
`using var client = new HttpClient();` 每个请求都 new 会耗尽 socket(`TIME_WAIT` 堆积),底层连接无法复用。正确做法是注册为单例 / 用 `IHttpClientFactory`,或在长生命周期类里 `private static readonly HttpClient`。.NET Core 之后 `SocketsHttpHandler` 自带连接池和 DNS 刷新,单例不会永远持有过期 DNS。
:::

## unsafe 与非托管互操作(简介)

```xml
<AllowUnsafeBlocks>true</AllowUnsafeBlocks>
```

```csharp
unsafe void Copy(byte* dest, byte* src, int length)
{
    for (int i = 0; i < length; i++) dest[i] = src[i];
}

unsafe void UseString(string s)
{
    fixed (char* p = s)                // 钉住,阻止 GC 移动
    {
        Console.WriteLine((int)p[0]);
    }                                   // 出块解除钉住
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

传统 P/Invoke 用 `[DllImport]`;.NET 7+ 推荐源生成器 `[LibraryImport]`,编译期生成封送代码,无运行时动态封送开销且对 Native AOT 友好:

```csharp
internal static partial class NativeMethods
{
    [LibraryImport("user32.dll", StringMarshalling = StringMarshalling.Utf16, SetLastError = true)]
    internal static partial int MessageBoxW(IntPtr hWnd, string text, string caption, uint type);
}
```

方法必须是 `partial`。`GCHandle` 用于让非托管代码持有托管对象引用:

```csharp
GCHandle handle = GCHandle.Alloc(data, GCHandleType.Pinned);
try { IntPtr ptr = handle.AddrOfPinnedObject(); /* 传给原生代码 */ }
finally { handle.Free(); }   // 不释放既泄漏句柄又永远钉住对象
```

长时间钉住会阻止 GC 压缩、加剧碎片,应尽量缩短钉住时间。

## Span 与 ref 系列

### `Span<T>` 与 `ReadOnlySpan<T>`

`Span<T>` 是"一段连续内存的视图",本质是 `(ref T, int length)`,可指向栈、数组、非托管内存或字符串,本身**不拥有**内存。

```csharp
int[] array = { 1, 2, 3, 4, 5 };
Span<int> span = array.AsSpan();

Span<int> slice = span.Slice(1, 3);   // { 2, 3, 4 },零分配
slice[0] = 99;
Console.WriteLine(array[1]);          // 输出: 99
```

它解决的问题:传统 `array.Skip(1).Take(3).ToArray()` 或 `Substring` 做切片会**复制**。`Span<T>` 只记录偏移和长度,零分配,在解析、协议处理、字符串处理等热路径上收益巨大。

### 为什么是 ref struct

`Span<T>` 声明为 `ref struct`,带来一系列强制限制:

- **只能在栈上**:不能做类字段、不能装箱、不能当 `object`;
- **不能作为泛型类型参数**(C# 13 前),`allows ref struct` 反约束可放宽;
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
Console.WriteLine(trimmed.ToString());               // 输出: hello, world

bool hasWorld = trimmed.Contains("world", StringComparison.OrdinalIgnoreCase);
int value = int.Parse("12345".AsSpan());              // 直接在 span 上解析

Span<char> result = stackalloc char[32];
trimmed.CopyTo(result);
```

`MemoryExtensions` 提供了在 span 上工作的扩展方法:`Trim`、`TrimStart`、`TrimEnd`、`StartsWith`、`EndsWith`、`Contains`、`IndexOf`、`Split`、`SequenceEqual`、`ToUpperInvariant` 等,它们不分配新字符串。

::: tip
判断字符串是否等于某个字面量时,`span.SequenceEqual("GET")` 或 `span == "GET"`(C# 11 起 `ReadOnlySpan<char>` 有 `==`)通常是零分配的,热路径上优先用 span 版本。
:::

### `Memory<T>` 与 `ReadOnlyMemory<T>`

`Memory<T>` 是 `Span<T>` 的"可上堆"版本:可以是类字段、可以跨 `await`、可以配合 `Task<T>`,用 `.Span` 拿到实际视图。

```csharp
async Task ReadAsync(Memory<byte> buffer)
{
    int read = await stream.ReadAsync(buffer);
    Process(buffer.Span.Slice(0, read));
}
```

它比 `Span<T>` 稍重(需要引用可能被池化的底层对象),所以能用 `Span<T>` 就用 `Span<T>`,只有需要字段或跨 `await` 时才退到 `Memory<T>`。

### 与数组、字符串互转

```csharp
int[] arr = { 1, 2, 3 };
Span<int> s = arr.AsSpan();
int[] back = s.ToArray();            // 会分配新数组

ReadOnlySpan<char> chars = "abc".AsSpan();
string str = chars.ToString();       // 会分配新字符串
```

高性能构造字符串用 `string.Create`:

```csharp
string result = string.Create(3, (byte)'a', static (span, state) =>
{
    span[0] = (char)state;
    span[1] = (char)(state + 1);
    span[2] = (char)(state + 2);
});
Console.WriteLine(result);    // 输出: abc
```

它直接在最终字符串内存上写,避免"先拼临时字符串再复制"的中间分配。

### ref / out / in 参数

```csharp
void Double(ref int x) => x *= 2;                     // 可读可写,调用方须初始化
bool TryParse(string s, out int value) { value = 0; return false; }  // 方法内必须赋值
void Print(in BigStruct s) => Console.WriteLine(s.X); // 只读引用

struct BigStruct { public long A, B, C, D, E, F, G, H; }
void ByValue(BigStruct s) { }   // 复制约 64 字节
void ByIn(in BigStruct s) { }   // 只传 8 字节引用
```

`in` 配合 `readonly struct` 效果最好——后者保证方法不修改字段,`in` 参数就不必为防御性拷贝而隐藏复制。

```csharp
public readonly struct Vector3
{
    public readonly double X, Y, Z;
    public Vector3(double x, double y, double z) => (X, Y, Z) = (x, y, z);
}

public static double Length(in Vector3 v) =>
    Math.Sqrt(v.X * v.X + v.Y * v.Y + v.Z * v.Z);
```

::: warning
`in` 只在结构体较大时才值得用。对 `int` 这类小类型,它增加间接寻址,可能更慢。经验阈值是超过 16~24 字节再考虑。
:::

### ref return 与 ref local

```csharp
public class Buffer
{
    private int[] _data = new int[10];
    public ref int At(int index) => ref _data[index];
}

var buffer = new Buffer();
ref int slot = ref buffer.At(3);
slot = 42;
Console.WriteLine(buffer.At(3));   // 输出: 42
```

`ref local` 保存引用,后续读写直接作用在原始位置,没有拷贝。`Span<T>` 的索引器本质就返回 `ref T`,所以 `span[0] = x` 能直接改到底层内存。

### [UnscopedRef] 简介

正常情况下,`ref struct` 的引用成员受"作用域"检查约束,方法不能返回可能指向更短生命周期的引用。`[UnscopedRef]`(C# 11)可放宽这个约束,是给 `ref struct` 库作者用的高级工具,普通业务代码很少需要。

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

### ObjectPool`<T>`

```csharp
var pool = new DefaultObjectPoolProvider()
    .Create(new StringBuilderPooledObjectPolicy());

var sb = pool.Get();
try { sb.Append("hello"); Console.WriteLine(sb.ToString()); }
finally { pool.Return(sb); }   // policy 负责 Reset
```

### StringBuilder vs ValueStringBuilder

普通拼接用 `StringBuilder`。.NET 8+ 的 `System.Text.ValueStringBuilder` 是 `ref struct`,优先使用栈上的 `stackalloc` 缓冲,适合"构造一小段字符串后立刻 `ToString` 或写入另一个 span"的场景,零堆分配。它不能跨 `await`、不能作为字段。

### 避免装箱

```csharp
ArrayList list = new();
list.Add(42);                       // 坏:装箱

int x = 42;
IComparable c = x;                  // 坏:接口是引用类型,装箱

List<int> numbers = new();
numbers.Add(42);                    // 好:泛型无装箱

if (EqualityComparer<int>.Default.Equals(a, b)) { }   // 好:无装箱比较
```

`EqualityComparer<T>.Default` 在 `T` 实现 `IEquatable<T>` 时走无装箱的强类型比较,否则退化为 `Object.Equals`。自定义 struct 想高效比较就实现 `IEquatable<T>` 并重写 `GetHashCode`。

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

C# 9+ 的 `static` lambda 会在编译期检查是否捕获环境,捕获了直接报错,是防止意外分配的有效手段。

### 字符串处理

```csharp
string r1 = "";
foreach (var item in items) r1 += item;          // 坏:O(n^2) 且大量分配

var sb = new StringBuilder();
foreach (var item in items) sb.Append(item);     // 好:StringBuilder
string r2 = sb.ToString();

string csv = string.Join(",", items);            // 好:已知分隔符
string full = string.Concat(a.AsSpan(), b.AsSpan(), c.AsSpan());  // 好:span 重载
```

`string.Format` / 插值走格式化路径,有装箱和 `StringBuilder` 分配成本;`string.Concat` 直接分配一次目标大小的字符串,是最快的拼接方式。

### 结构体 vs 类的性能权衡

| 维度 | struct | class |
| --- | --- | --- |
| 分配 | 通常在栈上 / 内联,无 GC 压力 | 堆分配,GC 压力 |
| 复制 | 按值复制(大结构体代价高) | 复制引用(8 字节) |
| 继承 / 多态 | 不支持,需装箱 | 原生支持 |
| 默认比较 | `ValueType.Equals` 反射比较,慢 | `ReferenceEquals`,快 |
| 适用 | 小、不可变、生命周期短、值语义 | 大、需继承 / 引用语义 |

经验法则:结构体控制在 16~24 字节以内,且要**不可变**;超过这个尺寸又频繁传递,维护成本会超过性能收益。

## 度量与诊断

### 为什么不要用 Stopwatch 做基准

- **JIT 编译**:首次调用是解释或快速编译的,耗时不代表稳态。
- **预热**:类型初始化、方法内联、去虚拟化需要多次调用才稳定。
- **GC 干扰**:一次 GC 停顿就能让某次测量大幅偏斜。
- **死代码消除**:JIT 可能把"无可观察副作用"的计算完全删掉,你测的是空操作。
- **测量开销**:`Stopwatch` 与 `DateTime.Now` 的成本可能与被测代码同量级。

### BenchmarkDotNet 最小示例

```csharp
[MemoryDiagnoser]
public class StringBenchmarks
{
    private readonly int[] _data = Enumerable.Range(0, 100).ToArray();

    [Benchmark(Baseline = true)]
    public string ConcatLoop()
    {
        string s = "";
        foreach (int i in _data) s += i;
        return s;
    }

    [Benchmark]
    public string StringBuilder()
    {
        var sb = new StringBuilder();
        foreach (int i in _data) sb.Append(i);
        return sb.ToString();
    }
}

public static class Program
{
    public static void Main() => BenchmarkRunner.Run<StringBenchmarks>();
}
```

```xml
<PackageReference Include="BenchmarkDotNet" Version="0.14.0" />
```

```bash
dotnet run -c Release
```

它会在独立子进程中运行,自动预热并多次迭代,报告均值、误差、标准差;`[MemoryDiagnoser]` 报告每次操作的分配字节数与 GC 次数。

```console
| Method        | Mean       | Ratio | Gen0   | Allocated |
|-------------- |-----------:|------:|-------:|----------:|
| ConcatLoop    | 12.345 us  |  1.00 | 9.5672 |  78.13 KB |
| StringBuilder |  2.345 us  |  0.19 | 1.6785 |  13.65 KB |
```

这份输出比任何单次 `Stopwatch` 数字都可信,还顺带暴露了"循环拼接分配 78KB"这个关键信息。

### 诊断工具概览

| 工具 | 用途 |
| --- | --- |
| `dotnet-counters` | 实时查看 GC、线程池、异常等计数器 |
| `dotnet-trace` | 采集 CPU / 事件追踪,离线分析 |
| `dotnet-dump` | 抓取和分析进程转储 |
| `dotnet-gcdump` | 专门的 GC 堆快照,轻量,可看对象存活图 |
| `dotnet-stack` | 快速 dump 所有线程的托管调用栈 |
| PerfView | Windows 上最全的分析器,基于 ETW |
| Visual Studio 诊断工具 | 内存快照对比、CPU 采样、分配跟踪 |
| JetBrains dotMemory / dotTrace | 商业工具,内存 / CPU 分析 |
| `dotnet-monitor` | 容器 / 生产环境的诊断 sidecar |

### 用 dotnet-counters 观察 GC 与分配

```bash
dotnet tool install --global dotnet-counters
dotnet-counters monitor --process-id 12345 --counters System.Runtime
```

关注这些计数器:

- `gc-heap-size`:托管堆大小
- `gen-0-gc-count` / `gen-2-gc-count`:Gen2 频繁增长说明长期存活对象在堆积
- `alloc-rate`:分配速率,持续高企说明短命对象太多
- `time-in-gc`:GC 时间占比,超过 10% 通常值得优化
- `loh-size` / `poh-size`:大对象堆 / 固定对象堆大小

```bash
dotnet-trace collect --process-id 12345 --duration 00:00:30
```

### 优化方法论

1. **先测量再优化**,没有 profile 数据就没有方向,人的直觉在性能问题上错得离谱。
2. **建立可重复的基准**,用 BenchmarkDotNet 或真实压测,固定硬件和负载。
3. **找到真正的瓶颈**:CPU、GC、锁竞争、I/O 等待,不同瓶颈解法完全不同。
4. **一次改一个变量**并重新测量,确认收益是否超出误差范围。
5. **不要过早优化**,清晰可维护的代码优先,只有数据证明是热点才动手。
6. **关注分配而非只有速度**,减少分配往往同时改善 GC 停顿和吞吐。

::: tip
常见的优化顺序(从小到大):消除热路径上的装箱和闭包 → 用 `Span<T>` 替代数组切片 → 用池化替代频繁大分配 → 用异步替代阻塞 → 最后才考虑 Native AOT 之类的重手段。
:::

## 发布与启动优化

```bash
dotnet publish -c Release                                   # 框架依赖,体积最小
dotnet publish -c Release -r linux-x64 --self-contained    # 自包含
dotnet publish -c Release -r linux-x64 --self-contained -p:PublishSingleFile=true
dotnet publish -c Release -r linux-x64 --self-contained -p:PublishTrimmed=true
dotnet publish -c Release -r linux-x64 -p:PublishReadyToRun=true
dotnet publish -c Release -r linux-x64 -p:PublishAot=true
```

| 选项 | 体积 | 启动速度 | 限制 |
| --- | --- | --- | --- |
| 框架依赖 | 最小 | 一般 | 目标机需装运行时 |
| 自包含 / 单文件 | 大 | 一般 | 无 |
| 裁剪 | 小 | 一般 | 反射、动态加载受限 |
| ReadyToRun | 较大 | 快 | 无重大限制 |
| Native AOT | 小 | 最快 | 反射 / 动态代码不可用 |

**ReadyToRun(R2R)**:发布时把 IL 预编译为原生代码,启动时省去部分 JIT,仍保留 IL,必要时可重新 JIT,几乎不影响功能。

**Native AOT**:编译期完全确定所有代码,产出原生可执行文件,启动毫秒级、内存小。限制必须提前评估:

- **反射受限**,依赖运行时反射的类型发现 / 方法调用需要源生成器替代(很多序列化器、DI 容器、ORM);
- **动态代码不可用**:`Reflection.Emit`、`Expression.Compile`、`Assembly.Load`;
- 部分库不兼容,交叉编译支持有限。

::: warning
迁移到 Native AOT 前先用 `PublishAot` 编译一次,看有哪些裁剪警告(IL2xxx / IL3xxx)。这些警告指向真正会在运行时炸掉的代码。
:::

### 容器化要点

- 多阶段构建:构建用 SDK 镜像,运行用 runtime / `runtime-deps` 镜像。
- 容器有内存上限时调低 `DOTNET_GCHeapCount`、调高 `DOTNET_GCConserveMemory`(0~9),避免 GC 按宿主机核心数开一堆堆而 OOM。
- 用 `dotnet-monitor` sidecar 在生产容器里抓诊断数据,不必进容器。
- `-alpine` / `-chiseled` 镜像体积更小,但注意 ICU / 时区数据差异;`InvariantGlobalization` 可进一步减体积,但会改变全球化行为。

## 常见性能陷阱清单

| 陷阱 | 正确做法 |
| --- | --- |
| 循环里用 `+=` 拼接字符串(O(n²) 且大量分配) | 用 `StringBuilder`,或 `string.Join` / `string.Concat` |
| 循环里 LINQ + 闭包,每次迭代分配迭代器和闭包 | 改 `for` / `foreach`;确需 LINQ 时用 `static` lambda |
| `+=` 订阅事件却从不取消订阅 | 用 `-=` 取消;或用弱事件模式,注意发布者持有订阅者导致泄漏 |
| 频繁分配超过 85000 字节的数组,造成 LOH 碎片 | 用 `ArrayPool<T>`,或减小缓冲区、拆分处理 |
| 无谓的 `ToList()` / `ToArray()`,只为遍历一次 | 保留 `IEnumerable` 延迟求值,确实需要物化时才转换 |
| 老代码里 `foreach` 遍历值类型集合产生装箱 | `List<T>` 枚举器已是 struct;避免用 `IEnumerable` 接口迭代 |
| 用异常做流程控制(如 `int.Parse` 抛异常) | 用 `TryParse`;异常构造昂贵且有 stack trace 开销 |
| `try/catch` 放在热路径里 | 移出循环;异常本身没成本,但 try 块会阻止某些优化 |
| `async void` 造成异常失控和无法测量 | 改为 `async Task`,事件处理器除外 |
| 热路径频繁用 `DateTime.Now`(带时区转换开销) | 用 `DateTime.UtcNow`,需要多次时缓存到局部变量 |
| 每次调用都重新编译 `Regex` | 用源生成器 `[GeneratedRegex]` 或 `RegexOptions.Compiled`,并缓存为静态字段 |
| 用 `string.ToLower()` 做大小写不敏感比较(还受 culture 影响) | 用 `string.Equals(a, b, StringComparison.OrdinalIgnoreCase)` |
| `list.Count() > 0`(对 `IEnumerable` 会遍历) | 用 `list.Count > 0`,或 `list.Any()` |
| `ConcurrentDictionary.GetOrAdd` 工厂有副作用且可能被调用多次 | 值用 `Lazy<T>`,工厂保持幂等无副作用 |
| `new HttpClient()` 后立刻 `Dispose`,耗尽 socket | 单例 / `IHttpClientFactory` 复用 |
| 用 `Task.Run` 包装同步 I/O(`File.ReadAllBytes`、`Thread.Sleep`) | 用原生异步 API(`ReadAllBytesAsync`、`Task.Delay`) |
| `Concat` / 插值在热路径产生中间字符串 | 用 `Span<char>` / `string.Create` / `string.Concat(span...)` |
| 值类型放进 `ArrayList`、`Hashtable` 或非泛型接口造成装箱 | 用 `List<T>`、`Dictionary<TKey,TValue>`,实现 `IEquatable<T>` |
| 大结构体按值传递,反复复制几十字节 | 用 `in` 参数 + `readonly struct` |
| 手动调用 `GC.Collect()` | 找到分配源头;仅在整理 LOH 等极端场景使用 |
| 持有 `CancellationTokenRegistration` / `Timer` 不释放 | 用 `using` 包住或显式 `Dispose` |
| 长时间钉住对象(忘记 `GCHandle.Free`) | 尽快释放,用 `fixed` 缩小作用域 |
| 为"保险"给每个类加终结器 | 只有直接持有非托管资源时才加;用 `SafeHandle` 通常更好 |
| 用 `Stopwatch` 单次测量下结论 | 用 BenchmarkDotNet,开 `[MemoryDiagnoser]` |
| 凭直觉优化而没有 profile 数据 | 先 `dotnet-counters` / `dotnet-trace` 定位瓶颈 |
