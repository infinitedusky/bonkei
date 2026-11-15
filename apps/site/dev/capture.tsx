// Dev-only page for `pnpm capture` (scripts/capture-stills.mjs). Not a build input, never in dist/.
// Renders a bare SceneView for ?sample=flow|seq&mode=flat|iso|3d and sets body[data-ready] once settled.
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { addAfterEffect } from '@react-three/fiber'
import flowSrc from '../src/sample.mmd?raw'
import { login } from '../src/login'
import { Bonkei, type Mode } from 'bonkei'

// Keep WebGL frames readable by the screenshot without a SceneView prop.
const getContext = HTMLCanvasElement.prototype.getContext
HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, attrs?: unknown) {
  if (type === 'webgl' || type === 'webgl2') attrs = { ...(attrs as object), preserveDrawingBuffer: true }
  return getContext.call(this, type, attrs)
} as typeof getContext

const q = new URLSearchParams(location.search)
const src = q.get('sample') === 'seq' ? login : flowSrc
const m = q.get('mode')
const mode: Mode = m === 'flat' || m === '3d' ? m : 'iso'
const SETTLE_FRAMES = 60

function Capture() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!ready) return
    let n = 0
    const unsub = addAfterEffect(() => { if (++n > SETTLE_FRAMES) { document.body.dataset.ready = '1'; unsub() } })
    return unsub
  }, [ready])
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Bonkei source={src} mode={mode} toolbar={false} controls={false} onReady={() => setReady(true)} />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Capture />)
