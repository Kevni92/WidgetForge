import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { createDockManager } from '../src/core/dock-manager'
import { createSplitPane, createWidgetPane } from '../src/core/pane'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import { captureWorkspace, restoreWorkspace, serializeWorkspace } from '../src/core/workspace'

const Widget = defineComponent({ template: '<span />' })

function createSetup() {
  const registry = createWidgetRegistry([
    defineWidget({ id: 'test.dock-persist', title: 'Dock', component: Widget }),
  ])
  return {
    registry,
    windows: createWindowManager(registry),
    docks: createDockManager(registry),
  }
}

describe('workspace dock persistence', () => {
  it('captures and restores dock pane trees and sizing state', () => {
    const source = createSetup()
    source.docks.add({
      id: 'top',
      position: 'top',
      pane: createSplitPane({
        id: 'top-root',
        axis: 'horizontal',
        weights: [2, 1],
        children: [
          createWidgetPane({ id: 'top-left', widgetId: 'test.dock-persist', instanceId: 'top-left-widget' }),
          createWidgetPane({ id: 'top-right', widgetId: 'test.dock-persist', instanceId: 'top-right-widget' }),
        ],
      }),
      thickness: 64,
      minThickness: 44,
      maxThickness: 100,
      resizable: true,
    })
    source.windows.open({ widgetId: 'test.dock-persist', instanceId: 'floating' })

    const snapshot = captureWorkspace(source.windows, source.docks)
    expect(snapshot.docks).toHaveLength(1)
    expect(snapshot.docks[0]).toMatchObject({ id: 'top', position: 'top', thickness: 64 })

    const target = createSetup()
    const result = restoreWorkspace(target.windows, serializeWorkspace(source.windows, source.docks), target.docks)

    expect(result.valid).toBe(true)
    expect(result.issues).toEqual([])
    expect(result.restoredDocks).toHaveLength(1)
    expect(target.docks.get('top')).toMatchObject({ thickness: 64, minThickness: 44, maxThickness: 100 })
    expect(target.docks.get('top').rootPane).toEqual(snapshot.docks[0]?.rootPane)
    expect(target.windows.get('floating').instanceId).toBe('floating')
  })

  it('requires a DockManager instead of silently dropping persisted docks', () => {
    const source = createSetup()
    source.docks.add({ id: 'bottom', position: 'bottom', pane: createWidgetPane({ id: 'bottom-pane', widgetId: 'test.dock-persist' }), thickness: 40 })

    const targetWindows = createWindowManager(source.registry)
    const result = restoreWorkspace(targetWindows, serializeWorkspace(source.windows, source.docks))

    expect(result.valid).toBe(false)
    expect(result.issues[0]?.code).toBe('dock-manager-required')
    expect(targetWindows.list()).toEqual([])
  })
})
