# 11. 工程化实践

语言语法决定单个文件怎么写,工程化决定一个项目能不能长期维护:依赖怎么管、构建怎么复现、配置怎么分层、服务怎么装配、测试怎么写、日志怎么打、发布产物怎么裁。这篇笔记覆盖 .NET 从项目文件到 CI 的完整工具链。

## 项目与解决方案

### SDK 风格 `.csproj`

现代 .NET 项目使用 SDK 风格的项目文件:所有源文件默认被包含,不再需要逐个 `<Compile Include>`。

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>
</Project>
```

常用属性一览:

| 属性 | 作用 |
| --- | --- |
| `TargetFramework` | 单个目标框架,如 `net10.0`、`netstandard2.0` |
| `TargetFrameworks` | 多目标,分号分隔,如 `net8.0;net10.0` |
| `OutputType` | `Exe` / `WinExe` / `Library`(默认) |
| `Nullable` | `enable` / `disable` / `annotations` / `warnings` |
| `ImplicitUsings` | 自动 `global using` 常用命名空间 |
| `LangVersion` | 语言版本,`latest` / `preview` / `14` |
| `RootNamespace` | 默认命名空间(通常等于项目名) |
| `AssemblyName` | 输出程序集名,默认等于项目名 |
| `Version` | 程序集版本,同时派生 `FileVersion` / `InformationalVersion` |
| `TreatWarningsAsErrors` | 把警告当错误,CI 推荐开启 |
| `WarningsAsErrors` | 只把指定警告当错误,如 `CS8600` |
| `NoWarn` | 抑制指定警告,如 `CS1591` |
| `GenerateDocumentationFile` | 生成 XML 文档,配合 `///` 注释 |
| `InvariantGlobalization` | 移除 ICU 依赖,减小体积,但失去区域文化 |
| `PublishAot` | 启用 Native AOT 发布 |
| `ServerGarbageCollection` | 服务器 GC,吞吐优先 |
| `ImplicitUsings` | 隐式 `global using` |
| `EnableDefaultItems` | 控制是否自动包含源文件(默认 true) |

::: tip 文件包含规则
SDK 风格项目默认包含 `**/*.cs`(排除 `bin`、`obj`)。若某文件的命名空间与 `RootNamespace` 不同,不影响编译。想排除文件用 `<Compile Remove="..." />`。
:::

### 多目标编译

```xml
<TargetFrameworks>net8.0;net10.0</TargetFrameworks>
```

多目标意味着一次 `dotnet build` 会为每个 TFM 单独编译一份输出,分别放在 `bin/Debug/net8.0` 与 `bin/Debug/net10.0`。用条件编译区分:

```csharp
#if NET10_0_OR_GREATER
    Console.WriteLine("使用 .NET 10 专属 API");
#else
    Console.WriteLine("降级路径");
#endif
```

也可以在 MSBuild 里按 TFM 加属性:

```xml
<ItemGroup Condition="'$(TargetFramework)' == 'net8.0'">
  <PackageReference Include="System.Text.Json" Version="8.0.5" />
</ItemGroup>
```

### `Directory.Build.props` 与 `Directory.Packages.props`

`Directory.Build.props` 会被从项目目录向上逐级查找,第一个命中即生效,用于统一一群项目的属性:

```xml
<!-- 仓库根目录 Directory.Build.props -->
<Project>
  <PropertyGroup>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <LangVersion>latest</LangVersion>
    <Company>Cherry Notes</Company>
  </PropertyGroup>
</Project>
```

`Directory.Packages.props` 配合 `<ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>` 集中管理包版本:

```xml
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <ItemGroup>
    <PackageVersion Include="Serilog" Version="4.2.0" />
    <PackageVersion Include="xunit" Version="2.9.2" />
  </ItemGroup>
</Project>
```

各项目里只写 `<PackageReference Include="Serilog" />`,不写版本,避免版本漂移。

### 解决方案 `.sln` 与 `.slnx`

```bash
dotnet new sln -n MyApp
dotnet sln add src/MyApp/MyApp.csproj
```

传统 `.sln` 是文本格式但结构冗长;较新的 `.slnx` 是简洁的 XML:

```xml
<Solution>
  <Project Path="src/MyApp/MyApp.csproj" />
  <Project Path="tests/MyApp.Tests/MyApp.Tests.csproj" />
</Solution>
```

项目间引用用 `ProjectReference`,编译时会带上依赖并参与增量构建:

```xml
<ItemGroup>
  <ProjectReference Include="..\MyApp.Core\MyApp.Core.csproj" />
</ItemGroup>
```

直接引用已有 DLL 用 `<Reference Include="Legacy"><HintPath>...</HintPath></Reference>`,但这种方式没有传递依赖,不推荐。

### `bin/` 与 `obj/`

- `bin/` 存放编译输出,可删除,删掉后 `dotnet build` 会重新生成。
- `obj/` 存放中间产物:解析后的项目文件、NuGet 还原结果、编译中间文件。
- `obj/project.assets.json` 是 NuGet 还原的成果清单,记录了每个包被解析到的具体路径与依赖图。它不存在或与 `csproj` 不一致时,构建会先触发 restore。

何时需要 `dotnet clean`:

- 切换分支或 SDK 后出现"找不到类型/程序集"的诡异错误。
- 修改了 `Directory.Build.props` 或包版本但行为没变。
- 怀疑 `obj/` 缓存过期。极端情况直接删 `bin/` 与 `obj/` 重来更彻底。

### 本地工具

工具清单 `dotnet-tools.json` 让工具版本随仓库走:

```bash
dotnet new tool-manifest
dotnet tool install dotnet-ef
dotnet tool restore
```

```json
{
  "version": 1,
  "isRoot": true,
  "tools": {
    "dotnet-ef": { "version": "10.0.0", "commands": ["dotnet-ef"] }
  }
}
```

调用方式为 `dotnet tool run dotnet-ef` 或 `dotnet ef`(已 restore)。

## NuGet

### 包引用方式

`PackageReference` 是现代唯一推荐方式,还原信息写入 `obj/project.assets.json`:

```xml
<ItemGroup>
  <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
  <PackageReference Include="Serilog.Sinks.Console" Version="6.0.0" />
</ItemGroup>
```

`packages.config` 是旧版 .NET Framework 的写法,把包解压到 `packages/` 目录,不支持传递依赖与版本统一。

### 版本语义(SemVer)

`Major.Minor.Patch`:

- `Major`:不兼容的 API 变更。
- `Minor`:向后兼容的新功能。
- `Patch`:向后兼容的修复。
- 预发布:`1.0.0-beta.1`。

浮动版本:

```xml
<PackageReference Include="Serilog" Version="4.*" />
<PackageReference Include="Serilog" Version="[4.0.0,5.0.0)" />
```

浮动能自动拿补丁/次版本,但破坏可复现构建。配合锁文件才安全。

### 版本冲突与统一

当两个包依赖同一个库的不同版本,NuGet 采用"就近原则"并可能产生 `NU1605`(降级警告)。解决方式:

- 用 `Directory.Packages.props` 统一版本。
- 显式 `<PackageReference Include="X" Version="..." />` 提升版本。
- 在无解时用 `<NoWarn>NU1605</NoWarn>` 临时压制(不推荐)。

### 源配置

`nuget.config` 可以放在仓库或用户目录:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" protocolVersion="3" />
    <add key="internal" value="https://pkgs.example.com/v3/index.json" />
  </packageSources>
  <packageSourceCredentials>
    <internal>
      <add key="Username" value="ci" />
      <add key="ClearTextPassword" value="%NUGET_TOKEN%" />
    </internal>
  </packageSourceCredentials>
</configuration>
```

国内镜像示例:

```xml
<add key="nuget.org" value="https://nuget.cdn.azure.cn/v3/index.json" protocolVersion="3" />
```

`<clear />` 会清空继承来的源,确保构建环境一致。凭据用环境变量引用(`%VAR%`),不要提交明文。

### 常用命令

```bash
dotnet add package Serilog --version 4.2.0
dotnet list package --outdated
dotnet list package --vulnerable --include-transitive
dotnet remove package Serilog
```

`--outdated` 显示可升级项,`--vulnerable` 结合审计数据列出有已知漏洞的包。

### 锁文件与可复现构建

```xml
<PropertyGroup>
  <RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>
</PropertyGroup>
```

会生成 `packages.lock.json`。CI 上用:

```bash
dotnet restore --locked-mode
```

若依赖图与锁文件不一致会直接失败,防止"在我机器上能跑"。

### 打包自己的库

```xml
<PropertyGroup>
  <PackageId>Cherry.Extensions</PackageId>
  <Version>1.2.0</Version>
  <Authors>cherry</Authors>
  <Description>常用扩展方法集合</Description>
  <PackageLicenseExpression>MIT</PackageLicenseExpression>
  <RepositoryUrl>https://github.com/example/cherry</RepositoryUrl>
  <GeneratePackageOnBuild>false</GeneratePackageOnBuild>
</PropertyGroup>
```

```bash
dotnet pack -c Release -o ./artifacts
```

多数情况不需要手写 `.nuspec`;`dotnet pack` 会从 csproj 生成清单。`PackageReadmeFile`、`PackageTags`、`PackageIcon` 等可进一步丰富元数据。

## dotnet CLI 速查

| 分组 | 命令 | 说明 |
| --- | --- | --- |
| 项目 | `dotnet new console -n App` | 新建项目 |
| 项目 | `dotnet new sln -n App` | 新建解决方案 |
| 项目 | `dotnet sln add App/App.csproj` | 加入解决方案 |
| 项目 | `dotnet new gitignore` | 生成 .NET 版 .gitignore |
| 依赖 | `dotnet add package X` | 添加包 |
| 依赖 | `dotnet add reference ../Core/Core.csproj` | 添加项目引用 |
| 依赖 | `dotnet list package --outdated` | 检查过期包 |
| 依赖 | `dotnet list package --vulnerable` | 检查漏洞包 |
| 依赖 | `dotnet restore` | 还原依赖 |
| 构建 | `dotnet build -c Release` | 构建 |
| 构建 | `dotnet build --no-restore` | 跳过还原(CI 已 restore 时) |
| 构建 | `dotnet clean` | 清理输出 |
| 测试 | `dotnet test` | 运行测试 |
| 测试 | `dotnet test --collect:"XPlat Code Coverage"` | 带覆盖率 |
| 运行 | `dotnet run --project src/App` | 运行 |
| 运行 | `dotnet run -- --port 8080` | 传参给程序 |
| 运行 | `dotnet watch run` | 热重载 |
| 发布 | `dotnet publish -c Release -r linux-x64 --self-contained` | 自包含发布 |
| 发布 | `dotnet publish -p:PublishSingleFile=true` | 单文件 |
| 发布 | `dotnet publish -p:PublishAot=true` | Native AOT |
| 工具 | `dotnet tool install -g dotnet-ef` | 全局工具 |
| 工具 | `dotnet tool restore` | 还原本地工具 |
| 工具 | `dotnet format` | 格式化代码 |
| NuGet | `dotnet pack -c Release` | 打包 |
| NuGet | `dotnet nuget push *.nupkg -s nuget.org` | 推送包 |
| NuGet | `dotnet nuget locals all --clear` | 清空本地缓存 |

## 依赖注入

### 什么是 DI 与 IoC

控制反转(IoC)指对象的创建与装配权从调用方转移到容器。依赖注入(DI)是 IoC 的一种实现:对象只声明自己需要什么,由容器在构造时注入。.NET 内置了 `Microsoft.Extensions.DependencyInjection`,ASP.NET Core、Worker、控制台应用都能直接使用。

DI 带来的收益:依赖显式化、可测试(注入 mock)、生命周期集中管理、装配与实现解耦。

### 基本用法

```csharp
using Microsoft.Extensions.DependencyInjection;

var services = new ServiceCollection();
services.AddSingleton<IClock, SystemClock>();
services.AddScoped<IOrderRepository, EfOrderRepository>();
services.AddTransient<IOrderService, OrderService>();

using ServiceProvider provider = services.BuildServiceProvider();
var svc = provider.GetRequiredService<IOrderService>();
```

`AddSingleton` / `AddScoped` / `AddTransient` 的第三个泛型参数是"实现类型",第二个是"服务类型"。若用 `AddSingleton<Foo>()`,则服务类型与实现类型都是 `Foo`。

```csharp
// 等价写法
services.AddSingleton(typeof(IClock), typeof(SystemClock));
services.AddSingleton<IClock>(sp => new SystemClock(TimeProvider.System));
```

### 构造函数注入

```csharp
public class OrderService(IOrderRepository repo, ILogger<OrderService> logger) : IOrderService
{
    public void Place(Order order)
    {
        logger.LogInformation("下单 {OrderId}", order.Id);
        repo.Save(order);
    }
}
```

构造函数的参数即依赖声明。若某个依赖无法被容器解析,`GetRequiredService` 会抛 `InvalidOperationException`。

### 注册泛型服务

```csharp
services.AddScoped(typeof(IRepository<>), typeof(EfRepository<>));
```

```csharp
public interface IRepository<T> { T? Get(int id); }
public class EfRepository<T> : IRepository<T> { /* ... */ }
```

### 多个实现与 `IEnumerable<T>`

```csharp
services.AddSingleton<INotifier, EmailNotifier>();
services.AddSingleton<INotifier, SmsNotifier>();
services.AddSingleton<INotifier, PushNotifier>();

var notifiers = provider.GetServices<INotifier>();
Console.WriteLine(notifiers.Count()); // 输出: 3
```

注意 `GetService<INotifier>()` 只返回**最后注册**的那个,而 `GetServices<INotifier>()` 返回全部。顺序按注册顺序。

### 工厂委托与装饰器

```csharp
services.AddSingleton<IConnection>(sp =>
{
    var cfg = sp.GetRequiredService<IConfiguration>();
    return new SqlConnection(cfg.GetConnectionString("db")!);
});
```

装饰器没有内建支持,需要手写:

```csharp
services.AddScoped<IOrderService, OrderService>();
services.AddScoped<IOrderService>(sp =>
    new LoggingOrderService(
        sp.GetRequiredService<OrderService>(),
        sp.GetRequiredService<ILogger<LoggingOrderService>>()));
```

::: warning 装饰器注册顺序
`AddScoped<IOrderService>(sp => ...)` 会追加到已有注册之后,而 `GetRequiredService<IOrderService>()` 返回最后注册的,所以装饰器能生效;但 `GetServices<IOrderService>()` 会同时拿到内层与外层。要避免重复,可在装饰器注册前把内层改注册为具体类型 `OrderService`。
:::

### 生命周期详解

| 生命周期 | 语义 | 典型用途 |
| --- | --- | --- |
| Singleton | 整个应用一个实例 | 无状态服务、配置、缓存、`HttpClient` 工厂 |
| Scoped | 每个作用域一个实例 | 每请求的 DbContext、工作单元 |
| Transient | 每次解析都新建 | 轻量无状态服务、工厂 |

```csharp
using var scope = provider.CreateScope();
var repo = scope.ServiceProvider.GetRequiredService<IOrderRepository>();
// scope 释放时,scope 内创建的 IDisposable 服务会被 Dispose
```

对 `ServiceProvider` 本身调用 `CreateScope()` 相当于开启一个作用域。ASP.NET Core 的每个 HTTP 请求会自动创建一个作用域,`Scoped` 服务因此天然是"每请求一个"。

### 经典错误:捕获依赖

```csharp
// 错误:Singleton 持有 Scoped
public class BadCache
{
    private readonly IOrderRepository _repo; // Scoped
    public BadCache(IOrderRepository repo) => _repo = repo;
}

services.AddSingleton<BadCache>();
services.AddScoped<IOrderRepository, EfOrderRepository>();
```

在开启**作用域验证**的容器里会直接抛异常:

```csharp
var services = new ServiceCollection();
// ...
services.BuildServiceProvider(new ServiceProviderOptions
{
    ValidateScopes = true,
    ValidateOnBuild = true,
});
```

标准做法是向 Singleton 注入 `IServiceScopeFactory` / `IServiceProvider`,在需要时创建作用域:

```csharp
public class CorrectCache(IServiceScopeFactory scopeFactory)
{
    public void Refresh()
    {
        using var scope = scopeFactory.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IOrderRepository>();
        // 使用 repo
    }
}
```

### 反模式

服务定位器:到处 `provider.GetService<T>()`。它隐藏了依赖,使构造函数无法表达"我需要什么",也让测试更难,应只在框架级代码(中间件、工厂)中使用。

隐式依赖:通过静态类或属性访问外部服务,同样绕开了 DI 的显式契约。

::: danger 不要手动 `new` 需要依赖的类型
`new OrderService()` 会绕过容器,导致其依赖无法被注入,生命周期也不受管理。要么全部由容器创建,要么显式传入依赖。
:::

## 配置与选项

### 配置来源

```csharp
var builder = Host.CreateApplicationBuilder(args);
// 默认顺序:appsettings.json -> appsettings.{Env}.json -> 环境变量 -> 命令行
IConfiguration config = builder.Configuration;

string? conn = config.GetConnectionString("db");
string env = config["ASPNETCORE_ENVIRONMENT"] ?? "Production";
```

各来源的优先级:后加入的会覆盖先加入的。User Secrets 只在开发环境通过 `dotnet user-secrets` 管理:

```bash
dotnet user-secrets init
dotnet user-secrets set "ConnectionStrings:db" "Server=localhost;..."
```

这样敏感信息不进 Git。生产环境用环境变量 `ConnectionStrings__db`(双下划线表示层级)。

### `IOptions<T>` 家族

```csharp
public class SmtpOptions
{
    public string Host { get; set; } = "";
    public int Port { get; set; } = 25;
}

builder.Services.Configure<SmtpOptions>(builder.Configuration.GetSection("Smtp"));
```

| 接口 | 生命周期 | 重载配置 | 适用 |
| --- | --- | --- | --- |
| `IOptions<T>` | Singleton | 否 | 启动后不变的配置 |
| `IOptionsSnapshot<T>` | Scoped | 是 | 每请求重读,ASP.NET Core |
| `IOptionsMonitor<T>` | Singleton | 是,带变更通知 | 单例/后台服务需要热更新 |

```csharp
public class Mailer(IOptionsMonitor<SmtpOptions> monitor)
{
    public void Send() => Console.WriteLine(monitor.CurrentValue.Host);
}
```

### 绑定与校验

```csharp
builder.Services
    .AddOptions<SmtpOptions>()
    .Bind(builder.Configuration.GetSection("Smtp"))
    .ValidateDataAnnotations()
    .ValidateOnStart();
```

```csharp
public class SmtpOptions
{
    [Required]
    public string Host { get; set; } = "";

    [Range(1, 65535)]
    public int Port { get; set; } = 25;
}
```

`ValidateOnStart` 让配置错误在启动时暴露,而不是第一次使用时。也可以用 `Validate(o => o.Port > 0, "Port 必须为正")` 自定义规则。

## 日志

### `ILogger<T>` 与级别

```csharp
public class Worker(ILogger<Worker> logger)
{
    public void Run()
    {
        logger.LogTrace("trace");
        logger.LogDebug("debug");
        logger.LogInformation("处理 {Count} 条记录", 10);
        logger.LogWarning("重试 {Attempt}", 2);
        logger.LogError(new IOException("io"), "读取失败");
        logger.LogCritical("即将关闭");
    }
}
```

级别从低到高:`Trace` < `Debug` < `Information` < `Warning` < `Error` < `Critical`。低于阈值的日志不会输出。

### 结构化日志与消息模板

占位符必须用**命名参数**,不能用字符串插值:

```csharp
// 正确:消息模板保留结构,参数单独传递
logger.LogInformation("用户 {UserId} 在 {Time} 登录", userId, DateTime.UtcNow);

// 错误:插值后被拍平成字符串,丢失结构化字段
logger.LogInformation($"用户 {userId} 登录");
```

用插值会触发分析器警告(CA2254),并且序列化器无法按字段索引。结构化日志让日志系统能按 `UserId` 过滤、聚合、告警。

### `LoggerMessage` 源生成器

```csharp
public static partial class Log
{
    [LoggerMessage(EventId = 1001, Level = LogLevel.Information,
        Message = "订单 {OrderId} 已提交,金额 {Amount}")]
    public static partial void OrderSubmitted(ILogger logger, int orderId, decimal amount);
}
```

源生成器在编译期生成 `IsEnabled` 检查与参数打包代码,避免每次调用分配数组与装箱,适合高频日志。

### 日志作用域

```csharp
using (logger.BeginScope("OrderId={OrderId}", order.Id))
{
    logger.LogInformation("开始处理");
    logger.LogInformation("完成处理");
}
```

作用域内的所有日志都会带上 `OrderId` 字段,便于串联一次业务流程。

### 日志提供程序

内置提供程序包括 Console、Debug、EventSource、EventLog。生产环境常用 Serilog 或 NLog:

```csharp
builder.Logging.ClearProviders();
builder.Services.AddSerilog(new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File("logs/app-.log", rollingInterval: RollingInterval.Day)
    .CreateLogger());
```

## 单元测试

### xUnit 入门

```csharp
public class CalculatorTests
{
    [Fact]
    public void Add_ReturnsSum()
    {
        var calc = new Calculator();
        Assert.Equal(5, calc.Add(2, 3));
    }

    [Theory]
    [InlineData(2, 3, 5)]
    [InlineData(-1, 1, 0)]
    [InlineData(0, 0, 0)]
    public void Add_Parameterized(int a, int b, int expected)
    {
        var calc = new Calculator();
        Assert.Equal(expected, calc.Add(a, b));
    }
}
```

`MemberData` 从静态属性提供数据:

```csharp
public static IEnumerable<object[]> Cases => new[]
{
    new object[] { 1, 1, 2 },
    new object[] { 2, 2, 4 },
};

[Theory]
[MemberData(nameof(Cases))]
public void Add_FromMemberData(int a, int b, int expected)
    => Assert.Equal(expected, new Calculator().Add(a, b));
```

共享 fixture:

```csharp
public class DatabaseFixture : IDisposable
{
    public DatabaseFixture() { /* 建立连接 */ }
    public void Dispose() { /* 释放 */ }
}

public class RepoTests : IClassFixture<DatabaseFixture>
{
    private readonly DatabaseFixture _fixture;
    public RepoTests(DatabaseFixture fixture) => _fixture = fixture;
}
```

- `IClassFixture<T>`:同一测试类内共享。
- `ICollectionFixture<T>`:跨测试类共享,配合 `[Collection("name")]`。

### 断言

```csharp
// xUnit 内置
Assert.Equal(expected, actual);
Assert.True(condition);
Assert.Null(value);
Assert.Throws<ArgumentException>(() => DoWork());
await Assert.ThrowsAsync<InvalidOperationException>(() => DoWorkAsync());

// FluentAssertions
actual.Should().Be(expected);
result.Should().BeGreaterThan(0);
action.Should().Throw<ArgumentException>().WithMessage("*invalid*");
list.Should().HaveCount(3).And.Contain(2);
```

FluentAssertions 的失败信息更可读,链式写法也更贴近自然语言。

### Mock

用 NSubstitute 为例:

```csharp
var repo = Substitute.For<IOrderRepository>();
repo.Get(1).Returns(new Order { Id = 1 });
var sut = new OrderService(repo);

sut.Place(new Order { Id = 1 });

repo.Received(1).Save(Arg.Is<Order>(o => o.Id == 1));
```

Moq 的等价写法:

```csharp
var repo = new Mock<IOrderRepository>();
repo.Setup(r => r.Get(1)).Returns(new Order { Id = 1 });
repo.Verify(r => r.Save(It.IsAny<Order>()), Times.Once);
```

### 命名规范与 AAA

```csharp
// 方法名_场景_期望行为
[Fact]
public void Withdraw_WhenBalanceInsufficient_ThrowsInvalidOperation() { }

[Fact]
public void Withdraw_WhenAmountPositive_DecreasesBalance() { }
```

AAA 结构:

```csharp
[Fact]
public void Discount_ForVipAcrossThreeYears_AppliesTwentyPercent()
{
    // Arrange
    var pricing = new Pricing();

    // Act
    decimal price = pricing.Discount(100m, isVip: true, years: 3);

    // Assert
    Assert.Equal(80m, price);
}
```

### 测试项目结构与异步

建议每个生产项目配一个 `*.Tests` 项目,镜像命名空间。测异步方法直接用 `async Task`:

```csharp
[Fact]
public async Task FetchAsync_ReturnsContent()
{
    var client = new FakeClient("hello");
    string text = await new Fetcher(client).FetchAsync();
    Assert.Equal("hello", text);
}
```

测依赖时间的代码用 `TimeProvider`:

```csharp
public class Aging(TimeProvider clock)
{
    public bool IsExpired(DateTimeOffset created, TimeSpan ttl)
        => clock.GetUtcNow() - created > ttl;
}

var fake = new FakeTimeProvider(new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero));
var aging = new Aging(fake);
fake.Advance(TimeSpan.FromHours(2));
Assert.True(aging.IsExpired(created, TimeSpan.FromHours(1)));
```

### 覆盖率与 `dotnet test`

```bash
dotnet test --collect:"XPlat Code Coverage"
dotnet test --filter "FullyQualifiedName~OrderService"
dotnet test --logger "console;verbosity=detailed"
dotnet test --blame-hang --blame-hang-timeout 60s
```

`coverlet` 常以 MSBuild 包形式集成,输出 `coverage.cobertura.xml`。注意覆盖率是手段不是目标,追求 100% 往往得到无意义的断言。

::: warning 测试里的时间与随机
直接用 `DateTime.Now`、`Random`、`Guid.NewGuid()` 会让测试不可复现。把它们抽象成 `TimeProvider`、`IRandom`、`IGuidProvider`,测试时注入可控实现。
:::

## 代码质量与分析器

### `.editorconfig`

```ini
root = true

[*.cs]
indent_style = space
indent_size = 4
end_of_line = lf
charset = utf-8

dotnet_style_qualification_for_field = false:warning
csharp_prefer_braces = true:silent
dotnet_diagnostic.CA1822.severity = error
dotnet_diagnostic.CA2007.severity = none
```

`dotnet format` 会按 `.editorconfig` 修复格式问题:

```bash
dotnet format
dotnet format --verify-no-changes   # CI 中校验
```

### 分析器

.NET SDK 自带 `Microsoft.CodeAnalysis.NetAnalyzers`,规则以 `CAxxxx` 编号。常用调控:

```xml
<PropertyGroup>
  <AnalysisLevel>latest-recommended</AnalysisLevel>
  <AnalysisMode>Recommended</AnalysisMode>
  <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
  <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>
</PropertyGroup>
```

- `TreatWarningsAsErrors` 适合 CI,但在本地开发可能太严,通常只对特定规则开启。
- `WarningsAsErrors` 可指定 `CS8600;CS8602` 等具体编号。
- `NoWarn` 用于压制确认无意义的警告。

### 可空性

```xml
<Nullable>enable</Nullable>
```

```csharp
public string? FindName(int id);        // 可能返回 null
public string GetName(int id);          // 调用方无需判空
```

可空注解是 API 契约的一部分:调用方在开启可空上下文时能获得准确提示。库作者应认真标注,`null` 该标注就标注,不要用 `null!` 掩盖问题。

### 源生成器

源生成器在编译期读取代码并生成补充代码,解决"运行时反射慢、AOT 不友好"的问题:

```csharp
// System.Text.Json 的编译期序列化
[JsonSerializable(typeof(Order))]
internal partial class OrderJsonContext : JsonSerializerContext { }

string json = JsonSerializer.Serialize(order, OrderJsonContext.Default.Order);
```

```csharp
// 编译期生成正则
[GeneratedRegex(@"^\d{4}-\d{2}-\d{2}$")]
private static partial Regex DateRegex();
```

日志的 `[LoggerMessage]` 也是源生成器。它的价值在于:无反射、可裁剪、无运行时编译,是 Native AOT 的必备基础。

## 构建与发布

### `dotnet publish` 常用参数

| 参数 | 作用 |
| --- | --- |
| `-c Release` | 发布配置 |
| `-r linux-x64` | 指定 RID,生成平台特定产物 |
| `--self-contained` | 自包含,带上运行时 |
| `--no-self-contained` | 框架依赖(默认) |
| `-p:PublishSingleFile=true` | 合并为单文件 |
| `-p:PublishTrimmed=true` | 裁剪未使用代码 |
| `-p:PublishReadyToRun=true` | 预编译提升启动速度 |
| `-p:PublishAot=true` | Native AOT |
| `-o ./publish` | 输出目录 |

### 框架依赖 vs 自包含

- 框架依赖:体积小(几十 KB 到几 MB),但目标机必须装对应运行时。适合容器与受控环境。
- 自包含:体积大(60~120 MB),开箱即用。适合分发桌面工具。
- 单文件:`PublishSingleFile` 把托管程序集打包进一个可执行文件,但运行时可能仍解压到临时目录(除非同时 AOT)。

### 裁剪与 AOT 的风险

```xml
<PublishTrimmed>true</PublishTrimmed>
<TrimMode>partial</TrimMode>
```

裁剪会移除"看似未被引用"的代码,而反射、动态类型、序列化恰恰依赖运行时才能发现的引用。症状是发布后才在运行时抛 `MissingMethodException`。对策是使用源生成器序列化,并配置 `TrimmerRootAssembly` 或 `<DynamicDependency>`。

Native AOT:

```bash
dotnet publish -c Release -r linux-x64 -p:PublishAot=true
```

优点:启动几乎瞬时、内存低、无 JIT。限制:不支持动态加载程序集、`Reflection.Emit`、部分反射;不能与所有库共存;编译时间显著变长。适合 CLI 工具、无服务器函数、边缘场景。

### Docker 多阶段构建

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY *.sln .
COPY src/App/App.csproj src/App/
RUN dotnet restore src/App/App.csproj
COPY . .
RUN dotnet publish src/App/App.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "App.dll"]
```

先复制 `csproj` 再 `restore`,能让 NuGet 层在源码变化时命中缓存。运行时镜像用 `aspnet`(含 ASP.NET Core)或 `runtime`(纯控制台)。

### GitHub Actions CI

```yaml
name: ci
on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: 10.0.x
      - run: dotnet restore --locked-mode
      - run: dotnet build -c Release --no-restore
      - run: dotnet test -c Release --no-build --collect:"XPlat Code Coverage"
```

`--locked-mode` 保证依赖可复现,`--no-restore` / `--no-build` 复用上一步产物。

## 调试与诊断

### 调试技巧

- 条件断点:右键断点设置条件,如 `order.Id == 42`。
- 命中次数:只在第 N 次命中时暂停,适合循环内定位。
- 即时窗口(Immediate Window):运行期执行表达式,可调用方法。
- `DebuggerDisplay`:定制对象在调试器里的显示。

```csharp
[DebuggerDisplay("Id={Id}, Total={Total}")]
public class Order
{
    public int Id { get; set; }
    public decimal Total { get; set; }
}
```

```csharp
if (Debugger.IsAttached)
    Debugger.Break(); // 只在挂调试器时中断
```

### `Debug` 与 `[Conditional]`

```csharp
Debug.WriteLine($"value = {value}");
```

```csharp
[Conditional("DEBUG")]
void LogDebugInfo(string message) => Console.WriteLine(message);
```

`[Conditional]` 标记的方法在未定义该符号时,连调用点都会被编译器移除,零开销。

### 日志优先

并发与生产环境的问题无法用断点复现。此时应依赖结构化日志、`EventSource`、`dotnet-counters`、`dotnet-trace`、`dotnet-dump` 等工具。断点会暂停线程、改变时序,反而掩盖竞态。

```bash
dotnet-counters monitor --process-id 1234
dotnet-trace collect --process-id 1234
dotnet-dump collect --process-id 1234
```

## 代码组织

### 命名空间与分层

约定:命名空间与文件夹层级一致,`RootNamespace` 通常是项目名。分层建议按职责划分,如 `Domain` / `Application` / `Infrastructure` / `Api`,而不是按技术类型堆在一个大目录。

### `internal` 与测试

默认成员是 `internal` 时,测试项目无法访问。用 `InternalsVisibleTo` 开放:

```xml
<ItemGroup>
  <AssemblyAttribute Include="System.Runtime.CompilerServices.InternalsVisibleTo">
    <_Parameter1>MyApp.Tests</_Parameter1>
  </AssemblyAttribute>
</ItemGroup>
```

或写在代码里:

```csharp
[assembly: InternalsVisibleTo("MyApp.Tests")]
```

::: tip 变更签名
`InternalsVisibleTo` 使用简单程序集名即可;若目标程序集有强名称,需要提供完整公钥。
:::

### `.gitignore`

.NET 项目至少忽略:

```text
bin/
obj/
*.user
*.suo
.vs/
.vscode/
artifacts/
TestResults/
*.nupkg
.idea/
```

用 `dotnet new gitignore` 生成官方模板可覆盖绝大多数情况。

### 文档注释

```csharp
/// <summary>
/// 计算订单的最终金额,包含折扣与税费。
/// </summary>
/// <param name="order">要计算的订单,不能为 null。</param>
/// <param name="includeTax">是否包含税费。</param>
/// <returns>最终金额,已四舍五入到分。</returns>
/// <exception cref="ArgumentNullException"><paramref name="order"/> 为 null 时抛出。</exception>
/// <example>
/// <code>
/// decimal total = Calculator.Total(order, includeTax: true);
/// </code>
/// </example>
public static decimal Total(Order order, bool includeTax) { /* ... */ }
```

开启 `<GenerateDocumentationFile>true</GenerateDocumentationFile>` 后,编译器会为公开成员生成 XML 文档,并在缺少注释时给出 `CS1591` 警告。

## 常见坑

1. **`TreatWarningsAsErrors` 打开后,`CS1591` 等文档警告会让本地构建失败**。要么补齐 `///` 注释,要么用 `<NoWarn>CS1591</NoWarn>`,不要用 `#pragma` 到处散落。

2. **`ImplicitUsings` 会隐藏 `using`**。新项目里看不到 `using System.Linq`,但代码能编译。跨项目复制代码时常因此困惑。

3. **`PackageReference` 的浮动版本破坏可复现构建**。`4.*` 在某天拉到新版本后行为可能不同,CI 必须配合 `packages.lock.json` 与 `--locked-mode`。

4. **`Scoped` 注入 `Singleton` 是运行时炸弹**。默认不校验时不会报错,直到请求结束时发现对象已被释放。CI 与开发环境应开启 `ValidateScopes`。

5. **`IOptionsSnapshot` 不能注入到 Singleton**。它是 Scoped,注入到 Singleton 就构成捕获依赖。需要热更新时用 `IOptionsMonitor`。

6. **`HttpClient` 直接用 `new` 会耗尽套接字**。应使用 `IHttpClientFactory` 或 `AddHttpClient`,由工厂管理连接池与 DNS 刷新。

7. **日志用字符串插值会丢失结构**。`logger.LogInformation($"...")` 触发 CA2254,序列化后无法按字段查询,高基数参数还会拖慢性能。

8. **`dotnet publish` 的 `PublishTrimmed` 会在运行时暴露反射问题**。裁剪错误通常不在构建期报出,部署后才崩。发布前务必在目标 RID 上跑一遍冒烟测试。

9. **Docker 构建时先 `COPY . .` 再 `restore` 会让 NuGet 缓存全部失效**。正确顺序是先复制 `csproj` 与解决方案文件,`restore` 之后再复制源码。

10. **`dotnet clean` 不能清掉 NuGet 全局缓存**。缓存问题需要 `dotnet nuget locals all --clear`,而 `obj/` 过期则要手动删除。

11. **`Directory.Build.props` 是从项目目录向上找第一个命中就停**,嵌套目录里再放一个会截断继承,导致父级配置失效。

12. **`services.GetService<T>()` 与 `GetServices<T>()` 语义不同**。前者返回最后注册的单个实例,后者返回所有注册,混用会导致只拿到一部分实现。

13. **User Secrets 只在开发机有效**。部署到生产不会自动读取,生产必须用环境变量或密钥管理服务。

14. **`Debug.WriteLine` 在 Release 下会被移除**,不要用它做生产诊断;需要生产可见的输出应走 `ILogger`。

15. **测试依赖 `DateTime.Now` / `Random` 不可复现**。引入 `TimeProvider` 等可注入的抽象,否则测试会间歇性失败。

16. **`GenerateDocumentationFile` 生成的 XML 不会自动被打进 NuGet 包**。需要设置 `<PackageReadmeFile>`、`<DocumentationFile>` 并确保 `dotnet pack` 包含它,否则 IDE 看不到库的文档提示。
