// Config side of @bonkei/vitepress: a markdown-it plugin for `markdown.config`. Runs in Node at build time and imports nothing from bonkei.
// It claims ```mermaid fences that hold a flowchart or a sequence diagram and passes every other fence to the renderer that was there before.

export const DEFAULT_HEIGHT = 420

// A flowchart or a sequence diagram, after optional `---` frontmatter and %% comment lines (the types Bonkei draws).
export function isSupported(source) {
  const body = source.replace(/^\s*---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n/, '').replace(/^(\s*%%[^\n]*\n)+/, '')
  return /^\s*(flowchart|graph|sequenceDiagram)\b/.test(body)
}

// ```mermaid {height=600 mode=3d theme=bonkei}
export function parseInfo(info) {
  const m = /^mermaid\b\s*(?:\{([^}]*)\})?/.exec(info.trim())
  if (!m) return null
  const attrs = {}
  for (const pair of (m[1] ?? '').split(/[\s,]+/).filter(Boolean)) {
    const [k, ...v] = pair.split('=')
    attrs[k] = v.join('=') || 'true'
  }
  return attrs
}

/**
 * @param {import('markdown-it')} md
 * @param {{ height?: number, theme?: string, mode?: 'flat' | 'iso' | '3d', onFence?: (e: { claimed: boolean, reason: string, file?: string }) => void }} [options]
 */
export function bonkeiMarkdown(md, options = {}) {
  const previous = md.renderer.rules.fence
  const fallback = (tokens, idx, opts, env, self) => self.renderToken(tokens, idx, opts)
  md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
    const token = tokens[idx]
    const attrs = parseInfo(token.info)
    const pass = reason => {
      options.onFence?.({ claimed: false, reason, file: env?.relativePath })
      return (previous ?? fallback)(tokens, idx, opts, env, self)
    }
    if (!attrs) return pass('not mermaid')
    if (!isSupported(token.content)) return pass('unsupported diagram type')
    options.onFence?.({ claimed: true, reason: 'supported', file: env?.relativePath })
    const height = Number(attrs.height ?? options.height ?? DEFAULT_HEIGHT)
    const props = { source: encodeURIComponent(token.content), height: String(height) }
    const mode = attrs.mode ?? options.mode, theme = attrs.theme ?? options.theme
    if (mode) props.mode = mode
    if (theme) props.theme = theme
    // The source is percent-encoded so neither HTML escaping nor Vue's {{ }} can touch it.
    return `<BonkeiDiagram ${Object.entries(props).map(([k, v]) => `${k}="${md.utils.escapeHtml(v)}"`).join(' ')} />\n`
  }
}
