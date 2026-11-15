// No React in this file: render() mounts its own root.
import { render } from 'bonkei'
import small from './sample.mmd?raw'
import { SAMPLES } from './samples'

const $ = (id: string) => document.getElementById(id)!
const log = (s: string) => { $('log').textContent = s }
const view = render($('box'), small, { mode: '3d', onError: e => log(`${e.severity}: ${e.message}`), onModeChange: m => log(`mode ${m}`) })
$('update').onclick = () => view.update(SAMPLES['seq: login flow'])
$('flat').onclick = () => view.setMode('flat')
$('bad').onclick = () => view.update('flowchart TD\n???')
$('destroy').onclick = () => { view.destroy(); log(`destroyed; canvases left: ${document.querySelectorAll('canvas').length}`) }
;(window as unknown as { view: typeof view }).view = view
