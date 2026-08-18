import { defineComponent, nextTick, onMounted, onUnmounted } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import WindowManagerHost from '../src/vue/WindowManagerHost.vue'

let mountCount = 0
let unmountCount = 0

const LifecycleWidget = defineComponent({
  setup() {
    onMounted(() => { mountCount += 1 })
    onUnmounted(() => { unmountCount += 1 })
    return () => 'lifecycle content'
  },
})

function createSetup() {
  mountCount = 0
  unmountCount = 0
  const registry = createWidgetRegistry([
    defineWidget({ id: 'test.lifecycle', title: 'Lifecycle', component: LifecycleWidget }),
  ])
  const manager = createWindowManager(registry)
  const window = manager.open({ widgetId: 'test.lifecycle', instanceId: 'lifecycle-1' })
  return { registry, manager, window }
}

describe('WindowManager and WidgetHost lifecycle integration', () => {
  it('uses one lifecycle and does not unmount a minimized widget', async () => {
    const { registry, manager, window } = createSetup()
    const lifecycle = manager.getLifecycle(window.instanceId)

    expect(lifecycle.state).toBe('created')
    const wrapper = mount(WindowManagerHost, { props: { registry, manager } })
    await nextTick()

    expect(lifecycle.state).toBe('active')
    expect(mountCount).toBe(1)

    manager.minimize(window.instanceId)
    await nextTick()
    expect(lifecycle.state).toBe('minimized')
    expect(lifecycle.mounted).toBe(true)
    expect(mountCount).toBe(1)
    expect(unmountCount).toBe(0)
    expect(wrapper.find('.wf-window-shell__content').exists()).toBe(true)
    expect(wrapper.get('.wf-window-shell__content').attributes('style')).toContain('display: none')

    manager.restore(window.instanceId)
    await nextTick()
    expect(lifecycle.state).toBe('active')
    expect(mountCount).toBe(1)

    manager.close(window.instanceId)
    await nextTick()
    expect(lifecycle.state).toBe('destroyed')
    expect(unmountCount).toBe(1)
    expect(manager.list()).toHaveLength(0)

    wrapper.unmount()
  })

  it('deactivates and activates lifecycle state with window focus', async () => {
    const registry = createWidgetRegistry([
      defineWidget({ id: 'test.lifecycle', title: 'Lifecycle', component: LifecycleWidget }),
    ])
    const manager = createWindowManager(registry)
    const first = manager.open({ widgetId: 'test.lifecycle', instanceId: 'first' })
    const second = manager.open({ widgetId: 'test.lifecycle', instanceId: 'second' })
    const wrapper = mount(WindowManagerHost, { props: { registry, manager } })
    await nextTick()

    expect(manager.getLifecycle(first.instanceId).state).toBe('mounted')
    expect(manager.getLifecycle(second.instanceId).state).toBe('active')

    manager.focus(first.instanceId)
    await nextTick()
    expect(manager.getLifecycle(first.instanceId).state).toBe('active')
    expect(manager.getLifecycle(second.instanceId).state).toBe('mounted')

    wrapper.unmount()
  })
})
