import { defineComponent, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createDockManager } from '../src/core/dock-manager'
import { createWidgetPane } from '../src/core/pane'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import { createWorkspaceHistory } from '../src/core/workspace-history'
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
  it('provides a persistent canvas editor layer, dims inert content and supports keyboard host selection', async () => {
    const { registry, windows, docks, edit } = setup('normal')
    const wrapper = mount(WorkspaceHost, { props: { windows, docks, registry, edit }, attachTo: document.body })

    await wrapper.get('[data-workspace-edit-toggle]').trigger('click')
    await nextTick()
    expect(edit.state.mode).toBe('edit')
    expect(wrapper.get('[data-workspace-edit-status]').text()).toBe('Layout editing')
    expect(wrapper.get('[data-workspace-edit-toggle]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-layout-inspector-empty]').text()).toContain('Select a window')
    expect(wrapper.find('[data-layout-edit-interaction-layer]').exists()).toBe(true)
    expect(wrapper.get('.wf-window-shell__content').attributes('inert')).toBeDefined()
    expect(wrapper.get('.wf-window-shell__content').attributes('data-layout-content')).toBe('dimmed')

    const frame = wrapper.get('.wf-window-frame[data-window-instance-id="window"]').element as HTMLElement
    frame.focus()
    await nextTick()
    expect(edit.state.windowSelection).toEqual({ instanceId: 'window' })

    await wrapper.get('[data-workspace-edit-toggle]').trigger('click')
    await nextTick()
    expect(edit.state.mode).toBe('normal')
    expect(edit.state.windowSelection).toBeNull()
    expect(wrapper.find('[data-layout-edit-interaction-layer]').exists()).toBe(false)
    expect(wrapper.find('[data-workspace-edit-status]').exists()).toBe(false)
    expect(wrapper.get('[data-workspace-edit-toggle]').attributes('aria-pressed')).toBe('false')
    expect(wrapper.get('.wf-window-shell__content').attributes('inert')).toBeUndefined()
    wrapper.unmount()
  })

  it('edits free geometry and direct constraint distance in the stable layout inspector', async () => {
    const free = setup('edit')
    const freeWrapper = mount(WorkspaceHost, { props: { windows: free.windows, docks: free.docks, registry: free.registry, edit: free.edit }, attachTo: document.body })
    await freeWrapper.get('.wf-pane-host[data-pane-id="window.root"]').trigger('pointerdown')
    await nextTick()
    await freeWrapper.get('[data-layout-inspector-x]').setValue('120')
    await freeWrapper.get('[data-layout-inspector-x]').trigger('blur')
    await nextTick()
    expect(free.windows.get('window').geometry.position.x).toBe(120)
    freeWrapper.unmount()

    const constrained = setup('edit')
    constrained.windows.open({ widgetId: 'edit.widget', instanceId: 'target', position: { x: 400, y: 30 }, size: { width: 220, height: 180 } })
    constrained.windows.setLayoutSpec('window', {
      horizontal: { end: { target: { kind: 'window', instanceId: 'target', edge: 'left' } }, size: { value: 300, unit: 'px' } },
      vertical: { start: { target: { kind: 'workspace', edge: 'top' } }, size: { value: 200, unit: 'px' } },
    }, { width: 800, height: 600 }, 'api', 'active')
    const constrainedWrapper = mount(WorkspaceHost, { props: { windows: constrained.windows, docks: constrained.docks, registry: constrained.registry, edit: constrained.edit }, attachTo: document.body })
    await constrainedWrapper.get('.wf-pane-host[data-pane-id="window.root"]').trigger('pointerdown')
    await nextTick()
    await constrainedWrapper.get('[data-window-layout-relation]').trigger('click')
    expect(constrainedWrapper.get('[data-window-constraint-card="right"]').classes()).toContain('wf-layout-inspector__constraint--selected')
    await constrainedWrapper.get('[data-layout-constraint-offset="right"]').setValue('20')
    await constrainedWrapper.get('[data-layout-constraint-offset="right"]').trigger('blur')
    await nextTick()
    expect(constrained.windows.get('window').layoutSpec?.horizontal.end).toMatchObject({ target: { kind: 'window', instanceId: 'target', edge: 'left' }, offset: { value: -20, unit: 'px' } })
    expect(constrained.windows.get('window').layoutSpecState).toBe('active')
    constrainedWrapper.unmount()
  })

  it('renders four connector handles and commits a valid pointer connection as one active rule', async () => {
    const { registry, windows, docks, edit } = setup('edit')
    windows.open({ widgetId: 'edit.widget', instanceId: 'target', position: { x: 400, y: 30 }, size: { width: 220, height: 180 } })
    const originalRect = HTMLElement.prototype.getBoundingClientRect
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('wf-workspace-host') || this.hasAttribute('data-workspace-floating')) return { x: 0, y: 0, top: 0, left: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON: () => ({}) }
      if (this.dataset.windowInstanceId === 'window') return { x: 100, y: 30, top: 30, left: 100, right: 320, bottom: 210, width: 220, height: 180, toJSON: () => ({}) }
      if (this.dataset.windowInstanceId === 'target') return { x: 400, y: 30, top: 30, left: 400, right: 620, bottom: 210, width: 220, height: 180, toJSON: () => ({}) }
      return originalRect.call(this)
    })
    const wrapper = mount(WorkspaceHost, { props: { windows, docks, registry, edit }, attachTo: document.body })
    await wrapper.get('.wf-pane-host[data-pane-id="window.root"]').trigger('pointerdown')
    await nextTick()
    expect(wrapper.findAll('[data-window-constraint-handle]')).toHaveLength(4)
    expect(wrapper.get('[data-window-constraint-handle="right"]').attributes('aria-label')).toBe('Connect right edge')
    await wrapper.get('[data-window-constraint-handle="right"]').trigger('click')
    expect(wrapper.get('[data-window-constraint-keyboard-picker]').text()).toContain('Edit · target · left')
    await wrapper.get('.wf-window-constraint-keyboard-picker__cancel').trigger('click')

    pointer(wrapper.get('[data-window-constraint-handle="right"]').element, 'pointerdown', 320, 120)
    globalThis.window.dispatchEvent(new MouseEvent('pointermove', { clientX: 400, clientY: 120, bubbles: true }))
    await nextTick()
    expect(wrapper.find('[data-window-constraint-drag-line]').exists()).toBe(true)
    expect(wrapper.find('[data-window-constraint-target]').attributes('data-window-constraint-target-id')).toBe('target')
    globalThis.window.dispatchEvent(new MouseEvent('pointerup', { clientX: 400, clientY: 120, bubbles: true }))
    await nextTick()
    expect(windows.get('window').layoutSpec?.horizontal.end?.target).toEqual({ kind: 'window', instanceId: 'target', edge: 'left' })
    expect(windows.get('window').layoutSpecState).toBe('active')
    expect(wrapper.find('[data-window-constraint-drag-line]').exists()).toBe(false)
    wrapper.unmount()
    vi.restoreAllMocks()
  })

  it('selects and removes an existing direct constraint without removing the remaining axis layout', async () => {
    const { registry, windows, docks, edit } = setup('edit')
    windows.open({ widgetId: 'edit.widget', instanceId: 'target', position: { x: 400, y: 30 }, size: { width: 220, height: 180 } })
    windows.setLayoutSpec('window', {
      horizontal: { start: { target: { kind: 'window', instanceId: 'target', edge: 'right' } }, size: { value: 300, unit: 'px' } },
      vertical: { start: { target: { kind: 'workspace', edge: 'top' } }, size: { value: 200, unit: 'px' } },
    }, { width: 800, height: 600 }, 'api', 'active')
    const wrapper = mount(WorkspaceHost, { props: { windows, docks, registry, edit }, attachTo: document.body })
    await wrapper.get('.wf-pane-host[data-pane-id="window.root"]').trigger('pointerdown')
    await nextTick()
    await wrapper.get('[data-window-layout-relation]').trigger('click')
    expect(wrapper.get('[data-window-constraint-remove]').text()).toContain('Remove left')
    await wrapper.get('[data-window-constraint-remove]').trigger('click')
    await nextTick()
    expect(windows.get('window').layoutSpec?.horizontal).toEqual({ start: { target: { kind: 'workspace', edge: 'left' }, offset: { value: 620, unit: 'px' } }, size: { value: 300, unit: 'px' } })
    expect(wrapper.find('[data-window-constraint-remove]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('resizes the selected layout frame through separate edge and corner zones with one commit', async () => {
    const { registry, windows, docks, edit } = setup('edit')
    const history = createWorkspaceHistory(windows, docks)
    const wrapper = mount(WorkspaceHost, { props: { windows, docks, registry, edit, history }, attachTo: document.body })
    await wrapper.get('.wf-pane-host[data-pane-id="window.root"]').trigger('pointerdown')
    await nextTick()
    expect(wrapper.findAll('[data-window-layout-resize-handle]')).toHaveLength(8)
    expect(wrapper.find('[data-window-constraint-handle="right"]').exists()).toBe(true)
    const before = windows.get('window')
    const resizeHandle = wrapper.get('[data-window-layout-resize-handle="right"]').element
    pointer(resizeHandle, 'pointerdown', 320, 130)
    globalThis.window.dispatchEvent(new MouseEvent('pointermove', { clientX: 360, clientY: 130, bubbles: true }))
    await nextTick()
    expect(wrapper.find('[data-layout-preview-overlay]').exists()).toBe(true)
    expect(windows.get('window').geometry).toEqual(before.geometry)
    expect(windows.get('window').layoutSpec).toBeUndefined()
    globalThis.window.dispatchEvent(new MouseEvent('pointerup', { clientX: 360, clientY: 130, bubbles: true }))
    await nextTick()
    expect(windows.get('window').geometry.size.width).toBe(340)
    expect(windows.get('window').layoutSpecState).toBe('active')
    expect(history.state.undoDepth).toBe(1)
    expect(wrapper.find('[data-layout-preview-overlay]').exists()).toBe(false)
    expect(history.undo()).toBe(true)
    expect(windows.get('window').layoutSpec).toBeUndefined()
    expect(windows.get('window').geometry).toEqual(before.geometry)
    expect(history.redo()).toBe(true)
    expect(windows.get('window').layoutSpecState).toBe('active')
    wrapper.unmount()
    history.dispose()
  })

  it('keeps responsive targets and units while previewing a constrained resize', async () => {
    const { registry, windows, docks, edit } = setup('edit')
    windows.open({ widgetId: 'edit.widget', instanceId: 'target', position: { x: 400, y: 30 }, size: { width: 220, height: 180 } })
    windows.setLayoutSpec('window', {
      horizontal: { start: { target: { kind: 'workspace', edge: 'left' } }, size: { value: 25, unit: 'percent' } },
      vertical: { start: { target: { kind: 'workspace', edge: 'top' } }, size: { value: 200, unit: 'px' } },
    }, { width: 800, height: 600 }, 'api', 'active')
    const wrapper = mount(WorkspaceHost, { props: { windows, docks, registry, edit }, attachTo: document.body })
    await wrapper.get('.wf-pane-host[data-pane-id="window.root"]').trigger('pointerdown')
    await nextTick()
    const before = windows.get('window')
    pointer(wrapper.get('[data-window-layout-resize-handle="right"]').element, 'pointerdown', 220, 130)
    globalThis.window.dispatchEvent(new MouseEvent('pointermove', { clientX: 300, clientY: 130, bubbles: true }))
    await nextTick()
    expect(wrapper.find('[data-window-layout-relation]').exists()).toBe(true)
    expect(windows.get('window').layoutSpec).toEqual(before.layoutSpec)
    globalThis.window.dispatchEvent(new MouseEvent('pointerup', { clientX: 300, clientY: 130, bubbles: true }))
    await nextTick()
    expect(windows.get('window').layoutSpec?.horizontal.start?.target).toEqual({ kind: 'workspace', edge: 'left' })
    expect(windows.get('window').layoutSpec?.horizontal.size).toEqual({ value: 35, unit: 'percent' })
    wrapper.unmount()
  })

  it('allows editor resize for locked windows and rolls back on Escape', async () => {
    const { registry, windows, docks, edit } = setup('edit')
    windows.lockWindow('window', 'api')
    const wrapper = mount(WorkspaceHost, { props: { windows, docks, registry, edit }, attachTo: document.body })
    await wrapper.get('.wf-window-frame[data-window-instance-id="window"]').trigger('pointerdown')
    await nextTick()
    expect(wrapper.findAll('[data-window-layout-resize-handle]')).toHaveLength(8)
    const before = windows.get('window')
    pointer(wrapper.get('[data-window-layout-resize-handle="bottom-right"]').element, 'pointerdown', 320, 230)
    globalThis.window.dispatchEvent(new MouseEvent('pointermove', { clientX: 380, clientY: 290, bubbles: true }))
    await nextTick()
    expect(wrapper.find('[data-layout-preview-overlay]').exists()).toBe(true)
    expect(windows.get('window').geometry).toEqual(before.geometry)
    globalThis.window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(wrapper.find('[data-layout-preview-overlay]').exists()).toBe(false)
    expect(windows.get('window').geometry).toEqual(before.geometry)
    expect(windows.get('window').layoutSpec).toEqual(before.layoutSpec)
    expect(windows.get('window').layoutLocked).toBe(true)
    edit.setMode('normal')
    await nextTick()
    expect(wrapper.find('[data-window-layout-resize-handle]').exists()).toBe(false)
    wrapper.unmount()
  })

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
    expect(wrapper.get('.wf-pane-host').attributes('data-layout-selection')).toBe('selected')

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

  it('keeps locked window focus separate from editor selection and removes the overlay on exit', async () => {
    const { registry, windows, docks, edit } = setup('edit')
    windows.lockWindow('window', 'api')
    const wrapper = mount(WorkspaceHost, { props: { windows, docks, registry, edit }, attachTo: document.body })
    const frame = wrapper.get('.wf-window-frame[data-window-instance-id="window"]')
    const shell = wrapper.get('.wf-window-shell')

    await frame.trigger('pointerdown')
    await nextTick()
    expect(shell.attributes('data-focused')).toBe('true')
    expect(shell.attributes('data-window-visual-focused')).toBe('false')
    expect(shell.classes()).not.toContain('wf-window-shell--focused')
    expect(frame.attributes('data-layout-selection')).toBe('selected')

    edit.setMode('normal')
    await nextTick()
    expect(frame.attributes('data-layout-selection')).toBeUndefined()
    expect(wrapper.find('[data-window-selected="true"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('marks dock selection independently from pane activity and clears editor markers', async () => {
    const registry = createWidgetRegistry([defineWidget({ id: 'dock.widget', title: 'Dock', component: Widget })])
    const windows = createWindowManager(registry)
    const docks = createDockManager(registry)
    const edit = createWorkspaceEditController({ mode: 'edit' })
    docks.add({ id: 'topnav', position: 'top', pane: createWidgetPane({ id: 'topnav-pane', widgetId: 'dock.widget' }), thickness: 72 })
    const wrapper = mount(WorkspaceHost, { props: { windows, docks, registry, edit }, attachTo: document.body })
    const dock = wrapper.get('[data-dock-id="topnav"]')
    const pane = wrapper.get('[data-dock-id="topnav"] .wf-pane-host[data-pane-id="topnav-pane"]')

    expect(dock.attributes('data-layout-selection')).toBe('unselected')
    await pane.trigger('pointerdown')
    await nextTick()
    expect(dock.attributes('data-layout-selection')).toBe('selected')
    expect(pane.attributes('data-layout-selection')).toBe('selected')
    expect(pane.attributes('data-pane-active')).toBe('true')

    edit.setMode('normal')
    await nextTick()
    expect(dock.attributes('data-layout-selection')).toBeUndefined()
    expect(pane.attributes('data-layout-selection')).toBeUndefined()
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
    const beforePreview = windows.get('window').geometry
    await wrapper.get('[data-layout-x]').setValue('120')
    await nextTick()
    expect(wrapper.find('[data-layout-preview-overlay]').exists()).toBe(true)
    expect(windows.get('window').geometry).toEqual(beforePreview)
    await wrapper.get('[role="dialog"] [aria-label="Cancel"]').trigger('click')
    expect(wrapper.find('[data-layout-preview-overlay]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('updates relationship overlays from the draft target before save', async () => {
    const { registry, windows, docks, edit } = setup('edit')
    windows.open({ widgetId: 'edit.widget', instanceId: 'base', position: { x: 20, y: 30 }, size: { width: 240, height: 160 } })
    windows.setLayoutSpec('window', {
      horizontal: { start: { target: { kind: 'window', instanceId: 'base', edge: 'right' } }, size: { value: 200, unit: 'px' } },
      vertical: { start: { target: { kind: 'workspace', edge: 'top' } }, size: { value: 120, unit: 'px' } },
    }, { width: 800, height: 600 }, 'api')
    const originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(target: Element): void { this.callback([{ target, contentRect: { width: 800, height: 600 } } as ResizeObserverEntry], this as unknown as ResizeObserver) }
      disconnect(): void {}
      unobserve(): void {}
    } as unknown as typeof ResizeObserver
    const wrapper = mount(WorkspaceHost, { props: { windows, docks, registry, edit }, attachTo: document.body })
    await wrapper.get('.wf-window-frame[data-window-instance-id="window"] .wf-pane-host[data-pane-id]').trigger('pointerdown')
    await nextTick()
    expect(wrapper.findAll('[data-window-layout-relation]')).toHaveLength(1)
    await wrapper.get('[data-window-selection-layout]').trigger('click')
    await nextTick()
    await wrapper.get('[data-layout-left-target]').setValue('workspace:left')
    await nextTick()
    await nextTick()
    expect(wrapper.findAll('[data-window-layout-relation]')).toHaveLength(0)
    expect(windows.get('window').layoutSpec?.horizontal.start?.target).toEqual({ kind: 'window', instanceId: 'base', edge: 'right' })
    await wrapper.get('[role="dialog"] [aria-label="Cancel"]').trigger('click')
    wrapper.unmount()
    globalThis.ResizeObserver = originalResizeObserver
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
