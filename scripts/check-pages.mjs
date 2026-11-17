// Checks the assembled Pages artifact (dist/) before it can deploy: no old name, no missing
// files, the bonkei.dev link preview and the CNAME. Prints each failure and exits 1.
import fs from 'node:fs'
import path from 'node:path'

const DIST = 'dist'
const SITE = 'https://bonkei.dev/'
const DOMAIN = 'bonkei.dev'
const fails = []
const fail = msg => fails.push(msg)
const read = f => fs.readFileSync(path.join(DIST, f), 'utf8')
const exists = f => fs.existsSync(path.join(DIST, f))

if (!fs.existsSync(DIST)) { console.error('check-pages: no dist/ (run pnpm build)'); process.exit(1) }

const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = path.join(dir, e.name)
  return e.isDirectory() ? walk(p) : [p]
})
const files = walk(DIST).map(p => path.relative(DIST, p).split(path.sep).join('/'))

// 1. The old name appears in no text file.
for (const f of files) {
  if (!/\.(html|js|css|svg)$/.test(f) && path.basename(f) !== 'CNAME') continue
  const lines = read(f).split('\n')
  lines.forEach((line, i) => {
    const m = /merman/i.exec(line)
    if (m) fail(`${f}:${i + 1}: mentions merman: …${line.slice(Math.max(0, m.index - 40), m.index + 40)}…`)
  })
}

// 2. Every root-relative src/href in the two pages points at a file in dist/.
for (const page of ['index.html', 'app/index.html']) {
  if (!exists(page)) { fail(`${page}: missing`); continue }
  for (const [, url] of read(page).matchAll(/\b(?:src|href)=["']?(\/[^"'\s>]*)/g)) {
    if (url.startsWith('//')) continue
    let rel = decodeURIComponent(url.replace(/[?#].*$/, '')).slice(1)
    if (rel === '' || rel.endsWith('/')) rel += 'index.html'
    if (!exists(rel) || fs.statSync(path.join(DIST, rel)).isDirectory()) fail(`${page}: ${url} → no file dist/${rel}`)
  }
}

const meta = (html, prop) => {
  const tag = html.match(new RegExp(`<meta[^>]*property=["']${prop}["'][^>]*>`))?.[0]
  return tag?.match(/content=["']([^"']*)["']/)?.[1]
}
const title = html => html.match(/<title>([^<]*)<\/title>/)?.[1] ?? ''

// 3. The site's link preview points at bonkei.dev, and its title says Bonkei.
if (exists('index.html')) {
  const html = read('index.html')
  const url = meta(html, 'og:url'), img = meta(html, 'og:image')
  if (url !== SITE) fail(`index.html: og:url is ${JSON.stringify(url)}, want ${SITE}`)
  if (img !== SITE + 'og.png') fail(`index.html: og:image is ${JSON.stringify(img)}, want ${SITE}og.png`)
  if (!title(html).includes('Bonkei')) fail(`index.html: title ${JSON.stringify(title(html))} does not say Bonkei`)
}
if (!exists('og.png')) fail('og.png: missing')

// 4. The viewer's title says Bonkei.
if (exists('app/index.html')) {
  const t = title(read('app/index.html'))
  if (!t.includes('Bonkei')) fail(`app/index.html: title ${JSON.stringify(t)} does not say Bonkei`)
}

// 5. The artifact records the domain.
if (!exists('CNAME')) fail('CNAME: missing')
else if (read('CNAME').trim() !== DOMAIN) fail(`CNAME: is ${JSON.stringify(read('CNAME').trim())}, want ${DOMAIN}`)

if (fails.length) {
  for (const f of fails) console.error(`check-pages: ${f}`)
  console.error(`check-pages: ${fails.length} problem(s) in dist/`)
  process.exit(1)
}
console.log(`check-pages: dist/ ok (${files.length} files, ${SITE})`)
