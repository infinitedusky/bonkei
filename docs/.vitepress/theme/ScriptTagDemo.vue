<script setup lang="ts">
// Loads the script-tag bundle from these docs (/docs/bonkei/bonkei.global.js, copied out of the installed package by scripts/prepare.mjs)
// and draws a real <bonkei-diagram> element, exactly as a plain HTML page would. The load is a bonkei.docs.script_tag.load span.
import { onMounted, ref } from 'vue'
import { withBase } from 'vitepress'
import { fail, start } from './telemetry'

const props = defineProps<{ source: string; attrs?: Record<string, string>; height?: number }>()
const host = ref<HTMLElement>()
const failure = ref('')
let loading: Promise<void> | undefined // one script for every demo on the page

function load(): Promise<void> {
  if ((window as any).Bonkei) return Promise.resolve()
  return loading ??= new Promise<void>((ok, bad) => {
    const s = document.createElement('script'); s.src = withBase('/bonkei/bonkei.global.js')
    s.onload = () => ok(); s.onerror = () => bad(new Error(`could not load ${s.src}`))
    document.head.appendChild(s)
  })
}

onMounted(async () => {
  const span = start('bonkei.docs.script_tag.load')
  try { await load(); span.end() } catch (e) {
    failure.value = String((e as Error).message ?? e); fail(span, failure.value); console.error('[docs] script-tag demo:', e)
    return
  }
  const d = document.createElement('bonkei-diagram')
  d.className = 'bonkei-diagram bonkei-tag'
  d.setAttribute('height', String(props.height ?? 300))
  for (const [k, v] of Object.entries(props.attrs ?? {})) d.setAttribute(k, v)
  d.textContent = decodeURIComponent(props.source)
  host.value!.appendChild(d)
})
</script>
<template><div ref="host" class="bonkei-tag-host"><p v-if="failure" class="bonkei-problems">{{ failure }}</p></div></template>
