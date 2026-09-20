/* ============================================================================
 * 首页内容配置
 * ----------------------------------------------------------------------------
 * 改首页的文字、数字、头像、封面图,全部只看这一个文件。
 * 组件代码在 SplitHome.vue,一般不用动。
 *
 * ▍图片怎么放(重要)
 *   1. 把图片文件丢进  docs/public/  目录。
 *      想分类就建子文件夹,比如  docs/public/img/avatar.jpg
 *   2. 下面写路径时以 / 开头,对应 docs/public/ 去掉这个前缀:
 *        文件 docs/public/img/avatar.jpg   →  写  '/img/avatar.jpg'
 *        文件 docs/public/bg.svg           →  写  '/bg.svg'
 *   3. 先压缩!照片建议压到 300KB 以内,背景图 500KB 以内,
 *      不然别人打开首页要等很久。
 *   4. 留空字符串 '' 也没关系 —— 会用内置的渐变色兜底,不会出现破图。
 *
 * ▍路径示例
 *   avatar: '/img/avatar.jpg'
 *   cover:  '/img/cover-notes.jpg'
 *   反例(会 404):avatar: 'img/avatar.jpg'   ← 少了开头的斜杠
 * ==========================================================================*/

/** 一块入口大卡 */
export interface HomeEntry {
  /** 卡片大字 */
  title: string
  /** 小字说明 */
  desc: string
  /** 点进去的站内地址 */
  link: string
  /** 封面图,留空用渐变兜底 */
  cover: string
  /** 左上角那个小标签,留空则不显示 */
  tag?: string
}

/** 底部状态栏 */
export interface HomeStatusBar {
  /** 是否显示实时时钟 */
  clock: boolean
  /** 技术徽章,不要就写 [] */
  badges: string[]
  /** 最右边那句话 */
  note: string
}

export const homeConfig = {
  /* ------------------------------------------------------------------
   * 背景图
   * 放几张贴几张,会自动淡入淡出轮播;只放一张就是静态背景。
   * 换成自己的照片,把文件丢进 docs/public/img/,然后:
   *   backgroundImages: ['/img/bg-1.jpg', '/img/bg-2.jpg', '/img/bg-3.jpg'],
   * ------------------------------------------------------------------ */
  backgroundImages: ['/bg.svg'],

  /* ------------------------------------------------------------------
   * 左侧的个人卡片
   * ------------------------------------------------------------------ */
  profile: {
    name: '乌鸦张嘴',
    /** 头像,留空显示名字首字 */
    avatar: '',
    bio: '在学 C# 和 Unity,想从小游戏开始做点能跑起来的东西。',
    /** 统计数字,不想要就写 stats: [] */
    stats: [
      { value: '8', label: '篇笔记' },
      { value: '1', label: '个项目' },
      { value: '∞', label: '还在学' },
    ],
    /** 社交按钮,icon 目前支持 github / mail / link */
    links: [
      { icon: 'github', href: 'https://github.com/Cherry77551', label: 'GitHub' },
    ],
  },

  /* ------------------------------------------------------------------
   * 入口大卡
   * 加一张就多一块,删一条就少一块 —— 布局会自动排。
   * ------------------------------------------------------------------ */
  entries: [
    {
      title: '笔记',
      desc: '学习记录与技术整理',
      link: '/notes/',
      cover: '',
      tag: 'Notes',
    },
    {
      title: '项目',
      desc: '做过的东西与源码',
      link: '/projects/',
      cover: '',
      tag: 'Projects',
    },
  ] as HomeEntry[],

  /* ------------------------------------------------------------------
   * 底部状态栏
   * ------------------------------------------------------------------ */
  statusBar: {
    clock: true,
    badges: ['VitePress', 'GitHub Pages', 'Actions'],
    note: '本站由 GitHub Actions 自动部署',
  } as HomeStatusBar,
}

export default homeConfig
