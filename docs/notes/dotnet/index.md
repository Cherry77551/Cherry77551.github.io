# C# 学习笔记

这一套笔记是按 **为 Unity 游戏开发做准备** 这个目标挑选和裁剪的 C# 知识点,共 8 篇。

每篇都是独立完整的,可以跳着看;但按顺序读下来效果最好,后面的内容建立在前面的基础上。

::: warning 先知道两件事,能省很多时间
**1. Unity 只支持 C# 9.0。** 这是 Unity 6.0 官方文档明确写的。所以 C# 10~14 的内容
(主构造函数、集合表达式、扩展成员、`field` 关键字、泛型数学……)在 Unity 里**一个都用不了**。
网上很多教程不会告诉你这一点。

**2. Unity 的 GC 不是 .NET 的 GC。** Unity 用的是 **Boehm-Demers-Weiser GC**:
不分代、默认不压缩、默认增量模式。网上绝大多数"Unity 性能优化"文章直接套用
.NET 的 Gen0/Gen1/Gen2 结论,是**错的**。第 8 篇会讲清楚。
:::

## 目录

| # | 篇目 | 主要内容 |
| --- | --- | --- |
| 1 | [类型系统与值/引用类型](./type-system.md) | 内置类型、内存模型、`struct`、装箱、可空类型、类型转换 |
| 2 | [字符串、数组与集合](./strings-collections.md) | 字符串不可变性与比较、数组、集合选型、迭代器、相等性契约 |
| 3 | [面向对象:类、接口与继承](./oop.md) | 类的成员、属性与构造、继承与多态、接口、扩展方法、`MonoBehaviour` |
| 4 | [泛型](./generics.md) | 类型参数与约束、协变与逆变、`GetComponent<T>()` |
| 5 | [委托、Lambda 与事件](./delegates-events.md) | 委托与多播、Lambda、闭包捕获、`event` 与 `UnityEvent` |
| 6 | [LINQ](./linq.md) | 延迟执行、算子全解、为什么不能在 `Update` 里用 |
| 7 | [异步编程与并发](./async.md) | `async`/`await` 原理、取消、协程与 `Awaitable`、并发原语 |
| 8 | [内存、GC 与性能](./memory-performance.md) | Unity 的 GC 模型、`IDisposable`、`Span<T>`、零分配实践 |

## 建议的读法

**必读(Unity 开发天天用)** —— 1、2、3、5、8

**按需查(用到再看)** —— 4、6、7

特别提醒几个重点:

- **第 1 篇**的值类型 / 引用类型和装箱:这是理解 Unity 性能问题的地基
- **第 5 篇**的闭包捕获:每一次闭包分配都是一次 GC 压力
- **第 6 篇**的性能那节:为什么 `Update()` 里不能写 LINQ
- **第 8 篇**的 GC 模型:和你在别处看到的 .NET 知识**不一样**,这里以 Unity 为准

::: tip 最开始怎么上手
如果你还没写过 C#,别按顺序啃完 8 篇再动手。做法是:
先读第 1 篇的前半部分(值类型/引用类型/装箱),然后直接去 Unity 里写
`MonoBehaviour`、拖拖拽拽,遇到不懂的概念再回来查。
:::

## 刻意没有收录的内容

这套笔记早期有 11 篇,后来删掉了 3 篇,原因是它们在 Unity 里**性价比极低**:

| 删掉的 | 为什么 |
| --- | --- |
| C# 与 .NET 生态 | Unity 不用 `dotnet` CLI、不用 `.csproj`、不用 NuGet。对应概念是 Unity 的**程序集定义(asmdef)** 和 **UPM 包管理器**,那是 Unity 的课题,不是 C# 的 |
| 现代 C# 特性(C# 10~14) | Unity 只到 C# 9,**一行都用不了** |
| 工程化实践 | 依赖注入容器、`appsettings.json`、xUnit、源生成器…… Unity 有自己的替代品(Inspector 序列化、Unity Test Framework),照搬 .NET 那套没用 |

同样被删掉的还有正文里的:泛型数学、静态抽象成员、`required`、`field` 关键字、
表达式树的深入用法、EF Core / LINQ to SQL、ASP.NET 相关内容。

## 下一步要补的 Unity 专属知识

这 8 篇是 C# **语言**层面。下面这些不在 C# 范围内,但 Unity 开发绕不开:

- **`MonoBehaviour` 生命周期**:`Awake` / `OnEnable` / `Start` / `FixedUpdate` / `Update` / `LateUpdate` / `OnDestroy` 的执行顺序
- **Unity 序列化**:`[SerializeField]`、`[Serializable]`、`ScriptableObject`、为什么不支持 `record` 和 `readonly struct` 字段
- **协程**:`IEnumerator` + `yield return null` / `WaitForSeconds` / `WaitForFixedUpdate`、`CustomYieldInstruction`
- **Unity 里的异步**:`Awaitable`(Unity 6)、UniTask、`MonoBehaviour` 销毁后的回调问题
- **对象池**:`UnityEngine.Pool.ObjectPool<T>`、子弹/特效/UI 的复用
- **性能陷阱**:`GetComponent` 缓存、`Camera.main`、`GameObject.Find`、`tag` 比较、`Physics.*NonAlloc`
- **IL2CPP 与 AOT**:反射限制、泛型实例化、`link.xml` 与代码剥离
- **程序集定义 asmdef**:编译速度与依赖管理

::: details 参考资料
- [Unity 官方:C# compiler and language version reference](https://docs.unity3d.com/6000.0/Documentation/Manual/csharp-compiler.html) —— 语言版本和 GC 的权威说明
- [Unity 官方:Incremental garbage collection](https://docs.unity3d.com/6000.0/Documentation/Manual/performance-incremental-garbage-collection.html)
- [Microsoft Learn:C# 语言参考](https://learn.microsoft.com/dotnet/csharp/language-reference/)
:::
