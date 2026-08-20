import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import type { WindowSnapZone } from '../src/core/window-snap'
import WindowFrame from '../src/vue/WindowFrame.vue'

const Widget = defineComponent({ template: '<span>snap</span>' })

function setup() {
  const registry = createWidgetRegistry([defineWidget({ id: 'test.snap-interaction', title: 'Snap', component: Widget })])
  const manager = createWindowManager(registry)
  const window = manager.open({
    widgetId: 'test.snap-interaction',
    instanceId: 'snap-window',
    position: { x: 100, y: 80 },
    size: { width: 360, height: 240 },
  })
  return { registry, manager, window }
}

function pointer(target: EventTarget, type: string, x: number, y: number): void {
  target.dispatchEvent(new MouseEvent(type, { button: 0, clientX: x, clientY: y, bubbles: true, cancelable: true }))
}

describe('window snap pointer lifecycle', () => {
  it('previews during drag and commits the proposed zone on pointer up', async () => {
    const { registry, manager, window } = setup()
    const preview = vi.fn<(instanceId: string, zone: WindowSnapZone | null) => void>()
    const commit = vi.fn((instanceId: string, zone: WindowSnapZone) => {
      manager.snapWindow(instanceId, zone, { width: 800, height: 500 })
    })
    const wrapper = mount(WindowFrame, {
      props: {
        window,
        manager,
        registry,
        containerSize: { width: 800, height: 500 },
        resolveSnapZone: (x) => x <= 28 ? 'left' : null,
        previewSnap: preview,
        commitSnap: commit,
      },
    })

    pointer(wrapper.get('[data-window-drag-handle]').element, 'pointerdown', 200, 90)
    pointer(globalThis.window, 'pointermove', 10, 120)
    await nextTick()
    expect(preview).toHaveBeenCalledWith('snap-window', 'left')

    pointer(globalThis.window, 'pointerup', 10, 120)
    await nextTick()
    expect(commit).toHaveBeenCalledWith('snap-window', 'left')
    expect(manager.get('snap-window').snap?.zone).toBe('left')
    expect(preview).toHaveBeenLastCalledWith('snap-window', null)
    wrapper.unmount()
  })

  it('clears preview without snapping on pointer cancel', async () => {
    const { registry, manager, window } = setup()
    const preview = vi.fn<(instanceId: string, zone: WindowSnapZone | null) => void>()
    const commit = vi.fn()
    const wrapper = mount(WindowFrame, {
      props: {
        window,
        manager,
        registry,
        containerSize: { width: 800, height: 500 },
        resolveSnapZone: () => 'right',
        previewSnap: preview,
        commitSnap: commit,
      },
    })

    pointer(wrapper.get('[data-window-drag-handle]').element, 'pointerdown', 200, 90)
    pointer(globalThis.window, 'pointermove', 790, 120)
    pointer(globalThis.window, 'pointercancel', 790, 120)
    await nextTick()

    expect(commit).not.toHaveBeenCalled()
    expect(preview).toHaveBeenLastCalledWith('snap-window', null)
    expect(manager.get('snap-window').snap).toBeNull()
    wrapper.unmount()
  })

  it('unsnaps before dragging a snapped window out of an edge', async () => {
    const { registry, manager } = setup()
    manager.snapWindow('snap-window', 'left', { width: 800, height: 500 })
    const unsnap = vi.fn((instanceId: string, x: number, y: number) =>
      manager.unsnapWindow(instanceId, { x, y }, { width: 800, height: 500 }))
    const wrapper = mount(WindowFrame, {
      props: {
        window: manager.get('snap-window'),
        manager,
        registry,
        containerSize: { width: 800, height: 500 },
        resolveSnapZone: () => null,
        previewSnap: () => {},
        unsnapForPointer: unsnap,
      },
    })

    pointer(wrapper.get('[data-window-drag-handle]').element, 'pointerdown', 250, 12)
    pointer(globalThis.window, 'pointermove', 400, 130)
    pointer(globalThis.window, 'pointerup', 400, 130)
    await nextTick()

    expect(unsnap).toHaveBeenCalled()
    expect(manager.get('snap-window').snap).toBeNull()
    expect(manager.get('snap-window').geometry.size).toEqual({ width: 360, height: 240 })
    wrapper.unmount()
  })

  it('clears snap state through the real resize-handle interaction', async () => {
    const { registry, manager } = setup()
    manager.snapWindow('snap-window', 'left', { width: 800, height: 500 })
    const wrapper = mount(WindowFrame, {
      props: {
        window: manager.get('snap-window'),
        manager,
        registry,
        containerSize: { width: 800, height: 500 },
      },
    })

    pointer(wrapper.get('[data-window-resize-handle="bottom-right"]').element, 'pointerdown', 400, 500)
    pointer(globalThis.window, 'pointermove', 480, 460)
    await nextTick()

    expect(manager.get('snap-window').snap).toBeNull()
    expect(manager.get('snap-window').geometry.size).toEqual({ width: 480, height: 460 })
    pointer(globalThis.window, 'pointerup', 480, 460)
    wrapper.unmount()
  })
})
