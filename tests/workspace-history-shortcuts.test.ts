import { defineComponent } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createDockManager } from '../src/core/dock-manager'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import { createWorkspaceHistory } from '../src/core/workspace-history'
import { handleWorkspaceHistoryShortcut } from '../src/vue/workspace-history-shortcuts'

const Widget = defineComponent({ template: '<span>history</span>' })

function setup() {
  const registry = createWidgetRegistry([defineWidget({ id: 'history.widget', title: 'History', component: Widget })])
  const windows = createWindowManager(registry)
  const docks = createDockManager(registry)
  const history = createWorkspaceHistory(windows, docks)
  return { windows, history }
}

function event(key: string, target: EventTarget | null = document.body, shiftKey = false) {
  return { key, ctrlKey: true, metaKey: false, shiftKey, target, preventDefault: vi.fn() }
}

describe('workspace history shortcuts', () => {
  it('maps Ctrl+Z, Ctrl+Y and Ctrl+Shift+Z to undo/redo', () => {
    const { windows, history } = setup()
    windows.open({ widgetId: 'history.widget', instanceId: 'window' })

    const undo = event('z')
    expect(handleWorkspaceHistoryShortcut(history, undo)).toBe(true)
    expect(windows.list()).toHaveLength(0)
    expect(undo.preventDefault).toHaveBeenCalledOnce()

    const redo = event('y')
    expect(handleWorkspaceHistoryShortcut(history, redo)).toBe(true)
    expect(windows.list()).toHaveLength(1)

    const undoAgain = event('z')
    handleWorkspaceHistoryShortcut(history, undoAgain)
    const shiftRedo = event('z', document.body, true)
    expect(handleWorkspaceHistoryShortcut(history, shiftRedo)).toBe(true)
    expect(windows.list()).toHaveLength(1)
    history.dispose()
  })

  it('ignores disabled shortcuts and editable controls', () => {
    const { windows, history } = setup()
    windows.open({ widgetId: 'history.widget', instanceId: 'window' })
    const input = document.createElement('input')

    expect(handleWorkspaceHistoryShortcut(history, event('z'), false)).toBe(false)
    expect(handleWorkspaceHistoryShortcut(history, event('z', input))).toBe(false)
    expect(windows.list()).toHaveLength(1)
    history.dispose()
  })
})
