import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { createSplitPane, createWidgetPane, findPane, InvalidPaneOperationError } from '../src/core/pane'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import {
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
})
