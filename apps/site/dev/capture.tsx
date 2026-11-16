// Dev-only page for `pnpm capture` (scripts/capture-stills.mjs). Not a build input, never in dist/.
// Renders a bare <Bonkei /> for ?sample=flow|seq&mode=flat|iso|3d and sets body[data-ready] once
// settled, or body[data-error] with the message if the diagram can't be drawn.
import { createRoot } from 'react-dom/client'
import flowSrc from '../src/sample.mmd?raw'
import { login } from '../src/login'
import { Bonkei, type BonkeiError, type Mode } from 'bonkei'

// Keep WebGL frames readable by the screenshot without a component prop.
const getContext = HTMLCanvasElement.prototype.getContext
HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, attrs?: unknown) {
  if (type === 'webgl' || type === 'webgl2') attrs = { ...(attrs as object), preserveDrawingBuffer: true }
  return getContext.call(this, type, attrs)
} as typeof getContext

const q = new URLSearchParams(location.search)
const src = q.get('sample') === 'seq' ? login : flowSrc
const m = q.get('mode')
const mode: Mode = m === 'flat' || m === '3d' ? m : 'iso'

// The first frame snaps the camera, so there is no tween to wait for. But drei <Text> (troika)
// lays out its fonts asynchronously and shadows take frames to settle, so a still shot a few
// frames after onReady can miss labels under swiftshader. This is a dev tool: waiting costs nothing.
const SETTLE_FRAMES = 60

function settle() {
  let n = 0
  const tick = () => { if (++n >= SETTLE_FRAMES) document.body.dataset.ready = '1'; else requestAnimationFrame(tick) }
  requestAnimationFrame(tick)
}

const fmt = (e: BonkeiError) => `${e.kind} error${e.line !== undefined ? ` at line ${e.line}` : ''}: ${e.message}`

createRoot(document.getElementById('root')!).render(
  <Bonkei source={src} mode={mode} toolbar={false} controls={false}
    onReady={settle} onError={e => { document.body.dataset.error = fmt(e) }} />,
)
