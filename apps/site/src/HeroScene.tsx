import { useEffect, useRef, useState } from 'react'
import { Bonkei, type BonkeiError, type Mode } from 'bonkei'

const ORDER: Mode[] = ['flat', 'iso', '3d']

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

// The live hero scene only (the poster, gate and fade live in Hero.tsx, which lazy-loads this file).
// Cycles flat -> iso -> 3d until the visitor picks a view; no cycling under reduced motion, and the
// cycle pauses while the stage is off-screen or the tab is hidden. `onReady` is the component's own:
// it fires on the first frame drawn with the diagram. `onError` is the component's own, passed up: Hero.tsx decides
// (heroFallsBack) whether the poster takes the stage, as it must when the scene can't make its WebGL context.
export default function HeroScene({ source, start = 'iso', autoplay = true, every = 3500, onReady, onError, onSource }: {
  source: string; start?: Mode; autoplay?: boolean; every?: number; onReady?: () => void; onError?: (e: BonkeiError) => void; onSource?: () => void
}) {
  const [mode, setM] = useState<Mode>(start)
  const [playing, setPlaying] = useState(() => autoplay && !reducedMotion())
  const [onScreen, setOnScreen] = useState(true)
  const [tabVisible, setTabVisible] = useState(() => !document.hidden)
  const i = useRef(ORDER.indexOf(start))
  const root = useRef<HTMLDivElement>(null)
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  useEffect(() => {
    const el = root.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const vis = () => setTabVisible(!document.hidden)
    document.addEventListener('visibilitychange', vis)
    return () => document.removeEventListener('visibilitychange', vis)
  }, [])

  useEffect(() => {
    if (!playing || !onScreen || !tabVisible) return
    const t = setInterval(() => { i.current = (i.current + 1) % ORDER.length; setM(ORDER[i.current]) }, every)
    return () => clearInterval(t)
  }, [playing, onScreen, tabVisible, every])

  const pick = (m: Mode) => { setPlaying(false); i.current = ORDER.indexOf(m); setM(m) }

  return (
    <div ref={root} className="site-live-scene">
      <Bonkei source={source} mode={mode} labels="top" toolbar={false} controls={{ zoom: false }}
        onReady={() => onReadyRef.current?.()}
        onError={e => { if (import.meta.env.DEV) console.warn('[bonkei] error', e); onErrorRef.current?.(e) }}
        onWarning={w => { if (import.meta.env.DEV) console.warn('[bonkei] warning', w) }} />
      <div className="site-modes" role="group" aria-label="View">
        {ORDER.map(m => <button key={m} className={m === mode ? 'on' : ''} aria-pressed={m === mode} onClick={() => pick(m)}>{m}</button>)}
      </div>
      <div className="site-stage-caption">{playing ? 'auto-playing · pick a view to take over' : 'drag a node · click a tray to fly in'}</div>
      <button className="site-stage-src" onClick={onSource}>see the source ↗</button>
    </div>
  )
}
