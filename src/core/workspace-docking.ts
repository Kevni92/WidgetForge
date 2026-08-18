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
import type { WindowManager, WindowState } from './window-manager'

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
  const rootPane = dropPaneAt(target.rootPane, targetPaneId, source.rootPane, zone, containerId)
  manager.setRootPane(targetInstanceId, rootPane, 'user')
  manager.close(sourceInstanceId, 'user')
  return manager.get(targetInstanceId)
}
