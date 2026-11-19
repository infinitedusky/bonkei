import { Suspense, lazy, useEffect, useState, type ComponentProps } from 'react'

// Types only (erased at build). No value import of the scene, camera, layout or three in this file.
type SceneProps = ComponentProps<typeof import('./HeroScene')['default']>

// The scene (three, drei, ELK, the viewer) is a separate chunk, fetched only when the gate opens.
const HeroScene = lazy(() => import('./HeroScene'))

// Desktop with WebGL2: not a narrow screen, not a touch-first pointer, and a webgl2 context exists.
function canGoLive() {
  if (typeof matchMedia !== 'function') return false
  if (matchMedia('(max-width:760px)').matches || matchMedia('(pointer:coarse)').matches) return false
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return !!gl
  } catch {
    return false
  }
}

// The landing page's hero. An empty stage first (nothing is painted until we know which path this device
// gets); the live scene fades in once it has drawn a real frame. The poster is only for devices that can't
// go live. `live`: true forces the scene, false forces the poster, unset auto-detects.
export function Hero({ live, source, start, autoplay, every, onSource }: {
  live?: boolean; source: string; start?: SceneProps['start']; autoplay?: boolean; every?: number; onSource?: () => void
}) {
  const [on, setOn] = useState<boolean | undefined>(live)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const go = live === undefined ? canGoLive() : live
    setOn(go)
    // Which path this visitor got; the site has no telemetry channel, so it is a User Timing mark.
    performance.mark(go ? 'hero-path-live' : 'hero-path-poster')
  }, [live])

  return (
    <div className="site-stage">
      {on === false && (
        <img className="site-stage-poster" src={`${import.meta.env.BASE_URL}poster.png`} width={1080} height={460}
          alt="A small Mermaid flowchart shown isometrically: nodes as raised blocks on trays, joined by arrows" />
      )}
      {on === true && (
        <Suspense fallback={null}>
          <div className={'site-live' + (ready ? ' ready' : '')}>
            <HeroScene source={source} start={start} autoplay={autoplay} every={every} onSource={onSource}
              onReady={() => { setReady(true); performance.mark('hero-scene-ready'); performance.measure('hero-time-to-ready', 'hero-path-live') }} />
          </div>
        </Suspense>
      )}
      {on === false && (
        <>
          <div className="site-stage-caption">Try it live to explore</div>
          <button className="site-stage-src" onClick={onSource}>see the source ↗</button>
        </>
      )}
    </div>
  )
}
