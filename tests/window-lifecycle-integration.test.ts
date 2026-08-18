import { defineComponent, nextTick, onBeforeUnmount, onMounted } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import WindowManagerHost from '../src/vue/WindowManagerHost.vue'

describe('window/widget lifecycle integration', () => {
  it('keeps a widget mounted while minimized and destroys resources on close', async () => {
    const mounted = vi.fn()
    const unmounted = vi.fn()
    const Widget = defineComponent({
      setup() {
        onMounted(mounted)
        onBeforeUnmount(unmounted)
        return () => 'content'
      },
    })
    const registry = createWidgetRegistry([
      defineWidget({ id: 'test.lifecycle', title: 'Lifecycle', component: Widget }),
    ])
    const manager = createWindowManager(registry)
    const wrapper = mount(WindowManagerHost, { props: { registry, manager } })

    manager.open({ widgetId: 'test.lifecycle', instanceId: 'lifecycle-1' })
    await nextTick()
    const lifecycle = manager.getLifecycle('lifecycle-1')
    const cleanup = vi.fn()
    lifecycle.addCleanup(cleanup)

    expect(lifecycle.state).toBe('active')
    expect(mounted).toHaveBeenCalledOnce()

    manager.minimize('lifecycle-1')
    await nextTick()
    expect(lifecycle.state).toBe('minimized')
    expect(unmounted).not.toHaveBeenCalled()
    expect(wrapper.get('.wf-widget-host').isVisible()).toBe(false)

    manager.restore('lifecycle-1')
    await nextTick()
    expect(lifecycle.state).toBe('active')
    expect(mounted).toHaveBeenCalledOnce()

    manager.close('lifecycle-1')
    await nextTick()
    expect(lifecycle.state).toBe('destroyed')
    expect(cleanup).toHaveBeenCalledOnce()
    expect(unmounted).toHaveBeenCalledOnce()
  })
})
