import DefaultTheme from 'vitepress/theme'
import { enhanceAppWithBonkei } from '@bonkei/vitepress/client'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    enhanceAppWithBonkei(app)
  },
}
