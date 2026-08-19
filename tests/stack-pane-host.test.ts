import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { createSplitPane, createStackPane, createWidgetPane } from '../src/core/pane'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import PaneHost from '../src/vue/PaneHost.vue'

const Probe = defineComponent({ template: '<span class="probe">probe</span>' })
const registry = createWidgetRegistry([defineWidget({ id: 'test.probe', title: 'Probe', component: Probe })])
const widget = (id: string, settings: Parameters<typeof createWidgetPane>[0]['settings'] = {}) => createWidgetPane({ id, widgetId: 'test.probe', instanceId: id, settings })

describe('PaneHost advanced layouts', () => {
  it('renders StackPane children as ordered layers', () => {
    const wrapper = mount(PaneHost, { props: { pane: createStackPane({ id: 'stack', children: [widget('base'), widget('overlay')] }), registry } })
    expect(wrapper.get('[data-pane-kind="stack"]').exists()).toBe(true)
    expect(wrapper.findAll('.wf-pane-host__stack-layer').map((layer) => layer.attributes('data-stack-layer-id'))).toEqual(['base', 'overlay'])
    expect(wrapper.findAll('.probe')).toHaveLength(2)
  })

  it('renders fixed, flex and collapsed split constraints without a special host', () => {
    const root = createSplitPane({ id: 'root', axis: 'horizontal', children: [
      widget('fixed', { sizeMode: 'fixed', size: 120 }),
      widget('flex', { grow: 2 }),
      widget('collapsed', { collapsible: true, collapsed: true }),
    ] })
    const wrapper = mount(PaneHost, { props: { pane: root, registry } })
    const cells = wrapper.findAll('.wf-pane-host__cell')
    expect(cells[0]?.attributes('style')).toContain('120px')
    expect(cells[1]?.attributes('style')).toContain('flex-grow: 2')
    expect(cells[2]?.attributes('style')).toContain('display: none')
    expect(wrapper.findAll('[data-pane-divider-index]').every((divider) => divider.classes().includes('wf-pane-host__divider--disabled'))).toBe(true)
  })
})
