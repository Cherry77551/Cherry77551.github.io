# FBX 模型导入与使用

## 一、FBX 是什么

FBX 是 Autodesk 的 3D 模型交换格式,Unity 导入外部模型主要就用它。

- **从哪来**:Blender / Maya / 3ds Max / ZBrush 等导出
- **里面装什么**:网格、UV、法线、材质槽、骨骼、动画、摄像机、灯光
- **Unity 里长什么样**:一个带 GameObject 图标的资源文件,展开能看到里面的网格、材质、动画片段

Unity 原生不认 `.blend`(装了 Blender 后有转换流程但容易出问题),**统一导出成 FBX 再导入**。

## 二、导入

把 `.fbx` 文件拖进 Project 面板的 `Assets/` 下就行。

选中它,Inspector 会出现 **Model / Rig / Animation / Materials** 四个标签页,导入设置全在这里。

改完点右下角 **Apply**。

## 三、Model 标签页

大部分设置保持默认,需要动的就下面几个。

### Scale Factor

**最常出问题的一项。**

Unity 里 1 个单位 = 1 米。模型导入后尺寸不对,基本都在这:

| 现象 | 原因 |
| --- | --- |
| 模型小得看不见 | Scale Factor 太小,一般是差了 100 倍 |
| 模型大得填满场景 | 同上,方向相反 |

FBX 内部的默认单位是**厘米**,Unity 的 **Convert Units** 勾上后会自动换算成米。正常情况下勾着就好,尺寸还是不对再手调 Scale Factor。

判断标准:一个正常人形模型导入后应该约 1.7~1.8 个单位高。

### Generate Colliders

勾上会给模型自动加 **Mesh Collider**。

注意 Mesh Collider 开销大,**移动的物体不要用**。角色、子弹这类用 Box / Capsule / Sphere Collider 手动加。

静态场景(地面、墙、建筑)可以勾。

### Read / Write Enabled

**默认关闭,一般不要开。**

开启后脚本才能读写网格顶点数据,代价是网格会在内存里存两份,内存占用翻倍。

只有做程序化修改网格(比如运行时变形、顶点动画)时才开。

### 其他

| 项 | 说明 |
| --- | --- |
| **Mesh Compression** | 压缩网格减小包体。Off / Low / Medium / High,**压太狠会变形**,默认 Off |
| **Optimize Mesh** | 重排顶点顺序提升渲染性能,保持开启 |
| **Weld Vertices** | 合并重合顶点,一般开启 |
| **Normals** | 默认 Import(用文件里的法线)。法线不对时才改 Calculate |
| **Tangents** | 默认 Calculate MikkTSpace。用不到法线贴图可设 None |
| **Generate Lightmap UVs** | 需要烘培光照贴图时勾上 |
| **Import Cameras / Lights** | 默认关闭。模型里带了摄像机灯光可以勾上导进来 |

## 四、Rig 标签页

控制骨骼和动画怎么导入。

| Animation Type | 用途 |
| --- | --- |
| **None** | 不导入动画,只要模型 |
| **Generic** | 通用骨骼动画。非人形(怪物、机械、载具)用这个 |
| **Humanoid** | 人形。**支持动画重定向**,同一套动画能给不同模型用 |
| **Legacy** | 老的动画系统,基本不用了 |

**人形角色选 Humanoid** 才能复用他人的人形动画。选完要配 Avatar,点 **Configure...** 把骨骼映射到 Unity 的标准人形骨架。

不是人形的一律用 **Generic**,选 Humanoid 会因为匹配不上骨骼而报错。

## 五、Animation 标签页

勾上 **Import Animation** 才会导入动画。

下面有个 **Clips** 列表,一个 FBX 可以切成多段动画:

- 点 **+** 加一段,填名字和起止帧
- **Loop Time**:循环动画(走、跑、待机)勾上
- **Loop Pose**:让循环首尾衔接平滑
- **Start / End**:指定这段动画的帧范围

一个 FBX 里有多段动作时,在这里切成 `Idle` / `Walk` / `Run` 分开用。

::: tip 找不到动画
导入后 Project 里展开 FBX 文件,动画片段应该在里面。

看不到就检查:Animation 标签页的 Import Animation 有没有勾;Rig 标签页的 Animation Type 是不是 None。
:::

## 六、Materials 标签页

### 一个必须知道的点

FBX 里的材质是**嵌在模型里的**。默认情况下 Unity 把它们作为子资源处理,**直接在场景里改是改不掉的**,而且没法和美术给的贴图对应上。

**正确做法:把材质提取出来**(见下一节)。

### 相关设置

| 项 | 说明 |
| --- | --- |
| **Material Creation Mode** | 默认 Standard,保持即可 |
| **Location** | 默认 Use Embedded Materials(内嵌)。改成 **Use External Materials** 会把材质输出成独立文件 |
| **Naming** | 材质命名规则,保持默认 |
| **Extract Materials...** | 点一下把材质提取到指定文件夹 |

## 七、从 FBX 里提取资源

FBX 是"打包"的,下面的东西都能单独提取出来用:

| 要提取 | 怎么取 |
| --- | --- |
| **网格** | 不用提取,拖进场景就是 Mesh Filter + Mesh Renderer |
| **材质** | 右键 FBX → **Extract Materials...**,或 Materials 标签页的按钮 |
| **动画片段** | 选中 FBX,展开子资源,动画片段可以直接拖到 Animator 里用 |
| **Avatar** | Humanoid 的 Avatar 是 FBX 的子资源,可以复制出来给别的模型用 |

提取材质后得到 `.mat` 文件,这时才能随意改贴图、颜色、Shader。

## 八、在场景里使用

### 直接拖

把 FBX 从 Project 拖到 Scene 或 Hierarchy,得到一个 GameObject,带:

- **Mesh Filter**:装着网格
- **Mesh Renderer**:负责渲染
- **Transform**

### 动作模型要做成 Prefab

FBX 本身是**只读的资源**,不能在上面加脚本、加碰撞体、挂子物体。

所以角色、道具这类要重复用的东西,**先把 FBX 拖进场景 → 加组件加子物体 → 再拖回 Project 做成 Prefab**。

### 换模型

后续美术给了新版本的 FBX,只要**网格的名字和结构没变**,可以只替换 Mesh Filter 里的网格,Prefab 上挂的组件和子物体都保留。

## 九、Blender 导出的设置

从 Blender 导出 FBX 时,默认值基本够用,注意这几点:

- **Scale** 保持 `1.0`
- **Apply Scalings** 选 **FBX All**(否则缩放可能不对)
- **Forward / Up** 保持默认(`-Z Forward` / `Y Up`)
- **Apply Modifiers** 勾上,否则修改器的效果不会导出
- **Animation** 打勾才会导出动画;不导出动画就取消勾选

::: warning Blender 的坐标轴
Blender 是 **Z 轴朝上**,Unity 是 **Y 轴朝上**。

导出时 Blender 会自动转换,一般不用管。但如果模型导入后躺倒了,就是这里的问题 —— 检查导出设置里的 Up 是不是 `Y Up`。
:::

## 十、注意事项

1. **模型尺寸不对**:先看 Model 标签页的 Scale Factor,常见是差 100 倍。
2. **模型是粉色的**:Shader 不匹配。项目如果用的是 URP / HDRP,内置 Standard Shader 的材质不工作。要么升级材质到当前渲染管线,要么把材质换成自己建的。
3. **改不了 FBX 上的材质**:材质是内嵌的,先 Extract Materials 提取成独立 `.mat`。
4. **找不到动画**:检查 Animation 标签页 Import Animation,以及 Rig 标签页的 Animation Type 是否为 None。
5. **人形角色动画不能复用**:Rig 要设成 Humanoid 并配好 Avatar。
6. **勾了 Generated Colliders 后帧率掉**:Mesh Collider 很贵,移动物体换成 Box / Capsule / Sphere。
7. **不要随便开 Read / Write Enabled**:内存占用翻倍,只在程序化改网格时开。
8. **FBX 是只读资源**:不能直接加组件,要转成 Prefab。
9. **别用 `.blend` 直接导入**:走 FBX 更稳。
10. **改完导入设置记得点 Apply**,不然不生效。
