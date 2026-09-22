import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: '乌鸦张嘴',
  description: '个人笔记与项目展示',

  // 部署在 <username>.github.io 根路径下,base 保持 '/'
  // 如果以后改成项目仓库 <username>.github.io/<repo>/,
  // 这里要改成 base: '/<repo>/'
  base: '/',

  // 规范要求「绝对禁止深色/黑色背景」,所以关掉深色模式开关
  appearance: false,

  cleanUrls: true,
  lastUpdated: true,

  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/favicon.png' }],
    ['link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }],
    ['meta', { name: 'theme-color', content: '#2e7d6b' }],
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
          text: 'C#(为 Unity 准备)',
          collapsed: true,
          items: [
            { text: '1. 类型系统与值/引用类型', link: '/notes/dotnet/type-system' },
            { text: '2. 字符串、数组与集合', link: '/notes/dotnet/strings-collections' },
            { text: '3. 面向对象:类、接口与继承', link: '/notes/dotnet/oop' },
            { text: '4. 泛型', link: '/notes/dotnet/generics' },
            { text: '5. 委托、Lambda 与事件', link: '/notes/dotnet/delegates-events' },
            { text: '6. LINQ', link: '/notes/dotnet/linq' },
            { text: '7. 异步编程与并发', link: '/notes/dotnet/async' },
            { text: '8. 内存、GC 与性能', link: '/notes/dotnet/memory-performance' },
          ],
        },
        {
          text: 'Unity',
          collapsed: true,
          items: [
            { text: '编辑器与基本操作', link: '/notes/unity/editor' },
          ],
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
      copyright: 'Copyright © 2026 乌鸦张嘴',
    },
  },
})
