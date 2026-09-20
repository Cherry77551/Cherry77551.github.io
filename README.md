# 个人网站

记笔记 + 展示项目,淡绿色主题,部署在 GitHub Pages 上。

## 本地开发

项目在 WSL 里,先用 WSL 进去:

```bash
wsl -d Ubuntu
cd ~/website
```

Node 已经装好了(`~/.local/bin`,由 `~/.bashrc` 加进 PATH)。第一次在新终端里可以确认一下:

```bash
node -v   # 应该输出 v24.x
```

启动本地预览:

```bash
npm run dev
```

打开 http://localhost:5173 。改 `.md` 文件会自动刷新。

其他命令:

```bash
npm run build     # 构建到 docs/.vitepress/dist
npm run preview   # 预览构建结果
```

## 日常写东西

1. 在 `docs/notes/` 或 `docs/projects/` 下新建 `.md` 文件
2. 打开 `docs/.vitepress/config.mts`,把新页面加到 `sidebar` 里
3. `npm run dev` 看效果
4. 提交:

   ```bash
   git add .
   git commit -m "add: 新笔记"
   git push
   ```

   推上去后 GitHub Actions 会自动构建并发布,大概一两分钟生效。

## 目录结构

```text
docs/
├─ .vitepress/
│  ├─ config.mts        # 导航、侧边栏、站点信息
│  └─ theme/
│     ├─ index.ts         # 主题入口(注册首页组件)
│     ├─ SplitHome.vue    # 首页那两块大的「笔记 / 项目」入口
│     └─ custom.css       # 淡绿色主题 + 背景图(改配色就看这个文件)
├─ index.md             # 首页
├─ about.md             # 关于
├─ notes/               # 笔记
│  └─ dotnet/          #   C# 笔记(为 Unity 准备,8 篇)
├─ projects/            # 项目
└─ public/              # 静态文件,原样复制到网站根目录
   ├─ bg.svg            # 默认背景图(换成自己的就是改这里)
   └─ favicon.svg       # 浏览器标签页图标
```

## 改配色

`docs/.vitepress/theme/custom.css` 最上面的变量:

```css
:root {
  --vp-c-brand-1: #3f9d6d;   /* 链接、文字高亮 */
  --vp-c-brand-2: #348a5f;   /* 悬浮 */
  --vp-c-brand-3: #54b380;   /* 主按钮背景 */
  --vp-c-bg: rgba(247, 251, 248, 0.86);   /* 页面底色(半透明,让背景图透出来) */
  --vp-c-bg-alt: rgba(237, 245, 240, 0.9);
  --vp-c-divider: #dbeade;   /* 分隔线 */
}
```

`.dark { ... }` 里是深色模式的对应值。

## 换背景图

1. 把你的图片放进 `docs/public/`,例如 `docs/public/bg.jpg`
2. 打开 `docs/.vitepress/theme/custom.css`,把这一行改掉:

   ```css
   --site-bg-image: url('/bg.jpg');
   ```

   路径以 `/` 开头,对应的是 `docs/public/` 目录。

3. 想让图片更明显 / 更淡,调 `--site-bg-veil`(遮罩不透明度),数值越小图越清楚:

   ```css
   --site-bg-veil: rgba(247, 251, 248, 0.45);
   ```

4. 不想要背景图就写 `--site-bg-image: none;`

> 图片建议先在别处压缩到 300KB 以内再放进来,不然打开会慢。


## 上线部署(只需要做一次)

### 1. 在 GitHub 上建仓库

仓库名必须是 **`<你的用户名>.github.io`**,比如用户名是 `cherry`,仓库名就是 `cherry.github.io`。
只有这个名字,网址才是干净的 `https://cherry.github.io/`。

建成 **Public**(免费账号的 Pages 只对公开仓库开放)。

> 如果仓库名不是 `<用户名>.github.io`,网址会变成 `https://<用户名>.github.io/<仓库名>/`,
> 这时候要把 `docs/.vitepress/config.mts` 里的 `base: '/'` 改成 `base: '/<仓库名>/'`。

### 2. 关联远程仓库并推送

```bash
cd ~/website
git remote add origin git@github.com:<你的用户名>/<你的用户名>.github.io.git
git branch -M main
git push -u origin main
```

用 HTTPS 的话把地址换成 `https://github.com/<你的用户名>/<你的用户名>.github.io.git`。

WSL 里第一次 `git push` 可能需要配身份和 SSH key:

```bash
git config --global user.name "你的名字"
git config --global user.email "你的邮箱"
ssh-keygen -t ed25519 -C "你的邮箱"        # 一路回车
cat ~/.ssh/id_ed25519.pub                  # 把输出粘到 GitHub → Settings → SSH keys
```

### 3. 打开 Pages

仓库页面 → **Settings → Pages** → **Source** 选 **GitHub Actions**。

::: warning 别选错
一定要选 **GitHub Actions**,不要选 `Deploy from a branch`。
选错了 Actions 构建出来的站点不会被发布。
:::

### 4. 等它跑完

仓库页面 → **Actions** 标签页,能看到 "Deploy to GitHub Pages" 这个 workflow 在跑。
绿勾之后访问 `https://<你的用户名>.github.io/` 就能看到了。

## 需要改的占位内容

- [x] `docs/about.md`、`docs/projects/*.md` 里的 GitHub 链接(已填 `Cherry77551`)
- [x] `docs/.vitepress/config.mts` 里的 footer 名字
- [x] 站点名称/昵称:现在是 `乌鸦张嘴`,在 `docs/.vitepress/config.mts` 的 `title` 和 `footer.copyright`,以及 `docs/about.md` 的自我介绍
- [ ] 换背景图:`docs/public/` 里放图,改 `custom.css` 的 `--site-bg-image`(见上面「换背景图」)
- [ ] `docs/public/favicon.svg` 想换的话直接替换文件
- [ ] 山茶花图标:`docs/public/camellia.svg`,顶栏那个由 `config.mts` 的 `themeConfig.logo` 指定
- [ ] 首页那两块入口的文字在 `docs/.vitepress/theme/SplitHome.vue` 里的 `panels`
- [ ] 想公开邮箱的话,加在 `docs/about.md` 的联系方式里

## 后面可以加的

- **本地搜索**:`config.mts` 的 `themeConfig` 里加一行

  ```ts
  search: { provider: 'local' },
  ```

  纯前端实现,不需要服务器。

- **标签 / 归档页**:用 VitePress 的 `createContentLoader` 自定义页面。
- **评论**:Giscus 或 Waline,都是把内容存在 GitHub Discussions / 自己的服务上。
