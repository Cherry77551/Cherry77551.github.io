# 1. C# 与 .NET 生态

C# 生态最容易被初学者搞混的一点,是"C#"和".NET"经常被当成同一个东西交替使用,而实际上它们是分层的、可以分别演进的。这一篇从分层开始,把语言、运行时、框架、SDK、工具链、包管理这些概念串成一条完整的线索,最后落到每天都要敲的 `dotnet` CLI 和 `.csproj`。

## C#、.NET、CLR、SDK 的关系

先把四层的定义摆清楚:

- **C#**:一门编程语言。它只规定语法和语义(有什么关键字、`ref` 怎么用、模式匹配怎么写),不规定运行时怎么执行。C# 的编译器叫 **Roslyn**(`Microsoft.CodeAnalysis` 命名空间那一套 API)。
- **CLR(Common Language Runtime)**:运行时,负责加载程序集、JIT 编译、垃圾回收、类型安全校验、异常分发。它是 .NET 的"引擎"。
- **框架类库(Framework Class Library / BCL)**:随运行时一起发布的一大堆类型,比如 `System.String`、`System.Collections.Generic.List<T>`、`System.IO.File`。
- **SDK**:工具链的集合,包含 CLI(`dotnet`)、编译器、MSBuild、模板、包管理器,以及打包进去的运行时。

一个口语化但准确的对应关系:C# 之于 .NET,就像 Java 语言之于 JVM。语言可以换(你也能用 F#、VB.NET、IronPython 编译到 IL),运行时上的语言有很多;反过来 CLR 也只是众多运行时实现之一(还有 Mono、CoreRT、NAOT)。

```text
C# 源码 (.cs)
   │  Roslyn 编译器 (csc)
   ▼
IL + 元数据 (.dll, 程序集)
   │  CLR 加载, JIT 编译
   ▼
本机机器码 (x86-64 / arm64 ...)
```

::: tip
`IL`(Intermediate Language,中间语言)不是解释执行的字节码。.NET 的 IL 在方法**第一次被调用时**由 JIT 编译成真正的机器码,之后就是原生执行。所以 .NET 在稳态下的性能与 C++ 同一量级,而不是像纯解释型语言那样慢一个数量级。
:::

## 发展史:Framework → Core → .NET 5+

### .NET Framework 时代(2002–2019)

| 版本 | 年份 | 关键内容 |
| --- | --- | --- |
| .NET Framework 1.0 | 2002 | 随 Visual Studio .NET 发布,C# 1.0 |
| 2.0 | 2005 | 泛型、`Nullable<T>`、C# 2.0 |
| 3.5 | 2007 | LINQ、`var`、Lambda |
| 4.0 | 2010 | `dynamic`、`Task`、C# 4.0 |
| 4.5 – 4.8 | 2012–2019 | 异步 `async/await`、`Span` 的部分回落 |
| 4.8.1 | 2022 | **最后一个 .NET Framework 版本** |

.NET Framework 是 Windows 独占的,和 Windows 组件深度绑定(比如 ASP.NET WebForms、WPF、Windows Forms 都依赖它),而且它是**系统级组件**:一台机器只能装一个主版本线,升级要动操作系统级别的依赖。

### .NET Core 时代(2016–2020)

微软在 2014 年宣布开源 .NET,2016 年发布 .NET Core 1.0。目标很明确:跨平台、模块化、可并排安装(side-by-side)、开源、性能优先。

- .NET Core 1.0 / 1.1:能力还弱,生态不齐。
- .NET Core 2.0 / 2.1:引入 .NET Standard 2.0 兼容层,终于能大量复用旧库;2.1 是第一个 LTS。
- .NET Core 3.0 / 3.1:重新支持 Windows Forms 和 WPF,3.1 是最后一个带 "Core" 名字的 LTS。

### 统一时代:.NET 5 之后(2020–)

从 .NET 5 开始,微软去掉了 "Core" 后缀,把 Framework 之外的各条产品线(.NET Core、Mono、Xamarin)收敛到统一的品牌和运行时。版本号也跳过了 4.x 以避免和 Framework 混淆。

| 版本 | 发布时间 | 支持级别 | 备注 |
| --- | --- | --- | --- |
| .NET 5 | 2020-11 | STS | 统一品牌的第一步 |
| .NET 6 | 2021-11 | LTS | 首个完整统一版本,极重要 |
| .NET 7 | 2022-11 | STS | |
| .NET 8 | 2023-11 | LTS | 广泛使用,引入 Native AOT 打磨 |
| .NET 9 | 2024-11 | STS | |
| .NET 10 | 2025-11 | LTS | 当前推荐新项目使用的版本 |

::: warning
".NET 10" 和 ".NET Framework 4.8" 不是同一套东西的不同版本,它们是完全平行的两条产品线。你可以在同一台 Windows 机器上同时装 .NET Framework 4.8 和 .NET 10,互不影响。不要把 "Framework 4.x → .NET 5" 理解成"升级到了 v5"。
:::

## 为什么新项目不要用 .NET Framework

这是新手最容易踩的第一个坑——照着十年前的教程建了 .NET Framework 项目,然后发现 `dotnet` CLI 完全不管用。原因如下:

1. **平台锁死**:只能在 Windows 上跑。今天部署环境大概率要 Linux 容器。
2. **性能差距大**:现代 .NET 的 JIT、GC、`Span<T>`、SIMD 支持都远超 Framework 4.8。同一个 Web 服务吞吐量常常差 2–5 倍。
3. **语言特性受限**:Framework 项目**默认**最高只能用 C# 7.3 的语法(虽然可以通过 `<LangVersion>` 强行开高版本,但很多新语法依赖运行时的类型,比如 `record` 依赖 `IsExternalInit`,要自己补一个 shim)。
4. **不再有新功能**:4.8.1 之后只修安全漏洞,不再加特性。
5. **生态在迁移**:越来越多的 NuGet 包只发 `net8.0` / `net10.0` 目标,老项目根本装不上。

唯一的例外是**维护存量项目**——如果代码库里有大量 WebForms 或 WCF 依赖,迁移成本高,可以维持现状,但新写的服务应该独立出去。

## .NET Standard 是什么,还要不要

.NET Standard **不是**一个可以安装的运行时,而是一份**API 契约集合**。它规定"这个目标框架至少要有这些类型和方法"。

历史问题:在 .NET Core 早期,你写一个库,既要能在 .NET Framework 上用,又要能在 .NET Core 和 Xamarin 上用,那目标框架该填什么?填 `net45` 就不能用 Core 的 API,填 `netcoreapp2.0` 就不能被 Framework 引用。`netstandard2.0` 解决了这个问题——它是一份大家都实现过的交集。

| 标准 | 覆盖范围 |
| --- | --- |
| netstandard1.x | 极度受限,已废弃 |
| netstandard2.0 | .NET Framework 4.6.1+、.NET Core 2.0+ 都支持,**最重要的一档** |
| netstandard2.1 | .NET Core 3.0+ / Mono 支持,但 Framework 不支持 |

现在的结论:**写新库时用 `net10.0` 或 `net8.0` 就行,不需要 .NET Standard**。只有在必须同时兼容 .NET Framework 4.8 的少数场景(比如给老系统发 SDK),才退回到 `netstandard2.0`。

```xml
<!-- 兼容新老两代的多目标写法 -->
<PropertyGroup>
  <TargetFrameworks>net10.0;netstandard2.0</TargetFrameworks>
</PropertyGroup>
```

注意这里是复数的 `TargetFrameworks`(多目标),编译时会为每个 TFM 各产出一份 DLL。

## CLR 执行模型:从源码到机器码

流程拆开看:

1. **编译期**:Roslyn 把 `.cs` 编译成 IL 和元数据,打包成程序集 `.dll` / `.exe`。程序集里还带有类型信息(元数据),这是反射和跨程序集类型检查的基础。
2. **加载期**:CLR 的 Assembly Loader 解析程序集引用,校验版本和强名称。
3. **JIT 期**:每个方法第一次执行时,`JIT` 把它编译成当前 CPU 架构的机器码,放到内存中缓存。后续调用直接跳过去。
4. **运行期**:GC 管理对象生命周期;如果方法被判定为热点(在 .NET 7+ 的 OSR / Tiered Compilation 下),会被重新编译成优化程度更高的版本。

### AOT 与 ReadyToRun

| 方式 | 说明 | 场景 |
| --- | --- | --- |
| JIT(默认) | 运行时编译,启动要先热身 | 长期运行的服务 |
| ReadyToRun (R2R) | 发布时预编译一份机器码塞进程序集,JIT 仍保留作为兜底 | 缩短启动时间,体积温和增大 |
| Native AOT | 完全预编译,发布物是原生可执行文件,没有 CLR/JIT | CLI 工具、冷启动敏感的容器,牺牲反射/dynamic |

```bash
# 开启 ReadyToRun,启动更快,体积略大
dotnet publish -c Release -p:PublishReadyToRun=true

# 发布为不依赖运行时的单文件原生可执行程序
dotnet publish -c Release -r linux-x64 --self-contained true -p:PublishAot=true
```

Native AOT 的代价很大:不能随便用反射、`Assembly.LoadFrom`、动态代码生成,`System.Reflection.Emit` 基本不可用。所以不是所有项目都能切过去。

## LTS 与 STS 发布策略

从 .NET 6 起,微软固定为**每年 11 月发一个大版本**,节奏非常规律:

- **偶数版本 = LTS(Long Term Support)**,支持 3 年。
- **奇数版本 = STS(Standard Term Support,原称 Current)**,支持 18 个月。

支持期从发布日开始算。所以早一年发的 STS 和晚一年发的 LTS,到期时间可能很接近——这也是很多人建议"直接等 LTS"的原因。

::: tip
选版本的经验法则:生产环境用最新 LTS(.NET 10);想提前验证新特性、或者需要某个只在最新版才有的 API,用当前的 STS。**不要**在生产上跑一个即将 EOL 的版本,因为 EOL 后不再有安全补丁。
:::

升级节奏建议:每两年跟着一个 LTS 走。从 `net8.0` 到 `net10.0`,绝大多数项目只需要改 `.csproj` 里的一个字符串,然后重新构建、跑测试。

## SDK 与 Runtime 的区别

- **Runtime**:只包含能**运行**已编译程序所需的东西(CLR + 类库)。适合部署服务器。
- **SDK**:包含 Runtime + 编译器(`csc`)+ `dotnet` CLI + MSBuild + 模板 + NuGet 客户端。适用于开发和构建。

**开发机装 SDK 就够了**,SDK 已经内嵌对应版本的运行时。服务器上如果程序是 framework-dependent(目标机器需要有运行时),则只需要装 Runtime;如果是 self-contained 发布,连运行时都不用装。

```bash
# 查看本机已安装的所有 SDK 和运行时
dotnet --list-sdks
dotnet --list-runtimes
dotnet --info
```

```console
$ dotnet --list-sdks
10.0.100 [C:\Program Files\dotnet\sdk]
```

## 安装方式对比

| 方式 | 适用平台 | 优点 | 命令 |
| --- | --- | --- | --- |
| 官方安装包 | Win/macOS | 图形化,最稳 | 官网下载 |
| winget | Windows | 无需手动下载 | `winget install Microsoft.DotNet.SDK.10` |
| scoop | Windows | 用户态,免管理员 | `scoop install dotnet-sdk` |
| `dotnet-install` 脚本 | 全平台 | 可指定版本、可装到用户目录、适合 CI | 见下 |
| apt / dnf | Linux | 系统包管理 | 见下 |

Windows 上推荐 winget:

```bash
winget install Microsoft.DotNet.SDK.10
```

Linux 上两种主流做法。官方脚本不需要 root,能装到 `~/.dotnet`:

```bash
curl -sSL https://dot.net/v1/dotnet-install.sh -o dotnet-install.sh
chmod +x dotnet-install.sh
./dotnet-install.sh --channel 10.0 --install-dir "$HOME/.dotnet"
export DOTNET_ROOT="$HOME/.dotnet"
export PATH="$DOTNET_ROOT:$PATH"
```

Ubuntu 用 apt,注意先把微软的源加进去:

```bash
sudo apt-get update
sudo apt-get install -y dotnet-sdk-10.0
```

::: warning
Linux 发行版自带仓库里经常有 `dotnet-sdk` 包,但版本非常旧(有的还停留在 6.0)。用之前一定先 `dotnet --list-sdks` 确认版本,别直接 `apt install dotnet-sdk`。
:::

## 开发工具对比

| 工具 | 平台 | 优势 | 适合 |
| --- | --- | --- | --- |
| Visual Studio 2022 | Windows(有 macOS 版但已停更) | 调试器最强、WinForms/WPF 设计器、性能分析器、完整 IntelliSense | Windows 桌面、大型企业项目 |
| VS Code + C# Dev Kit | 全平台 | 轻量、启动快、多语言混用方便 | Web/API 开发、跨平台、脚本式工作流 |
| JetBrains Rider | 全平台 | 重构能力顶级、Unity 游戏开发首选、跨平台体验一致 | 从 IDEA/ReSharper 迁移的用户、Unity 项目 |

VS Code 方案需要装 C# Dev Kit 扩展(会自动带上 C# 扩展和 .NET Install Tool),它提供解决方案资源管理器、测试浏览器、调试支持。

## `dotnet` CLI 常用命令

CLI 是跨平台一致的核心工具,CI 里全靠它。下表是最常用的子命令:

| 命令 | 说明 | 示例 |
| --- | --- | --- |
| `new` | 用模板创建项目/解决方案/文件 | `dotnet new console -n HelloApp` |
| `restore` | 还原 NuGet 依赖(写 `obj/project.assets.json`) | `dotnet restore` |
| `build` | 编译项目 | `dotnet build -c Release` |
| `run` | 编译并运行 | `dotnet run --project src/App` |
| `test` | 运行测试项目 | `dotnet test` |
| `publish` | 产出可部署文件 | `dotnet publish -c Release -o ./out` |
| `add package` | 添加 NuGet 包引用 | `dotnet add package Newtonsoft.Json` |
| `add reference` | 添加项目引用 | `dotnet add reference ../Lib/Lib.csproj` |
| `remove package` | 移除包 | `dotnet remove package Newtonsoft.Json` |
| `list package` | 列出当前引用的包 | `dotnet list package` |
| `list package --outdated` | 列出有新版本的包 | `dotnet list package --outdated` |
| `list package --vulnerable` | 列出有已知漏洞的包 | `dotnet list package --vulnerable` |
| `format` | 按规则格式化代码 | `dotnet format` |
| `nuget` | NuGet 相关操作 | `dotnet nuget list source` |
| `sln` | 解决方案文件操作 | `dotnet sln add src/App/App.csproj` |
| `sdk check` | 检查 SDK/运行时更新 | `dotnet sdk check` |
| `workload` | 管理工作负载(MAUI、AOT 工具等) | `dotnet workload install maui` |

几个常用的完整流程:

```bash
# 新建解决方案 + 两个项目,并建立引用
dotnet new sln -n MySolution
dotnet new classlib -n Core
dotnet new console -n App
dotnet sln add Core/Core.csproj App/App.csproj
dotnet add App/App.csproj reference Core/Core.csproj

# 发布一个自包含的 Linux 单文件程序
dotnet publish -c Release -r linux-x64 --self-contained true -p:PublishSingleFile=true
```

::: details `dotnet build` 和 `dotnet run` 到底做了什么?
`dotnet build` 实际执行的是 `restore` + MSBuild 的 `Build` target,产物写到 `bin/Debug/net10.0/`。`dotnet run` 在你没加 `--no-build` 时,会先隐式 build 再启动进程,而且它把项目的工作目录作为当前目录。所以 `run` 比 `build` 慢一点点,但方便。CI 里应该用 `build` + `publish`,不要用 `run`。
:::

## 第一个程序

### Top-level statements(推荐)

从 C# 9 开始,可以省略 `Main` 方法,直接在文件顶部写语句:

```csharp
// Program.cs
using System;

Console.WriteLine("Hello, .NET 10!");

int result = Add(2, 3);
Console.WriteLine($"2 + 3 = {result}");

static int Add(int a, int b) => a + b;

// 输出:
// Hello, .NET 10!
// 2 + 3 = 5
```

注意 `static` 局部函数必须写在顶层语句之后(或前面也可以,但要求它们是函数声明,不参与顶层语句的顺序执行)。

### 传统写法

```csharp
namespace HelloApp;

internal static class Program
{
    private static void Main(string[] args)
    {
        Console.WriteLine("Hello, classic Main!");
    }
}
```

### 两者的关系

Top-level statements **不是**新运行时特性,而是**编译器语法糖**。编译器会生成一个隐藏的 `Program` 类,把顶层语句塞进它的 `Main` 方法里:

```csharp
// 编译器实际生成的等价代码(简化示意)
[CompilerGenerated]
internal static class Program
{
    private static void <Main>$(string[] args)
    {
        Console.WriteLine("Hello, .NET 10!");
        // ...
    }
}
```

因此约束是:一个项目里**只能有一个文件**使用顶层语句,且不能同时存在手写的 `Main`(除非项目设置 `StartupObject` 指定用哪个)。如果用了顶层语句又想访问 `args`,可以直接用 `args` 这个隐式变量。

## `namespace` 与 `using`

### 块式 vs file-scoped

```csharp
// 传统块式,嵌套会导致整块缩进
namespace MyApp.Data
{
    public class Repo { }
}

// C# 10+ file-scoped,整个文件都属于这个命名空间
namespace MyApp.Data;

public class Repo { }
```

file-scoped namespace 一个文件只能有一个,而且必须在所有其他声明之前。日常新代码一律推荐它。

### `global using`

避免每个文件重复写一堆 `using`。通常放在一个单独的 `GlobalUsings.cs` 里:

```csharp
// GlobalUsings.cs
global using System;
global using System.Collections.Generic;
global using System.Linq;
```

而且 `ImplicitUsings` 开启后,SDK 会自动为你隐式加入一组常见命名空间(Console 项目会有 `System`、`System.Linq` 等)。

### `using static` 与别名

```csharp
using static System.Math;          // 直接调用 Sqrt / PI
using Console = System.Console;    // 别名
using Vec = System.Collections.Generic.List<double>;

double x = Sqrt(PI);               // 不用写 Math.Sqrt
Console.WriteLine(x);
```

C# 12 起,`using` 别名可以指向**任意类型**,不再局限于命名空间和具名类型:

```csharp
using IntPair = (int X, int Y);                 // 元组
using Numbers = int[];                          // 数组
using Point = (double Lat, double Lon);

IntPair p = (1, 2);
Numbers nums = [1, 2, 3];
```

## `.csproj` 结构详解

SDK 风格的项目文件极其精简,因为绝大多数默认值由 SDK 提供:

```xml
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <LangVersion>latest</LangVersion>
    <RootNamespace>MyApp</RootNamespace>
    <AssemblyName>MyApp</AssemblyName>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <InvariantGlobalization>true</InvariantGlobalization>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\Core\Core.csproj" />
  </ItemGroup>

</Project>
```

逐个说明常用属性:

| 属性 | 作用 | 常用值 |
| --- | --- | --- |
| `TargetFramework` | 目标框架,决定可用 API 和运行时 | `net10.0` |
| `TargetFrameworks` | 多目标(复数) | `net10.0;netstandard2.0` |
| `OutputType` | 产物类型 | `Exe`、`WinExe`、`Library` |
| `Nullable` | 启用可空引用类型上下文 | `enable` / `disable` / `annotations` |
| `ImplicitUsings` | 自动引入常见命名空间 | `enable` / `disable` |
| `LangVersion` | C# 语言版本 | `latest`、`preview`、`13.0` |
| `RootNamespace` | 新建文件时的默认命名空间 | `MyApp` |
| `AssemblyName` | 输出程序集名称(决定 dll 文件名) | `MyApp` |
| `TreatWarningsAsErrors` | 警告视为错误 | `true` |
| `WarningsAsErrors` | 指定哪些警告升级为错误 | `CS8600;CS8602` |
| `GenerateDocumentationFile` | 生成 XML 文档 | `true` |
| `ImplicitUsings` | 见上 | |
| `InvariantGlobalization` | 去掉 ICU 依赖,减小体积(文化相关 API 受限) | `true` |
| `PublishSingleFile` | 发布成单文件 | `true` |
| `EnableTrimAnalyzer` | 开启裁剪分析告警 | `true` |

::: tip
`Directory.Build.props` 可以把上面的公共属性抽到仓库根目录,所有子项目自动继承,避免每个 `.csproj` 重复一遍:

```xml
<Project>
  <PropertyGroup>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <LangVersion>latest</LangVersion>
  </PropertyGroup>
</Project>
```
:::

## TFM 命名规则

TFM = Target Framework Moniker,就是 `TargetFramework` 里那个字符串。

```text
net10.0              → .NET 10,标准跨平台
net10.0-windows      → .NET 10 + Windows 专属 API(注册表、WPF 等)
net10.0-android      → MAUI Android
net10.0-ios          → MAUI iOS
netstandard2.0       → .NET Standard 2.0 契约
net48                → .NET Framework 4.8
```

规则要点:

1. `net` 前缀后面的数字是**主版本**;只有一位数字时会补 `.0`(比如 `net8.0` 其实是 8.0)。
2. `-windows`、`-android` 是**平台限定后缀**,加了这个后缀才能用平台专属 API,代价是彻底不可跨平台。
3. `-windows` 还可以带版本,如 `net10.0-windows10.0.19041.0`,指定所需的最低 Windows SDK 版本。
4. 生成的目标框架可以用 `NET10_0_OR_GREATER` 这类预定义常量做条件编译。

```csharp
#if NET10_0_OR_GREATER
    var span = CollectionsMarshal.AsSpan(list);
#else
    var array = list.ToArray();
#endif
```

## 编译产物:`bin` 与 `obj`

```text
MyApp/
├── MyApp.csproj
├── Program.cs
├── obj/                       # 中间产物,不提交到 git
│   ├── Debug/net10.0/
│   │   ├── MyApp.AssemblyInfo.cs
│   │   └── MyApp.csproj.FileListAbsolute.txt
│   └── project.assets.json    # NuGet 还原结果
└── bin/                       # 最终产物
    ├── Debug/net10.0/
    │   ├── MyApp.dll
    │   ├── MyApp.runtimeconfig.json
    │   └── MyApp.deps.json
    └── Release/net10.0/
```

- `obj/`:还原与编译的中间状态,`restore` 写的 `project.assets.json` 就在这里。删掉它下次构建会慢(要重新还原),但不会出错。
- `bin/`:可执行产物。注意**可执行文件其实是 `.dll`**,`MyApp.exe` 只是启动器(Windows 上)。
- `.runtimeconfig.json`:记录目标运行时和 GC 配置等。
- `.deps.json`:记录依赖的包和版本。

::: warning
`bin/` 和 `obj/` 都应该写进 `.gitignore`。`dotnet new gitignore` 可以生成一份针对 .NET 的标准忽略文件。把 `obj/project.assets.json` 提交上去会导致还原状态和同事不一致。
:::

### Debug 与 Release

| | Debug | Release |
| --- | --- | --- |
| 优化 | 关闭 | 开启(`/optimize+`) |
| 调试符号 | 生成完整 `.pdb`,行号精确 | 默认也生成,可配 `DebugType` |
| 条件编译 | `DEBUG` 常量定义 | `RELEASE`?不,是 `DEBUG` 不定义 |
| 典型用途 | 本地调试 | 发布部署 |

```csharp
#if DEBUG
    Console.WriteLine("调试构建");
#endif
```

日常开发用 Debug 就好;做性能测试一定要用 Release,Debug 的数值没有参考意义。默认情况下 `dotnet build` 是 Debug,`dotnet publish` 是 Release(其实 `publish` 默认 Release,而 `build` 默认 Debug)。

## 如何读异常堆栈

```csharp
try
{
    ProcessOrder(null!);
}
catch (Exception ex)
{
    Console.WriteLine(ex);
}

static void ProcessOrder(string order)
{
    Validate(order);
}

static void Validate(string order)
{
    throw new ArgumentNullException(nameof(order));
}
```

输出(节选):

```text
System.ArgumentNullException: Value cannot be null. (Parameter 'order')
   at Program.<<Main>$>g__Validate|0_1(String order) in /app/Program.cs:line 18
   at Program.<<Main>$>g__ProcessOrder|0_0(String order) in /app/Program.cs:line 12
   at Program.<Main>$(String[] args) in /app/Program.cs:line 4
```

读法:

1. **第一行**:异常类型 + 消息 + 参数名。这是**抛出点**。
2. **第一行 `at`**:最先执行到的那一帧,也就是 `Validate`。注意这是**自下而上**的调用顺序:最内层在最上面。
3. 每行格式:`命名空间.类.方法(参数类型 参数名) in 文件路径:line 行号`。有 `.pdb` 才有文件行号,否则只有方法名。
4. 顶层(上面例子的 `<Main>$`)是入口点。

```csharp
// 包装并保留内层异常
try
{
    ParseConfig(path);
}
catch (IOException ex)
{
    throw new InvalidOperationException($"无法读取配置 {path}", ex);
}
```

打印时会这样展示:

```text
System.InvalidOperationException: 无法读取配置 /etc/app.json
 ---> System.IO.FileNotFoundException: Could not find file '/etc/app.json'.
   ...
   --- End of inner exception stack trace ---
```

`--->` 后面就是 **InnerException**,它保留了原始错误。排查时一定要看最内层,那才是根因。

::: details 第一次机会异常(First-chance exception)是什么?
启用调试器的"异常设置"后,你会看到大量还没被捕获的异常通知。CLR 在异常**刚开始抛出**时,会先通知调试器一次,这就是"第一次机会";如果一路冒泡到没有 `catch`,才会再通知一次,叫"第二次机会"(second-chance),此时进程通常就崩了。很多框架内部用异常做正常控制流(比如枚举结束时的 `InvalidOperationException`),所以看到一堆第一次机会异常通知是正常的,不要被吓到——真正要关注的是第二次机会。
:::

## NuGet 基础

NuGet 是 .NET 的包管理器,相当于 Java 的 Maven、Node 的 npm。

### 搜索与安装

```bash
dotnet add package Newtonsoft.Json
dotnet add package Serilog --version 3.1.1
dotnet search System.Text.Json   # 需要较新 SDK;也可以直接上 nuget.org
```

包还原后的引用是写在 `.csproj` 里的:

```xml
<ItemGroup>
  <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
</ItemGroup>
```

### 版本号语义

NuGet 遵循 SemVer 2.0:`MAJOR.MINOR.PATCH`,可以带预发布标签。

```text
13.0.3               精确版本
[13.0.3]             精确版本(方括号显式表达)
1.2.*                允许补丁号浮动
[1.0,2.0)            >= 1.0 且 < 2.0
1.0.0-beta.1         预发布版
```

`MAJOR` 变更是破坏性变更,`MINOR` 是向后兼容的新功能,`PATCH` 是向后兼容的修复。

### 集中式包管理

多项目解决方案里,版本散落在各个 `.csproj` 中容易冲突。用 `Directory.Packages.props` 集中管理(C# 10 / .NET 6+ SDK 支持):

```xml
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <ItemGroup>
    <PackageVersion Include="Newtonsoft.Json" Version="13.0.3" />
    <PackageVersion Include="Serilog" Version="3.1.1" />
  </ItemGroup>
</Project>
```

之后每个 `.csproj` 里只写 `<PackageReference Include="Newtonsoft.Json" />`,不带版本。

### 常用源管理

```bash
dotnet nuget list source
dotnet nuget add source https://api.nuget.org/v3/index.json -n nuget.org
dotnet nuget locals all --clear
```

::: danger
不要在生产构建里依赖 preview 版本的包,除非你明确知道风险。预发布包的 API 随时可能变,而且 `--outdated` 不会提示你升级到稳定版。另外,发布到 NuGet 的包是**公开可搜索**的,不要往里塞公司内部密钥或私有代码。
:::

## 常见坑

**1. 装的是 Runtime 却想 `dotnet build`。**
报错 `The 'build' command is not available. Please check that the correct .NET SDK is installed.`。解决办法是装 SDK,而不是 Runtime。

**2. SDK 版本和 `TargetFramework` 不匹配。**
`TargetFramework` 写到 `net10.0` 但只装了 8.0 的 SDK,报 `NETSDK1045`。要么升级 SDK,要么把 TFM 改回 `net8.0`。可以用 `global.json` 固定 SDK 版本:

```json
{
  "sdk": {
    "version": "10.0.100",
    "rollForward": "latestFeature"
  }
}
```

**3. 混淆 `bin` 和 `obj` 的删除后果。**
删 `bin` 只需重新构建;删 `obj` 还要重新 restore,离线环境下可能失败(包缓存被清掉的话)。

**4. 用 `dotnet run` 做部署。**
`run` 会隐式构建,而且会锁定项目目录。CI 和部署应该 `publish`。

**5. `.NET Framework` 教程当饭吃。**
网上大量中文教程还在 `Console.WriteLine` 前面配 `using System;` + 手写 `Main`,并用 `packages.config` 管理包。这些不是"错误",但已经过时,别照抄。识别方法:看 `.csproj` 第一行是不是 `<Project Sdk="Microsoft.NET.Sdk">`——不是的话,那就是老项目。

**6. 顶层语句 + 手写 `Main` 冲突。**
同时存在时会报 `CS8802: Only one compilation unit can have top-level statements` 或入口点歧义。用 `<StartupObject>Ns.Class</StartupObject>` 指定,或者干脆统一风格。

**7. `Nullable` 没开就当没有可空引用类型。**
`<Nullable>enable</Nullable>` 不开,`string?` 写出来也不会有任何警告,可空注解形同虚设。新项目务必打开。

**8. 忽略 `dotnet list package --vulnerable`。**
依赖漏洞是供应链攻击的主要入口,建议放进 CI 定期跑。`--outdated` 也应该偶尔看一眼,尤其是 `MAJOR` 落后的包。
