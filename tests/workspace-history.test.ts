import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { createDockManager } from '../src/core/dock-manager'
import { createSplitPane, createWidgetPane, findPane } from '../src/core/pane'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import { createWorkspaceHistory } from '../src/core/workspace-history'

const Widget = defineComponent({ template: '<span />' })
function setup() {
  const registry = createWidgetRegistry([
    defineWidget({ id: 'history.a', title: 'A', component: Widget }),
    defineWidget({ id: 'history.b', title: 'B', component: Widget }),
  ])
  const windows = createWindowManager(registry)
  const docks = createDockManager(registry)
  return { registry, windows, docks }
}

describe('WorkspaceHistory', () => {
  it('undoes and redoes open, minimize and close state from serializable snapshots', () => {
    const { windows, docks } = setup()
    const history = createWorkspaceHistory(windows, docks)
    windows.open({ widgetId: 'history.a', instanceId: 'a' })
    windows.minimize('a', 'user')
    expect(history.state.undoDepth).toBe(2)

    expect(history.undo()).toBe(true)
    expect(windows.get('a').mode).toBe('normal')
    expect(history.undo()).toBe(true)
    expect(windows.list()).toHaveLength(0)
    expect(history.redo()).toBe(true)
    expect(windows.get('a').instanceId).toBe('a')
    history.dispose()
  })

  it('undoes and redoes a per-window layout lock without changing geometry', () => {
    const { windows } = setup()
    windows.open({ widgetId: 'history.a', instanceId: 'window', position: { x: 20, y: 30 }, size: { width: 280, height: 180 } })
    const history = createWorkspaceHistory(windows)
    const geometry = windows.get('window').geometry

    windows.lockWindow('window', 'user')
    expect(history.state.undoDepth).toBe(1)
    expect(windows.get('window')).toMatchObject({ layoutLocked: true, geometry })
    expect(history.undo()).toBe(true)
    expect(windows.get('window')).toMatchObject({ layoutLocked: false, geometry })
    expect(history.redo()).toBe(true)
    expect(windows.get('window')).toMatchObject({ layoutLocked: true, geometry })
    history.dispose()
  })

  it('does not add history entries for responsive workspace resize but does for contract edits', () => {
    const { windows } = setup()
    windows.open({ widgetId: 'history.a', instanceId: 'sidebar', position: { x: 10, y: 10 }, size: { width: 200, height: 100 } })
    const history = createWorkspaceHistory(windows)
    windows.setLayoutSpec('sidebar', {
      horizontal: { start: { target: { kind: 'workspace', edge: 'left' } }, size: { value: 25, unit: 'percent' } },
      vertical: { start: { target: { kind: 'workspace', edge: 'top' } }, end: { target: { kind: 'workspace', edge: 'bottom' } } },
    }, { width: 800, height: 600 }, 'user')
    expect(history.state.undoDepth).toBe(1)
    const dormantGeometry = windows.get('sidebar').geometry
    windows.resolveResponsiveLayouts({ width: 1200, height: 700 }, 'api')
    expect(history.state.undoDepth).toBe(1)
    expect(windows.get('sidebar').geometry).toEqual(dormantGeometry)
    expect(history.undo()).toBe(true)
    expect(windows.get('sidebar').layoutSpec).toBeUndefined()
    history.dispose()
  })

  it('commits many geometry changes in one transaction as one undo entry', () => {
    const { windows, docks } = setup()
    windows.open({ widgetId: 'history.a', instanceId: 'a', position: { x: 10, y: 20 }, size: { width: 300, height: 200 } })
    const history = createWorkspaceHistory(windows, docks)
    history.beginTransaction()
    windows.setGeometry('a', { position: { x: 20, y: 30 }, size: { width: 310, height: 210 } }, 'user')
    windows.setGeometry('a', { position: { x: 50, y: 60 }, size: { width: 320, height: 220 } }, 'user')
    windows.setGeometry('a', { position: { x: 80, y: 90 }, size: { width: 330, height: 230 } }, 'user')
    expect(history.commitTransaction()).toBe(true)
    expect(history.state.undoDepth).toBe(1)
    history.undo()
    expect(windows.get('a').geometry).toEqual({ position: { x: 10, y: 20 }, size: { width: 300, height: 200 } })
    history.redo()
    expect(windows.get('a').geometry).toEqual({ position: { x: 80, y: 90 }, size: { width: 330, height: 230 } })
    history.dispose()
  })

  it('groups pane reparenting and dock resize while preserving pane ids', () => {
    const { windows, docks } = setup()
    windows.openPane({ instanceId: 'a', pane: createSplitPane({ id: 'root', axis: 'horizontal', children: [createWidgetPane({ id: 'left', widgetId: 'history.a', instanceId: 'left-widget' }), createWidgetPane({ id: 'right', widgetId: 'history.b', instanceId: 'right-widget' })] }) })
    docks.add({ id: 'bottom', position: 'bottom', thickness: 40, pane: createWidgetPane({ id: 'dock-pane', widgetId: 'history.a' }) })
    const history = createWorkspaceHistory(windows, docks)

    history.beginTransaction()
    windows.setRootPane('a', createSplitPane({ id: 'root-next', axis: 'vertical', children: [createWidgetPane({ id: 'left', widgetId: 'history.a', instanceId: 'left-widget' }), createWidgetPane({ id: 'right', widgetId: 'history.b', instanceId: 'right-widget' })] }), 'user')
    docks.setThickness('bottom', 80)
    history.commitTransaction()
    expect(history.state.undoDepth).toBe(1)

    history.undo()
    expect(docks.get('bottom').thickness).toBe(40)
    expect(findPane(windows.get('a').rootPane, 'left')).toMatchObject({ instanceId: 'left-widget' })
    expect(windows.get('a').rootPane.id).toBe('root')
    history.dispose()
  })

  it('drops redo entries after a new operation and enforces the configured limit', () => {
    const { windows, docks } = setup()
    const history = createWorkspaceHistory(windows, docks, { limit: 2 })
    windows.open({ widgetId: 'history.a', instanceId: 'a' })
    windows.minimize('a', 'user')
    windows.restore('a', 'user')
    expect(history.state.undoDepth).toBe(2)
    history.undo()
    expect(history.state.canRedo).toBe(true)
    windows.close('a', 'user')
    expect(history.state.canRedo).toBe(false)
    expect(history.state.undoDepth).toBe(2)
    history.dispose()
  })
})
