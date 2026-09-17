import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import SplitHome from './SplitHome.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('SplitHome', SplitHome)
  },
} satisfies Theme
