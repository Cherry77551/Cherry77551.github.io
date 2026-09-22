# Unity 编辑器与基本操作

操作备忘。Layout 用的 2 by 3,面板位置随布局变,下面按功能记,不按位置记。

Layout 在右上角下拉框切换(2 by 3 / Default)。面板拖没了在 Layout 里选回来,不会丢东西。

## 一、面板

| 面板 | 用途 |
| --- | --- |
| **Hierarchy** | 当前场景的物体列表 |
| **Scene** | 编辑用 3D 视图 |
| **Game** | 相机实际画面,玩家看到的 |
| **Inspector** | 选中物体的属性 |
| **Project** | 项目全部文件 |
| **Console** | 日志和报错,排错先看这里 |

- Scene 是编辑用的,Game 是最终画面。摆相机看 Game。
- Console 常开。`Ctrl` + `Shift` + `C` 开关。

## 二、场景视角

| 操作 | 效果 |
| --- | --- |
| 右键拖动 | 转视角 |
| 中键拖动 | 平移 |
| 滚轮 | 缩放 |
| 右键 + `W` `A` `S` `D` | 前后左右飞 |
| 右键 + `Q` `E` | 下降 / 上升 |
| 右键 + `Shift` | 加速 |
| `Alt` + 左键拖 | 绕物体转 |
| `Alt` + 中键拖 | 平移 |
| `Alt` + 右键拖 | 推拉 |

### 聚焦

点选物体 → 鼠标移到 Scene 面板 → 按 `F`。Hierarchy 里双击物体名字效果相同。

## 三、工具

| 键 | 工具 | 手柄 |
| --- | --- | --- |
| `Q` | 抓手 | 无手柄 |
| `W` | 移动 | 三根箭头 |
| `E` | 旋转 | 三个圈 |
| `R` | 缩放 | 三个方块 |
| `T` | Rect Tool | 方框,UI 和 2D 用 |
| `Y` | 综合 | 移动旋转缩放同时显示 |

按钮位置:Scene 视图左上角浮层(Unity 6 叫 Overlays)。

拖箭头的**杆**沿单轴走,拖箭头尖端的**小方块**在平面上走。旋转同理。

### Pivot / Center

| | 基准 |
| --- | --- |
| Pivot | 物体自己的轴心 |
| Center | 物体的几何中心 |

多选物体时差别最明显。

### Local / Global

| | 方向 |
| --- | --- |
| Global | 世界坐标轴,固定 |
| Local | 跟随物体自身朝向 |

物体旋转后,Global 箭头仍横平竖直,Local 箭头跟着歪。摆放倾斜物体用 Local。

### 吸附

| 操作 | 效果 |
| --- | --- |
| 拖动 + `Ctrl` | 按增量吸附(位置 1,旋转 15°) |
| 拖动 + `Ctrl` + `Shift` | 增量减半 |
| 拖动 + `V` | 顶点吸附 |

增量在 **Edit → Grid and Snap Settings** 改。

## 四、选择与编辑

| 操作 | 效果 |
| --- | --- |
| `Ctrl` + 左键 | 加选 / 取消 |
| `Shift` + 左键 | 选连续范围 |
| Scene 里拖框 | 框选 |
| `Ctrl` + `D` | 复制(原地) |
| `Delete` | 删除 |
| `F2` | 改名 |
| `Ctrl` + `Z` / `Ctrl` + `Y` | 撤销 / 重做 |

## 五、GameObject 与组件

GameObject 本身是空壳,功能全在挂载的组件上。

### Transform

新建物体必有 Transform,不可删。Position 位置、Rotation 旋转、Scale 缩放(`1` 为原始大小)。

齿轮菜单里的 Reset 可把三项归零。

### 添加组件

- Inspector 底部 **Add Component**
- 菜单 **Component**
- 把脚本文件从 Project 拖到物体上

### 新建物体

- 菜单 **GameObject → 3D Object → Cube / Sphere / Plane**
- Hierarchy 空白处右键
- `Ctrl` + `Shift` + `N` 新建空物体

空物体无外观,可当文件夹整理层级,也可当父物体控制一组物体。

## 六、Inspector 实用功能

| 功能 | 位置 | 用途 |
| --- | --- | --- |
| Copy / Paste Component Values | 组件右上角齿轮 | 把数值复制到其他物体 |
| Reset | 同一齿轮菜单 | 恢复默认值 |
| 锁定 | Inspector 右上角小锁 | 锁住后切换物体时内容不变 |
| Debug 模式 | 右上角三个点 → Debug | 显示私有字段和隐藏属性 |

Debug 模式用于查看 `private` 或未加 `[SerializeField]` 的字段。

## 七、父子关系

在 Hierarchy 里把子物体拖到父物体名字上建立。

- 移动父物体,子物体跟随
- 旋转父物体,子物体绕其旋转
- 删除父物体,子物体一并删除
- 子物体的 Position 是相对父物体的坐标

世界坐标在 Inspector 里 Position 下方那行灰色小字。

典型用法:角色 = 空物体当父 + 模型 / 武器 / 碰撞体当子;车 = 父物体 + 四个轮子。

## 八、预制体 Prefab

Prefab 是可复用的物体模板。

- **创建**:把 Hierarchy 里的物体拖到 Project 面板,名字变蓝
- **使用**:从 Project 拖回场景,生成实例
- **编辑**:双击 Project 里的 Prefab 进编辑模式,退出点左上角 ←
- **改动只影响当前实例**:直接在场景里改
- **推给所有实例**:Inspector → Overrides → **Apply All**
- **撤销当前实例的改动**:Overrides → **Revert All**

场景里改 Prefab 实例默认只影响这一个。要同步给全部实例需显式 Apply。

## 九、运行 / 暂停 / 逐帧

| 按钮 | 快捷键 | 效果 |
| --- | --- | --- |
| ▶ | `Ctrl` + `P` | 运行 |
| ⏸ | `Ctrl` + `Shift` + `P` | 暂停 |
| ⏭ | `Ctrl` + `Alt` + `P` | 逐帧,按一下走一帧 |

运行时按钮变蓝。

### Play 模式

- 运行中改的 Inspector 数值、拖动的位置,退出后**还原**
- 运行中新建的物体,退出后**消失**
- 运行中**切换场景**,改动会真的保存

要保留运行中的改动:组件齿轮 → Copy Component,退出 Play,齿轮 → Paste Component Values。

进 Play 前先 `Ctrl` + `S` 保存场景。

## 十、保存与项目结构

| 快捷键 | 效果 |
| --- | --- |
| `Ctrl` + `S` | 保存当前场景 |
| `Ctrl` + `Shift` + `S` | 另存为 |

Unity 是边改边存的:Project 里建文件夹、改素材导入设置立刻生效。只有场景需要手动保存。

| 文件夹 | 内容 |
| --- | --- |
| **`Assets/`** | 素材、脚本、场景、Prefab |
| `ProjectSettings/` | 项目设置 |
| `Packages/` | 依赖包列表 |
| `Library/` | Unity 生成的缓存,可随时删,重开重建 |

`.gitignore`:

```text
Library/
Temp/
Obj/
Build/
Builds/
Logs/
UserSettings/
*.csproj
*.sln
```

`.meta` 文件不能忽略,也不能手动删。每个资源配一个,记录 GUID 和导入设置,丢了引用会断。

## 十一、第一个脚本

1. Project 里 `Assets` 下右键 → **Create → C# Script**,命名 `Hello`
2. 内容:

```csharp
using UnityEngine;

public class Hello : MonoBehaviour
{
    void Start()
    {
        // 开始时执行一次
        Debug.Log("Start 跑了");
    }

    void Update()
    {
        // 每帧执行一次
    }
}
```

3. 把脚本从 Project 拖到 Hierarchy 的物体上
4. `Ctrl` + `P` 运行,Console 查看输出

文件名必须与类名一致。命名只用字母、数字、下划线,不用中文、空格、横杠。

## 十二、快捷键

**工具**:`Q` 抓手 / `W` 移动 / `E` 旋转 / `R` 缩放 / `T` Rect / `Y` 综合

**视角**

| 键 | 效果 |
| --- | --- |
| 右键拖 / 中键拖 / 滚轮 | 转 / 平移 / 缩放 |
| 右键 + `WASD` | 飞行 |
| 右键 + `Q` `E` | 下降 / 上升 |
| 右键 + `Shift` | 加速 |
| `Alt` + 左 / 中 / 右拖 | 环绕 / 平移 / 推拉 |
| `F` | 聚焦选中物体 |
| `Ctrl` + `Shift` + `F` | 选中物体对齐到当前视角 |
| `Ctrl` + `Alt` + `F` | 视角对准选中物体 |

**编辑**

| 键 | 效果 |
| --- | --- |
| `Ctrl` + `Z` / `Ctrl` + `Y` | 撤销 / 重做 |
| `Ctrl` + `D` | 复制 |
| `Delete` | 删除 |
| `F2` | 改名 |
| `Ctrl` + `S` | 保存场景 |
| 拖动 + `Ctrl` | 吸附 |
| 拖动 + `V` | 顶点吸附 |

**窗口与运行**

| 键 | 效果 |
| --- | --- |
| `Ctrl` + `P` | 运行 |
| `Ctrl` + `Shift` + `P` | 暂停 |
| `Ctrl` + `Alt` + `P` | 逐帧 |
| `Ctrl` + `Shift` + `C` | 开关 Console |
| `Ctrl` + `Shift` + `N` | 新建空物体 |

## 十三、注意事项

1. Play 模式下改的数值退出后还原。进 Play 前先 `Ctrl` + `S`。
2. 场景没保存就关 Unity,对话框容易手快点掉。
3. 子物体的 Position 是相对坐标,不在原点是正常的。
4. 改 Prefab 实例默认不影响其他实例,要同步需 Apply。
5. 脚本挂不上时看 Console 第一条红字。常见原因:文件名与类名不一致、括号不配对、缺 `using`。
6. `.meta` 不能删、不能忽略。
7. 脚本和资源命名统一用英文。
8. `MonoBehaviour` 上写构造函数不会被调用,初始化写在 `Awake()` 或 `Start()`。
9. 摆相机盯 Game 面板,不是 Scene。
