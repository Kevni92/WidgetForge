import { defineComponent, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createDockManager } from '../src/core/dock-manager'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import { createWorkspaceEditController } from '../src/core/workspace-edit'
import WorkspaceHost from '../src/vue/WorkspaceHost.vue'

const Widget = defineComponent({
  setup() { const count = ref(0); return { count } },
  template: '<button data-widget-action @click="count += 1">{{ count }}</button>',
})

function setup(mode: 'normal' | 'edit' | 'locked') {
  const registry = createWidgetRegistry([defineWidget({ id: 'edit.widget', title: 'Edit', component: Widget })])
  const windows = createWindowManager(registry)
  const docks = createDockManager(registry)
  const edit = createWorkspaceEditController({ mode })
  windows.open({ widgetId: 'edit.widget', instanceId: 'window', position: { x: 20, y: 30 }, size: { width: 300, height: 200 } })
  return { registry, windows, docks, edit }
}

function pointer(target: EventTarget, type: string, x: number, y: number): void {
  target.dispatchEvent(new MouseEvent(type, { button: 0, clientX: x, clientY: y, bubbles: true, cancelable: true }))
}

describe('WorkspaceHost edit mode', () => {
  it('prevents structural window interaction while locked but leaves widget interaction active', async () => {
    const { registry, windows, docks, edit } = setup('locked')
    const wrapper = mount(WorkspaceHost, { props: { windows, docks, registry, edit }, attachTo: document.body })
    const before = windows.get('window').geometry
    const handle = wrapper.get('[data-window-drag-handle]').element
    pointer(handle, 'pointerdown', 60, 40)
    pointer(globalThis.window, 'pointermove', 180, 140)
    pointer(globalThis.window, 'pointerup', 180, 140)
    await nextTick()
    expect(windows.get('window').geometry).toEqual(before)
    expect(wrapper.find('[data-window-resize-handle]').exists()).toBe(false)
    await wrapper.get('[data-widget-action]').trigger('click')
    expect(wrapper.get('[data-widget-action]').text()).toBe('1')
    wrapper.unmount()
  })

  it('selects panes in explicit edit mode and integrates pane lock context actions', async () => {
    const { registry, windows, docks, edit } = setup('edit')
    const wrapper = mount(WorkspaceHost, { props: { windows, docks, registry, edit }, attachTo: document.body })
    const pane = wrapper.get('.wf-pane-host[data-pane-id]').element
    pointer(pane, 'pointerdown', 80, 90)
    await nextTick()
    expect(edit.state.selection?.paneId).toBe('window.root')
    expect(wrapper.get('.wf-pane-host').attributes('data-pane-selected')).toBe('true')

    pane.dispatchEvent(new MouseEvent('contextmenu', { clientX: 100, clientY: 100, bubbles: true, cancelable: true }))
    await nextTick()
    const lock = wrapper.findAll('[role="menuitem"]').find((item) => item.text() === 'Lock pane')
    expect(lock).toBeDefined()
    await lock?.trigger('click')
    await nextTick()
    expect(edit.isPaneLocked({ owner: { kind: 'window', id: 'window' }, paneId: 'window.root' })).toBe(true)
    expect(wrapper.get('.wf-pane-host').attributes('data-pane-layout-locked')).toBe('true')
    wrapper.unmount()
  })

  it('uses Control only as temporary edit while normal and never overrides locked mode', async () => {
    const { registry, windows, docks, edit } = setup('normal')
    const wrapper = mount(WorkspaceHost, { props: { windows, docks, registry, edit }, attachTo: document.body })
    globalThis.window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control' }))
    expect(edit.state.editActive).toBe(true)
    globalThis.window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control' }))
    expect(edit.state.editActive).toBe(false)
    edit.setMode('locked')
    globalThis.window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control' }))
    expect(edit.state).toMatchObject({ mode: 'locked', editActive: false, locked: true })
    wrapper.unmount()
  })
})
