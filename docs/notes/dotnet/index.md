# C# / .NET 学习笔记

这一套笔记把 C# 和 .NET 的知识点按主题拆开整理,从语言基础一直讲到工程实践。

每篇都是独立完整的,可以跳着看;但按顺序读下来效果最好,因为后面的内容会建立在前面的基础上。

## 目录

| # | 篇目 | 主要内容 |
| --- | --- | --- |
| 1 | [C# 与 .NET 生态](./ecosystem.md) | 语言和运行时的关系、版本与 LTS、安装、dotnet CLI、第一个程序、项目文件 |
| 2 | [类型系统与值/引用类型](./type-system.md) | 内置类型、值类型与引用类型的内存模型、装箱、`Nullable<T>`、可空引用类型、类型转换 |
| 3 | [字符串、数组与集合](./strings-collections.md) | 字符串不可变性与比较、格式化和编码、数组、集合类型选型、迭代器、相等性契约 |
| 4 | [面向对象:类、接口与继承](./oop.md) | 类的成员、属性与构造、继承与多态、接口、抽象类、静态成员、扩展方法、`object` 的四个方法 |
| 5 | [泛型](./generics.md) | 具现化泛型、类型参数约束、协变与逆变、泛型数学、静态抽象成员 |
| 6 | [委托、Lambda 与事件](./delegates-events.md) | 委托与多播、Lambda 各种写法、闭包捕获、表达式树、`event` 与内存泄漏 |
| 7 | [LINQ](./linq.md) | 查询语法与方法语法、延迟执行、`IEnumerable` 与 `IQueryable`、算子全解、性能陷阱 |
| 8 | [异步编程与并发](./async.md) | `async`/`await` 状态机、`Task`、同步上下文与死锁、取消、并发原语、并发集合 |
| 9 | [内存、GC 与性能](./memory-performance.md) | 托管堆与 GC 分代、`IDisposable` 模式、`Span<T>`、`ref` 系列、池化、性能分析工具 |
| 10 | [现代 C# 特性(按版本)](./modern-csharp.md) | 从 C# 3 到 C# 14 的重要特性、模式匹配专题、`record` 专题、语言版本控制 |
| 11 | [工程化实践](./engineering.md) | 项目文件、NuGet、依赖注入、配置与日志、单元测试、分析器、发布部署 |

## 怎么用这套笔记

- **刚开始学**:按 1 → 11 的顺序读,每篇末尾的代码都动手敲一遍
- **查漏补缺**:直接跳到不熟的那一篇
- **面试前**:重点看 2(值/引用类型)、7(LINQ 延迟执行)、8(异步)、9(GC 与 Span)
- **手上要有代码**:光看会误以为自己懂了,尤其是异步和泛型

::: tip 关于代码
笔记里的代码都是可以直接跑的最小示例。建议用 `dotnet new console` 建个空项目,
把代码贴进 `Program.cs` 里跑一遍,比看十遍都管用。
:::

## 配套资料

- [C# 官方文档](https://learn.microsoft.com/dotnet/csharp/) —— 最权威,遇到问题先查这里
- [.NET API 浏览器](https://learn.microsoft.com/dotnet/api/) —— 查某个类型有哪些方法
- [C# 版本历史](https://learn.microsoft.com/dotnet/csharp/whats-new/csharp-version-history) —— 某个特性是哪个版本加的
- [csharplang](https://github.com/dotnet/csharplang) —— 语言提案,想知道"为什么这么设计"看这里

书:

- 《C# 12 in a Nutshell》—— 当手册用,最全
- 《C# in Depth》—— 讲语言演进和设计原理,不是入门书
- 《CLR via C#》—— 深入运行时,GC、线程、类型系统
- 《Concurrency in C# Cookbook》—— 并发和异步的实用方案集
