import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import LayoutInspector from '../src/vue/LayoutInspector.vue'

const Widget = defineComponent({ template: '<span />' })

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
})
