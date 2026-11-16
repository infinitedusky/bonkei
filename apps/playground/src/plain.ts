// plain.html: render() and its handle on a page with no React of its own. Dev-only.
// Sample data: the flowchart is src/sample.mmd, the sequence is SAMPLES['seq: login flow'].
import { render, type BonkeiError, type BonkeiWarning } from 'bonkei'
import flowchart from './sample.mmd?raw'
import { SAMPLES } from './samples'

const BROKEN = '???\n!!!' // sample data: nothing readable

const $ = (id: string) => document.getElementById(id)!
const logEl = $('log')
const log = (line: string) => { logEl.textContent += line + '\n' }

const handle = render($('box'), flowchart, {
  onModeChange: (mode, change) => log(`onModeChange: ${mode} (from ${change.source})`),
  onReady: r => log(`onReady: ${r.nodes} nodes, ${r.edges} edges, ${r.dropped} dropped, layout ${Math.round(r.layoutMs)} ms`),
  onError: (e: BonkeiError) => log(`onError: error line ${e.line}: ${e.message} (kind ${e.kind})`),
  onWarning: (w: BonkeiWarning) => log(`onWarning: warning line ${w.line}: ${w.message} (kind ${w.kind})`),
})

$('flat').onclick = () => handle.setMode('flat')
$('sequence').onclick = () => { $('label').textContent = "sample data: SAMPLES['seq: login flow']"; handle.update(SAMPLES['seq: login flow']) }
$('broken').onclick = () => handle.update(BROKEN)
$('destroy').onclick = () => { handle.destroy(); log('destroy()') }
