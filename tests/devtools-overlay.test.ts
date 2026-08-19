import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDockManager } from '../src/core/dock-manager'
import { createWidgetPane } from '../src/core/pane'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import DevToolsOverlay from '../src/vue/DevToolsOverlay.vue'

const wrappers: ReturnType<typeof mount>[] = []
const testWidget = defineComponent(() => () => h('div'))
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

function managers(registry = createWidgetRegistry([])) {
  return { windows: createWindowManager(registry), docks: createDockManager(registry) }
}

function mountOverlay(enabled: boolean, target?: HTMLElement, registry = createWidgetRegistry([])) {
  const { windows, docks } = managers(registry)
  const host = document.createElement('div')
  document.body.append(host)
  const wrapper = mount(DevToolsOverlay, {
    attachTo: host,
    props: { windows, docks, enabled, ...(target ? { target } : {}) },
  })
  wrappers.push(wrapper)
  return { wrapper, windows, docks }
}

describe('DevToolsOverlay', () => {
  it('has no visible runtime effect and installs no shortcut while disabled', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    const { wrapper } = mountOverlay(false)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', ctrlKey: true, shiftKey: true, bubbles: true }))
    await nextTick()

    expect(wrapper.find('[data-widgetforge-devtools]').exists()).toBe(false)
    expect(wrapper.find('[data-devtools-visual-overlay]').exists()).toBe(false)
    expect(add.mock.calls.some(([type]) => type === 'keydown')).toBe(false)
  })

  it('toggles with Ctrl+Shift+D and visualizes public pane/window/drop-zone data attributes', async () => {
    const target = document.createElement('div')
    const pane = document.createElement('div')
    pane.dataset.paneId = 'pane-a'
    pane.dataset.paneKind = 'widget'
    pane.dataset.paneFocused = 'true'
    pane.getBoundingClientRect = () => ({ x: 10, y: 20, left: 10, top: 20, right: 210, bottom: 120, width: 200, height: 100, toJSON: () => ({}) }) as DOMRect
    const windowElement = document.createElement('div')
    windowElement.dataset.windowInstanceId = 'window-a'
    windowElement.dataset.windowZIndex = '3'
    windowElement.dataset.windowLayer = 'always-on-top'
    windowElement.getBoundingClientRect = () => ({ x: 5, y: 5, left: 5, top: 5, right: 305, bottom: 205, width: 300, height: 200, toJSON: () => ({}) }) as DOMRect
    const drop = document.createElement('div')
    drop.dataset.dockingActiveZone = 'left'
    drop.dataset.dockingSource = 'source'
    drop.dataset.dockingTarget = 'target'
    drop.getBoundingClientRect = windowElement.getBoundingClientRect
    target.append(windowElement, pane, drop)
    document.body.append(target)

    const { wrapper } = mountOverlay(true, target)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', ctrlKey: true, shiftKey: true, bubbles: true }))
    await nextTick()

    expect(wrapper.get('[data-widgetforge-devtools]').text()).toContain('WidgetForge DevTools')
    const marks = wrapper.findAll('.wf-devtools-mark')
    expect(marks).toHaveLength(3)
    expect(wrapper.get('[data-devtools-visual-overlay]').text()).toContain('pane-a · widget · 200×100 · focused')
    expect(wrapper.get('[data-devtools-visual-overlay]').text()).toContain('window-a · z3 · always-on-top')
    expect(wrapper.get('[data-devtools-visual-overlay]').text()).toContain('drop · left')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', ctrlKey: true, shiftKey: true, bubbles: true }))
    await nextTick()
    expect(wrapper.find('[data-widgetforge-devtools]').exists()).toBe(false)
  })

  it('copies live workspace JSON and cleans global listeners on unmount', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const remove = vi.spyOn(window, 'removeEventListener')
    const removeDocument = vi.spyOn(document, 'removeEventListener')
    const { wrapper } = mountOverlay(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', ctrlKey: true, shiftKey: true, bubbles: true }))
    await nextTick()

    await wrapper.get('[data-devtools-copy]').trigger('click')
    expect(writeText).toHaveBeenCalledOnce()
    expect(writeText.mock.calls[0]?.[0]).toContain('"version": 3')

    wrapper.unmount()
    wrappers.splice(wrappers.indexOf(wrapper), 1)
    expect(remove.mock.calls.some(([type]) => type === 'keydown')).toBe(true)
    expect(remove.mock.calls.some(([type]) => type === 'resize')).toBe(true)
    expect(removeDocument.mock.calls.some(([type]) => type === 'pointermove')).toBe(true)
  })

  it('supports selective modes, type filters and explicit inspect selection', async () => {
    const target = document.createElement('div')
    const windowElement = document.createElement('div')
    windowElement.className = 'wf-window-frame'
    windowElement.dataset.windowInstanceId = 'window-a'
    windowElement.dataset.windowZIndex = '2'
    const pane = document.createElement('div')
    pane.className = 'wf-pane-host'
    pane.dataset.paneId = 'pane-a'
    pane.dataset.paneKind = 'widget'
    pane.dataset.paneFocused = 'true'
    const widget = document.createElement('div')
    widget.dataset.widgetInstanceId = 'widget-a'
    widget.dataset.widgetId = 'test.widget'
    const rect = ({ x: 10, y: 20, left: 10, top: 20, right: 210, bottom: 120, width: 200, height: 100, toJSON: () => ({}) }) as DOMRect
    windowElement.getBoundingClientRect = () => rect
    pane.getBoundingClientRect = () => rect
    widget.getBoundingClientRect = () => rect
    pane.append(widget)
    windowElement.append(pane)
    target.append(windowElement)
    document.body.append(target)

    const registry = createWidgetRegistry([defineWidget({ id: 'test.widget', title: 'Test widget', component: testWidget })])
    const { wrapper, windows } = mountOverlay(true, target, registry)
    windows.openPane({ instanceId: 'window-a', pane: createWidgetPane({ id: 'pane-a', widgetId: 'test.widget', instanceId: 'widget-a' }) })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', ctrlKey: true, shiftKey: true, bubbles: true }))
    await nextTick()

    await wrapper.get('[data-devtools-select="pane:window:window-a:pane-a"]').trigger('click')
    expect((wrapper.get('[data-devtools-mode]').element as HTMLSelectElement).value).toBe('selected')
    expect(wrapper.get('[data-devtools-node="pane:window:window-a:pane-a"]').attributes('data-devtools-selected')).toBe('true')
    expect(wrapper.get('[data-devtools-node="window:window-a"]').attributes('data-devtools-selected')).toBeUndefined()

    await wrapper.get('[data-devtools-filter="window"]').setValue(false)
    expect((wrapper.get('[data-devtools-node="window:window-a"]').element as HTMLElement).style.display).toBe('none')

    await wrapper.get('[data-devtools-mode]').setValue('hovered')
    widget.dispatchEvent(new Event('pointermove', { bubbles: true }))
    await nextTick()
    expect(wrapper.get('[data-devtools-node="widget:pane:window:window-a:pane-a"]').attributes('data-devtools-selected')).toBe('true')

    await wrapper.get('[data-devtools-inspect-mode]').setValue(true)
    await wrapper.get('[data-devtools-node="widget:pane:window:window-a:pane-a"]').trigger('click')
    expect((wrapper.get('[data-devtools-mode]').element as HTMLSelectElement).value).toBe('selected')
    expect(wrapper.get('[data-devtools-node="widget:pane:window:window-a:pane-a"]').attributes('data-devtools-selected')).toBe('true')
  })
})
