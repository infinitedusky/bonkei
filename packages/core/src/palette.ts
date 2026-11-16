// The scene's colours in one place: the Canvas background, the ground, the grid, edges and labels.
export const SCENE = {
  bg: '#0f1218',
  grid: ['#1d2433', '#161c28'] as [string, string], // centre lines, other lines
  edge: '#e8edf7',
  label: '#ffd479',
} as const

// The overlay chrome drawn over the scene (toolbar, error card and strip, loading text).
export const UI = {
  text: '#e8edf7',
  muted: '#7f8aa3',
  panel: 'rgba(22, 28, 40, 0.92)',
  border: '#3a4560',
  on: '#5b8def',
  error: '#ff8f8f',
} as const
