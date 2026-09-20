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
│     ├─ index.ts          # 主题入口
│     ├─ Layout.vue        # 包一层,给所有页面加背景层
│     ├─ SiteBackground.vue # 全屏背景:照片轮播 + 磨砂 + 靛紫渐变
│     ├─ SplitHome.vue     # 首页仪表盘
│     ├─ home.config.ts    # ★ 首页内容配置(改这里就够了)
│     └─ custom.css        # 玻璃拟态 + 配色(改主色看这里)
├─ index.md             # 首页
├─ about.md             # 关于
├─ notes/               # 笔记
│  └─ dotnet/          #   C# 笔记(为 Unity 准备,8 篇)
├─ projects/            # 项目
└─ public/              # 静态文件,原样复制到网站根目录
   ├─ bg.svg            # 默认背景图(换成自己的照片)
   └─ favicon.svg       # 浏览器标签页图标
```

## 图片怎么放(重点)

**所有图片都放在 `docs/public/` 目录里。** 引用时以 `/` 开头,把 `docs/public/` 这个前缀去掉:

| 文件实际位置 | 引用时写 |
| --- | --- |
| `docs/public/img/avatar.jpg` | `/img/avatar.jpg` |
| `docs/public/bg-1.jpg` | `/bg-1.jpg` |
| `docs/public/img/cover/notes.png` | `/img/cover/notes.png` |

> 常见错误:写成 `img/avatar.jpg`(少了开头的斜杠)或 `docs/public/img/avatar.jpg`(多带了前缀),
> 都会变成破图。

**首页的图和文字全部在 `docs/.vitepress/theme/home.config.ts` 里改**(不用碰组件代码):

```ts
export const homeConfig = {
  // 背景图:放几张贴几张,自动轮播
  backgroundImages: ['/img/bg-1.jpg', '/img/bg-2.jpg'],

  profile: {
    name: '乌鸦张嘴',
    avatar: '/img/avatar.jpg',   // 留空 '' 会显示名字首字
    bio: '……',
    stats: [...],
    links: [...],
  },

  entries: [
    { title: '笔记', desc: '…', link: '/notes/', cover: '/img/cover-notes.jpg', tag: 'Notes' },
    { title: '项目', desc: '…', link: '/projects/', cover: '/img/cover-projects.jpg', tag: 'Projects' },
  ],
}
```

**压缩很重要**:照片压到 300KB 以内、背景图 500KB 以内再放进来,不然首页打开要等很久。
在线压图工具搜「squoosh」就行。

留空字符串 `''` 也没事 —— 会用内置的靛紫渐变兜底,不会出现破图。

## 改配色

`docs/.vitepress/theme/custom.css` 最上面的变量:

```css
:root {
  --brand: #4f46e5;          /* 链接、高亮 */
  --brand-2: #6366f1;        /* 主按钮 */
  --brand-3: #a855f7;        /* 渐变用的紫 */
  --glass: rgba(255,255,255,0.45);   /* 玻璃卡片底色 */
  --glass-blur: blur(16px) saturate(150%);
}
```

## 改字体

默认正文是衬线体(宋体系),跟参考站一致。想换成无衬线,改 `custom.css` 里这一行:

```css
--vp-font-family-base: var(--site-font-sans);
```

## 换背景(免费)

背景照片和轮播都在 `docs/.vitepress/theme/home.config.ts` 的 `backgroundImages` 里改。
磨砂强度、渐变遮罩在 `SiteBackground.vue` 里的一条对应样式,想调淡调浓改 `--site-bg-veil`
那个数字(`SiteBackground.vue` 里的 `.site-bg__veil` 的 `background` 那行)。

不放任何背景图也行,会显示内置的靛紫渐变。


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
- [ ] **首页的头像、简介、统计数字、入口封面图** —— 全在 `docs/.vitepress/theme/home.config.ts`
- [ ] **背景照片** —— 放 `docs/public/img/`,写进 `home.config.ts` 的 `backgroundImages`
- [ ] `docs/public/favicon.svg` 想换的话直接替换文件(现在是靛紫渐变 + 一个「鸦」字)
- [ ] 想公开邮箱的话,加在 `docs/about.md` 的联系方式里

## 后面可以加的

- **本地搜索**:`config.mts` 的 `themeConfig` 里加一行

  ```ts
  search: { provider: 'local' },
  ```

  纯前端实现,不需要服务器。

- **标签 / 归档页**:用 VitePress 的 `createContentLoader` 自定义页面。
- **评论**:Giscus 或 Waline,都是把内容存在 GitHub Discussions / 自己的服务上。
