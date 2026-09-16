# WSL 常用技巧

在 Windows 上做 Linux 开发的一些经验,记录一下免得每次都去搜。

## 传文件

Windows 的盘符在 WSL 里挂在 `/mnt/` 下面:

```bash
cp ~/report.pdf /mnt/c/Users/你的用户名/Desktop/
```

反过来把文件拷进 WSL 家里:

```bash
cp /mnt/c/Users/你的用户名/Downloads/data.csv ~/work/
```

## 在资源管理器里打开当前目录

```bash
explorer.exe .
```

Windows 11 的文件管理器地址栏直接输 `\\wsl.localhost\Ubuntu\home\你的用户名` 也能进。

## 从 Windows 直接跑 WSL 里的命令

在 PowerShell 里:

```powershell
wsl -d Ubuntu -- bash -lc "cd ~/website && npm run build"
```

## 性能:项目别放在 /mnt 下

Windows 盘(`/mnt/c/...`)是跨文件系统访问的,`npm install` 这种大量小文件读写的操作会慢好几倍。
项目放在 Linux 自己的文件系统里(`~/` 下面),快很多。

一个对比感受:同样装一次前端依赖,`/mnt/c/` 下可能要几分钟,`~/` 下几十秒。

## 有个坑:localhost 代理

WSL 默认是 NAT 网络模式,Windows 上开着的代理(比如 127.0.0.1:7890)在 WSL 里用 `localhost` 是访问不到的。

如果用代理,要在 WSL 里指向 Windows 宿主机的 IP:

```bash
# 拿到宿主机 IP
ip route show default | awk '{print $3}'
```

或者在 Windows 用户目录建 `.wslconfig`,开镜像网络模式(Windows 11 22H2+):

```ini
[wsl2]
networkingMode=mirrored
```

这样 WSL 里就能直接用 `localhost` 访问 Windows 的服务了。

## 中文输出乱码

在 PowerShell 里调 `wsl` 命令时,先设一下编码:

```powershell
$env:WSL_UTF8=1
```
