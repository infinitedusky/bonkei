<script setup lang="ts">
// Try the trench light (Edge styles): the controls write config.themeVariables into the diagram's frontmatter (shown under the diagram,
// rules in trench.ts) and hand the new source to the installed package's render() handle, the same path a diagram author uses. Nothing here
// reaches into the scene. Each change is a bonkei.docs.trench_light.edit span (telemetry.ts), ended when it draws or fails.
// data-bonkei-demo on the root is the title of this demo's heading in the page's .md: the docs smoke counts its one diagram as a demo, not a
// fence, and fails when the .md has no such heading (scripts/smoke/diagram-rule.mjs). A new interactive demo marks its root the same way.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Span } from '@opentelemetry/api'
import { fail, start } from './telemetry'
import { TRENCH_THEMES, own, parts, preset, themeColour, trenchSource, type TrenchPreset, type TrenchState, type TrenchTheme } from './trench'

const theme = ref<TrenchTheme>('classic')
const state = ref<TrenchState>(own('classic'))
const host = ref<HTMLElement>()
const problems = ref<string[]>([])
let handle: { update(s: string): void; destroy(): void } | undefined
let edit: Span | undefined
let control = 'theme'

const apply = (p: TrenchPreset) => { control = `preset:${p}`; state.value = preset(theme.value, p, state.value) }
const set = <K extends keyof TrenchState>(k: K, v: TrenchState[K]) => { control = k; state.value = { ...state.value, [k]: v } }
watch(theme, t => { control = 'theme'; state.value = own(t) })
const colour = computed(() => state.value.colour ?? themeColour(theme.value))
const source = computed(() => trenchSource(theme.value, state.value))

onMounted(async () => {
  const { render } = await import('bonkei')
  handle = render(host.value!, source.value, {
    mode: 'iso',
    onError: e => {
      const p = `${e.kind}${e.line ? ' line ' + e.line : ''}: ${e.message}`
      problems.value = [p]
      if (edit) { fail(edit, p); edit = undefined }
    },
    onWarning: w => {
      problems.value = [...problems.value, `warning${w.line ? ', line ' + w.line : ''}: ${w.message}`]
      edit?.addEvent('bonkei.docs.trench_light.warning', { 'bonkei.warning.kind': w.kind, 'bonkei.warning.message': w.message })
    },
    onReady: () => { edit?.end(); edit = undefined },
  })
})
watch(source, s => {
  problems.value = []
  edit?.end() // superseded before it drew
  edit = start('bonkei.docs.trench_light.edit', {
    'bonkei.docs.control': control, 'bonkei.theme': theme.value, 'bonkei.docs.trench.parts': parts(state.value),
    'bonkei.docs.trench.strength': state.value.strength, 'bonkei.docs.trench.own_colour': state.value.colour !== null,
  })
  handle?.update(s)
})
onBeforeUnmount(() => { edit?.end(); handle?.destroy() })
</script>

<template>
  <div class="trench-light" data-bonkei-demo="The trench light">
    <div class="trench-controls">
      <div class="row">
        <span>Preset</span>
        <button @click="apply('default')">Theme default</button>
        <button @click="apply('light-only')">Light only</button>
        <button @click="apply('off')">All off</button>
      </div>
      <div class="row">
        <label>Theme <select v-model="theme"><option v-for="t in TRENCH_THEMES" :key="t">{{ t }}</option></select></label>
        <label><input type="checkbox" :checked="state.floor" @change="set('floor', ($event.target as HTMLInputElement).checked)" /> floor light</label>
        <label><input type="checkbox" :checked="state.wash" @change="set('wash', ($event.target as HTMLInputElement).checked)" /> wall wash</label>
        <label><input type="checkbox" :checked="state.rim" @change="set('rim', ($event.target as HTMLInputElement).checked)" /> rim</label>
      </div>
      <div class="row">
        <label>Colour <input type="color" :value="colour" @input="set('colour', ($event.target as HTMLInputElement).value)" /></label>
        <button :disabled="state.colour === null" @click="set('colour', null)">Theme colour</button>
        <label>Strength <input type="range" min="0" max="100" :value="state.strength" @input="set('strength', +($event.target as HTMLInputElement).value)" /> {{ state.strength }}%</label>
      </div>
    </div>
    <div ref="host" class="bonkei-diagram bonkei-live" style="height: 340px; position: relative"></div>
    <ul class="bonkei-problems" aria-live="polite"><li v-for="(p, i) in problems" :key="i"><code>{{ p }}</code></li></ul>
    <p class="trench-cap">The controls write these <code>themeVariables</code> into the diagram's frontmatter, the same way you would:</p>
    <pre class="trench-src">{{ source.split('---')[1].trim() }}</pre>
  </div>
</template>
