import { Component, Suspense, lazy, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { probeGate } from './howGate'
import { track } from './track'

// Types only (erased at build). No value import of the scene, camera, layout or three in this file.
type SceneProps = ComponentProps<typeof import('./HeroScene')['default']>

// The scene (three, drei, ELK, the viewer) is a separate chunk, fetched only when the gate opens.
const HeroScene = lazy(() => import('./HeroScene'))

// The scene's chunk failing to load (a dropped connection, a deploy mid-visit) would otherwise unmount the whole page:
// this turns it into `onFailed`, and the hero shows the poster.
class SceneBoundary extends Component<{ onFailed: (message: string) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(e: unknown) { this.props.onFailed(e instanceof Error ? e.message : String(e)) }
  render() { return this.state.failed ? null : this.props.children }
}

// The landing page's hero. An empty stage first (nothing is painted until we know which path this device
// gets); the live scene fades in once it has drawn a real frame. The poster is only for devices that can't
// go live. `live`: true forces the scene, false forces the poster, unset auto-detects.
export function Hero({ live, source, start, autoplay, every, onSource }: {
  live?: boolean; source: string; start?: SceneProps['start']; autoplay?: boolean; every?: number; onSource?: () => void
}) {
  const [on, setOn] = useState<boolean | undefined>(live)
  const [ready, setReady] = useState(false)
  const decided = useRef(0)

  useEffect(() => {
    // Which path this visitor got (counts and states only): live, or the poster and why.
    const gate = live === undefined ? probeGate() : live ? 'live' : 'forced'
    setOn(gate === 'live')
    decided.current = performance.now()
    track('site.hero.path', gate === 'live' ? { 'site.hero.path': 'live' } : { 'site.hero.path': 'poster', 'site.hero.reason': gate })
  }, [live])

  return (
    <div className="site-stage">
      {on === false && (
        <img className="site-stage-poster" src={`${import.meta.env.BASE_URL}poster.png`} width={1080} height={460}
          alt="A small Mermaid flowchart shown isometrically: nodes as raised blocks on trays, joined by arrows" />
      )}
      {on === true && (
        <SceneBoundary onFailed={message => { track('site.hero.fallback', { 'site.hero.reason': 'load-error' }, message); setOn(false) }}>
        <Suspense fallback={null}>
          <div className={'site-live' + (ready ? ' ready' : '')}>
            <HeroScene source={source} start={start} autoplay={autoplay} every={every} onSource={onSource}
              onReady={() => {
                setReady(true)
                performance.mark('hero-scene-ready')
                track('site.hero.ready', { 'site.hero.ready_ms': Math.round(performance.now() - decided.current) })
              }} />
          </div>
        </Suspense>
        </SceneBoundary>
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
