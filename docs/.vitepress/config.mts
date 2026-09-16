import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Cherry777',
  description: '个人笔记与项目展示',

  // 部署在 <username>.github.io 根路径下,base 保持 '/'
  // 如果以后改成项目仓库 <username>.github.io/<repo>/,
  // 这里要改成 base: '/<repo>/'
  base: '/',

  cleanUrls: true,
  lastUpdated: true,

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#54b380' }],
  ],

  markdown: {
    lineNumbers: true,
  },

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '笔记', link: '/notes/' },
      { text: '项目', link: '/projects/' },
      { text: '关于', link: '/about' },
    ],

    sidebar: {
      '/notes/': [
        {
          text: '入门',
          items: [
            { text: '笔记总览', link: '/notes/' },
            { text: '怎么用这个站记笔记', link: '/notes/getting-started' },
          ],
        },
        {
          text: 'Linux 与工具',
          items: [{ text: 'WSL 常用技巧', link: '/notes/linux/wsl-tips' }],
        },
        {
          text: '前端',
          items: [{ text: 'CSS 布局笔记', link: '/notes/web/css-layout' }],
        },
      ],
      '/projects/': [
        {
          text: '项目',
          items: [
            { text: '全部项目', link: '/projects/' },
            { text: '个人网站(本站)', link: '/projects/personal-site' },
          ],
        },
      ],
    },

    // 每个页面底部的上下篇
    docFooter: { prev: '上一篇', next: '下一篇' },
    outline: { level: [2, 3], label: '本页目录' },
    lastUpdated: { text: '最后更新于' },
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '深浅色',

    footer: {
      message: '用 VitePress 搭建,托管在 GitHub Pages',
      copyright: 'Copyright © 2026 Cherry777',
    },
  },
})
