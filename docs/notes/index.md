# 笔记

这里按主题整理我平时记的笔记。

## 目录

### 入门

- [怎么用这个站记笔记](./getting-started.md) —— 新建笔记、加侧栏、写 Markdown 的套路

### C#(为 Unity 准备)

按 Unity 游戏开发的实际需要挑选和裁剪的一套 C# 笔记,共 8 篇。

| # | 篇目 | 主要内容 |
| --- | --- | --- |
| 1 | [类型系统与值/引用类型](./dotnet/type-system.md) | 内置类型、内存模型、`struct`、装箱、可空类型 |
| 2 | [字符串、数组与集合](./dotnet/strings-collections.md) | 字符串比较、数组、集合选型、迭代器、相等性契约 |
| 3 | [面向对象:类、接口与继承](./dotnet/oop.md) | 属性、构造、继承与多态、接口、`MonoBehaviour` |
| 4 | [泛型](./dotnet/generics.md) | 类型参数与约束、协变与逆变、`GetComponent<T>()` |
| 5 | [委托、Lambda 与事件](./dotnet/delegates-events.md) | 委托与多播、闭包捕获、`event` 与 `UnityEvent` |
| 6 | [LINQ](./dotnet/linq.md) | 延迟执行、算子全解、为什么不能在 `Update` 里用 |
| 7 | [异步编程与并发](./dotnet/async.md) | `async`/`await` 原理、取消、协程与 `Awaitable` |
| 8 | [内存、GC 与性能](./dotnet/memory-performance.md) | Unity 的 GC 模型、`IDisposable`、`Span<T>`、零分配 |

### Unity

接着上面那套 C# 往下走,这边学引擎。

| 篇目 | 主要内容 |
| --- | --- |
| [Unity 编辑器与基本操作](./unity/editor.md) | 六个面板、场景视角、移动旋转缩放手柄、组件、父子关系、预制体、Play 模式、常用快捷键 |
| [FBX 模型导入与使用](./unity/fbx.md) | 导入设置、Rig 与动画、材质提取、做成 Prefab、Blender 导出、模型变粉的原因 |

---

想加新分类的话,只要在 `docs/notes/` 下建个文件夹,然后在侧栏里加一行就行,
具体看[怎么用这个站记笔记](./getting-started.md)。
