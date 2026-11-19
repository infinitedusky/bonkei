<script setup lang="ts">
// Try the trench light: the controls write config.themeVariables into the diagram's frontmatter (shown under the diagram) and hand
// the new source to the installed package's render() handle, the same path a diagram author uses. Nothing here reaches into the scene.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const theme = ref('classic')
// What each theme draws with no themeVariables: Classic lights the floor and walls in grey-white at 30%, no rim; the Bonkei themes have the
// light off and keep their dark rim. The controls start from the theme's own state and write themeVariables for anything that differs.
const own = (t: string) => (t === 'classic' ? { floor: true, wash: true, rim: false, strength: 30 } : { floor: false, wash: false, rim: true, strength: 50 })
const floor = ref(true), wash = ref(true), rim = ref(false)
const colour = ref<string | null>(null) // null: the theme's own colour
const strength = ref(30) // % of the standard light: 50 is core 3.5, halo 11 at 0.28, wash 0.3
const host = ref<HTMLElement>()
let handle: { update(s: string): void; destroy(): void } | undefined

const preset = (p: 'default' | 'light-only' | 'off') => {
  if (p === 'default') { const o = own(theme.value); floor.value = o.floor; wash.value = o.wash; rim.value = o.rim; strength.value = o.strength; colour.value = null }
  else { floor.value = wash.value = p === 'light-only'; rim.value = false; if (p === 'light-only' && strength.value === 0) strength.value = 30 }
}
watch(theme, () => preset('default'))
const baseColour = computed(() => colour.value ?? (theme.value === 'classic' ? '#e0e0e0' : '#ffc873'))

const vars = computed(() => {
  const o = own(theme.value)
  if (floor.value === o.floor && wash.value === o.wash && rim.value === o.rim && strength.value === o.strength && colour.value === null) return []
  const v: string[] = [], c = baseColour.value, s = strength.value / 50
  if (!floor.value && !wash.value) v.push('edge.glow: off')
  else {
    if (floor.value) v.push(`edge.glow.core: "${c}"`, `edge.glow.halo: "${c}"`, `edge.glow.coreWidth: ${+(3.5 * s).toFixed(1)}`, `edge.glow.haloWidth: ${+(11 * s).toFixed(1)}`, `edge.glow.haloOpacity: ${+(0.28 * s).toFixed(2)}`)
    else v.push('edge.glow.core: null', 'edge.glow.halo: null')
    if (wash.value) v.push(`edge.glow.wash: "${c}"`, `edge.glow.washIntensity: ${+(0.3 * s).toFixed(2)}`)
    else v.push('edge.glow.wash: null')
  }
  if (!rim.value) v.push('edge.rim: none')
  else if (colour.value || theme.value === 'classic') v.push(`edge.rim: "${c}"`)
  return v
})
const source = computed(() => `---
config:
  theme: ${theme.value}
  bonkei:
    crossings: tunnel
    avoidCrossings: off
${vars.value.length ? '  themeVariables:\n' + vars.value.map(l => '    ' + l).join('\n') + '\n' : ''}---
flowchart LR
  Web[Web app] --> Api[API] --> Db[(Database)]
  Web --> Db
  Cdn[CDN] --> Api
  Cdn --> Cache[(Cache)]`)

onMounted(async () => {
  const { render } = await import('bonkei')
  handle = render(host.value!, source.value, { mode: 'iso' })
})
watch(source, s => handle?.update(s))
onBeforeUnmount(() => handle?.destroy())
</script>

<template>
  <div class="trench-light">
    <div class="trench-controls">
      <div class="row">
        <span>Preset</span>
        <button @click="preset('default')">Theme default</button>
        <button @click="preset('light-only')">Light only</button>
        <button @click="preset('off')">All off</button>
      </div>
      <div class="row">
        <label>Theme <select v-model="theme"><option>classic</option><option>bonkei</option><option>bonkei-landscape</option></select></label>
        <label><input type="checkbox" v-model="floor" /> floor light</label>
        <label><input type="checkbox" v-model="wash" /> wall wash</label>
        <label><input type="checkbox" v-model="rim" /> rim</label>
      </div>
      <div class="row">
        <label>Colour <input type="color" :value="baseColour" @input="colour = ($event.target as HTMLInputElement).value" /></label>
        <button :disabled="colour === null" @click="colour = null">theme colour</button>
        <label>Strength <input type="range" min="0" max="100" v-model.number="strength" /> {{ strength }}%</label>
      </div>
    </div>
    <div ref="host" class="bonkei-diagram bonkei-live" style="height: 340px; position: relative"></div>
    <p class="trench-cap">The controls write these <code>themeVariables</code> into the diagram's frontmatter, the same way you would:</p>
    <pre class="trench-src">{{ source.split('---')[1].trim() }}</pre>
  </div>
</template>
