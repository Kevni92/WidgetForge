import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import WindowShell from '../src/vue/WindowShell.vue'

const EmptyWidget = defineComponent({ template: '<div class="content">content</div>' })

function createRegistry() {
  return createWidgetRegistry([
    defineWidget({ id: 'test.multi', title: 'Multi', component: EmptyWidget }),
    defineWidget({
      id: 'test.singleton',
      title: 'Singleton',
      component: EmptyWidget,
      window: { singleton: true, defaultSize: { width: 420, height: 280 } },
    }),
  ])
}

describe('window states and instance rules', () => {
  it('keeps minimized instances and restores their geometry and focus', () => {
    const manager = createWindowManager(createRegistry())
    const first = manager.open({
      widgetId: 'test.multi',
      position: { x: 120, y: 90 },
      size: { width: 460, height: 310 },
    })
    const second = manager.open({ widgetId: 'test.multi' })

    manager.minimize(second.instanceId)
    expect(manager.list()).toHaveLength(2)
    expect(manager.get(second.instanceId).mode).toBe('minimized')
    expect(manager.get(second.instanceId).focused).toBe(false)
    expect(manager.get(first.instanceId).focused).toBe(true)

    const originalGeometry = manager.get(first.instanceId).geometry
    manager.minimize(first.instanceId)
    manager.restore(first.instanceId)

    expect(manager.get(first.instanceId).mode).toBe('normal')
    expect(manager.get(first.instanceId).focused).toBe(true)
    expect(manager.get(first.instanceId).geometry).toEqual(originalGeometry)
  })

  it('allows multi-instance widgets while reusing singleton widgets', () => {
    const manager = createWindowManager(createRegistry())

    const multiA = manager.open({ widgetId: 'test.multi' })
    const multiB = manager.open({ widgetId: 'test.multi' })
    expect(multiA.instanceId).not.toBe(multiB.instanceId)

    const singletonA = manager.open({ widgetId: 'test.singleton', instanceId: 'singleton-a' })
    manager.minimize(singletonA.instanceId)
    const singletonB = manager.open({ widgetId: 'test.singleton', instanceId: 'singleton-b' })

    expect(singletonB.instanceId).toBe(singletonA.instanceId)
    expect(manager.list().filter((window) =>
      window.rootPane.kind === 'widget' && window.rootPane.widgetId === 'test.singleton')).toHaveLength(1)
    expect(manager.get(singletonA.instanceId).mode).toBe('normal')
    expect(manager.get(singletonA.instanceId).focused).toBe(true)
  })

  it('keeps minimized shell content mounted and emits restore', async () => {
    const registry = createRegistry()
    const wrapper = mount(WindowShell, {
      props: {
        registry,
        widgetId: 'test.multi',
        instanceId: 'window-1',
        minimized: false,
      },
    })

    expect(wrapper.find('.content').exists()).toBe(true)
    await wrapper.setProps({ minimized: true })
    expect(wrapper.attributes('data-window-mode')).toBe('minimized')
    expect(wrapper.find('.content').exists()).toBe(true)
    expect(wrapper.get('.wf-window-shell__content').attributes('style')).toContain('display: none')

    await wrapper.get('.wf-window-shell__minimize').trigger('click')
    expect(wrapper.emitted('restore')?.[0]?.[0]).toEqual({ instanceId: 'window-1' })
  })
})
