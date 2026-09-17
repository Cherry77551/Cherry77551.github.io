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
          text: 'C# / .NET',
          collapsed: true,
          items: [
            { text: '总览与目录', link: '/notes/dotnet/' },
            { text: '1. C# 与 .NET 生态', link: '/notes/dotnet/ecosystem' },
            { text: '2. 类型系统与值/引用类型', link: '/notes/dotnet/type-system' },
            { text: '3. 字符串、数组与集合', link: '/notes/dotnet/strings-collections' },
            { text: '4. 面向对象:类、接口与继承', link: '/notes/dotnet/oop' },
            { text: '5. 泛型', link: '/notes/dotnet/generics' },
            { text: '6. 委托、Lambda 与事件', link: '/notes/dotnet/delegates-events' },
            { text: '7. LINQ', link: '/notes/dotnet/linq' },
            { text: '8. 异步编程与并发', link: '/notes/dotnet/async' },
            { text: '9. 内存、GC 与性能', link: '/notes/dotnet/memory-performance' },
            { text: '10. 现代 C# 特性(按版本)', link: '/notes/dotnet/modern-csharp' },
            { text: '11. 工程化实践', link: '/notes/dotnet/engineering' },
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
