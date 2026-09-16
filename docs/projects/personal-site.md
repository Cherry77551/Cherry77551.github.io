# 个人网站

| | |
| --- | --- |
| **类型** | 个人站点 |
| **技术栈** | VitePress、Markdown、GitHub Actions、GitHub Pages |
| **状态** | 已上线,持续更新 |
| **源码** | [GitHub](https://github.com/Cherry77551/Cherry77551.github.io) |

## 想做的东西

需要一个地方放两类内容:

- **笔记** —— 学习记录,要能快速新增、自动生成目录
- **项目** —— 展示作品,要能让别人直接访问

同时不想花钱买服务器,也不想每次改完还要手动上传文件。

## 怎么选的

试过直接手写 HTML,但记笔记太痛苦,每加一篇都要复制一遍页面结构。

后来选 VitePress,原因很简单:

- 每一页就是一个 Markdown 文件,**新增内容 = 新建文件**,不用碰 HTML
- 侧边栏、上一篇/下一篇、右侧目录都是自动的
- 主题色改几个 CSS 变量就行
- 构建出来是纯静态文件,任何静态托管都能放

## 怎么实现的

### 目录结构

```text
website/
├─ docs/
│  ├─ .vitepress/
│  │  ├─ config.mts        # 站点配置:导航、侧边栏
│  │  └─ theme/
│  │     └─ custom.css     # 淡绿色主题
│  ├─ index.md             # 首页
│  ├─ about.md
│  ├─ notes/               # 笔记
│  └─ projects/            # 项目
└─ .github/workflows/
   └─ deploy.yml           # 自动部署
```

### 淡绿色主题

VitePress 的默认主题把颜色都抽成了 CSS 变量,所以只需要覆盖变量:

```css
:root {
  --vp-c-brand-1: #3f9d6d;   /* 链接、文字高亮 */
  --vp-c-brand-3: #54b380;   /* 主按钮背景 */
  --vp-c-bg: #f7fbf8;        /* 页面底色带一点淡绿 */
  --vp-c-divider: #dbeade;
}
```

深色模式在 `.dark` 里另配一套,整体思路是把品牌色调亮一点,底色压到接近黑绿。

### 自动部署

`.github/workflows/deploy.yml` 里定义了三件事:

1. 监听 `main` 分支的 push
2. 用 Node 构建出静态文件到 `docs/.vitepress/dist`
3. 把这个目录发布到 GitHub Pages

所以日常流程就三步:

```bash
git add .
git commit -m "add: 新笔记"
git push
```

推上去之后一两分钟,网站就更新了。

## 踩到的坑

- 仓库名如果不是 `<用户名>.github.io`,而是普通的项目仓库,网址会多一层路径,
  `config.mts` 里的 `base` 必须跟着改,不然所有静态资源都 404。
- GitHub Pages 的 Source 要选 **GitHub Actions**,不能选 `Deploy from a branch`,
  否则 Actions 构建出来的东西不会被用上。
- 第一次部署完,Pages 那边可能要等一两分钟才生效。

## 后面想加的

- 本地搜索(`config.mts` 里加 `themeConfig.search = { provider: 'local' }` 就行)
- 笔记的标签和归档页
- 评论功能
