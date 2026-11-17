// Draws a sample's boxes and routes as an SVG (plan view), lines that double back or cross a block or foreign tray in red.
//   node --experimental-strip-types scripts/route-svg.ts [small|large] > out.svg
import { readFileSync } from 'node:fs'
process.env.NOMAIN = '1'
const root = new URL('../../../packages/core/src/', import.meta.url).pathname
const { layout } = await import(root + 'layout.ts')
const { parse } = await import(root + 'parser.ts')
const { metrics } = await import('./route-metrics.ts')
const ts = readFileSync(new URL('../src/samples.ts', import.meta.url), 'utf8')
const which = process.argv[2] ?? 'large'
const src = which === 'small' ? readFileSync(new URL('../src/sample.mmd', import.meta.url), 'utf8') : ts.match(/const large = `([\s\S]*?)`/)![1]
const r = await layout(parse(src))
const m = metrics(r)
const bad = new Set([...m.backIds, ...m.throughIds, ...m.trayIds])
const out: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${r.width}" height="${r.height}" viewBox="0 0 ${r.width} ${r.height}" style="background:#fff" font-family="sans-serif">`]
for (const b of r.boxes) out.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${b.kind === 'group' ? `rgba(80,120,200,${0.08 + 0.06 * b.level})` : '#cfe'}" stroke="#567"/><text x="${b.x + 4}" y="${b.y + 14}" font-size="12">${b.id}</text>`)
for (const e of r.routes) {
  const c = bad.has(e.id) ? 'red' : '#333'
  out.push(`<polyline fill="none" stroke="${c}" stroke-width="${bad.has(e.id) ? 2.5 : 1.2}" points="${e.points.map((p: number[]) => p.join(',')).join(' ')}"/>`)
  const [x, y] = e.points[e.points.length - 1]
  out.push(`<circle cx="${x}" cy="${y}" r="3" fill="${c}"/>`)
  if (bad.has(e.id)) { const [sx, sy] = e.points[0]; out.push(`<text x="${sx + 3}" y="${sy - 3}" font-size="11" fill="red">${e.id}</text>`) }
}
out.push('</svg>')
console.log(out.join('\n'))
