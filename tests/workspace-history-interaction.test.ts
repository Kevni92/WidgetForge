import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createDockManager } from '../src/core/dock-manager'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import { createWorkspaceHistory } from '../src/core/workspace-history'
import WorkspaceHost from '../src/vue/WorkspaceHost.vue'

const Widget = defineComponent({ template: '<span>history</span>' })
function pointer(target: EventTarget, type: string, x: number, y: number): void { target.dispatchEvent(new MouseEvent(type, { button: 0, clientX: x, clientY: y, bubbles: true, cancelable: true })) }

describe('WorkspaceHost history integration', () => {
  it('records a full window drag as exactly one undo operation', async () => {
    const registry = createWidgetRegistry([defineWidget({ id: 'history.widget', title: 'History', component: Widget })])
    const windows = createWindowManager(registry)
    const docks = createDockManager(registry)
    windows.open({ widgetId: 'history.widget', instanceId: 'window', position: { x: 20, y: 30 }, size: { width: 300, height: 200 } })
    const history = createWorkspaceHistory(windows, docks)
    const wrapper = mount(WorkspaceHost, { props: { windows, docks, registry, history }, attachTo: document.body })
    const handle = wrapper.get('[data-window-instance-id="window"] [data-window-drag-handle]').element
    pointer(handle, 'pointerdown', 100, 50); pointer(globalThis.window, 'pointermove', 140, 80); pointer(globalThis.window, 'pointermove', 180, 100); pointer(globalThis.window, 'pointermove', 220, 120); pointer(globalThis.window, 'pointerup', 220, 120)
    await Promise.resolve(); await nextTick()
    expect(history.state.undoDepth).toBe(1); expect(windows.get('window').geometry.position).toEqual({ x: 140, y: 100 })
    history.undo(); await nextTick(); expect(windows.get('window').geometry.position).toEqual({ x: 20, y: 30 })
    wrapper.unmount(); history.dispose()
  })
})
