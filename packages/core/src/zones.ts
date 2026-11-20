// A tray's zone colour (theme.tray.colorBy 'zone', Cloud Cartography): each top-level tray takes the next colour of theme.tray.zones
// in the layout's order, and a nested tray its top-level ancestor's (Tray mixes it with less white, a stronger tint). Plain .ts for node tests.
import type { Box } from './model.ts'

export interface Zone { color: string; nested: boolean }

/** Each tray's zone by id; empty when the theme colours trays by level or names no zone colours. */
export function zoneColors(boxes: Map<string, Box>, tray: { colorBy: 'level' | 'zone'; zones: readonly string[] }): Map<string, Zone> {
  const m = new Map<string, Zone>()
  if (tray.colorBy !== 'zone' || !tray.zones.length) return m
  const tops = [...boxes.values()].filter(b => b.kind === 'group' && b.level === 0)
  const index = new Map(tops.map((b, i) => [b.id, i]))
  for (const b of boxes.values()) {
    if (b.kind !== 'group') continue
    let top = b
    while (top.parent && boxes.get(top.parent)) top = boxes.get(top.parent)!
    m.set(b.id, { color: tray.zones[(index.get(top.id) ?? 0) % tray.zones.length], nested: b.level > 0 })
  }
  return m
}
