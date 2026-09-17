# 笔记

这里按主题整理我平时记的笔记。左边侧栏可以直接跳转。

## 目录

### 入门

- [怎么用这个站记笔记](./getting-started.md) —— 新建笔记、加侧栏、写 Markdown 的套路

### C# / .NET

系统整理的一套 C# 笔记,从语言基础到工程实践,共 11 篇。从[总览与目录](./dotnet/index.md)开始读。

| # | 篇目 | 主要内容 |
| --- | --- | --- |
| 1 | [C# 与 .NET 生态](./dotnet/ecosystem.md) | 语言与运行时的关系、版本与 LTS、CLI、项目文件 |
| 2 | [类型系统与值/引用类型](./dotnet/type-system.md) | 内置类型、内存模型、装箱、可空引用类型 |
| 3 | [字符串、数组与集合](./dotnet/strings-collections.md) | 字符串比较与格式化、数组、集合选型、迭代器 |
| 4 | [面向对象:类、接口与继承](./dotnet/oop.md) | 属性、构造、继承与多态、接口、扩展方法 |
| 5 | [泛型](./dotnet/generics.md) | 具现化泛型、约束、协变与逆变、泛型数学 |
| 6 | [委托、Lambda 与事件](./dotnet/delegates-events.md) | 委托与多播、闭包捕获、表达式树、事件 |
| 7 | [LINQ](./dotnet/linq.md) | 延迟执行、`IEnumerable` 与 `IQueryable`、算子全解 |
| 8 | [异步编程与并发](./dotnet/async.md) | `async`/`await` 原理、取消、同步上下文、并发集合 |
| 9 | [内存、GC 与性能](./dotnet/memory-performance.md) | GC 分代、`IDisposable`、`Span<T>`、性能度量 |
| 10 | [现代 C# 特性(按版本)](./dotnet/modern-csharp.md) | C# 3 到 C# 14、模式匹配专题、`record` 专题 |
| 11 | [工程化实践](./dotnet/engineering.md) | NuGet、依赖注入、配置日志、测试、发布 |

### Linux 与工具

- [WSL 常用技巧](./linux/wsl-tips.md) —— 在 Windows 上用 Linux 开发的一些经验

### 前端

- [CSS 布局笔记](./web/css-layout.md) —— Flex / Grid 的常用写法速查

---

想加新分类的话,只要在 `docs/notes/` 下建个文件夹,然后在侧栏里加一行就行,
具体看[怎么用这个站记笔记](./getting-started.md)。
