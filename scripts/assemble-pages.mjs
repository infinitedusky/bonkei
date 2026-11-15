// Puts the two app builds into one Pages artifact: the site at dist/, the viewer at dist/app/.
import fs from 'node:fs'

fs.rmSync('dist', { recursive: true, force: true })
fs.cpSync('apps/site/dist', 'dist', { recursive: true })
fs.cpSync('apps/playground/dist', 'dist/app', { recursive: true })

for (const f of ['dist/index.html', 'dist/app/index.html']) {
  if (!fs.existsSync(f)) { console.error(`assemble-pages: missing ${f}`); process.exit(1) }
}
console.log('assembled dist/ (site) and dist/app/ (viewer)')
