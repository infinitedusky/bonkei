import { Component, type ReactNode } from 'react'

// A scene's chunk failing to load (a dropped connection, a deploy mid-visit), or the scene throwing while it renders,
// would otherwise unmount the whole page: this turns it into `onFailed`, and the section shows its picture instead.
// Hero and How use it; it is plain React, so it adds nothing of the scene to the page's entry chunk.
export class SceneBoundary extends Component<{ onFailed: (message: string) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(e: unknown) { this.props.onFailed(e instanceof Error ? e.message : String(e)) }
  render() { return this.state.failed ? null : this.props.children }
}
