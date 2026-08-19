import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import WindowManagerHost from '../src/vue/WindowManagerHost.vue'

const originalResizeObserver = globalThis.ResizeObserver
class FakeResizeObserver {
  static current: FakeResizeObserver | null = null
  private readonly callback: ResizeObserverCallback
  private target: Element | null = null
  constructor(callback: ResizeObserverCallback) { this.callback = callback; FakeResizeObserver.current = this }
  observe(target: Element): void { this.target = target }
  disconnect(): void { this.target = null }
  resize(width: number, height: number): void {
    if (!this.target) return
    this.callback([{ target: this.target, contentRect: { width, height } } as ResizeObserverEntry], this as unknown as ResizeObserver)
  }
}
afterEach(() => { globalThis.ResizeObserver = originalResizeObserver; FakeResizeObserver.current = null })

const EmptyWidget = defineComponent({ template: '<span class="empty-widget">content</span>' })

function createSetup() {
  const registry = createWidgetRegistry([
    defineWidget({ id: 'test.window', title: 'Window', component: EmptyWidget }),
  ])
  return { registry, manager: createWindowManager(registry) }
}

describe('WindowManagerHost', () => {
  it('normalizes existing windows on resize without remounting their frames', async () => {
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver
    const { registry, manager } = createSetup()
    const opened = manager.open({ widgetId: 'test.window', instanceId: 'resized', position: { x: 700, y: 500 } })
    const wrapper = mount(WindowManagerHost, { props: { registry, manager }, attachTo: document.body })
    const frame = wrapper.get('[data-window-instance-id="resized"]').element

    FakeResizeObserver.current?.resize(400, 300)
    await nextTick()

    expect(manager.get(opened.instanceId).geometry.position).toEqual({ x: 336, y: 268 })
    expect(wrapper.get('[data-window-instance-id="resized"]').element).toBe(frame)
    wrapper.unmount()
  })

  it('reacts to manager open/focus/close while preserving instance identity', async () => {
    const { registry, manager } = createSetup()
    const wrapper = mount(WindowManagerHost, { props: { registry, manager } })

    const first = manager.open({ widgetId: 'test.window', instanceId: 'first' })
    const second = manager.open({ widgetId: 'test.window', instanceId: 'second' })
    await nextTick()

    expect(wrapper.findAll('.wf-window-shell')).toHaveLength(2)
    expect(wrapper.get('[data-window-instance-id="second"] .wf-window-shell').attributes('data-focused')).toBe('true')

    await wrapper.get('[data-window-instance-id="first"] .wf-window-shell').trigger('pointerdown')
    await nextTick()

    expect(manager.get(first.instanceId).focused).toBe(true)
    expect(manager.get(first.instanceId).zIndex).toBe(1)
    expect(manager.get(second.instanceId).zIndex).toBe(0)
    expect(wrapper.get('[data-window-instance-id="first"] .wf-window-shell').attributes('data-focused')).toBe('true')

    await wrapper.get('[data-window-instance-id="second"] .wf-window-shell__close').trigger('click')
    await nextTick()

    expect(manager.list().map((window) => window.instanceId)).toEqual(['first'])
    expect(wrapper.find('[data-window-instance-id="second"]').exists()).toBe(false)
  })

  it('unsubscribes cleanly when unmounted', () => {
    const { registry, manager } = createSetup()
    const wrapper = mount(WindowManagerHost, { props: { registry, manager } })
    wrapper.unmount()

    expect(() => manager.open({ widgetId: 'test.window' })).not.toThrow()
  })
})
