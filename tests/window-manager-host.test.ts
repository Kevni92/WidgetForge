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
const ModalWidget = defineComponent({ template: '<div><button data-dialog-initial-focus>Primary action</button><button data-modal-second>Secondary action</button></div>' })
const EmptyModalWidget = defineComponent({ template: '<p>No focusable controls</p>' })
const DisabledModalWidget = defineComponent({ template: '<div><button data-dialog-initial-focus disabled>Disabled</button><button data-modal-enabled>Enabled</button></div>' })

function createSetup() {
  const registry = createWidgetRegistry([
    defineWidget({ id: 'test.window', title: 'Window', component: EmptyWidget }),
    defineWidget({ id: 'test.modal', title: 'Modal', component: ModalWidget, window: { options: { role: 'modal' } } }),
    defineWidget({ id: 'test.empty-modal', title: 'Empty Modal', component: EmptyModalWidget, window: { options: { role: 'modal' } } }),
    defineWidget({ id: 'test.disabled-modal', title: 'Disabled Modal', component: DisabledModalWidget, window: { options: { role: 'modal' } } }),
  ])
  return { registry, manager: createWindowManager(registry) }
}

async function flushFocus(): Promise<void> {
  await nextTick()
  await nextTick()
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

  it('moves focus into a modal, traps Tab in both directions and restores the opener', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const { registry, manager } = createSetup()
    const wrapper = mount(WindowManagerHost, { props: { registry, manager }, attachTo: document.body })

    manager.open({ widgetId: 'test.modal', instanceId: 'modal-focus' })
    await flushFocus()

    const dialog = wrapper.get('[data-window-instance-id="modal-focus"] [role="dialog"]')
    const initial = dialog.get('[data-dialog-initial-focus]')
    const secondary = dialog.get('[data-modal-second]')
    expect(document.activeElement).toBe(initial.element)

    await initial.trigger('keydown', { key: 'Tab' })
    expect(document.activeElement).toBe(secondary.element)
    await secondary.trigger('keydown', { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(initial.element)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await flushFocus()
    expect(manager.list()).toHaveLength(0)
    expect(document.activeElement).toBe(opener)

    opener.focus()
    manager.open({ widgetId: 'test.modal', instanceId: 'modal-close-button' })
    await flushFocus()
    await wrapper.get('[data-window-instance-id="modal-close-button"] .wf-window-shell__close').trigger('click')
    await flushFocus()
    expect(document.activeElement).toBe(opener)

    wrapper.unmount()
    opener.remove()
  })

  it('uses a focusable dialog fallback, ignores disabled controls and restores the workspace fallback', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const { registry, manager } = createSetup()
    const wrapper = mount(WindowManagerHost, { props: { registry, manager }, attachTo: document.body })

    manager.open({ widgetId: 'test.empty-modal', instanceId: 'empty-modal', options: { closable: false } })
    await flushFocus()
    const emptyDialog = wrapper.get('[data-window-instance-id="empty-modal"] [role="dialog"]')
    expect(document.activeElement).toBe(emptyDialog.element)
    await emptyDialog.trigger('keydown', { key: 'Tab' })
    expect(document.activeElement).toBe(emptyDialog.element)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await flushFocus()
    expect(manager.list()).toHaveLength(1)
    manager.close('empty-modal')
    await flushFocus()
    expect(document.activeElement).toBe(opener)

    opener.focus()
    manager.open({ widgetId: 'test.disabled-modal', instanceId: 'disabled-modal' })
    await flushFocus()
    const disabledDialog = wrapper.get('[data-window-instance-id="disabled-modal"] [role="dialog"]')
    expect(document.activeElement).not.toBe(disabledDialog.get('[data-dialog-initial-focus]').element)
    expect(disabledDialog.get('[data-dialog-initial-focus]').attributes('disabled')).toBeDefined()

    opener.remove()
    manager.close('disabled-modal')
    await flushFocus()
    expect(document.activeElement).toBe(wrapper.get('[data-window-focus-fallback]').element)

    wrapper.unmount()
  })

  it('returns focus to the underlying modal before restoring the original opener', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const { registry, manager } = createSetup()
    const wrapper = mount(WindowManagerHost, { props: { registry, manager }, attachTo: document.body })

    manager.open({ widgetId: 'test.modal', instanceId: 'modal-first' })
    await flushFocus()
    const firstFocus = wrapper.get('[data-window-instance-id="modal-first"] [data-dialog-initial-focus]')
    manager.open({ widgetId: 'test.modal', instanceId: 'modal-second' })
    await flushFocus()

    expect(document.activeElement).toBe(wrapper.get('[data-window-instance-id="modal-second"] [data-dialog-initial-focus]').element)
    expect(wrapper.get('[data-window-instance-id="modal-first"]').attributes('aria-hidden')).toBe('true')
    manager.close('modal-second')
    await flushFocus()
    expect(document.activeElement).toBe(firstFocus.element)

    manager.close('modal-first')
    await flushFocus()
    expect(document.activeElement).toBe(opener)
    wrapper.unmount()
    opener.remove()
  })
})
