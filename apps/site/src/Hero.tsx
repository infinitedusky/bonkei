import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import { heroGateOf, heroPathAttrs, heroShows, probeGate } from './howGate'
import { SceneBoundary } from './SceneBoundary'
import { track } from './track'

// Types only (erased at build). No value import of the scene, camera, layout or three in this file.
type SceneProps = ComponentProps<typeof import('./HeroScene')['default']>

// The scene (three, drei, ELK, the viewer) is a separate chunk, fetched only when the gate opens.
const HeroScene = lazy(() => import('./HeroScene'))
// Stories only (holdLoad): a chunk still on its way, to show the empty stage a desktop sees while it loads.
const SlowScene = lazy(() => new Promise<never>(() => {}))
// Stories only (failLoad): a chunk that does not load, as a dropped connection or a deploy mid-visit does.
const NoScene = lazy(() => Promise.reject(new Error('the hero scene chunk did not load')))

// The landing page's hero (BON-209). The path is decided on the first render (the page is client-rendered, so there is
// no undecided frame): a desktop with WebGL 2 gets an empty stage (its size and background) and the live scene fades in
// once it has drawn a real frame; poster.png is never requested. The poster, caption and "see the source" are only for a
// device that can't go live (phone, coarse pointer, no WebGL 2), `live={false}`, or a scene chunk that failed to load.
// `live`: true forces the scene, false forces the poster, unset auto-detects. `holdLoad` / `failLoad`: stories only.
export function Hero({ live, source, start, autoplay, every, onSource, holdLoad = false, failLoad = false }: {
  live?: boolean; source: string; start?: SceneProps['start']; autoplay?: boolean; every?: number; onSource?: () => void
  holdLoad?: boolean; failLoad?: boolean
}) {
  const gate = useMemo(() => heroGateOf(live, probeGate), [live])
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const decidedAt = useRef(performance.now())

  // Which path this visitor got (states only): live, or the poster and why.
  useEffect(() => { track('site.hero.path', heroPathAttrs(gate)) }, [gate])

  const shows = heroShows(gate, failed)
  const Scene = failLoad ? NoScene : holdLoad ? SlowScene : HeroScene
  return (
    <div className="site-stage">
      {shows === 'live' && (
        <SceneBoundary onFailed={message => { track('site.hero.fallback', { 'site.hero.reason': 'load-error' }, message); setFailed(true) }}>
          <Suspense fallback={null}>
            <div className={'site-live' + (ready ? ' ready' : '')}>
              <Scene source={source} start={start} autoplay={autoplay} every={every} onSource={onSource}
                onReady={() => {
                  setReady(true)
                  performance.mark('hero-scene-ready')
                  track('site.hero.ready', { 'site.hero.ready_ms': Math.round(performance.now() - decidedAt.current) })
                }} />
            </div>
          </Suspense>
        </SceneBoundary>
      )}
      {shows === 'poster' && (
        <>
          <img className="site-stage-poster" src={`${import.meta.env.BASE_URL}poster.png`} width={1080} height={460}
            alt="A small Mermaid flowchart shown isometrically: nodes as raised blocks on trays, joined by arrows" />
          <div className="site-stage-caption">Try it live to explore</div>
          <button className="site-stage-src" onClick={onSource}>see the source ↗</button>
        </>
      )}
    </div>
  )
}
