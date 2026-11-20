// The path of a dotted link drawn as an arc overhead (theme.edge.dotted 'arc', EdgeScene ArcLink). Plain .ts so node tests can import it.

/** A point in world units: x, y (up), z. */
export type V3 = [number, number, number]

/** How many points an arc is drawn with (an odd count, so the middle one is its peak). */
export const ARC_POINTS = 49
/** A link from a node to itself: the loop's reach to the side and its height, world units. */
const LOOP = { reach: 0.7, height: 1.4 }

/**
 * The arc from `a` to `b`: a parabola whose peak stands `peak` times the span in plan above the straight line between them.
 * A link from a node to itself (no span) is a loop standing over the node, so it is still seen and still has a direction at its end.
 */
export function arcPath(a: V3, b: V3, peak: number, n = ARC_POINTS): V3[] {
  const span = Math.hypot(b[0] - a[0], b[2] - a[2])
  return Array.from({ length: n }, (_, i): V3 => {
    const t = i / (n - 1)
    if (span < 0.01) return [a[0] + LOOP.reach * Math.sin(2 * Math.PI * t), a[1] + LOOP.height * Math.sin(Math.PI * t), a[2]]
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + 4 * span * peak * t * (1 - t), a[2] + (b[2] - a[2]) * t]
  })
}
