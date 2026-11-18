// Client side of @bonkei/vitepress (BON-53): a Vue component and the one line the theme's enhanceApp needs.
// Nothing here imports bonkei, React or three at load: the component does it in onMounted, so server rendering never touches
// them and a page without a diagram never downloads them.
import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch } from 'vue'

export const DEFAULT_HEIGHT = 420

// Tracing through @opentelemetry/api (bonkei's own dependency, so one copy): a no-op unless the site registers an SDK.
// Loaded with bonkei, never on a page without a diagram.
async function span(name, attrs, error) {
  const otel = await import('@opentelemetry/api').catch(() => null)
  if (!otel) return
  const s = otel.trace.getTracer('@bonkei/vitepress').startSpan(name, { attributes: attrs })
  if (error) s.setStatus({ code: otel.SpanStatusCode.ERROR, message: String(error?.message ?? error) })
  s.end()
}

const boxStyle = height => ({
  position: 'relative',
  height: `${height}px`,
  margin: '16px 0',
  border: '1px solid var(--vp-c-divider, #ddd)',
  borderRadius: '8px',
  overflow: 'hidden',
})

export const BonkeiDiagram = defineComponent({
  name: 'BonkeiDiagram',
  props: {
    /** The diagram source, percent-encoded by the markdown plugin (so neither HTML escaping nor Vue's {{ }} touches it). */
    source: { type: String, required: true },
    height: { type: [Number, String], default: DEFAULT_HEIGHT },
    mode: String,
    theme: String,
  },
  setup(props) {
    const el = ref(null)
    const state = ref('loading') // loading → ready | error; 'failed' when bonkei itself could not be loaded
    const failure = ref('')
    let handle = null
    let render = null
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
    const draw = () => {
      if (gone || !render || !el.value) return
      handle?.destroy()
      handle = render(el.value, decodeURIComponent(props.source), options())
    }

    onMounted(async () => {
      const t0 = performance.now()
      try {
        // A dynamic import: its own chunks, fetched only on a page that has a diagram.
        ;({ render } = await import('bonkei'))
        span('bonkei.vitepress.load', { 'bonkei.vitepress.load_ms': performance.now() - t0 })
      } catch (e) {
        state.value = 'failed'
        failure.value = `Bonkei could not be loaded: ${e?.message ?? e}`
        span('bonkei.vitepress.load', { 'bonkei.vitepress.load_ms': performance.now() - t0 }, e)
        console.error('[@bonkei/vitepress]', e)
        return
      }
      draw()
    })
    // While editing (HMR): a changed source updates the same view; a changed mode or theme starts a fresh one.
    watch(() => props.source, s => handle?.update(decodeURIComponent(s)))
    watch(() => [props.mode, props.theme], draw)
    onBeforeUnmount(() => { gone = true; handle?.destroy(); handle = null })

    // On the server (and before bonkei loads): an empty box of the set height, so nothing below moves when the diagram draws.
    return () => h('div', { ref: el, class: 'bonkei-diagram', 'data-state': state.value, style: boxStyle(props.height) },
      state.value === 'failed' ? [h('p', { style: { padding: '1rem', margin: 0, color: 'var(--vp-c-danger-1, #b00)' } }, failure.value)] : [])
  },
})

/** In .vitepress/theme/index: `enhanceApp({ app }) { enhanceAppWithBonkei(app) }`. */
export function enhanceAppWithBonkei(app) {
  app.component('BonkeiDiagram', BonkeiDiagram)
}
