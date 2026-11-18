<script setup lang="ts">
// Edit Mermaid, see the diagram change: the textarea feeds bonkei's render() handle (update()) after a short pause. An error keeps the last
// diagram (that is what update() does) and is shown under the editor; warnings too. All of it is the installed package's public API.
// Each edit is a bonkei.docs.playground.edit span (telemetry.ts), ended when it draws or fails.
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Span } from '@opentelemetry/api'
import { fail, start } from './telemetry'

const props = defineProps<{ source: string; height?: number; options?: Record<string, any> }>()
const text = ref(decodeURIComponent(props.source))
const host = ref<HTMLElement>()
const problems = ref<string[]>([])
let handle: { update(s: string): void; destroy(): void } | undefined
let timer: ReturnType<typeof setTimeout> | undefined
let edit: Span | undefined

onMounted(async () => {
  const { render } = await import('bonkei')
  handle = render(host.value!, text.value, {
    ...(props.options ?? {}),
    onError: e => {
      const p = `${e.kind}${e.line ? ' line ' + e.line : ''}: ${e.message}`
      problems.value = [p]
      if (edit) { fail(edit, p); edit = undefined }
    },
    onWarning: w => {
      problems.value = [...problems.value, `warning${w.line ? ', line ' + w.line : ''}: ${w.message}`]
      edit?.addEvent('bonkei.docs.playground.warning', { 'bonkei.warning.kind': w.kind, 'bonkei.warning.message': w.message })
    },
    onReady: r => {
      problems.value = []
      edit?.setAttributes({ 'bonkei.nodes': r.nodes, 'bonkei.edges': r.edges }); edit?.end(); edit = undefined
    },
  })
})
watch(text, v => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    problems.value = []
    edit?.end() // superseded before it drew
    edit = start('bonkei.docs.playground.edit', { 'bonkei.docs.source_length': v.length })
    handle?.update(v)
  }, 350)
})
onBeforeUnmount(() => { clearTimeout(timer); edit?.end(); handle?.destroy() })
</script>

<template>
  <div class="bonkei-playground">
    <textarea v-model="text" class="bonkei-editor" spellcheck="false" aria-label="Mermaid source" rows="9"></textarea>
    <div ref="host" class="bonkei-diagram bonkei-live" :style="{ height: (height ?? 340) + 'px', position: 'relative' }"></div>
    <ul class="bonkei-problems" aria-live="polite"><li v-for="p in problems" :key="p"><code>{{ p }}</code></li></ul>
  </div>
</template>
