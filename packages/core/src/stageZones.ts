// Zones and the base of a stage (BON-253): the floor under each part that has one, its name's room, and the floor under the whole
// model when a zone would run past it. Plain numbers, no React and no three: the camera's fit and the scene both read it.
// Decisions: LOG.md, "A stage from a 3D model (BON-253)".
import { GROUND, groundTitle, groundWidth, type GroundFit } from './titles.ts'
import { S } from './scale.ts'
import type { StageLayout, StagePart } from './stage.ts'
import type { StageLabelMode } from './model.ts'

/** Floor left round a part inside its zone, world units. */
export const ZONE_MARGIN = 0.9
/** Floor left round the model and every zone on the base, world units (even all round). */
export const BASE_MARGIN = 0.8
/**
 * A part is small when its name, in ground capitals on its zone's floor (wrapped and shrunk as Cloud Cartography does for a zone,
 * titles.ts groundTitle), would be drawn below this size, world units. Cloud Cartography's own least size for a zone's name is 0.35;
 * on a part's footprint that is too small to read in iso, so 0.44 is the line. Measured with a 0.9 margin on the sample stages: kitchen
 * grill 0.53, prep line 0.51, register 0.45, wrap station 0.40 (long and narrow, so its name wraps); house exchange 0.68, server 0.93,
 * phone 0.43, router 0.37, telephone pole 0.31. No size line puts the wrap station above the phone, so the wrap station floats.
 */
export const READABLE = 0.44

export interface Rect { x0: number; x1: number; z0: number; z1: number }
export interface Zone extends Rect {
  w: number; h: number // the floor, world units (h includes the strip in front for the name)
  fit: GroundFit // the name as it lies on the floor
  titleX: number // where the name starts along the strip, from the floor's centre: the first place on it nothing stands on, from the left
  room: number // the strip in front of the part the name lies in
  small: boolean // its name would not read on this floor: the part is named by a floating label instead
}

/** The zone of a part: its footprint, a margin all round, and a strip in front (+z, towards the viewer) for the name, so no part stands on its own name. */
export function zoneOf(p: StagePart, blockers: Rect[] = []): Zone {
  const w = p.w * S + 2 * ZONE_MARGIN, h0 = p.h * S + 2 * ZONE_MARGIN
  const fit = groundTitle(w, h0, p.label, 0)
  const room0 = fit.size * GROUND.line * fit.lines.length + GROUND.inset // the strip in front of the part the name lies in
  const tw = Math.max(...fit.lines.map(l => groundWidth(l, fit.size))), th = fit.size * GROUND.line * fit.lines.length
  const x0 = p.cx - w / 2, x1 = p.cx + w / 2, zFront = p.cz + h0 / 2
  // The name lies in the strip in front, as Cloud Cartography puts a zone's name at a corner nothing stands on: from the front-left, slide it
  // along to the first place no object stands on; if the strip has none, grow the floor forward (a deeper strip) until it has one.
  const hit = (x: number, z1: number) => blockers.filter(b => b.x0 < x + tw && b.x1 > x && b.z0 < z1 && b.z1 > z1 - th).length
  let found: { x: number; extra: number } | null = null
  for (let extra = 0; extra <= 4 && !found; extra += 0.25) {
    const zt = zFront + room0 + extra - GROUND.inset
    for (let x = x0 + GROUND.inset; x + tw <= x1 - GROUND.inset + 1e-6; x += 0.2) if (!hit(x, zt)) { found = { x, extra }; break }
  }
  const spot = found ?? { x: x0 + GROUND.inset, extra: 0 } // nowhere free: the front-left corner, as it was
  const room = room0 + spot.extra
  return { x0, x1, z0: p.cz - h0 / 2, z1: zFront + room, w, h: h0 + room, fit, room, titleX: spot.x - (x0 + x1) / 2, small: fit.size < READABLE }
}

/** Which parts get a zone under the label mode: all for `zone`, the ones that are not small for `auto`, none otherwise. */
export const hasZone = (mode: StageLabelMode, z: Zone) => mode === 'zone' || (mode === 'auto' && !z.small)

/**
 * The stage as the camera frames it: the model's footprint, or, when a zone would run past it, a base grown to hold the model and every
 * zone with an even margin. The whole is centred on the origin (`ox`, `oz` move the model and its labels there), and the layout's width
 * and height are the base's, so fit, pan and zoom frame it.
 */
export function framed(layout: StageLayout, mode: StageLabelMode): StageLayout {
  const hw = (layout.width * S) / 2, hd = (layout.height * S) / 2
  const model: Rect = { x0: -hw, x1: hw, z0: -hd, z1: hd }
  const all: Rect = { ...model }
  for (const p of layout.parts) {
    const z = zoneOf(p, layout.blockers)
    if (!hasZone(mode, z)) continue
    all.x0 = Math.min(all.x0, z.x0); all.x1 = Math.max(all.x1, z.x1); all.z0 = Math.min(all.z0, z.z0); all.z1 = Math.max(all.z1, z.z1)
  }
  const grown = all.x0 < model.x0 - 1e-6 || all.x1 > model.x1 + 1e-6 || all.z0 < model.z0 - 1e-6 || all.z1 > model.z1 + 1e-6
  const ext: Rect = grown ? { x0: all.x0 - BASE_MARGIN, x1: all.x1 + BASE_MARGIN, z0: all.z0 - BASE_MARGIN, z1: all.z1 + BASE_MARGIN } : model
  const ox = -(ext.x0 + ext.x1) / 2, oz = -(ext.z0 + ext.z1) / 2
  const width = (ext.x1 - ext.x0) / S, height = (ext.z1 - ext.z0) / S
  // floating names (a small part's in `auto`, every part's in `sign` and `diamond`) stand up to a column of letters above the part: the fit leaves room
  const floats = layout.parts.filter(p => mode === 'sign' || mode === 'diamond' || (mode === 'auto' && zoneOf(p, layout.blockers).small))
  const reach = Math.max(layout.tall, ...floats.map(p => p.top + 1.9 + Math.min(4, [...p.label].length * 0.36)))
  const parts = layout.parts.map(p => ({ ...p, x: (p.cx + ox) / S + width / 2 - p.w / 2, y: (p.cz + oz) / S + height / 2 - p.h / 2 }))
  return { ...layout, width, height, parts, base: grown ? ext : null, reach, ox, oz }
}
