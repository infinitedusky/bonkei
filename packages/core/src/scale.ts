// Layout-to-world scale and the scene's fixed heights. Plain .ts so node (strip-types) can load
// it through camera.ts; shapes.tsx re-exports these for existing imports.
export const S = 1 / 40 // px -> world
export const TRAY = 0.25 // tray thickness (one level)
export const NODE_H = 0.7
export const TEXT_LAYER = 1 // text and labels: on the main camera, left out of portal views
// The height of the top of a Cloud Cartography icon by shape (world units, icons.tsx): where its callout's leader starts. Plain data so the camera can use it.
export const ICON_TOP = { rect: 1.13, round: 0.62, cylinder: 0.84, diamond: 0.95 } as const
export const CARD_H = 0.95 // a callout card with a subtitle
/** How high the tallest thing standing on a box reaches, for the camera's fit: a landscape form on its plinth, or an icon with its leader and card. */
export function headroom(th: { node: { form: string; icon: { size: number } }; label: { card: { gap: number } } }): number {
  return th.node.form === 'icon' ? Math.max(...Object.values(ICON_TOP)) * (th.node.icon.size / 1.2) + th.label.card.gap + CARD_H : 1.6
}
