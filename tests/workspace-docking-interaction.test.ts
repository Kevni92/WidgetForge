import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createDockManager } from '../src/core/dock-manager'
import { createSplitPane, createWidgetPane, findPane } from '../src/core/pane'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import WorkspaceHost from '../src/vue/WorkspaceHost.vue'

const Widget = defineComponent({ template: '<span>widget</span>' })

function setup() {
  const registry = createWidgetRegistry([
    defineWidget({ id: 'dock.a', title: 'A', component: Widget }),
    defineWidget({ id: 'dock.b', title: 'B', component: Widget }),
  ])
  return { registry, windows: createWindowManager(registry), docks: createDockManager(registry) }
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left, y: top, left, top, width, height,
    right: left + width, bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect
}

function stubRect(element: Element, value: DOMRect): void {
  Object.defineProperty(element, 'getBoundingClientRect', { configurable: true, value: () => value })
}

function pointer(target: EventTarget, type: string, x: number, y: number, ctrlKey = false): void {
  target.dispatchEvent(new MouseEvent(type, { button: 0, clientX: x, clientY: y, ctrlKey, bubbles: true, cancelable: true }))
}

describe('workspace docking interactions', () => {
  it('docks a dragged window into another window and removes the source shell', async () => {
    const { registry, windows, docks } = setup()
    windows.open({ widgetId: 'dock.a', instanceId: 'source', position: { x: 20, y: 20 }, size: { width: 280, height: 200 } })
    windows.open({ widgetId: 'dock.b', instanceId: 'target', position: { x: 420, y: 80 }, size: { width: 300, height: 240 } })
    const sourcePaneId = windows.get('source').rootPane.id
    const targetPaneId = windows.get('target').rootPane.id

    const wrapper = mount(WorkspaceHost, { props: { windows, docks, registry }, attachTo: document.body })
    const host = wrapper.get('.wf-window-manager-host').element
    const sourceFrame = wrapper.get('[data-window-instance-id="source"]').element
    const targetFrame = wrapper.get('[data-window-instance-id="target"]').element
    const targetPane = wrapper.get(`[data-window-instance-id="target"] [data-pane-id="${targetPaneId}"]`).element
    stubRect(host, rect(0, 0, 800, 600))
    stubRect(sourceFrame, rect(20, 20, 280, 200))
    stubRect(targetFrame, rect(420, 80, 300, 240))
    stubRect(targetPane, rect(420, 114, 300, 206))

    pointer(wrapper.get('[data-window-instance-id="source"] [data-window-drag-handle]').element, 'pointerdown', 120, 35)
    pointer(globalThis.window, 'pointermove', 430, 180)
    await nextTick()
    expect(wrapper.get('[data-window-dock-preview]').attributes('data-window-dock-zone')).toBe('left')

    pointer(globalThis.window, 'pointerup', 430, 180)
    await nextTick()

    expect(windows.list().map((window) => window.instanceId)).toEqual(['target'])
    expect(wrapper.find('[data-window-instance-id="source"]').exists()).toBe(false)
    expect(findPane(windows.get('target').rootPane, sourcePaneId)).toBeDefined()
    wrapper.unmount()
  })

  it('moves a pane with ctrl drag between windows while preserving its widget instance id', async () => {
    const { registry, windows, docks } = setup()
    const movable = createWidgetPane({ id: 'movable-pane', widgetId: 'dock.a', instanceId: 'stable-widget' })
    const stay = createWidgetPane({ id: 'stay-pane', widgetId: 'dock.b', instanceId: 'stay-widget' })
    windows.openPane({
      instanceId: 'source',
      pane: createSplitPane({ id: 'source-root', axis: 'horizontal', children: [movable, stay] }),
      position: { x: 20, y: 20 }, size: { width: 320, height: 220 },
    })
    windows.open({ widgetId: 'dock.b', instanceId: 'target', position: { x: 420, y: 80 }, size: { width: 300, height: 240 } })
    const targetPaneId = windows.get('target').rootPane.id

    const wrapper = mount(WorkspaceHost, { props: { windows, docks, registry }, attachTo: document.body })
    const workspace = wrapper.get('.wf-workspace-host').element
    const sourcePane = wrapper.get('[data-pane-id="movable-pane"]').element
    const targetPane = wrapper.get(`[data-window-instance-id="target"] [data-pane-id="${targetPaneId}"]`).element
    stubRect(workspace, rect(0, 0, 900, 650))
    stubRect(sourcePane, rect(40, 70, 140, 150))
    stubRect(targetPane, rect(420, 114, 300, 206))

    pointer(sourcePane, 'pointerdown', 80, 120, true)
    pointer(globalThis.window, 'pointermove', 710, 180, true)
    await nextTick()
    expect(wrapper.get('[data-pane-drop-target]').attributes('data-pane-drop-zone')).toBe('right')

    pointer(globalThis.window, 'pointerup', 710, 180, true)
    await nextTick()

    expect(findPane(windows.get('source').rootPane, 'movable-pane')).toBeUndefined()
    const moved = findPane(windows.get('target').rootPane, 'movable-pane')
    expect(moved?.kind).toBe('widget')
    expect(moved?.kind === 'widget' ? moved.instanceId : null).toBe('stable-widget')
    wrapper.unmount()
  })
})
