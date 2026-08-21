import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import LayoutInspector from '../src/vue/LayoutInspector.vue'

const Widget = defineComponent({ template: '<span />' })

function pointerEvent(type: string, values: Partial<PointerEvent>): PointerEvent {
  const event = new Event(type, { bubbles: true }) as PointerEvent
  Object.assign(event, values)
  return event
}

function setup() {
  const registry = createWidgetRegistry([defineWidget({ id: 'inspector.widget', title: 'Inspector', component: Widget })])
  const windows = createWindowManager(registry)
  windows.open({ widgetId: 'inspector.widget', instanceId: 'source', position: { x: 20, y: 30 }, size: { width: 300, height: 200 } })
  return { registry, windows }
}

describe('LayoutInspector', () => {
  it('renders an explicit empty state without stale properties', () => {
    const { windows } = setup()
    const wrapper = mount(LayoutInspector, { props: { window: null, windows: windows.list(), container: { width: 800, height: 600 } } })
    expect(wrapper.get('[data-layout-inspector-empty]').text()).toContain('Select a window')
    expect(wrapper.find('[data-window-geometry]').exists()).toBe(false)
  })

  it('marks stretch size as calculated and emits a structured distance edit', async () => {
    const { windows } = setup()
    windows.open({ widgetId: 'inspector.widget', instanceId: 'target', position: { x: 400, y: 30 }, size: { width: 220, height: 180 } })
    windows.setLayoutSpec('source', {
      horizontal: { start: { target: { kind: 'workspace', edge: 'left' } }, end: { target: { kind: 'window', instanceId: 'target', edge: 'left' } } },
      vertical: { start: { target: { kind: 'workspace', edge: 'top' } }, size: { value: 200, unit: 'px' } },
    }, { width: 800, height: 600 }, 'api', 'active')
    const wrapper = mount(LayoutInspector, { props: { window: windows.get('source'), windows: windows.list(), container: { width: 800, height: 600 }, surface: 'floating', rule: 'active' } })
    expect(wrapper.get('[data-layout-derived-size="horizontal"]').text()).toContain('Calculated')
    expect(wrapper.get('[data-window-constraint-card="right"]').text()).toContain('Inspector · target')
    await wrapper.get('[data-layout-constraint-offset="right"]').setValue('20')
    await wrapper.get('[data-layout-constraint-offset="right"]').trigger('blur')
    await nextTick()
    const save = wrapper.emitted('save')?.at(-1)?.[0] as { layoutSpec: { horizontal: { end?: { offset?: { value: number; unit: string } } } } } | undefined
    expect(save?.layoutSpec.horizontal.end?.offset).toEqual({ value: -20, unit: 'px' })
  })

  it('switches docked, floating and minimized modes without losing selection state', async () => {
    const { windows } = setup()
    windows.open({ widgetId: 'inspector.widget', instanceId: 'target', position: { x: 400, y: 30 }, size: { width: 220, height: 180 } })
    const wrapper = mount(LayoutInspector, { props: { window: windows.get('source'), windows: windows.list(), container: { width: 800, height: 600 }, mode: 'docked' }, attachTo: document.body })

    await wrapper.get('[data-layout-inspector-dock]').trigger('click')
    expect(wrapper.get('[data-layout-inspector-mode]').attributes('data-layout-inspector-mode')).toBe('floating')
    await wrapper.get('[data-layout-inspector-toggle]').trigger('click')
    await nextTick()
    expect(wrapper.get('[data-layout-inspector-mode]').attributes('data-layout-inspector-mode')).toBe('minimized')
    expect(wrapper.get('[data-layout-inspector-minimized]').exists()).toBe(true)
    expect(document.activeElement).toBe(wrapper.get('[data-layout-inspector-restore]').element)

    await wrapper.setProps({ window: windows.get('target') })
    expect(wrapper.get('[data-layout-inspector-mode]').attributes('data-layout-inspector-mode')).toBe('minimized')
    await wrapper.get('[data-layout-inspector-restore]').trigger('click')
    expect(wrapper.get('[data-layout-inspector-mode]').attributes('data-layout-inspector-mode')).toBe('floating')
    expect(wrapper.get('[data-selected-window-id]').text()).toBe('target')
    await wrapper.get('[data-layout-inspector-dock]').trigger('click')
    expect(wrapper.get('[data-layout-inspector-mode]').attributes('data-layout-inspector-mode')).toBe('docked')
    wrapper.unmount()
  })

  it('clamps floating drag, restores on Escape, and ignores control pointerdown', async () => {
    const { windows } = setup()
    const wrapper = mount(LayoutInspector, { props: { window: windows.get('source'), windows: windows.list(), container: { width: 500, height: 400 }, mode: 'floating', floatingPosition: { x: 100, y: 60 } }, attachTo: document.body })
    const inspector = wrapper.get('[data-layout-inspector]').element as HTMLElement
    const editor = inspector.parentElement as HTMLElement
    let inspectorRect = { left: 100, top: 60, width: 240, height: 300 }
    Object.defineProperty(editor, 'getBoundingClientRect', { configurable: true, value: () => ({ left: 0, top: 0, right: 500, bottom: 400, width: 500, height: 400, x: 0, y: 0, toJSON: () => ({}) }) })
    Object.defineProperty(inspector, 'getBoundingClientRect', { configurable: true, value: () => ({ ...inspectorRect, right: inspectorRect.left + inspectorRect.width, bottom: inspectorRect.top + inspectorRect.height, x: inspectorRect.left, y: inspectorRect.top, toJSON: () => ({}) }) })
    Object.defineProperty(wrapper.get('[data-layout-inspector-header]').element, 'getBoundingClientRect', { configurable: true, value: () => ({ left: 0, top: 0, right: 240, bottom: 40, width: 240, height: 40, x: 0, y: 0, toJSON: () => ({}) }) })

    wrapper.get('[data-layout-inspector-header]').element.dispatchEvent(pointerEvent('pointerdown', { button: 0, pointerId: 1, clientX: 100, clientY: 60 }))
    window.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: -200, clientY: -200 }))
    await nextTick()
    expect(inspector.style.left).toBe('8px')
    expect(inspector.style.top).toBe('8px')
    window.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: -200, clientY: -200 }))

    await wrapper.setProps({ floatingPosition: { x: 100, y: 60 } })
    inspectorRect = { left: 100, top: 60, width: 240, height: 300 }
    wrapper.get('[data-layout-inspector-header]').element.dispatchEvent(pointerEvent('pointerdown', { button: 0, pointerId: 2, clientX: 100, clientY: 60 }))
    window.dispatchEvent(pointerEvent('pointermove', { pointerId: 2, clientX: 140, clientY: 80 }))
    await nextTick()
    expect(inspector.style.left).toBe('140px')
    wrapper.get('[data-layout-inspector]').element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(inspector.style.left).toBe('100px')
    expect(inspector.style.top).toBe('60px')

    wrapper.get('[data-layout-inspector-minimize]').element.dispatchEvent(pointerEvent('pointerdown', { button: 0, pointerId: 3, clientX: 100, clientY: 60 }))
    window.dispatchEvent(pointerEvent('pointermove', { pointerId: 3, clientX: 200, clientY: 160 }))
    expect(inspector.style.left).toBe('100px')
    wrapper.unmount()
  })
})
