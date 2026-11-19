// Smoke test (BON-178): the docs cover the INSTALLED package, read from its types (docs/node_modules/bonkei/dist/index.d.ts).
//  1. every public export has a generated API page (docs/api, after `npm run api` in docs/)
//  2. every property of BonkeiOptions and BonkeiProps (options, callbacks), every mode, label placement and reader's control is shown in
//     a guide page inside a live example: a ```mermaid fence the page draws, by its frontmatter or its attributes (see `live` below).
//     A code sample does not count, however type-checked.
// Exits 1 and names what is missing.
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const docs = path.resolve(import.meta.dirname, '../../docs')
const ts = createRequire(path.join(docs, 'package.json'))('typescript')
const dts = path.join(docs, 'node_modules/bonkei/dist/index.d.ts')
const program = ts.createProgram([dts], { target: ts.ScriptTarget.ES2022, moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext, skipLibCheck: true, jsx: ts.JsxEmit.ReactJSX })
const checker = program.getTypeChecker()
const mod = checker.getSymbolAtLocation(program.getSourceFile(dts))
const exports = checker.getExportsOfModule(mod)
let bad = 0
const fail = m => { bad++; console.log(`FAIL ${m}`) }

// 1. exports -> API pages
const apiNames = new Set(fs.readdirSync(path.join(docs, 'api'), { recursive: true }).filter(f => f.endsWith('.md')).map(f => path.basename(f, '.md').replace(/-1$/, '')))
const apiText = fs.readdirSync(path.join(docs, 'api'), { recursive: true }).filter(f => f.endsWith('.md')).map(f => fs.readFileSync(path.join(docs, 'api', f), 'utf8')).join('\n')
for (const e of exports) if (!apiNames.has(e.name)) fail(`export ${e.name} has no API page`)
console.log(`exports: ${exports.length} public exports, ${exports.filter(e => apiNames.has(e.name)).length} with an API page`)

// 2. options, callbacks, controls -> guide examples
const propsOf = name => {
  const sym = exports.find(e => e.name === name)
  const type = checker.getDeclaredTypeOfSymbol(checker.getAliasedSymbol ? (sym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(sym) : sym) : sym)
  return checker.getPropertiesOfType(type).map(p => p.name)
}
const props = [...new Set([...propsOf('BonkeiOptions'), ...propsOf('BonkeiProps')])].filter(n => n !== 'source')
const controls = ['zoom', 'pan', 'move', 'drillIn']
const modes = ['flat', 'iso', '3d'], labels = ['top', 'billboard']
const guide = fs.readdirSync(path.join(docs, 'guide')).map(f => [f, fs.readFileSync(path.join(docs, 'guide', f), 'utf8')])
// The live parts of a page: its top-level ```mermaid fences, which this site draws (a fence nested in a longer one, like a code group's
// Markdown tab, is source shown as text). What a fence shows: its frontmatter, plus the props its attributes pass (docs/.vitepress/config.ts):
// {events} logs every event, {stats} counts onEdgeStats, {fit=…} {minLabelPx=…} {mode=…} {theme=…} pass that prop. A code sample is not a
// live example, however type-checked.
const ATTR_SHOWS = { events: 'onReady onNodeClick onModeChange onWarning onError', stats: 'onEdgeStats' }
function live(md) {
  const out = [], lines = md.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = /^(`{3,})(.*)$/.exec(lines[i]); if (!m) continue
    const body = []; i++
    while (i < lines.length && !(lines[i].startsWith(m[1]) && lines[i].trim() === m[1])) body.push(lines[i++])
    const info = m[2].trim()
    if (!/^mermaid(\s|$)/.test(info)) continue
    const attrs = [...info.matchAll(/([\w]+)(?:=(\S+?))?(?=[\s}])/g)].slice(1).map(([, k, v]) => `${ATTR_SHOWS[k] ?? k} ${v ?? ''}`)
    out.push(attrs.join(' '), body.join('\n'))
  }
  return out.join('\n')
}
const shown = name => guide.filter(([, md]) => new RegExp(`(^|[^\\w-])${name}([^\\w-]|$)`, 'm').test(live(md))).map(([f]) => f)
for (const n of [...props, ...controls, ...modes, ...labels]) {
  const where = shown(n)
  if (!where.length) fail(`${n}: no live example in any guide page`)
  else console.log(`  ${n.padEnd(18)} ${where.join(', ')}`)
}
console.log(bad ? `\n${bad} missing` : '\nevery export has an API page and every option, event and control has an example')
process.exit(bad ? 1 : 0)
