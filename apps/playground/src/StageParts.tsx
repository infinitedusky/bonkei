import { useState } from 'react'
import { normaliseName, type StageInfo } from 'bonkei'

/** Which of a stage's parts a search finds: matched the one way a script will match them (normaliseName), so "Prep Line" and "prep_line" find "prep line". */
export const findParts = (parts: StageInfo['parts'], query: string) => {
  const q = normaliseName(query)
  return q ? parts.filter(p => normaliseName(p.name).includes(q)) : parts
}

/** The playground's list of a stage's parts (from onReady), with a box that finds a part however its name is spelled. */
export function StageParts({ stage, initialFind = '' }: { stage: StageInfo; initialFind?: string }) {
  const [find, setFind] = useState(initialFind)
  const shown = findParts(stage.parts, find)
  return (
    <div data-stage-parts style={{ position: 'absolute', top: 88, right: 10, width: 220, background: '#1a2030cc', border: '1px solid #3a4560', borderRadius: 6, padding: 8, color: '#cfd8ea', font: '12px system-ui, sans-serif' }}>
      <b>Stage parts</b> <span style={{ color: '#9aa6c0' }}>({stage.parts.length})</span>
      <input aria-label="Find a part" placeholder="find: Prep Line, prep_line…" value={find} onChange={e => setFind(e.target.value)}
        style={{ display: 'block', width: '100%', boxSizing: 'border-box', margin: '6px 0', padding: 4, background: '#10151f', color: '#cfd8ea', border: '1px solid #3a4560', borderRadius: 4 }} />
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', maxHeight: 240, overflowY: 'auto' }}>
        {shown.map((p, i) => <li key={i} style={{ padding: '2px 0', overflowWrap: 'anywhere' }}>{p.name} <span style={{ color: '#9aa6c0' }}>· {p.pieces} {p.pieces === 1 ? 'piece' : 'pieces'}</span></li>)}
        {!shown.length && <li style={{ color: '#9aa6c0' }}>no part is called that</li>}
      </ul>
    </div>
  )
}
