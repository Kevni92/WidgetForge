import { defineComponent, nextTick, onMounted, onUnmounted } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import WindowFrame from '../src/vue/WindowFrame.vue'
import WindowShell from '../src/vue/WindowShell.vue'

function pointer(target: EventTarget, type: string, x: number, y: number): void { target.dispatchEvent(new MouseEvent(type, { button: 0, clientX: x, clientY: y, bubbles: true, cancelable: true })) }

describe('advanced window chrome components', () => {
  it('shows hover header without remounting widget content and emits declarative action intent', async () => {
    const mounted = vi.fn(), unmounted = vi.fn()
    const Widget = defineComponent({ setup(){onMounted(mounted);onUnmounted(unmounted);return()=> 'content'} })
    const registry = createWidgetRegistry([defineWidget({ id: 'chrome.widget', title: 'Chrome', component: Widget })])
    const wrapper = mount(WindowShell, { props: {
      registry, widgetId: 'chrome.widget', instanceId: 'chrome', header: 'hover', chrome: 'borderless', glass: true,
      icon: '◈', badge: 'LIVE', status: 'SYNC', headerActions: [{ id: 'refresh', label: 'Refresh', actionRef: 'demo.refresh' }],
    }, attachTo: document.body })
    expect(wrapper.find('.wf-window-shell__titlebar').exists()).toBe(false)
    await wrapper.trigger('mouseenter'); await nextTick()
    expect(wrapper.find('.wf-window-shell__titlebar').exists()).toBe(true)
    expect(wrapper.text()).toContain('LIVE'); expect(wrapper.text()).toContain('SYNC')
    await wrapper.get('[data-window-header-action="refresh"]').trigger('click')
    expect(wrapper.emitted('headerAction')?.[0]?.[0]).toMatchObject({ id: 'refresh', actionRef: 'demo.refresh' })
    await wrapper.trigger('mouseleave'); await nextTick()
    expect(wrapper.find('.wf-window-shell__titlebar').exists()).toBe(false)
    expect(mounted).toHaveBeenCalledOnce(); expect(unmounted).not.toHaveBeenCalled()
    wrapper.unmount(); expect(unmounted).toHaveBeenCalledOnce()
  })

  it('keeps chrome-less windows movable through a dedicated drag strip', async () => {
    const Widget = defineComponent({ template: '<button data-widget-button>Widget</button>' })
    const registry = createWidgetRegistry([defineWidget({ id: 'chrome.widget', title: 'Chrome', component: Widget })])
    const manager = createWindowManager(registry)
    const state = manager.open({ widgetId: 'chrome.widget', instanceId: 'chrome', position: { x: 20, y: 30 }, size: { width: 280, height: 180 }, options: { chrome: 'none', header: 'hidden' } })
    const wrapper = mount(WindowFrame, { props: { window: state, manager, registry, containerSize: { width: 800, height: 600 } }, attachTo: document.body })
    expect(wrapper.find('.wf-window-shell__titlebar').exists()).toBe(false)
    expect(wrapper.find('[data-window-drag-handle]').exists()).toBe(true)
    const strip = wrapper.get('.wf-window-frame__chrome-drag-strip').element
    pointer(strip, 'pointerdown', 50, 35); pointer(globalThis.window, 'pointermove', 130, 95); pointer(globalThis.window, 'pointerup', 130, 95); await nextTick()
    expect(manager.get('chrome').geometry.position).toEqual({ x: 100, y: 90 })
    await wrapper.get('[data-widget-button]').trigger('click')
    wrapper.unmount()
  })
})
