import { resolveLegacyPaneSurfaceStyle, type LayoutSurfaceStyle } from './layout-surface-style'
import type { PaneNode } from './pane'
import type { DockState } from './dock-manager'
import type { WindowState } from './window-manager'

export type LayoutInspectorHostKind = 'window' | 'dock' | 'pane'

export interface LayoutInspectorSelection {
  readonly kind: LayoutInspectorHostKind
  readonly id: string
  readonly label: string
  readonly ownerId?: string
  readonly ownerKind?: 'window' | 'dock'
  readonly window?: WindowState
  readonly dock?: DockState
  readonly pane?: PaneNode
  readonly surfaceStyle?: LayoutSurfaceStyle
}

export function createWindowInspectorSelection(window: WindowState): LayoutInspectorSelection {
  return { kind: 'window', id: window.instanceId, label: window.title, window, ...(window.options.surfaceStyle ? { surfaceStyle: window.options.surfaceStyle } : {}) }
}

export function createDockInspectorSelection(dock: DockState): LayoutInspectorSelection {
  return { kind: 'dock', id: dock.id, label: dock.id, dock, ...(dock.surfaceStyle ? { surfaceStyle: dock.surfaceStyle } : {}) }
}

export function createPaneInspectorSelection(pane: PaneNode, ownerKind: 'window' | 'dock', ownerId: string): LayoutInspectorSelection {
  const label = pane.id
  const style = pane.settings?.surfaceStyle ?? resolveLegacyPaneSurfaceStyle(pane.settings)
  return { kind: 'pane', id: pane.id, label, ownerKind, ownerId, pane, ...(style ? { surfaceStyle: style } : {}) }
}
