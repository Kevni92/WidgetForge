import { defineComponent, h, nextTick, onMounted } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createSplitPane, createWidgetPane, type SplitPane } from '../src/core/pane'
import { resizePaneSplitWeights } from '../src/core/pane-layout'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import PaneHost from '../src/vue/PaneHost.vue'

function dispatchPointer(target: EventTarget, type: string, clientX: number, clientY: number): void {
  target.dispatchEvent(new MouseEvent(type, { clientX, clientY, bubbles: true, cancelable: true, button: 0 }))
}

describe('PaneHost', () => {
  it('renders nested widget panes recursively and preserves widget instances across layout updates', async () => {
    let mounts = 0
    const Probe = defineComponent({
      setup() {
        onMounted(() => { mounts += 1 })
        return () => h('span', { class: 'pane-probe' }, 'probe')
      },
    })
    const registry = createWidgetRegistry([
      defineWidget({ id: 'test.pane-probe', title: 'Probe', component: Probe }),
    ])
    const first = createWidgetPane({ id: 'first', widgetId: 'test.pane-probe', instanceId: 'probe-1' })
    const second = createWidgetPane({ id: 'second', widgetId: 'test.pane-probe', instanceId: 'probe-2' })
    const third = createWidgetPane({ id: 'third', widgetId: 'test.pane-probe', instanceId: 'probe-3' })
    const nested = createSplitPane({ id: 'nested', axis: 'vertical', children: [second, third] })
    const root = createSplitPane({ id: 'root', axis: 'horizontal', children: [first, nested], weights: [2, 1] })

    const wrapper = mount(PaneHost, { props: { pane: root, registry } })
    expect(wrapper.findAll('.pane-probe')).toHaveLength(3)
    expect(mounts).toBe(3)

    await wrapper.setProps({ pane: { ...root, weights: [1, 2] } })
    expect(wrapper.findAll('.pane-probe')).toHaveLength(3)
    expect(mounts).toBe(3)
  })

  it('emits resized split weights and cleans the pointer session on unmount', async () => {
    const Probe = defineComponent({ template: '<span>probe</span>' })
    const registry = createWidgetRegistry([defineWidget({ id: 'test.resize-pane', title: 'Probe', component: Probe })])
    const root = createSplitPane({
      id: 'root',
      axis: 'horizontal',
      children: [
        createWidgetPane({ id: 'left', widgetId: 'test.resize-pane', settings: { minSize: 100 } }),
        createWidgetPane({ id: 'right', widgetId: 'test.resize-pane', settings: { minSize: 100 } }),
      ],
      weights: [1, 1],
    })
    const wrapper = mount(PaneHost, { props: { pane: root, registry } })
    Object.defineProperty(wrapper.element, 'getBoundingClientRect', {
      value: () => ({ width: 400, height: 200, x: 0, y: 0, top: 0, right: 400, bottom: 200, left: 0, toJSON: () => ({}) }),
    })

    dispatchPointer(wrapper.get('[data-pane-divider-index="0"]').element, 'pointerdown', 200, 0)
    dispatchPointer(globalThis.window, 'pointermove', 300, 0)
    await nextTick()

    const emitted = wrapper.emitted('update:pane')
    const resized = emitted?.at(-1)?.[0] as SplitPane | undefined
    expect(resized?.weights[0]).toBeGreaterThan(resized?.weights[1] ?? 0)

    wrapper.unmount()
    expect(() => dispatchPointer(globalThis.window, 'pointermove', 350, 0)).not.toThrow()
  })
})

describe('resizePaneSplitWeights', () => {
  it('clamps adjacent panes to their min and max sizes while preserving pair weight', () => {
    const split = createSplitPane({
      id: 'root',
      axis: 'horizontal',
      children: [
        createWidgetPane({ id: 'left', widgetId: 'demo.left', settings: { minSize: 120, maxSize: 260 } }),
        createWidgetPane({ id: 'right', widgetId: 'demo.right', settings: { minSize: 140 } }),
      ],
      weights: [1, 1],
    })

    const expanded = resizePaneSplitWeights(split, 0, 500, 400)
    expect(expanded[0]).toBeCloseTo(1.3)
    expect(expanded[1]).toBeCloseTo(0.7)
    expect((expanded[0] ?? 0) + (expanded[1] ?? 0)).toBeCloseTo(2)

    const contracted = resizePaneSplitWeights(split, 0, -500, 400)
    expect(contracted[0]).toBeCloseTo(0.6)
    expect(contracted[1]).toBeCloseTo(1.4)
  })
})
