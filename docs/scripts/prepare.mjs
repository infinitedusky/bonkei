// Runs after TypeDoc, before VitePress: (1) gives every generated API page a frontmatter `description` (llms.txt lists it),
// (2) serves the script-tag bundle from the docs themselves, copied out of the INSTALLED package (node_modules/bonkei/dist).
import fs from 'node:fs'
import path from 'node:path'

const docs = path.resolve(import.meta.dirname, '..')
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])

for (const f of walk(path.join(docs, 'api')).filter(f => f.endsWith('.md'))) {
  const text = fs.readFileSync(f, 'utf8')
  if (text.startsWith('---')) continue
  const lines = text.split('\n')
  const title = lines.find(l => l.startsWith('# '))?.slice(2).replace(/[:`]/g, '').trim() ?? 'API'
  const prose = lines.filter((l, i) => i > 0 && l.trim() && !/^(#|```|\||- |\[|function |type |interface |const |class |   )/.test(l) && !/^\)|^[A-Za-z]+(\?)?:/.test(l))
  const desc = (prose[0] ?? `The ${title} export of bonkei.`).replace(/[`*]|\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/"/g, "'").trim()
  fs.writeFileSync(f, `---\ndescription: "${title.replace(/"/g, "'")}: ${desc}"\n---\n\n${text}`)
}

const dist = path.join(docs, 'node_modules/bonkei/dist')
const out = path.join(docs, 'public/bonkei')
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true })
for (const f of ['bonkei.global.js', 'libavoid.wasm']) fs.copyFileSync(path.join(dist, f), path.join(out, f))
fs.cpSync(path.join(dist, 'fonts'), path.join(out, 'fonts'), { recursive: true })
console.log('prepare: api descriptions written, script-tag bundle copied from node_modules/bonkei/dist')
