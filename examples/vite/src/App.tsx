import { Bonkei } from 'bonkei'
import source from './sample.mmd?raw'

export default function App() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Bonkei
        source={source}
        // what the smoke test reads: the route stats, and why drawing failed if it did
        onEdgeStats={s => { (window as any).__stats = s }}
        onError={e => { (window as any).__error = e.message }}
      />
    </div>
  )
}
