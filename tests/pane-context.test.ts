import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTabPane, createWidgetPane, type PaneNode } from '../src/core/pane'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { usePaneContext } from '../src/vue/pane-context'
import PaneHost from '../src/vue/PaneHost.vue'
import WindowShell from '../src/vue/WindowShell.vue'

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = []
  disconnected = false
  private readonly callback: ResizeObserverCallback
  constructor(callback: ResizeObserverCallback) { this.callback = callback; FakeResizeObserver.instances.push(this) }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void { this.disconnected = true }
  emit(target: Element, width: number, height: number): void {
    this.callback([{ target, contentRect: { width, height } } as ResizeObserverEntry], this as unknown as ResizeObserver)
  }
}

const originalResizeObserver = globalThis.ResizeObserver
let mounts = 0
const Probe = defineComponent({
  setup() {
    mounts += 1
    const context = usePaneContext()
    return { paneId: context.paneId, hostType: context.hostType, size: context.size, active: context.active, visible: context.visible, focused: context.focused, collapsed: context.collapsed }
  },
  template: '<output class="pane-context-probe" :data-context-pane="paneId" :data-context-host="hostType" :data-context-active="String(active)" :data-context-visible="String(visible)" :data-context-focused="String(focused)" :data-context-collapsed="String(collapsed)">{{ size.width }}x{{ size.height }}</output>',
})
const registry = createWidgetRegistry([defineWidget({ id: 'test.pane-context', title: 'Pane Context', component: Probe })])
const widget = (id: string) => createWidgetPane({ id, widgetId: 'test.pane-context', instanceId: id })

beforeEach(() => { mounts = 0; FakeResizeObserver.instances = []; globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver })
afterEach(() => { globalThis.ResizeObserver = originalResizeObserver })

describe('PaneContext', () => {
  it('reacts to pane size and cleans up its observer', async () => {
    const wrapper = mount(PaneHost, { attachTo: document.body, props: { pane: widget('metric'), registry, hostType: 'window', hostFocused: true } })
    const root = wrapper.get('[data-pane-id="metric"]').element
    const observer = FakeResizeObserver.instances[0]
    expect(observer).toBeDefined()
    observer?.emit(root, 321.4, 122.6)
    await nextTick()
    const probe = wrapper.get('.pane-context-probe')
    expect(probe.text()).toBe('321x123')
    expect(probe.attributes('data-context-host')).toBe('window')
    expect(probe.attributes('data-context-focused')).toBe('true')
    wrapper.unmount()
    expect(observer?.disconnected).toBe(true)
  })

  it('marks inactive tabs without remounting widgets when active tab changes', async () => {
    const root = createTabPane({ id: 'tabs', activeId: 'a', children: [widget('a'), widget('b')] })
    const wrapper = mount(PaneHost, { props: { pane: root, registry, hostType: 'window', hostFocused: true } })
    expect(mounts).toBe(2)
    expect(wrapper.get('[data-context-pane="a"]').attributes('data-context-active')).toBe('true')
    expect(wrapper.get('[data-context-pane="b"]').attributes('data-context-visible')).toBe('false')
    await wrapper.get('[data-tab-pane-id="b"]').trigger('click')
    const next = wrapper.emitted('update:pane')?.at(-1)?.[0] as PaneNode
    await wrapper.setProps({ pane: next })
    expect(wrapper.get('[data-context-pane="a"]').attributes('data-context-active')).toBe('false')
    expect(wrapper.get('[data-context-pane="b"]').attributes('data-context-visible')).toBe('true')
    expect(mounts).toBe(2)
  })

  it('updates host and visibility context without changing widget identity', async () => {
    const wrapper = mount(PaneHost, { props: { pane: widget('portable'), registry, hostType: 'window', hostFocused: true } })
    expect(mounts).toBe(1)
    await wrapper.setProps({ hostType: 'dock', hostFocused: false, hostVisible: false })
    const probe = wrapper.get('.pane-context-probe')
    expect(probe.attributes('data-context-pane')).toBe('portable')
    expect(probe.attributes('data-context-host')).toBe('dock')
    expect(probe.attributes('data-context-visible')).toBe('false')
    expect(probe.attributes('data-context-focused')).toBe('false')
    expect(mounts).toBe(1)
  })

  it('maps window focus and minimized state into widget context without remounting', async () => {
    const wrapper = mount(WindowShell, { props: { registry, pane: widget('window-pane'), instanceId: 'window', focused: true } })
    expect(wrapper.get('.pane-context-probe').attributes('data-context-focused')).toBe('true')
    expect(mounts).toBe(1)
    await wrapper.setProps({ minimized: true, focused: false })
    expect(wrapper.get('.pane-context-probe').attributes('data-context-visible')).toBe('false')
    expect(wrapper.get('.pane-context-probe').attributes('data-context-focused')).toBe('false')
    expect(mounts).toBe(1)
  })
})
