import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createWindowGroupManager } from '../src/core/window-groups'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import WindowManagerHost from '../src/vue/WindowManagerHost.vue'

const Widget = defineComponent({ template: '<span>group</span>' })
function pointer(target: EventTarget, type: string, x: number, y: number): void { target.dispatchEvent(new MouseEvent(type, { button: 0, clientX: x, clientY: y, bubbles: true, cancelable: true })) }

describe('grouped window host interactions', () => {
  it('moves grouped windows with one shared pointer delta and exposes group identity', async () => {
    const registry = createWidgetRegistry([defineWidget({ id: 'group.widget', title: 'Group', component: Widget })])
    const windows = createWindowManager(registry)
    windows.open({ widgetId: 'group.widget', instanceId: 'a', position: { x: 20, y: 30 }, size: { width: 240, height: 180 } })
    windows.open({ widgetId: 'group.widget', instanceId: 'b', position: { x: 320, y: 160 }, size: { width: 240, height: 180 } })
    const groups = createWindowGroupManager(windows)
    groups.assign('ops', ['a', 'b'])
    const wrapper = mount(WindowManagerHost, { props: { manager: windows, registry }, attachTo: document.body })

    expect(wrapper.get('[data-window-instance-id="a"]').attributes('data-window-group')).toBe('ops')
    const handle = wrapper.get('[data-window-instance-id="a"] [data-window-drag-handle]').element
    pointer(handle, 'pointerdown', 60, 45)
    pointer(globalThis.window, 'pointermove', 120, 95)
    pointer(globalThis.window, 'pointerup', 120, 95)
    await nextTick()
    expect(windows.get('a').geometry.position).toEqual({ x: 80, y: 80 })
    expect(windows.get('b').geometry.position).toEqual({ x: 380, y: 210 })
    wrapper.unmount(); groups.dispose()
  })

  it('minimizes the full group from one member while individual close only removes that member', async () => {
    const registry = createWidgetRegistry([defineWidget({ id: 'group.widget', title: 'Group', component: Widget })])
    const windows = createWindowManager(registry)
    windows.open({ widgetId: 'group.widget', instanceId: 'a' }); windows.open({ widgetId: 'group.widget', instanceId: 'b' })
    const groups = createWindowGroupManager(windows); groups.assign('ops', ['a', 'b'])
    const wrapper = mount(WindowManagerHost, { props: { manager: windows, registry }, attachTo: document.body })
    await wrapper.get('[data-window-instance-id="a"] .wf-window-shell__minimize').trigger('click'); await nextTick()
    expect(windows.get('a').mode).toBe('minimized'); expect(windows.get('b').mode).toBe('minimized')
    groups.restoreGroup('ops'); await nextTick()
    await wrapper.get('[data-window-instance-id="a"] .wf-window-shell__close').trigger('click'); await nextTick()
    expect(windows.list().map((window) => window.instanceId)).toEqual(['b'])
    expect(groups.get('ops')?.members).toEqual(['b'])
    wrapper.unmount(); groups.dispose()
  })
})
