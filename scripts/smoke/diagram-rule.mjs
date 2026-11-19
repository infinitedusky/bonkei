// The docs smoke's rule for the diagrams on a page (scripts/smoke/docs.mjs, BON-197): every diagram drawn is a ```mermaid fence in the
// page's .md, so agents, llms-full.txt and Copy page carry it, apart from interactive demos. An interactive demo (TrenchLight on Edge styles)
// marks its root with data-bonkei-demo="<title>": it is counted on its own, it holds exactly one diagram, and the page's .md has a heading
// with that title, where the prose and frontmatter that stand for the demo are. Any other diagram that is not a fence fails, in a demo or not.
// Tested in diagram-rule.test.mjs (the root `pnpm test`).

/** The headings of a Markdown page, without the ones inside code fences and without a trailing {#anchor}. */
export function headings(md) {
  const out = []; let fence = null
  for (const line of md.split('\n')) {
    const f = /^(`{3,}|~{3,})/.exec(line)
    if (f) { if (!fence) fence = f[1]; else if (line.trim() === fence) fence = null; continue }
    if (fence) continue
    const h = /^#{1,6}\s+(.+?)\s*(\{#[^}]*\})?\s*$/.exec(line)
    if (h) out.push(h[1])
  }
  return out
}

/**
 * Judges one page. `total`: the diagrams drawn on it; `fences`: the drawn mermaid fences in its .md; `demos`: each marked root, its title
 * and the diagrams inside it; `md`: the page's .md. `drawn` is the diagrams outside demos; `undeclared` names the demos that break the rule.
 */
export function judgeDiagrams({ total, fences, demos, md }) {
  const titles = headings(md)
  const inDemos = demos.reduce((n, d) => n + d.diagrams, 0)
  const undeclared = demos.filter(d => !d.title || d.diagrams !== 1 || !titles.includes(d.title)).map(d => d.title || '(untitled)')
  return { good: total - inDemos === fences && undeclared.length === 0, drawn: total - inDemos, undeclared }
}
