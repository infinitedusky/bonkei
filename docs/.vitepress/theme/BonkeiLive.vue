<script setup lang="ts">
// A live diagram drawn by bonkei's own render() (loaded when it mounts), for the pages that show what the plugin's fences cannot:
// options passed in code, and events. Everything it uses is the installed package's public API.
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{ source: string; options?: Record<string, any>; height?: number; events?: boolean; stats?: boolean; label?: string }>()
const el = ref<HTMLElement>()
const log = ref<string[]>([])
const counts = ref<any>(null)
let handle: { destroy(): void } | undefined
const push = (s: string) => { log.value = [s, ...log.value].slice(0, 6) }

onMounted(async () => {
  const { render } = await import('bonkei')
  const o: Record<string, any> = { ...(props.options ?? {}) }
  if (props.events) {
    o.onReady = (r: any) => push(`onReady  ${r.nodes} nodes, ${r.edges} edges`)
    o.onNodeClick = (n: any) => push(`onNodeClick  ${n.kind} "${n.label}"`)
    o.onModeChange = (m: string, c: any) => push(`onModeChange  ${m} (${c.source})`)
    o.onWarning = (w: any) => push(`onWarning  ${w.kind}: ${w.message}`)
    o.onError = (e: any) => push(`onError  ${e.kind}: ${e.message}`)
  }
  // onEdgeStats is a prop of <Bonkei />; render() hands its options on to it, so it works here (the types of render() do not list it)
  if (props.stats) o.onEdgeStats = (s: any) => { counts.value = s }
  handle = render(el.value!, decodeURIComponent(props.source), o)
})
onBeforeUnmount(() => handle?.destroy())
</script>

<template>
  <figure class="bonkei-live-fig">
    <div ref="el" class="bonkei-diagram bonkei-live" :style="{ height: (height ?? 300) + 'px', position: 'relative' }"></div>
    <figcaption v-if="label">{{ label }}</figcaption>
    <p v-if="stats" class="bonkei-stats" aria-live="polite">
      <template v-if="counts">onEdgeStats: <b>{{ counts.crossings }}</b> crossing{{ counts.crossings === 1 ? '' : 's' }} found<template v-for="k in ['bridge', 'tunnel', 'portal']" :key="k"><template v-if="counts[k]">, <b>{{ counts[k] }}</b> drawn as {{ k }}</template></template><template v-if="counts.skipped">, {{ counts.skipped }} skipped</template></template>
      <template v-else>counting…</template>
    </p>
    <ol v-if="events" class="bonkei-events" aria-label="Events">
      <li v-if="!log.length"><em>Events appear here: click a node, switch the view.</em></li>
      <li v-for="(l, i) in log" :key="i"><code>{{ l }}</code></li>
    </ol>
  </figure>
</template>
