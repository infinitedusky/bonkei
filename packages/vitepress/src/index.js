// Config side of @bonkei/vitepress (BON-53): a markdown-it plugin for VitePress's `markdown.config`. It runs in Node at build time
// and imports nothing from bonkei. It claims ```mermaid fences that hold a flowchart or a sequence diagram and passes every other
// fence to the renderer that was there before (VitePress's code block, or another Mermaid plugin installed earlier).

export const DEFAULT_HEIGHT = 420

// A copy of bonkei's isSupported() (packages/core/src/embed.ts); index.test.js runs the same cases as embed.test.ts.
const FRONTMATTER = /^\s*---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n/
const COMMENTS = /^(\s*%%[^\n]*\n)+/

/** True for a flowchart (`flowchart` / `graph`) a sequence diagram or an Ishikawa diagram, after optional frontmatter and %% comment lines. */
export function isSupported(source) {
  const body = source.replace(FRONTMATTER, '').replace(COMMENTS, '')
  return /^\s*(flowchart|graph|sequenceDiagram|ishikawa(?:-beta)?)\b/.test(body)
}

/** ```mermaid {height=600 mode=3d theme=bonkei} → { height: '600', mode: '3d', theme: 'bonkei' }; null when the fence is not mermaid. */
export function parseInfo(info) {
  const m = /^mermaid(?:\s+|$)(?:\{([^}]*)\})?/.exec(info.trim())
  if (!m) return null
  const attrs = {}
  for (const pair of (m[1] ?? '').split(/[\s,]+/).filter(Boolean)) {
    const [k, ...v] = pair.split('=')
    attrs[k] = v.join('=').replace(/^["']|["']$/g, '') || 'true'
  }
  return attrs
}

const MODES = new Set(['flat', 'iso', '3d'])
const positive = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null }

/**
 * @param {import('markdown-it')} md
 * @param {import('./index.d.ts').BonkeiMarkdownOptions} [options]
 */
export function bonkeiMarkdown(md, options = {}) {
  const siteHeight = positive(options.height) ?? DEFAULT_HEIGHT
  const previous = md.renderer.rules.fence
  const fallback = (tokens, idx, opts, env, self) => self.renderToken(tokens, idx, opts)
  md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
    const token = tokens[idx]
    const file = env?.relativePath
    const attrs = parseInfo(token.info)
    // VitePress runs markdown-it-attrs, which moves `{height=600}` out of the info string into token.attrs; plain markdown-it leaves it.
    if (attrs) for (const [k, v] of token.attrs ?? []) attrs[k] = v || 'true'
    const pass = reason => {
      options.onFence?.({ claimed: false, reason, file })
      return (previous ?? fallback)(tokens, idx, opts, env, self)
    }
    if (!attrs) return pass('not mermaid')
    if (!isSupported(token.content)) return pass('unsupported diagram type')

    const height = attrs.height === undefined ? siteHeight : positive(attrs.height)
    const mode = attrs.mode ?? options.mode, theme = attrs.theme ?? options.theme
    const props = { source: encodeURIComponent(token.content), height: String(height ?? siteHeight) }
    if (mode && MODES.has(mode)) props.mode = mode
    if (theme) props.theme = theme
    const notes = []
    if (height === null) notes.push(`height "${attrs.height}" is not a positive number; ${siteHeight} used`)
    if (mode && !MODES.has(mode)) notes.push(`mode "${mode}" is not flat, iso or 3d; left out`)
    options.onFence?.({ claimed: true, reason: notes.length ? notes.join('; ') : 'supported', file })
    return `<BonkeiDiagram ${Object.entries(props).map(([k, v]) => `${k}="${md.utils.escapeHtml(v)}"`).join(' ')} />\n`
  }
}
