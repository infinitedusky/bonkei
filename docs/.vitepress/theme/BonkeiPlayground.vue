<script setup lang="ts">
// Edit Mermaid, see the diagram change: the textarea feeds bonkei's render() handle (update()) after a short pause. An error keeps the last
// diagram (that is what update() does) and is shown under the editor; warnings too. All of it is the installed package's public API.
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ source: string; height?: number; options?: Record<string, any> }>()
const text = ref(decodeURIComponent(props.source))
const host = ref<HTMLElement>()
const problems = ref<string[]>([])
let handle: { update(s: string): void; destroy(): void } | undefined
let timer: ReturnType<typeof setTimeout> | undefined

onMounted(async () => {
  const { render } = await import('bonkei')
  handle = render(host.value!, text.value, {
    ...(props.options ?? {}),
    onError: e => { problems.value = [`${e.kind}${e.line ? ' line ' + e.line : ''}: ${e.message}`] },
    onWarning: w => { problems.value = [...problems.value, `warning, line ${w.line}: ${w.message}`] },
    onReady: () => { problems.value = [] },
  })
})
watch(text, v => {
  clearTimeout(timer)
  timer = setTimeout(() => { problems.value = []; handle?.update(v) }, 350)
})
onBeforeUnmount(() => { clearTimeout(timer); handle?.destroy() })
</script>

<template>
  <div class="bonkei-playground">
    <textarea v-model="text" class="bonkei-editor" spellcheck="false" aria-label="Mermaid source" rows="9"></textarea>
    <div ref="host" class="bonkei-diagram bonkei-live" :style="{ height: (height ?? 340) + 'px', position: 'relative' }"></div>
    <ul class="bonkei-problems" aria-live="polite"><li v-for="p in problems" :key="p"><code>{{ p }}</code></li></ul>
  </div>
</template>
