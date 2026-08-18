import {
  InvalidPaneOperationError,
  containsPane,
  findPane,
  movePane,
  removePane,
  replacePane,
  splitPaneAt,
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
  splitId: string,
): PaneNode {
  const target = findPane(root, targetId)
  if (!target) throw new InvalidPaneOperationError(`target pane "${targetId}" does not exist`)
  if (containsPane(incoming, targetId)) throw new InvalidPaneOperationError('incoming pane must not contain the target pane')

  if (zone === 'center') {
    if (target.kind === 'split') throw new InvalidPaneOperationError('center drop requires a leaf pane')
    return replacePane(root, targetId, incoming)
  }
  return splitPaneAt(root, targetId, incoming, zone, splitId)
}

export function movePaneToTarget(
  root: PaneNode,
  sourceId: string,
  targetId: string,
  zone: WorkspaceDropZone,
  splitId: string,
): PaneNode {
  if (sourceId === targetId) throw new InvalidPaneOperationError('source and target pane must differ')
  const source = findPane(root, sourceId)
  const target = findPane(root, targetId)
  if (!source) throw new InvalidPaneOperationError(`source pane "${sourceId}" does not exist`)
  if (!target) throw new InvalidPaneOperationError(`target pane "${targetId}" does not exist`)
  if (containsPane(source, targetId)) throw new InvalidPaneOperationError('a pane cannot be moved into one of its descendants')

  if (zone !== 'center') return movePane(root, sourceId, targetId, zone, splitId)
  if (source.id === root.id) throw new InvalidPaneOperationError('the root pane cannot be moved inside itself')
  if (target.kind === 'split') throw new InvalidPaneOperationError('center drop requires a leaf pane')

  const removed = removePane(root, sourceId)
  if (!removed.root || !findPane(removed.root, targetId)) {
    throw new InvalidPaneOperationError('target pane is not available after removing the source')
  }
  return replacePane(removed.root, targetId, removed.removed)
}

export function relocatePaneBetweenTrees(
  sourceRoot: PaneNode,
  sourceId: string,
  targetRoot: PaneNode,
  targetId: string,
  zone: WorkspaceDropZone,
  splitId: string,
): RelocatePaneResult {
  const source = findPane(sourceRoot, sourceId)
  if (!source) throw new InvalidPaneOperationError(`source pane "${sourceId}" does not exist`)
  const removed = removePane(sourceRoot, sourceId)
  return {
    sourceRoot: removed.root,
    targetRoot: dropPaneAt(targetRoot, targetId, removed.removed, zone, splitId),
  }
}

export function dockWindowIntoWindow(
  manager: WindowManager,
  sourceInstanceId: string,
  targetInstanceId: string,
  targetPaneId: string,
  zone: WorkspaceDropZone,
  splitId: string,
): WindowState {
  if (sourceInstanceId === targetInstanceId) throw new InvalidPaneOperationError('a window cannot be docked into itself')
  const source = manager.get(sourceInstanceId)
  const target = manager.get(targetInstanceId)
  const rootPane = dropPaneAt(target.rootPane, targetPaneId, source.rootPane, zone, splitId)
  manager.setRootPane(targetInstanceId, rootPane, 'user')
  manager.close(sourceInstanceId, 'user')
  return manager.get(targetInstanceId)
}
