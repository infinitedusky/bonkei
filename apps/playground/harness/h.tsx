import { createRoot } from 'react-dom/client'
import { Bonkei } from 'bonkei'
import { SAMPLES } from '../src/samples'
const q = new URLSearchParams(location.search)
const src = q.get('src') ?? Object.values(SAMPLES)[Number(q.get('i') ?? 0)]
createRoot(document.getElementById('r')!).render(<Bonkei source={src} theme={q.get('theme') ?? 'classic'} mode={(q.get('mode') ?? 'iso') as any} toolbar={false} onReady={() => { (window as any).ready = true }} />)
