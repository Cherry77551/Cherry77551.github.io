# 个人网站

| | |
| --- | --- |
| **类型** | 个人站点 |
| **技术栈** | VitePress、Markdown、GitHub Actions、GitHub Pages |
| **状态** | 已上线,还在改 |
| **源码** | [GitHub](https://github.com/Cherry77551/Cherry77551.github.io) |

## 为什么要搭

两个原因。

一是笔记散得到处都是 —— 有的躺在本地 txt 里,有的夹在聊天记录中间,
想找的时候翻半天。需要一个地方,能随手加一篇,还能自动生成目录。

二是做过的项目没地方摆,别人问起来只能说"在我电脑上"。

又不想花钱买服务器,也不想每次改完手动传一遍文件。

## 最后怎么定的

一开始想手写 HTML,写了两页就放弃了 —— 每加一篇笔记都要复制一遍页面结构,太蠢。

后来选了 [VitePress](https://vitepress.dev/),理由挺实在:

- 一篇笔记就是一个 Markdown 文件,新建文件就算加了一篇,不用碰 HTML
- 侧边栏、上一篇 / 下一篇、右边的目录,全都自动生成
- 改主题色就是改几个 CSS 变量
- 构建出来是纯静态文件,扔哪儿都能跑

## 具体怎么做的

### 目录

```text
website/
├─ docs/
│  ├─ .vitepress/
│  │  ├─ config.mts        # 导航、侧边栏
│  │  └─ theme/
│  │     ├─ SplitHome.vue  # 首页那两块入口
│  │     └─ custom.css     # 淡绿色主题 + 背景图
│  ├─ index.md
│  ├─ about.md
│  ├─ notes/
│  └─ projects/
└─ .github/workflows/
   └─ deploy.yml           # 自动部署
```

### 配色

VitePress 把颜色都抽成了 CSS 变量,所以改主题不用动组件代码,覆盖变量就行:

```css
:root {
  --vp-c-brand-1: #3f9d6d;   /* 链接、文字高亮 */
  --vp-c-brand-3: #54b380;   /* 主按钮 */
  --vp-c-bg: rgba(247, 251, 248, 0.86);  /* 半透明,让背景图透出来 */
}
```

深色模式在 `.dark` 里另配一套,思路是把品牌色提亮,底色压到接近黑绿。

首页那两块入口是自己写的 Vue 组件,背景图也是可替换的 ——
把图丢进 `docs/public/` 再改一行变量就行。

### 自动部署

`.github/workflows/deploy.yml` 干三件事:

1. 盯着 `main` 分支,有 push 就触发
2. 用 Node 构建,产物出到 `docs/.vitepress/dist`
3. 把这个目录发布到 GitHub Pages

所以日常就三步:

```bash
git add .
git commit -m "add: 新笔记"
git push
```

一两分钟后网站就更新了。

## 踩过的坑

**仓库名必须是 `<用户名>.github.io`**,少一个字母都不行。否则 Github 不认,
会当成普通项目仓库,网址会多一层路径,`config.mts` 里的 `base` 也得跟着改。
我一开始账户名和仓库名拼错了一个字母,卡了半天。

**Pages 的 Source 得选 GitHub Actions。** 默认是「从分支部署」,
它会用 Jekyll 把你的 README 渲染成一个白底黑字的页面,而且会**覆盖**掉 Actions 的产物。
我明明部署成功却看到个莫名其妙的页面,就是这个原因。

**缓存。** 第一次部署完 CDN 要等一两分钟,浏览器自己也有缓存,记得 `Ctrl` + `F5` 强刷。

## 以后想加的

- 本地搜索(`config.mts` 里加一行 `search: { provider: 'local' }` 就行)
- 笔记的标签和归档页
- 等 Unity 学出点东西,把项目区填满
