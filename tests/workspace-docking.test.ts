import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { createSplitPane, createWidgetPane, findPane, InvalidPaneOperationError } from '../src/core/pane'
import { createDockManager } from '../src/core/dock-manager'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import { captureWorkspace, restoreWorkspace, serializeWorkspace } from '../src/core/workspace'
import {
  anchorWindowToDock,
  detachDockToWindow,
  detectWorkspaceDropZone,
  dockWindowIntoWindow,
  movePaneToTarget,
  relocatePaneBetweenTrees,
  workspaceDropPreviewRect,
} from '../src/core/workspace-docking'

const Widget = defineComponent({ template: '<span>content</span>' })
const registry = createWidgetRegistry([
  defineWidget({ id: 'dock.a', title: 'A', component: Widget }),
  defineWidget({ id: 'dock.b', title: 'B', component: Widget }),
  defineWidget({ id: 'dock.c', title: 'C', component: Widget }),
])

function leaf(id: string, widgetId = 'dock.a') {
  return createWidgetPane({ id, widgetId, instanceId: `${id}.widget` })
}

describe('workspace docking core', () => {
  it('detects all drop zones and returns matching preview geometry', () => {
    const rect = { x: 100, y: 50, width: 400, height: 240 }
    expect(detectWorkspaceDropZone({ x: 105, y: 150 }, rect)).toBe('left')
    expect(detectWorkspaceDropZone({ x: 495, y: 150 }, rect)).toBe('right')
    expect(detectWorkspaceDropZone({ x: 300, y: 55 }, rect)).toBe('top')
    expect(detectWorkspaceDropZone({ x: 300, y: 285 }, rect)).toBe('bottom')
    expect(detectWorkspaceDropZone({ x: 300, y: 170 }, rect)).toBe('center')
    expect(workspaceDropPreviewRect('right', rect)).toEqual({ x: 300, y: 50, width: 200, height: 240 })
  })

  it('moves panes without changing pane or widget instance ids and rejects descendant drops', () => {
    const root = createSplitPane({
      id: 'root',
      axis: 'horizontal',
      children: [
        leaf('source'),
        createSplitPane({ id: 'nested', axis: 'vertical', children: [leaf('target', 'dock.b'), leaf('other', 'dock.c')] }),
      ],
    })

    const moved = movePaneToTarget(root, 'source', 'target', 'bottom', 'moved-split')
    const source = findPane(moved, 'source')
    expect(source?.kind).toBe('widget')
    expect(source?.kind === 'widget' ? source.instanceId : null).toBe('source.widget')
    expect(findPane(moved, 'moved-split')?.kind).toBe('split')

    expect(() => movePaneToTarget(root, 'nested', 'target', 'left', 'invalid')).toThrow(InvalidPaneOperationError)
  })

  it('relocates panes across separate trees and docks an entire window tree', () => {
    const sourceRoot = createSplitPane({ id: 'source-root', axis: 'horizontal', children: [leaf('move-me'), leaf('stay')] })
    const targetRoot = leaf('target-root', 'dock.b')
    const relocated = relocatePaneBetweenTrees(sourceRoot, 'move-me', targetRoot, 'target-root', 'left', 'cross-split')

    expect(relocated.sourceRoot?.id).toBe('stay')
    expect(findPane(relocated.targetRoot, 'move-me')).toBeDefined()
    expect(findPane(relocated.targetRoot, 'cross-split')?.kind).toBe('split')

    const manager = createWindowManager(registry)
    manager.open({ widgetId: 'dock.a', instanceId: 'source-window' })
    manager.open({ widgetId: 'dock.b', instanceId: 'target-window' })
    const sourcePaneId = manager.get('source-window').rootPane.id
    const targetPaneId = manager.get('target-window').rootPane.id

    const result = dockWindowIntoWindow(manager, 'source-window', 'target-window', targetPaneId, 'right', 'window-split')
    expect(manager.list().map((window) => window.instanceId)).toEqual(['target-window'])
    expect(findPane(result.rootPane, sourcePaneId)).toBeDefined()
    expect(findPane(result.rootPane, 'window-split')?.kind).toBe('split')
  })

  it.each(['top', 'bottom', 'left', 'right'] as const)('anchors and detaches the same window pane at the %s edge', (position) => {
    const manager = createWindowManager(registry)
    const docks = createDockManager(registry)
    const opened = manager.openPane({ pane: leaf(`anchor-${position}`), instanceId: `anchor-${position}`, title: 'Anchorable', position: { x: 42, y: 36 }, size: { width: 500, height: 260 }, minSize: { width: 240, height: 180 }, maxSize: { width: 600, height: 300 } })
    const paneId = opened.rootPane.id
    const widgetInstanceId = opened.rootPane.kind === 'widget' ? opened.rootPane.instanceId : null

    const dock = anchorWindowToDock(manager, docks, { instanceId: opened.instanceId, position })
    expect(manager.list()).toEqual([])
    expect(dock.position).toBe(position)
    expect(dock.thickness).toBe(position === 'top' || position === 'bottom' ? 260 : 500)
    expect(dock.minThickness).toBe(position === 'top' || position === 'bottom' ? 180 : 240)
    expect(dock.maxThickness).toBe(position === 'top' || position === 'bottom' ? 300 : 600)
    expect(dock.rootPane.id).toBe(paneId)
    expect(dock.rootPane.kind === 'widget' ? dock.rootPane.instanceId : null).toBe(widgetInstanceId)

    const detached = detachDockToWindow(manager, docks, { dockId: dock.id })
    expect(docks.list()).toEqual([])
    expect(detached.instanceId).toBe(opened.instanceId)
    expect(detached.title).toBe('Anchorable')
    expect(detached.geometry).toEqual(opened.geometry)
    expect(detached.rootPane.id).toBe(paneId)
    expect(detached.rootPane.kind === 'widget' ? detached.rootPane.instanceId : null).toBe(widgetInstanceId)
  })

  it('uses deterministic dock ids and persists the floating restore metadata', () => {
    const manager = createWindowManager(registry)
    const docks = createDockManager(registry)
    docks.add({ id: 'anchor-window-dock', position: 'top', pane: leaf('existing'), thickness: 32 })
    manager.openPane({ pane: leaf('anchor-window'), instanceId: 'anchor-window', title: 'Persist me', size: { width: 410, height: 220 } })

    const dock = anchorWindowToDock(manager, docks, { instanceId: 'anchor-window', position: 'bottom' })
    expect(dock.id).toBe('anchor-window-dock-2')
    const serialized = serializeWorkspace(manager, docks)
    const target = createWindowManager(registry)
    const targetDocks = createDockManager(registry)
    expect(restoreWorkspace(target, serialized, targetDocks).valid).toBe(true)
    expect(targetDocks.get(dock.id).restoreWindow?.instanceId).toBe('anchor-window')
    expect(captureWorkspace(target, targetDocks).docks.find((item) => item.id === dock.id)?.restoreWindow?.geometry.size).toEqual({ width: 410, height: 220 })
  })

  it('rejects modal windows before changing workspace state', () => {
    const manager = createWindowManager(registry)
    const docks = createDockManager(registry)
    manager.open({ widgetId: 'dock.a', instanceId: 'modal-window', options: { role: 'modal' } })

    expect(() => anchorWindowToDock(manager, docks, { instanceId: 'modal-window', position: 'top' })).toThrow(/role/)
    expect(manager.list().map((window) => window.instanceId)).toEqual(['modal-window'])
    expect(docks.list()).toEqual([])
  })

  it('rolls back when the source widget is not dockable', () => {
    const onlyFloating = defineWidget({ id: 'dock.floating-only', title: 'Floating only', component: Widget, capabilities: { dockable: false } })
    const localRegistry = createWidgetRegistry([onlyFloating])
    const manager = createWindowManager(localRegistry)
    const docks = createDockManager(localRegistry)
    manager.open({ widgetId: onlyFloating.id, instanceId: 'floating-only' })

    expect(() => anchorWindowToDock(manager, docks, { instanceId: 'floating-only', position: 'left' })).toThrow()
    expect(manager.list().map((window) => window.instanceId)).toEqual(['floating-only'])
    expect(docks.list()).toEqual([])
  })
})
