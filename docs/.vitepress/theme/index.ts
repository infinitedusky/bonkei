import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { enhanceAppWithBonkei } from '@bonkei/vitepress/client'
import CopyOrDownloadAsMarkdownButtons from 'vitepress-plugin-llms/vitepress-components/CopyOrDownloadAsMarkdownButtons.vue'
import TwoslashFloatingVue from '@shikijs/vitepress-twoslash/client'
import '@shikijs/vitepress-twoslash/style.css'
import BonkeiLive from './BonkeiLive.vue'
import BonkeiPlayground from './BonkeiPlayground.vue'
import ScriptTagDemo from './ScriptTagDemo.vue'
import CopyHomePage from './CopyHomePage.vue'
import TrenchLight from './TrenchLight.vue'
import { watchCopyButtons } from './telemetry'
import './brand.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    enhanceAppWithBonkei(app)
    app.component('CopyOrDownloadAsMarkdownButtons', CopyOrDownloadAsMarkdownButtons)
    app.component('BonkeiLive', BonkeiLive)
    app.component('BonkeiPlayground', BonkeiPlayground)
    app.component('ScriptTagDemo', ScriptTagDemo)
    app.component('CopyHomePage', CopyHomePage)
    app.component('TrenchLight', TrenchLight)
    app.use(TwoslashFloatingVue)
    watchCopyButtons()
  },
} satisfies Theme
