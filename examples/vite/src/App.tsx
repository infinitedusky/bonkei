import { Bonkei, type BonkeiProps } from 'bonkei'
import source from './sample.mmd?raw'

// What the smoke test reads, per diagram: the route stats, whether the first frame was drawn, why drawing failed if it did,
// and every warning (a missing font file shows up here).
const report = (name: string): Partial<BonkeiProps> => {
  const w = window as any
  const d = ((w.__diagrams ??= {})[name] ??= { stats: null, ready: false, warnings: [] })
  return {
    onEdgeStats: s => { d.stats = s },
    onReady: () => { d.ready = true },
    onError: e => { w.__error = `${name}: ${e.message}` },
    onWarning: x => { d.warnings.push(x.message) },
  }
}

// Two diagrams of the same made-up sample: the default look, and the Bonkei theme (its labels use the bundled font).
export default function App() {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', gridTemplateRows: '1fr 1fr' }}>
      <div style={{ position: 'relative' }}><Bonkei source={source} {...report('default')} /></div>
      <div style={{ position: 'relative' }}><Bonkei source={source} theme="bonkei" {...report('bonkei')} /></div>
    </div>
  )
}
