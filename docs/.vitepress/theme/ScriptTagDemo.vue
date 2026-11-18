<script setup lang="ts">
// Loads the script-tag bundle from these docs (/docs/bonkei/bonkei.global.js, copied out of the installed package) and draws a
// real <bonkei-diagram> element, exactly as a plain HTML page would.
import { onMounted, ref } from 'vue'
import { withBase } from 'vitepress'
const props = defineProps<{ source: string; attrs?: Record<string, string>; height?: number }>()
const host = ref<HTMLElement>()
onMounted(async () => {
  if (!(window as any).Bonkei) {
    await new Promise<void>((ok, bad) => {
      const s = document.createElement('script'); s.src = withBase('/bonkei/bonkei.global.js'); s.onload = () => ok(); s.onerror = () => bad(new Error('bonkei.global.js'))
      document.head.appendChild(s)
    })
  }
  const d = document.createElement('bonkei-diagram')
  d.className = 'bonkei-diagram bonkei-tag'
  d.setAttribute('height', String(props.height ?? 300))
  for (const [k, v] of Object.entries(props.attrs ?? {})) d.setAttribute(k, v)
  d.textContent = decodeURIComponent(props.source)
  host.value!.appendChild(d)
})
</script>
<template><div ref="host" class="bonkei-tag-host"></div></template>
