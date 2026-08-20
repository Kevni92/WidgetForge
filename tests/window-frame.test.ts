import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import WindowFrame from '../src/vue/WindowFrame.vue'
import WindowManagerHost from '../src/vue/WindowManagerHost.vue'

const EmptyWidget = defineComponent({ template: '<span>content</span>' })

function createSetup() {
  const registry = createWidgetRegistry([
    defineWidget({
      id: 'test.frame',
      title: 'Frame',
      component: EmptyWidget,
      window: {
        defaultSize: { width: 300, height: 200 },
        minSize: { width: 200, height: 120 },
        maxSize: { width: 500, height: 400 },
      },
    }),
  ])
  const manager = createWindowManager(registry)
  const window = manager.open({
    widgetId: 'test.frame',
    instanceId: 'frame-1',
    position: { x: 100, y: 100 },
  })
  return { registry, manager, window }
}

function dispatchPointer(type: string, clientX: number, clientY: number): void {
  globalThis.window.dispatchEvent(new MouseEvent(type, { clientX, clientY, bubbles: true, cancelable: true }))
}

function dispatchPointerOn(element: Element, type: string, clientX: number, clientY: number): void {
  element.dispatchEvent(new MouseEvent(type, { clientX, clientY, bubbles: true, cancelable: true }))
}

describe('WindowFrame', () => {
  it('moves from the titlebar and ends cleanly on pointercancel', async () => {
    const { registry, manager, window } = createSetup()
    const wrapper = mount(WindowFrame, {
      props: { window, manager, registry, containerSize: { width: 800, height: 600 } },
    })

    dispatchPointerOn(wrapper.get('[data-window-drag-handle]').element, 'pointerdown', 100, 100)
    await nextTick()
    expect(wrapper.attributes('data-window-interaction')).toBe('move')

    dispatchPointer('pointermove', 150, 130)
    await nextTick()
    expect(manager.get('frame-1').geometry.position).toEqual({ x: 150, y: 130 })

    dispatchPointer('pointercancel', 150, 130)
    await nextTick()
    expect(wrapper.attributes('data-window-interaction')).toBe('none')

    dispatchPointer('pointermove', 250, 230)
    expect(manager.get('frame-1').geometry.position).toEqual({ x: 150, y: 130 })
  })

  it('resizes from a corner and applies manifest constraints', async () => {
    const { registry, manager, window } = createSetup()
    const wrapper = mount(WindowFrame, {
      props: { window, manager, registry, containerSize: { width: 800, height: 600 } },
    })

    dispatchPointerOn(wrapper.get('[data-window-resize-handle="bottom-right"]').element, 'pointerdown', 0, 0)
    dispatchPointer('pointermove', 400, 400)
    await nextTick()

    expect(manager.get('frame-1').geometry.size).toEqual({ width: 500, height: 400 })
    dispatchPointer('pointerup', 400, 400)
  })

  it('renders locked windows without geometry chrome while keeping content interactive', async () => {
    const { registry, manager } = createSetup()
    const locked = manager.lockWindow('frame-1', 'user')
    const wrapper = mount(WindowFrame, {
      props: { window: locked, manager, registry, containerSize: { width: 800, height: 600 } },
    })

    expect(wrapper.attributes('data-window-layout-locked')).toBe('true')
    expect(wrapper.find('.wf-window-shell__titlebar').exists()).toBe(false)
    expect(wrapper.find('[data-window-resize-handle]').exists()).toBe(false)
    expect(wrapper.find('.wf-window-shell__content').text()).toContain('content')
    dispatchPointerOn(wrapper.get('.wf-window-shell__content').element, 'pointerdown', 100, 100)
    await nextTick()
    expect(manager.get('frame-1').geometry).toEqual(locked.geometry)
  })

  it('removes active global interaction listeners when the frame is unmounted or closed', async () => {
    const first = createSetup()
    const frame = mount(WindowFrame, {
      props: {
        window: first.window,
        manager: first.manager,
        registry: first.registry,
        containerSize: { width: 800, height: 600 },
      },
    })

    dispatchPointerOn(frame.get('[data-window-drag-handle]').element, 'pointerdown', 100, 100)
    frame.unmount()
    dispatchPointer('pointermove', 300, 300)
    expect(first.manager.get('frame-1').geometry.position).toEqual({ x: 100, y: 100 })

    const second = createSetup()
    const host = mount(WindowManagerHost, { props: { registry: second.registry, manager: second.manager } })
    dispatchPointerOn(host.get('[data-window-drag-handle]').element, 'pointerdown', 100, 100)
    second.manager.close('frame-1')
    await nextTick()

    expect(() => dispatchPointer('pointermove', 400, 400)).not.toThrow()
    expect(second.manager.list()).toHaveLength(0)
    host.unmount()
  })
})
