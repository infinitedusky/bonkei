// Client side of @bonkei/vitepress: a Vue component and the one line the theme's enhanceApp needs.
// Nothing here imports bonkei (or React or three) at load: the component does it in onMounted, so server rendering never touches
// them and a page without a diagram never downloads them.
import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const decode = s => decodeURIComponent(s)

export const BonkeiDiagram = defineComponent({
  name: 'BonkeiDiagram',
  props: {
    /** The diagram source, percent-encoded by the markdown plugin. */
    source: { type: String, required: true },
    height: { type: [Number, String], default: 420 },
    mode: String,
    theme: String,
  },
  setup(props) {
    const el = ref(null)
    const state = ref('loading')
    let handle = null
    let gone = false
    const options = () => {
      const o = {
        onReady: () => { state.value = 'ready' },
        onError: e => { state.value = 'error'; el.value?.dispatchEvent(new CustomEvent('bonkei-error', { detail: e })) },
      }
      if (props.mode) o.mode = props.mode
      if (props.theme) o.theme = props.theme
      return o
    }
    onMounted(async () => {
      // A dynamic import: its own chunk, loaded only on a page that has a diagram.
      const { render } = await import('bonkei')
      if (gone || !el.value) return
      handle = render(el.value, decode(props.source), options())
    })
    watch(() => props.source, s => handle?.update(decode(s))) // HMR: the markdown changed
    onBeforeUnmount(() => { gone = true; handle?.destroy(); handle = null })
    // Server render: an empty box of the set height, so nothing below moves when the diagram draws.
    return () => h('div', {
      ref: el,
      class: 'bonkei-diagram',
      'data-state': state.value,
      style: { position: 'relative', height: `${props.height}px`, margin: '16px 0', border: '1px solid var(--vp-c-divider, #ddd)', borderRadius: '8px', overflow: 'hidden' },
    })
  },
})

/** In .vitepress/theme/index: `enhanceApp({ app }) { enhanceAppWithBonkei(app) }`. */
export function enhanceAppWithBonkei(app) {
  app.component('BonkeiDiagram', BonkeiDiagram)
}
