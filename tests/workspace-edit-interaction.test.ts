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
  it('marks the full pane surface as draggable in edit mode without rendering drag icons', () => {
    const normal = setup('normal')
    const normalWrapper = mount(WorkspaceHost, { props: { windows: normal.windows, docks: normal.docks, registry: normal.registry, edit: normal.edit }, attachTo: document.body })
    expect(normalWrapper.findAll('[data-pane-drag-handle]')).toHaveLength(0)
    normalWrapper.unmount()

    const edit = setup('edit')
    const editWrapper = mount(WorkspaceHost, { props: { windows: edit.windows, docks: edit.docks, registry: edit.registry, edit: edit.edit }, attachTo: document.body })
    expect(editWrapper.findAll('[data-pane-drag-handle]')).toHaveLength(0)
    expect(editWrapper.findAll('[data-pane-edit-draggable="true"]')).toHaveLength(1)
    editWrapper.unmount()

    const locked = setup('locked')
    const lockedWrapper = mount(WorkspaceHost, { props: { windows: locked.windows, docks: locked.docks, registry: locked.registry, edit: locked.edit }, attachTo: document.body })
    expect(lockedWrapper.findAll('[data-pane-drag-handle]')).toHaveLength(0)
    expect(lockedWrapper.findAll('[data-pane-edit-draggable="true"]')).toHaveLength(0)
    lockedWrapper.unmount()
  })

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

  it('shows a window inspector with identity, geometry, state and a direct layout action', async () => {
    const { registry, windows, docks, edit } = setup('edit')
    const wrapper = mount(WorkspaceHost, { props: { windows, docks, registry, edit }, attachTo: document.body })
    await wrapper.get('.wf-window-frame[data-window-instance-id="window"] .wf-pane-host[data-pane-id]').trigger('pointerdown')
    await nextTick()
    const inspector = wrapper.get('[data-workspace-selection-actions]')
    expect(inspector.get('[data-selected-window-id]').text()).toBe('window')
    expect(inspector.get('[data-window-geometry]').text()).toContain('300 px')
    expect(inspector.get('[data-window-layout-status]').text()).toContain('Floating')
    await inspector.get('[data-window-selection-layout]').trigger('click')
    await nextTick()
    expect(wrapper.get('[role="dialog"]').text()).toContain('Layout bearbeiten')
    await wrapper.get('[role="dialog"] [aria-label="Cancel"]').trigger('click')
    wrapper.unmount()
  })

  it('locks and unlocks a window through the generic edit context menu', async () => {
    const { registry, windows, docks, edit } = setup('edit')
    const wrapper = mount(WorkspaceHost, { props: { windows, docks, registry, edit }, attachTo: document.body })
    const pane = wrapper.get('.wf-pane-host[data-pane-id]').element
    pane.dispatchEvent(new MouseEvent('contextmenu', { clientX: 100, clientY: 100, bubbles: true, cancelable: true }))
    await nextTick()
    expect(wrapper.findAll('[role="menuitem"]').map((item) => item.text())).toContain('Lock window')
    await wrapper.findAll('[role="menuitem"]').find((item) => item.text() === 'Lock window')?.trigger('click')
    await nextTick()
    expect(windows.get('window').layoutLocked).toBe(true)
    expect(wrapper.find('.wf-window-shell__titlebar').exists()).toBe(false)

    wrapper.get('.wf-pane-host[data-pane-id]').element.dispatchEvent(new MouseEvent('contextmenu', { clientX: 100, clientY: 100, bubbles: true, cancelable: true }))
    await nextTick()
    expect(wrapper.findAll('[role="menuitem"]').map((item) => item.text())).toEqual(['Unlock window', 'Layout…'])
    await wrapper.get('[role="menuitem"]').trigger('click')
    await nextTick()
    expect(windows.get('window').layoutLocked).toBe(false)
    expect(wrapper.find('.wf-window-shell__titlebar').exists()).toBe(true)
    wrapper.unmount()
  })

  it('selects a chrome-less locked window as a host and unlocks it from visible edit actions', async () => {
    const { registry, windows, docks, edit } = setup('edit')
    const before = windows.get('window')
    windows.lockWindow('window', 'api')
    const wrapper = mount(WorkspaceHost, { props: { windows, docks, registry, edit }, attachTo: document.body })

    await wrapper.get('.wf-window-frame[data-window-instance-id="window"]').trigger('pointerdown')
    await nextTick()
    expect(edit.state.windowSelection).toEqual({ instanceId: 'window' })
    expect(wrapper.get('.wf-window-frame[data-window-selected="true"]').attributes('data-window-instance-id')).toBe('window')
    expect(wrapper.get('[data-window-selection-lock]').attributes('aria-label')).toBe('Unlock window Edit')

    await wrapper.get('[data-window-selection-lock]').trigger('click')
    await nextTick()
    expect(windows.get('window').layoutLocked).toBe(false)
    expect(windows.get('window').geometry).toEqual(before.geometry)
    expect(windows.get('window').rootPane).toEqual(before.rootPane)
    expect(edit.state.windowSelection).toBeNull()
    expect(wrapper.find('[data-window-selected="true"]').exists()).toBe(false)
    expect(wrapper.find('.wf-window-shell__titlebar').exists()).toBe(true)
    expect(document.activeElement).toBe(wrapper.get('.wf-window-shell').element)
    wrapper.unmount()
  })

  it('keeps a click on pane content when the pointer does not cross the drag threshold', async () => {
    const { registry, windows, docks, edit } = setup('edit')
    const wrapper = mount(WorkspaceHost, { props: { windows, docks, registry, edit }, attachTo: document.body })
    const action = wrapper.get('[data-widget-action]').element
    pointer(action, 'pointerdown', 80, 90)
    pointer(globalThis.window, 'pointerup', 80, 90)
    await wrapper.get('[data-widget-action]').trigger('click')
    expect(wrapper.get('[data-widget-action]').text()).toBe('1')
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
