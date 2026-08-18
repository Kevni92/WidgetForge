import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import WindowManagerHost from '../src/vue/WindowManagerHost.vue'

const EmptyWidget = defineComponent({ template: '<span class="empty-widget">content</span>' })

function createSetup() {
  const registry = createWidgetRegistry([
    defineWidget({ id: 'test.window', title: 'Window', component: EmptyWidget }),
  ])
  return { registry, manager: createWindowManager(registry) }
}

describe('WindowManagerHost', () => {
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
