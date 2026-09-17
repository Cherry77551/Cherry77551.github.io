# 7. 异步编程与并发

C# 用 `async` / `await` 把异步编程的表达成本压得极低,但也正因为语法顺手,大量能跑却会死锁、会耗尽线程池、会吞掉异常的代码正流通在生产环境里。这一章从概念、语法、编译器实现讲到线程同步与并发集合,并说明它们在 Unity(C# 9 + Boehm GC)里的特殊约束。

## 概念辨析

### 同步、异步、并发、并行

| 术语 | 关注点 | 含义 |
| --- | --- | --- |
| 同步(Synchronous) | 调用方等待方式 | 调用发出后一直等到结果返回才继续 |
| 异步(Asynchronous) | 调用方等待方式 | 调用发出后立即返回,结果稍后通知 |
| 并发(Concurrency) | 任务是否重叠 | 多个任务在时间上重叠推进(可交替,也可同时) |
| 并行(Parallelism) | 是否同时执行 | 多个任务在同一时刻真的同时执行,需要多核 |

关键在于:**同步 / 异步描述"调用方如何等待",并发 / 并行描述"任务之间如何共处"**。两者可以任意组合:

```text
同步 + 串行 : 逐行顺序执行,每行都等结果            → 普通代码
异步 + 并发 : 同时发起 100 个 HTTP 请求,不阻塞线程  → Task.WhenAll
同步 + 并行 : Parallel.For,多核跑满但阻塞调用线程   → CPU 密集计算
异步 + 串行 : await 一个再 await 下一个             → 顺序依赖的流程
```

```text
单线程上的并发(异步),时间 →
任务 A: [发起 I/O]........[等待]........[处理结果]
任务 B: ....[发起 I/O]........[等待]........[处理结果]
         A 等待期间,B 占用同一个线程
```

- **并发**像"一个人一边烧水一边切菜",单核也能做。
- **并行**像"三个人各干一件事",必须有多个执行单元。

### I/O 密集与 CPU 密集

- **I/O 密集型**(网络、文件、数据库):大部分时间在等外部设备,CPU 空闲。手段是**异步**,让线程在等待期间服务别的任务。
- **CPU 密集型**(图像、加密、大对象序列化):瓶颈是算力。手段是**并行**,把工作分到多个核心。

::: warning
最常见的错误是给 I/O 操作用 `Task.Run` 包一层。它只是换个线程去**阻塞**,网络请求该等多久还是等多久,唯一收获是多占用一个线程池线程,属于用并行手段解决并发问题。
:::

### 线程与线程池

.NET 的 `Thread` 对应操作系统线程,创建一次涉及内核分配栈(默认约 1MB 虚拟内存)、注册调度器,开销在毫秒级。CLR 用**线程池**摊销这个成本:池中维持一批工作线程,提交任务时从队列取任务交给空闲线程。

线程池不是"要多少给多少":

- 队列积压且线程都在忙时,它以**每秒约 1~2 个的速率**逐步注入新线程,避免突发工作撑爆资源;
- 池线程都是后台线程,不阻止进程退出。

**线程池饥饿**由此产生:所有线程都被长阻塞(如同步等待一个需要线程池线程才能完成的任务)时,新任务只能排队,而注入速度很慢,吞吐量暴跌甚至卡死。经典死锁就是饥饿的极端形态。

::: tip
`ThreadPool.SetMinThreads` 能提高最小线程数、缓解启动阶段饥饿,但治标不治本,还会增加内存与上下文切换开销。真正的修复是把阻塞调用改成异步。
:::

### 为什么"异步不等于多线程"

`async` / `await` 本身**不创建任何线程**。`await` 一个未完成的 I/O 任务时:

1. 把当前状态存进编译器生成的状态机;
2. 立刻把控制权**返回给调用者**,`await` 之后的代码尚未执行;
3. I/O 完成时由操作系统完成通知(IOCP / epoll)触发,调度器把续体交给**某个**可用线程继续跑。

所以异步是"不占线程等待"的模型,底层是操作系统的异步 I/O 能力。真正产生线程的是你显式调用 `Task.Run` 或 `Parallel` 的时候。

## async/await 基础

### Task 与 Task`<T>`

`Task` 表示"将来会有结果的异步操作",`Task<T>` 额外携带 `T` 类型的结果。它与 JavaScript 的 Promise 同样是"未来值"的抽象,区别在于:Promise 由事件循环驱动、天然单线程;`Task` 由线程池 / 调度器驱动,本质是并发的,并且三态(结果 / 异常 / 取消)都可同步查询。

```csharp
public async Task<string> DownloadAsync(string url)
{
    using var client = new HttpClient();
    string content = await client.GetStringAsync(url);
    return content.ToUpperInvariant();
}
```

### 语法与命名约定

- 方法签名加 `async` 修饰符,返回类型通常是 `Task` / `Task<T>`,少数是 `ValueTask`、`IAsyncEnumerable<T>`,以及仅事件处理器可用的 `void`。
- 方法名以 `Async` 结尾,这是 BCL 的统一约定。
- `async` 只是提示编译器"这里可能有 `await`,请生成状态机",它本身不改变运行时行为。

### await 的真实语义

`await` 的语义等价于:

```text
1. 拿到 awaiter(Task 或自定义对象)
2. 若 IsCompleted == true:同步取结果并继续,不返回、不切线程
3. 否则:把续体注册到任务上,立刻 return 给调用者
        任务完成后由调度器继续执行剩余部分
4. 任务失败:在 await 处抛出原异常
5. 任务取消:在 await 处抛 OperationCanceledException
```

两条重要推论:

- **`async` 方法在执行到第一个真正需要等待的 `await` 之前是同步的**,运行在调用者线程上。
- **被 await 的任务若已完成,`await` 不切换线程也不分配续体**,直接同步往下走(如 `await Task.CompletedTask`)。这是所有异步性能优化的基础。

### 编译器生成的状态机

`async` 方法不是运行时魔法,而是被编译器改写成实现了 `IAsyncStateMachine` 的**结构体**:

- `int state` 字段:记录执行到哪一步(`-1` 未启动 / 已完成,`-2` 异常);
- 跨 `await` 存活的局部变量与 `this` 被提升为字段;
- 一个 `AsyncTaskMethodBuilder`(泛型版本 `AsyncTaskMethodBuilder<T>`、`AsyncValueTaskMethodBuilder` 等),负责创建 `Task`、启动状态机、写入结果或异常;
- 原方法体被拆成若干段,由 `MoveNext()` 按 `state` 分发。

以 `async Task<int> AddAsync(int a, int b) { await Task.Delay(1); return a + b; }` 为例,编译器生成的 `MoveNext()` 大致做这几件事:首次进入时调用 `Task.Delay(1).GetAwaiter()`,如果 `IsCompleted` 为 `false` 就把 `state` 置为 `0`、保存 awaiter、通过 `builder.AwaitUnsafeOnCompleted` 注册续体后 `return`;任务完成后由调度器再次调用 `MoveNext()`,从 `state == 0` 分支取出 awaiter、`GetResult()`、执行 `return a + b`、调用 `builder.SetResult`。整个方法体被包在 `try` 里,`catch` 则调用 `builder.SetException`。

由此可得:

1. 调用 `AddAsync(1, 2)` 实际是**同步执行** `MoveNext()` 直到第一个未完成的 `await` 才返回——"async 方法第一次执行是同步的"。
2. 只有真的挂起,局部变量才被提升到堆上的状态机对象,产生一次分配;全部 `await` 同步完成时状态机留在栈上,零堆分配。
3. `await` 之后的代码都在 `try` 里,这就是异常会被写进 `Task.Exception` 的原因。

### return 与异常的流转

- `return value` 不是真正返回,而是调用 `builder.SetResult(value)` 写入结果并把任务置为完成。
- `throw` 被状态机的 `catch` 捕获后调用 `builder.SetException(ex)`,任务变为 faulted。异常**不会同步抛给调用者**,而是保存在任务里等 `await` 时重新抛出。例如 `async Task ThrowAsync() => throw new InvalidOperationException("boom");` 调用后立即返回一个 faulted 的 `Task`,只有 `await` 它时才抛出。

## 返回类型选择

| 返回类型 | 适用场景 | 注意 |
| --- | --- | --- |
| `Task` / `Task<T>` | 通用异步操作 | 默认选择 |
| `void` | **仅限事件处理器** | 不可 await,异常直抛上下文 |
| `ValueTask` / `ValueTask<T>` | 高频且经常同步完成的热路径 | 只能 await 一次 |
| `IAsyncEnumerable<T>` | 异步流式产出多条数据 | 用 `await foreach` 消费 |

### ValueTask

`Task` 是引用类型,每次返回都要堆分配。对"经常同步完成"的方法(读缓存、读已缓冲的流),这个分配是纯浪费。`ValueTask` 是结构体,可包装已完成结果(零分配)、池化的 `IValueTaskSource<T>`,或退化为普通 `Task`。典型写法是命中缓存时直接 `new ValueTask<string>(value)`,否则 `new ValueTask<string>(LoadFromDiskAsync(key))`。

::: danger
`ValueTask` 的契约是**同一个实例只能被 await 一次**。它可能包装一个被池化复用的 `IValueTaskSource`,第二次 await 时底层对象可能已被改写。也不要对它调 `.Result` / `.GetAwaiter().GetResult()`。需要多次使用或存起来时,先 `.AsTask()`。
:::

### async void

只允许事件处理器 / Unity 生命周期方法使用。它的问题:

- **异常无法捕获**:没有返回值,`AsyncVoidMethodBuilder` 无处安放异常,只能直接抛到当前 `SynchronizationContext`(无上下文时抛到线程池,导致进程崩溃)。**Unity 里这往往表现为异常被静默吞掉或直接卡死**。
- **无法 await**,调用方拿不到句柄;
- **无法测试**。

::: warning
非事件处理器却写了 `async void`,几乎一定是 bug。改成 `async Task`,调用方仍可选择"发射后不管",至少异常可被观察。
:::

## 同步上下文与死锁

### SynchronizationContext

它回答一个问题:"`await` 之后,续体应该在哪个线程继续?"

- **UI 应用**:上下文绑定 UI 线程,续体被 `Post` 回 UI 线程,可以安全更新控件。
- **控制台等默认环境**:默认**没有**同步上下文,续体在线程池线程上继续。

::: warning
Unity 并不保证主线程上一定有可用的同步上下文,`await` 之后的代码**不一定回到主线程**;而 `Transform`、`GameObject`、`Instantiate` 等 Unity API 只能在主线程调用。详见后面的「Unity 里的异步」一节。
:::

### 经典死锁

```csharp
private void Button_Click(object sender, RoutedEventArgs e)
{
    string content = GetContentAsync().Result;   // 死锁
    textBox.Text = content;
}
private async Task<string> GetContentAsync()
{
    await Task.Delay(1000);                       // 捕获了 UI 同步上下文
    return "hello";
}
```

过程:UI 线程进入 `GetContentAsync()` 后,在 `await` 处挂起并**捕获 UI 上下文**,把未完成的 Task 交回 `Button_Click`;`Button_Click` 调 `.Result` **同步阻塞 UI 线程**。1 秒后任务完成,续体需要 UI 线程来执行 `return "hello"`,但 UI 线程正卡在 `.Result` 上,永远没空执行——任务永不完成,调用永不返回。

::: danger
UI 线程上的 `.Result` / `.Wait()` / `.GetAwaiter().GetResult()` 都是死锁候选。即使在没有同步上下文的环境(如 Unity 主线程)里不会死锁,这么写也会**阻塞线程**,拖慢整个主线程。
:::

### ConfigureAwait(false)

`ConfigureAwait(false)` 表示"续体不需要回到原上下文,在线程池线程继续即可"。

- **库代码**:除极少数例外一律使用。库不该假设调用方有上下文,也不该为回到上下文付出调度开销和死锁风险。
- **需要回到主线程的代码**:不要写 `false`,否则后续调用 Unity API 会抛异常。

### 死锁排查

1. 搜 `.Result` / `.Wait()` / `.GetAwaiter().GetResult()`,尤其在主线程上同步等待异步方法的位置。
2. 检查是否有 `lock` 内调用异步、或锁顺序相反的情况。
3. 修复通常是全链路异步,把事件回调改成 `async void`(它合法的场景)然后 await 到底。

## 异常处理

### try/catch 中的 await

```csharp
public async Task<string?> TryFetchAsync(string url)
{
    try { return await client.GetStringAsync(url); }
    catch (HttpRequestException ex)
    {
        Console.WriteLine($"请求失败: {ex.Message}");
        return null;
    }
    finally { await FlushLogsAsync(); }   // finally 里也可以 await
}
```

`catch` / `finally` 里都可以 `await`,异常过滤器 `when` 依然有效;注意 `catch` 中若再抛异常会替换原异常。

### Task.WhenAll 的异常行为

```csharp
Task t1 = FailAsync("A");
Task t2 = FailAsync("B");
Task all = Task.WhenAll(t1, t2, Task.Delay(100));

try { await all; }
catch (Exception ex)
{
    Console.WriteLine(ex.Message);                            // 输出: A(只看到第一个)
    Console.WriteLine(all.Exception!.InnerExceptions.Count);  // 输出: 2
}

foreach (var ex in all.Exception!.Flatten().InnerExceptions)
    Console.WriteLine(ex.Message);   // 依次输出 A、B
```

规则:

- **`await Task.WhenAll(...)` 只抛出第一个异常**,不是 `AggregateException`。这是为了避免开发者写 `catch (AggregateException)` 却永远进不去。
- 全部异常在返回的聚合 `Task` 的 `Exception` 属性里,类型是 `AggregateException`(`.Flatten()` 可拍平嵌套)。
- `WhenAll` 传入 `Task<T>` 时返回 `Task<T[]>`,结果按输入顺序排列。
- `WhenAny` **永远不抛异常**,返回第一个完成的任务(可能失败或取消),需自己 `await` 它才会抛出。

### 未观察异常

失败的 `Task` 从未被 await、也没人读 `.Exception`,就是"未观察"。.NET Core 后默认不会让进程崩溃,但可以订阅全局事件诊断:

```csharp
TaskScheduler.UnobservedTaskException += (sender, e) =>
{
    Console.WriteLine(e.Exception.Flatten().Message);
    e.SetObserved();
};
```

它要等任务被 GC 回收才触发,时机不确定,适合诊断而非错误处理。

### 取消与异常的区别

- **失败**:抛 `Exception`,任务状态 `Faulted`。
- **取消**:抛 `OperationCanceledException`,任务状态 `Canceled`。

`TaskCanceledException` 继承自 `OperationCanceledException`,捕获时优先更具体的类型。`Task.IsCanceled` 仅在抛出带匹配令牌的 `OperationCanceledException` 时为 `true`。

```csharp
try { await client.GetAsync(url, ct); }
catch (OperationCanceledException) when (ct.IsCancellationRequested) { /* 我们主动取消 */ }
catch (OperationCanceledException) { /* 其他取消原因,如 HttpClient 自身超时 */ }
```

## 取消

### CancellationToken 与 CancellationTokenSource

`CancellationTokenSource` 是发起者,`CancellationToken` 是给消费者看的只读句柄。

```csharp
using var cts = new CancellationTokenSource();
Task work = LongRunningAsync(cts.Token);
cts.Cancel();
await work;
```

### 为什么是协作式

没有安全机制能强杀正在执行的托管线程(强行中止会导致锁不释放、结构损坏),所以取消完全依赖被调用方**主动检查**:

- 每个异步方法都应有 `CancellationToken` 参数并**透传下去**;
- 长循环必须每轮迭代检查,不能只在开头检查一次;
- 链上任一层漏传,取消就断在那里。

```csharp
public async Task ProcessAllAsync(IEnumerable<string> items, CancellationToken ct)
{
    foreach (var item in items)
    {
        ct.ThrowIfCancellationRequested();
        await ProcessOneAsync(item, ct);
    }
}
```

| 成员 | 作用 |
| --- | --- |
| `ThrowIfCancellationRequested()` | 已取消则抛 `OperationCanceledException` |
| `IsCancellationRequested` | 只检查不抛,用于清理逻辑 |
| `ct.Register(callback)` | 注册取消回调,返回 `IDisposable`,**务必释放** |
| `CancellationToken.None` | 永不取消,可安全作为默认值 |
| `CancelAfter(ms)` | 到期自动取消,用于超时 |
| `CreateLinkedTokenSource(a, b)` | 任一令牌取消就取消 |

### 链接令牌与超时

```csharp
public async Task<string> FetchWithTimeoutAsync(string url, CancellationToken outer)
{
    using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
    using var linked = CancellationTokenSource.CreateLinkedTokenSource(outer, timeoutCts.Token);

    try
    {
        return await _client.GetStringAsync(url, linked.Token);
    }
    catch (OperationCanceledException)
        when (timeoutCts.IsCancellationRequested && !outer.IsCancellationRequested)
    {
        throw new TimeoutException($"请求 {url} 超时");
    }
}
```

链接令牌在任一输入取消时取消,这样才能区分"对方主动取消"和"超时取消"。若只是给单个任务加超时,.NET 6+ 提供了 `await task.WaitAsync(TimeSpan.FromSeconds(5), ct);`,不要手写 `WhenAny` + `Task.Delay` 竞速。

### 取消时的资源清理

`OperationCanceledException` 同样走 `finally`,清理写在 `finally` / `using` 里是可靠的:

```csharp
public async Task RunAsync(CancellationToken ct)
{
    using var stream = File.Create("log.txt");   // 取消时也会 Dispose
    try { await CopyAsync(stream, ct); }
    finally { await stream.FlushAsync(ct); }
}
```

## 异步流与并发组合

### IAsyncEnumerable`<T>` 与 await foreach

数据"边算边出"或数量很大时,返回 `Task<List<T>>` 会在返回前占满内存。`IAsyncEnumerable<T>` 支持流式产出:

```csharp
public async IAsyncEnumerable<int> RangeAsync(
    int count,
    [EnumeratorCancellation] CancellationToken ct = default)
{
    for (int i = 0; i < count; i++)
    {
        await Task.Delay(100, ct);
        yield return i;
    }
}

await foreach (int v in RangeAsync(5, ct).WithCancellation(ct).ConfigureAwait(false))
    Console.WriteLine(v);   // 输出: 0 1 2 3 4(各间隔 100ms)
```

`[EnumeratorCancellation]` 必须标在令牌参数上,`WithCancellation` 才能把令牌真正注入迭代器。异步迭代器里的 `try/finally` 在调用方提前 `break` 时也会正确执行。

### WhenAll / WhenAny / WhenEach

| API | 语义 | 返回 |
| --- | --- | --- |
| `Task.WhenAll` | 等待**全部**完成 | `Task` 或 `Task<T[]>` |
| `Task.WhenAny` | 等待**第一个**完成 | `Task<Task>` / `Task<Task<T>>` |
| `Task.WhenEach`(.NET 9) | 完成一个就出一个 | `IAsyncEnumerable<Task<T>>` |

```csharp
// .NET 9+,按完成顺序处理,不必等最慢的那个
await foreach (Task<string> task in Task.WhenEach(tasks))
    Console.WriteLine(await task);
```

### Parallel.ForEachAsync 与 Parallel.For

`Parallel.ForEachAsync` 用于限制并发度地跑一批异步任务,参数是 `ParallelOptions { MaxDegreeOfParallelism, CancellationToken }`。`Parallel.For` / `Parallel.ForEach` 则是同步的 CPU 密集型工具,会阻塞调用线程直到全部完成。**Unity 里慎用**:这些回调可能不在主线程,不能触碰 Unity API。

### 限制并发度

`ParallelOptions.MaxDegreeOfParallelism` 用于 `Parallel` 系列。普通一批 Task 用 `SemaphoreSlim`:

```csharp
using var semaphore = new SemaphoreSlim(limit);
var tasks = items.Select(async item =>
{
    await semaphore.WaitAsync();
    try { await ProcessAsync(item); }
    finally { semaphore.Release(); }   // 必须在 finally 里释放
});
await Task.WhenAll(tasks);
```

::: tip
流式生产者-消费者场景用 `System.Threading.Channels` 配合多个消费者协程更优雅。手写 `SemaphoreSlim` 适合简单场景。
:::

## 线程同步

### lock 的本质

```csharp
private readonly object _gate = new();

public void Increment()
{
    lock (_gate) { _count++; }
}
```

`lock` 编译后就是 `Monitor.Enter` / `Monitor.Exit`(包在 `try/finally` 里)。锁是**可重入**的(同一线程可重复进入),`Enter` / `Exit` 必须配对,锁的是对象引用对应的同步块,不是对象内容。

锁对象选择:

- **不要锁 `this`**:外部代码能锁住同一对象,造成意外竞争甚至死锁。
- **不要锁 `string` 字面量**:字符串驻留让所有相同字面量共享同一对象。
- **不要锁 `Type` / 值类型**:`typeof(X)` 全局唯一;值类型每次装箱都是新对象,锁完全失效。
- **推荐**:`private readonly object _gate = new();`。

### Interlocked 与 volatile

```csharp
private int _counter;
private int _flag;

public void Increment()
{
    Interlocked.Increment(ref _counter);
    Interlocked.CompareExchange(ref _flag, 1, 0);   // CAS:当前为 0 则设为 1
}
```

`CompareExchange` 是无锁算法的基础原语("当前值等于预期值时才替换"),常用于懒初始化。`volatile` 只解决可见性与指令重排,不解决原子性——`i++` 依旧是三步操作。

| 手段 | 解决什么 |
| --- | --- |
| `lock` / `Monitor` | 互斥 + 可见性 |
| `Interlocked` | 单次操作的原子性 |
| `volatile` | 读写的可见性与顺序 |

### 其他同步原语

| 原语 | 用途 |
| --- | --- |
| `SemaphoreSlim` | 限制并发数量,支持 `WaitAsync`,是异步互斥的首选 |
| `ReaderWriterLockSlim` | 读并发、写互斥,适合读多的缓存 |
| `Mutex` | 跨进程互斥(命名 Mutex),比 `Monitor` 慢得多 |
| `ManualResetEventSlim` / `AutoResetEvent` | 线程间发信号,分别一次放行多个 / 一个等待者 |
| `CountdownEvent` | 等 N 个信号到齐后一次性放行 |

### 死锁的四个必要条件

1. **互斥**:资源一次只能被一个线程占用。
2. **持有并等待**:线程拿着一个资源去等另一个。
3. **不可剥夺**:资源不能被强行夺走。
4. **循环等待**:线程之间形成环形等待链。

破坏任意一个即可避免:

- **统一加锁顺序**:所有代码按同样的全局顺序获取锁,最实用。
- **锁内不做慢操作**:不在持锁时做 I/O、异步等待、调用外部代码。
- **使用超时**:`Monitor.TryEnter(lockObj, timeout)`,拿不到就放弃并释放已持有的锁。
- **数据不可变优先**:从根本减少共享可变状态。

::: danger
`lock` 块内**不能** `await`。锁由**线程**持有,而 `await` 后续体可能跑在别的线程上,那时 `Monitor.Exit` 会因线程不匹配抛 `SynchronizationLockException`。需要异步互斥用 `SemaphoreSlim.WaitAsync`。
:::

### 不可变数据与线程安全

不可变对象(所有字段 `readonly`、创建后不可修改)天然线程安全,可被任意多线程同时读,无需锁:

```csharp
public sealed record Money(decimal Amount, string Currency);

var m1 = new Money(100m, "CNY");
var m2 = m1 with { Amount = 200m };   // 新对象,原对象不变
```

多线程更新状态时,用 `Interlocked.CompareExchange` 替换整个不可变快照,把细粒度锁变成一次 CAS。

## 并发集合

### `ConcurrentDictionary<TKey, TValue>`

```csharp
var dict = new ConcurrentDictionary<string, int>();
dict.GetOrAdd("a", _ => 0);
dict.AddOrUpdate("a", 1, (key, old) => old + 1);
if (dict.TryRemove("a", out int removed)) { /* ... */ }
```

::: warning
`GetOrAdd` / `AddOrUpdate` 的工厂委托**可能被多次调用**:并发写入下多个线程可能同时发现键不存在、各自执行一次工厂,只有一个结果被写入。因此工厂必须**幂等且无副作用**;需要"只初始化一次"时把值设为 `Lazy<T>`。它们只保证单次调用原子,跨多次的"读-改-写"组合不原子,需要整体原子就用 `TryUpdate` 重试或加锁。
:::

### ConcurrentQueue / ConcurrentStack / ConcurrentBag

`ConcurrentDictionary<TKey, TValue>` 是唯一常用且值得掌握的并发集合,其余几个大多可以用"普通集合 + `lock`"替代:

| 类型 | 特点 |
| --- | --- |
| `ConcurrentQueue<T>` | 无锁并发队列,`Enqueue` / `TryDequeue` |
| `ConcurrentStack<T>` | 后进先出,`Push` / `TryPop` |
| `ConcurrentBag<T>` | 无序,优先返回本线程加入的元素 |

```csharp
var queue = new ConcurrentQueue<WorkItem>();
queue.Enqueue(item);
if (queue.TryDequeue(out var got)) { /* ... */ }
```

### BlockingCollection 与 Channel

`BlockingCollection<T>` 的 `Take` 会**阻塞线程**,是旧的线程池式生产者-消费者方案。**新代码推荐 `System.Threading.Channels`**,它原生支持异步并带背压:

```csharp
using System.Threading.Channels;

var channel = Channel.CreateBounded<string>(new BoundedChannelOptions(100)
{
    FullMode = BoundedChannelFullMode.Wait
});

await channel.Writer.WriteAsync(item);   // 满了就异步等
channel.Writer.Complete();

await foreach (var item in channel.Reader.ReadAllAsync())
    Process(item);                       // 消费者可多个
```

`Channel<T>` 的读端是 `IAsyncEnumerable<T>`,天然配合 `await foreach`;`BoundedChannelFullMode` 提供背压,不会像无界 `Task` 洪流那样打爆内存。

## 其他

### `IProgress<T>` 与 `Progress<T>`

`Progress<T>` 在构造时捕获当前 `SynchronizationContext`,`Report` 把回调 Post 回该上下文;在后台线程构造就跑到线程池上。Unity 里没有可靠的主线程上下文,用它回主线程并不可靠,应该用 `Awaitable` 或 UniTask(见下节)。

```csharp
var reporter = new Progress<int>(p => Debug.Log($"进度 {p}%"));
await DownloadAsync(reporter);
```

### TaskCompletionSource`<T>`

`TaskCompletionSource<T>` 把回调式 API 包装成 `Task`:创建 TCS,回调里用 `TrySetResult` / `TrySetException` / `TrySetCanceled` 避免竞争,最后返回 `tcs.Task`。创建时传 `TaskCreationOptions.RunContinuationsAsynchronously`,防止回调线程被续体内联占用。包装旧的回调式插件 API 时很有用。

### ValueTask 与 IValueTaskSource

高吞吐库会实现 `IValueTaskSource<T>`,让高频同步完成的路径零分配;普通业务代码无需自己实现,直接返回 `ValueTask` 即可。

## Unity 里的异步

### 主线程约束

Unity 大部分 API(`Transform`、`GameObject`、`Instantiate`、`GetComponent` 以及渲染、物理调用)只能在**主线程**执行。而 `await` 之后的续体可能落在线程池线程上,所以下面这段代码在 Unity 里**不保证安全**:

```csharp
async Task MoveAsync(Transform t)
{
    await Task.Delay(1000);
    t.position += Vector3.up;   // 可能不在主线程 → 抛异常
}
```

::: danger
Unity 不提供 .NET 那种"主线程同步上下文"的默认保证,`await` 之后的代码**不一定回到主线程**。任何 `await` 之后访问 Unity API 的代码都必须显式回到主线程。
:::

### Unity 6 的 `Awaitable`

Unity 6 新增了 `UnityEngine.Awaitable`,专门解决这个问题:`Awaitable.NextFrameAsync()`、`Awaitable.WaitForSecondsAsync(1f)` 等完成后**保证回到主线程**,并且不分配 `Task`。这是 Unity 官方推荐的异步方案。

```csharp
async Awaitable MoveAsync(Transform t)
{
    await Awaitable.WaitForSecondsAsync(1f, destroyCancellationToken);
    t.position += Vector3.up;   // 保证在主线程
}
```

`Awaitable` 面向的是 Unity 的帧与主线程时序,不适合真正的后台 I/O;它也**不应在 `await` 之后配 `ConfigureAwait(false)`**。

### 社区方案 UniTask

Unity 6 之前,社区广泛使用 **UniTask**(Cysharp):零分配的 `ValueTask` 风格类型,完全构建在 Unity 的 PlayerLoop 上,`await` 保证回主线程,并提供 `UniTask.DelayFrame`、`UniTask.Yield`、`WhenAll`、`CancellationToken` 支持。项目已在用就继续用;新项目可优先考虑官方 `Awaitable`。

### 对象被销毁后的回调

`MonoBehaviour` 被 `Destroy` 后,挂起的 `await` 仍会继续执行,此时访问已销毁对象会抛 `MissingReferenceException`。标准做法是每个组件在 `OnDestroy` 里取消自己的令牌:

```csharp
private readonly CancellationTokenSource _cts = new();

async void StartWork()                       // 生命周期方法,async void 是少数合法场景
{
    try { await DoWorkAsync(_cts.Token); }
    catch (OperationCanceledException) { }
}

void OnDestroy() => _cts.Cancel();           // 销毁时取消所有挂起任务
```

`Awaitable` 的 `destroyCancellationToken` 能达到同样效果。非生命周期方法一律用 `async Task`,以便异常可被观察。

### 协程 vs async/await

| 维度 | 协程(`IEnumerator` + `yield return`) | `async` / `await` |
| --- | --- | --- |
| 调度 | 绑定 `MonoBehaviour`,随对象销毁自动停止 | 与对象生命周期无关,需手动取消 |
| 时序控制 | 天然逐帧:`yield return null` / `WaitForSeconds` | 用 `Awaitable` / UniTask 才能逐帧 |
| 异步 I/O | 做不到(会在主线程阻塞) | 真正的异步 I/O 主场 |
| 异常 | 不能跨 `yield` 用 `try/catch` 捕获外部异常 | `try/catch` 正常 |
| 分配 | 每次 `yield` 有少量分配 | `Awaitable` / UniTask 可接近零分配 |

**选择建议**:逐帧流程、简单延时、动画时序用协程;网络请求、文件读写、需要取消与异常处理的逻辑用 `async` / `await`。两者可以在同一个类里共存。

## 常见坑

1. **`async void` 滥用**:只有事件处理器 / Unity 生命周期方法能用,异常直抛上下文、无法 await 或测试。其他一律 `async Task`。
2. **`.Result` / `.Wait()` / `.GetAwaiter().GetResult()`**:UI / Unity 主线程上必然死锁,线程池线程上造成饥饿。
3. **忘记 `await`**:拿到的是 `Task` 而非结果,异常还被吞进未观察任务。把 CS4014 当错误处理。
4. **`Task.Run` 包装同步 I/O**:不会让 I/O 变快,只多占一个线程。
5. **`await` 在 `lock` 里**:编译器直接报错。用 `SemaphoreSlim.WaitAsync`。
6. **`ConfigureAwait` 位置错误**:库代码不写 `ConfigureAwait(false)` 引入死锁风险;需要回到主线程的代码写 `false` 会导致后续 Unity API 调用抛异常。
7. **取消令牌忘记透传**:调用链任一层漏传,取消就断在那里。
8. **`Task.WhenAll` 只看到第一个异常**:要全部异常需 `all.Exception.Flatten().InnerExceptions`。
9. **`ValueTask` 被 await 两次或读 `.Result`**:未定义行为,需要多次使用先 `.AsTask()`。
10. **`ConcurrentDictionary` 工厂有副作用**:并发下可能被调用多次,用 `Lazy<T>` 包装。
11. **异步资源只调 `Dispose` 没 `await DisposeAsync`**:实现 `IAsyncDisposable` 的资源用 `await using`。
12. **无界并发**:一次性 `WhenAll` 几万个任务会打满线程池或压垮下游,用 `SemaphoreSlim` / `Parallel.ForEachAsync` 限流。
13. **`CancellationTokenSource` 没 Dispose**:订阅了定时器或链接令牌时会泄漏,用 `using`。
14. **`ct.Register` 的返回值被丢弃**:回调被长期持有造成泄漏,用 `using` 包住。
15. **后台线程直接调用 Unity API**:抛异常或未定义行为,用 `Awaitable` / UniTask 回主线程。
16. **`MonoBehaviour` 销毁后 await 回调继续跑**:访问已销毁对象抛 `MissingReferenceException`,在 `OnDestroy` 里 `Cancel` 令牌。
17. **`finally` 里 await 后再抛异常**:会覆盖原异常,丢失真正的错误信息。
