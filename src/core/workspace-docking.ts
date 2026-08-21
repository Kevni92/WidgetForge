import {
  InvalidPaneOperationError,
  containsPane,
  findPane,
  movePane,
  movePaneToTabs,
  removePane,
  splitPaneAt,
  tabPaneAt,
  type PaneNode,
  type PaneSplitEdge,
} from './pane'
import type { DockManager } from './dock-manager'
import type { WindowGeometry, WindowPosition, WindowSize } from './window-geometry'
import type { WindowManager, WindowState } from './window-manager'
import { defaultWindowOptions } from './window-options'
import { captureWorkspace, commitWorkspacePaneMutations, restoreWorkspace, validateWorkspaceSnapshot, type WorkspaceSnapshot } from './workspace'

export type WorkspaceDropZone = 'center' | PaneSplitEdge

export interface WorkspaceDropRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface WorkspacePoint {
  readonly x: number
  readonly y: number
}

export interface RelocatePaneResult {
  readonly sourceRoot: PaneNode | null
  readonly targetRoot: PaneNode
}

export function detectWorkspaceDropZone(point: WorkspacePoint, rect: WorkspaceDropRect): WorkspaceDropZone | null {
  if (rect.width <= 0 || rect.height <= 0) return null
  if (point.x < rect.x || point.y < rect.y || point.x > rect.x + rect.width || point.y > rect.y + rect.height) return null

  const localX = point.x - rect.x
  const localY = point.y - rect.y
  const edgeX = Math.min(72, rect.width * 0.25)
  const edgeY = Math.min(72, rect.height * 0.25)

  if (localX <= edgeX) return 'left'
  if (localX >= rect.width - edgeX) return 'right'
  if (localY <= edgeY) return 'top'
  if (localY >= rect.height - edgeY) return 'bottom'
  return 'center'
}

export function workspaceDropPreviewRect(zone: WorkspaceDropZone, rect: WorkspaceDropRect): WorkspaceDropRect {
  if (zone === 'center') return { ...rect }
  if (zone === 'left') return { ...rect, width: rect.width / 2 }
  if (zone === 'right') return { x: rect.x + rect.width / 2, y: rect.y, width: rect.width / 2, height: rect.height }
  if (zone === 'top') return { ...rect, height: rect.height / 2 }
  return { x: rect.x, y: rect.y + rect.height / 2, width: rect.width, height: rect.height / 2 }
}

export function dropPaneAt(
  root: PaneNode,
  targetId: string,
  incoming: PaneNode,
  zone: WorkspaceDropZone,
  containerId: string,
): PaneNode {
  const target = findPane(root, targetId)
  if (!target) throw new InvalidPaneOperationError(`target pane "${targetId}" does not exist`)
  if (containsPane(incoming, targetId)) throw new InvalidPaneOperationError('incoming pane must not contain the target pane')

  if (zone === 'center') return tabPaneAt(root, targetId, incoming, containerId)
  return splitPaneAt(root, targetId, incoming, zone, containerId)
}

export function movePaneToTarget(
  root: PaneNode,
  sourceId: string,
  targetId: string,
  zone: WorkspaceDropZone,
  containerId: string,
): PaneNode {
  if (sourceId === targetId) throw new InvalidPaneOperationError('source and target pane must differ')
  const source = findPane(root, sourceId)
  const target = findPane(root, targetId)
  if (!source) throw new InvalidPaneOperationError(`source pane "${sourceId}" does not exist`)
  if (!target) throw new InvalidPaneOperationError(`target pane "${targetId}" does not exist`)
  if (containsPane(source, targetId)) throw new InvalidPaneOperationError('a pane cannot be moved into one of its descendants')

  if (zone === 'center') return movePaneToTabs(root, sourceId, targetId, containerId)
  return movePane(root, sourceId, targetId, zone, containerId)
}

export function relocatePaneBetweenTrees(
  sourceRoot: PaneNode,
  sourceId: string,
  targetRoot: PaneNode,
  targetId: string,
  zone: WorkspaceDropZone,
  containerId: string,
): RelocatePaneResult {
  const source = findPane(sourceRoot, sourceId)
  if (!source) throw new InvalidPaneOperationError(`source pane "${sourceId}" does not exist`)
  const removed = removePane(sourceRoot, sourceId)
  return {
    sourceRoot: removed.root,
    targetRoot: dropPaneAt(targetRoot, targetId, removed.removed, zone, containerId),
  }
}

export function dockWindowIntoWindow(
  manager: WindowManager,
  sourceInstanceId: string,
  targetInstanceId: string,
  targetPaneId: string,
  zone: WorkspaceDropZone,
  containerId: string,
): WindowState {
  if (sourceInstanceId === targetInstanceId) throw new InvalidPaneOperationError('a window cannot be docked into itself')
  const source = manager.get(sourceInstanceId)
  const target = manager.get(targetInstanceId)
  if (source.layoutLocked || target.layoutLocked) throw new InvalidPaneOperationError('layout-locked windows cannot participate in window docking')
  const rootPane = dropPaneAt(target.rootPane, targetPaneId, source.rootPane, zone, containerId)
  commitWorkspacePaneMutations(manager, undefined, [
    { owner: { kind: 'window', id: sourceInstanceId }, rootPane: null },
    { owner: { kind: 'window', id: targetInstanceId }, rootPane },
  ])
  return manager.get(targetInstanceId)
}

export class WorkspaceDockTransformError extends Error {
  constructor(message: string) { super(message); this.name = 'WorkspaceDockTransformError' }
}

export interface DetachDockToWindowRequest {
  readonly dockId: string
  readonly position?: WindowPosition
  readonly size?: WindowSize
}

function nextWindowId(manager: WindowManager, requested: string): string {
  const ids = new Set(manager.list().map((window) => window.instanceId))
  if (!ids.has(requested)) return requested
  let suffix = 2
  while (ids.has(`${requested}-${suffix}`)) suffix += 1
  return `${requested}-${suffix}`
}

function clearAndRestoreWorkspace(manager: WindowManager, dockManager: DockManager, snapshot: WorkspaceSnapshot): void {
  for (const window of [...manager.list()]) manager.close(window.instanceId, 'api')
  for (const dock of [...dockManager.list()]) dockManager.remove(dock.id)
  const restored = restoreWorkspace(manager, snapshot, dockManager, undefined, { atomic: true })
  if (!restored.valid || restored.issues.length > 0) throw new WorkspaceDockTransformError('workspace transformation could not be applied atomically')
}

function applyWorkspaceTransformation(
  manager: WindowManager,
  dockManager: DockManager,
  before: WorkspaceSnapshot,
  next: WorkspaceSnapshot,
): void {
  validateWorkspaceSnapshot(next)
  try {
    clearAndRestoreWorkspace(manager, dockManager, next)
  } catch (error) {
    try { clearAndRestoreWorkspace(manager, dockManager, before) } catch (rollbackError) { throw new WorkspaceDockTransformError(`workspace transformation and rollback failed: ${String(rollbackError)}`) }
    throw error
  }
}

export function detachDockToWindow(
  manager: WindowManager,
  dockManager: DockManager,
  request: DetachDockToWindowRequest,
): WindowState {
  const dock = dockManager.get(request.dockId)
  const before = captureWorkspace(manager, dockManager)
  const restore = dock.restoreWindow
  const fallbackSize = request.size ?? {
    width: dock.position === 'left' || dock.position === 'right' ? dock.thickness : 420,
    height: dock.position === 'top' || dock.position === 'bottom' ? dock.thickness : 300,
  }
  const fallbackGeometry: WindowGeometry = {
    position: request.position ?? { x: 24, y: 24 },
    size: fallbackSize,
  }
  const instanceId = nextWindowId(manager, restore?.instanceId ?? `workspace-${dock.id}-window`)
  const geometry = restore?.geometry ?? fallbackGeometry
  const nextWindows = [...before.windows.map((window) => ({ ...window, focused: false })), {
    instanceId,
    title: restore?.title ?? `Dock ${dock.id}`,
    rootPane: dock.rootPane,
    geometry,
    constraints: restore?.constraints ?? { minSize: { width: 160, height: 96 }, maxSize: null },
    options: restore?.options ?? defaultWindowOptions,
    snap: null,
    restoreGeometry: null,
    mode: 'normal' as const,
    focused: true,
    zIndex: before.windows.reduce((max, window) => Math.max(max, window.zIndex), -1) + 1,
  }]
  const next: WorkspaceSnapshot = { version: before.version, windows: nextWindows, docks: before.docks.filter((item) => item.id !== dock.id) }
  applyWorkspaceTransformation(manager, dockManager, before, next)
  return manager.get(instanceId)
}
