import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import WindowManagerHost from '../src/vue/WindowManagerHost.vue'

const Widget = defineComponent({ template: '<button data-role-action>action</button>' })
function setup() {
  const registry = createWidgetRegistry([
    defineWidget({ id: 'role.normal', title: 'Normal', component: Widget }),
    defineWidget({ id: 'role.utility', title: 'Utility', component: Widget, window: { options: { role: 'utility' } } }),
    defineWidget({ id: 'role.overlay', title: 'Overlay', component: Widget, window: { options: { role: 'overlay' } } }),
    defineWidget({ id: 'role.modal', title: 'Modal', component: Widget, window: { options: { role: 'modal' } } }),
  ])
  return { registry, manager: createWindowManager(registry) }
}

describe('WindowManagerHost role semantics', () => {
  it('renders role-specific stacking and modal accessibility', async () => {
    const { registry, manager } = setup()
    manager.open({ widgetId: 'role.normal', instanceId: 'normal' })
    manager.open({ widgetId: 'role.utility', instanceId: 'utility' })
    manager.open({ widgetId: 'role.overlay', instanceId: 'overlay' })
    manager.open({ widgetId: 'role.modal', instanceId: 'modal' })
    const wrapper = mount(WindowManagerHost, { props: { manager, registry }, attachTo: document.body })
    await nextTick()

    expect(wrapper.get('[data-window-instance-id="normal"]').attributes('style')).toContain(' + 0)')
    expect(wrapper.get('[data-window-instance-id="utility"]').attributes('style')).toContain('1001')
    expect(wrapper.get('[data-window-instance-id="overlay"]').attributes('style')).toContain('2002')
    expect(wrapper.get('[data-window-instance-id="modal"]').attributes('style')).toContain('3003')
    expect(wrapper.get('[data-window-instance-id="modal"] .wf-window-shell').attributes('role')).toBe('dialog')
    expect(wrapper.get('[data-window-instance-id="modal"] .wf-window-shell').attributes('aria-modal')).toBe('true')
    expect(wrapper.find('[data-modal-backdrop]').exists()).toBe(true)
    expect(wrapper.get('[data-window-instance-id="normal"]').attributes('aria-hidden')).toBe('true')
    wrapper.unmount()
  })

  it('keeps the top modal focused, blocks background interaction and closes it with Escape', async () => {
    const { registry, manager } = setup()
    manager.open({ widgetId: 'role.normal', instanceId: 'normal' })
    manager.open({ widgetId: 'role.modal', instanceId: 'modal' })
    const wrapper = mount(WindowManagerHost, { props: { manager, registry }, attachTo: document.body })
    await nextTick()

    manager.focus('normal', 'api')
    await Promise.resolve(); await nextTick()
    expect(manager.get('modal').focused).toBe(true)
    expect(wrapper.get('[data-window-instance-id="normal"]').classes()).toContain('wf-window-frame--interaction-blocked')

    globalThis.window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await nextTick()
    expect(manager.list().map((window) => window.instanceId)).toEqual(['normal'])
    expect(manager.get('normal').focused).toBe(true)
    expect(wrapper.find('[data-modal-backdrop]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('keeps nested modals deterministic and Escape affects only the top modal', async () => {
    const { registry, manager } = setup()
    manager.open({ widgetId: 'role.modal', instanceId: 'modal-a' })
    manager.open({ widgetId: 'role.modal', instanceId: 'modal-b' })
    const wrapper = mount(WindowManagerHost, { props: { manager, registry }, attachTo: document.body })
    await nextTick()
    expect(manager.get('modal-b').focused).toBe(true)
    expect(wrapper.get('[data-window-instance-id="modal-a"]').attributes('aria-hidden')).toBe('true')
    globalThis.window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await nextTick()
    expect(manager.list().map((window) => window.instanceId)).toEqual(['modal-a'])
    expect(manager.get('modal-a').focused).toBe(true)
    wrapper.unmount()
  })
})
