import type { DataClient, DataClientDiagnostics } from '../data/data-client'
import type { DockManager } from './dock-manager'
import type { PaneNode, PaneSettings } from './pane'
import type { WindowGeometry } from './window-geometry'
import type { WindowManager, WindowMode } from './window-manager'
import type { WindowLayer, WindowRole } from './window-options'
import { captureWorkspace, type WorkspaceSnapshot } from './workspace'

export type DevToolsPaneOwnerKind = 'window' | 'dock'

export interface DevToolsPaneDiagnostic {
  readonly id: string
  readonly kind: PaneNode['kind']
  readonly ownerKind: DevToolsPaneOwnerKind
  readonly ownerId: string
  readonly parentId: string | null
  readonly depth: number
  readonly path: readonly string[]
  readonly settings: PaneSettings | null
  readonly widgetId: string | null
  readonly instanceId: string | null
  readonly activeChildId: string | null
}

export interface DevToolsWindowDiagnostic {
  readonly instanceId: string
  readonly title: string
  readonly focused: boolean
  readonly zIndex: number
  readonly layer: WindowLayer
  readonly role: WindowRole
  readonly mode: WindowMode
  readonly geometry: WindowGeometry
  readonly rootPaneId: string
}

export interface DevToolsDockDiagnostic {
  readonly id: string
  readonly position: 'top' | 'bottom' | 'left' | 'right'
  readonly thickness: number
  readonly resizable: boolean
  readonly rootPaneId: string
}

export interface WidgetForgeDevToolsSnapshot {
  readonly workspace: WorkspaceSnapshot
  readonly windows: readonly DevToolsWindowDiagnostic[]
  readonly docks: readonly DevToolsDockDiagnostic[]
  readonly panes: readonly DevToolsPaneDiagnostic[]
  readonly data: DataClientDiagnostics | null
}

function cloneSettings(settings: PaneSettings | undefined): PaneSettings | null {
  return settings ? { ...settings } : null
}

function flattenPane(
  pane: PaneNode,
  ownerKind: DevToolsPaneOwnerKind,
  ownerId: string,
  parentId: string | null,
  path: readonly string[],
  result: DevToolsPaneDiagnostic[],
): void {
  const nextPath = [...path, pane.id]
  result.push(Object.freeze({
    id: pane.id,
    kind: pane.kind,
    ownerKind,
    ownerId,
    parentId,
    depth: path.length,
    path: Object.freeze(nextPath),
    settings: cloneSettings(pane.settings),
    widgetId: pane.kind === 'widget' ? pane.widgetId : null,
    instanceId: pane.kind === 'widget' ? pane.instanceId : null,
    activeChildId: pane.kind === 'tabs' ? pane.activeId : null,
  }))
  if (pane.kind !== 'widget') {
    for (const child of pane.children) flattenPane(child, ownerKind, ownerId, pane.id, nextPath, result)
  }
}

export function captureWidgetForgeDevToolsSnapshot(
  windows: WindowManager,
  docks?: DockManager,
  dataClient?: DataClient,
): WidgetForgeDevToolsSnapshot {
  const workspace = captureWorkspace(windows, docks)
  const panes: DevToolsPaneDiagnostic[] = []
  for (const window of workspace.windows) flattenPane(window.rootPane, 'window', window.instanceId, null, [], panes)
  for (const dock of workspace.docks) flattenPane(dock.rootPane, 'dock', dock.id, null, [], panes)

  return Object.freeze({
    workspace,
    windows: Object.freeze(workspace.windows.map((window) => Object.freeze({
      instanceId: window.instanceId,
      title: window.title,
      focused: window.focused,
      zIndex: window.zIndex,
      layer: window.options.layer,
      role: window.options.role,
      mode: window.mode,
      geometry: {
        position: { ...window.geometry.position },
        size: { ...window.geometry.size },
      },
      rootPaneId: window.rootPane.id,
    }))),
    docks: Object.freeze(workspace.docks.map((dock) => Object.freeze({
      id: dock.id,
      position: dock.position,
      thickness: dock.thickness,
      resizable: dock.resizable,
      rootPaneId: dock.rootPane.id,
    }))),
    panes: Object.freeze(panes),
    data: dataClient?.diagnostics() ?? null,
  })
}
