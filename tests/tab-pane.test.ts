import { defineComponent, h, nextTick, onMounted } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import {
  createTabPane,
  createWidgetPane,
  findPane,
  reorderTab,
  setActiveTab,
  type TabPane,
} from '../src/core/pane'
import { dropPaneAt, movePaneToTarget } from '../src/core/workspace-docking'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import { restoreWorkspace, serializeWorkspace } from '../src/core/workspace'
import PaneHost from '../src/vue/PaneHost.vue'

const first = createWidgetPane({ id: 'first', widgetId: 'test.first', instanceId: 'first-instance' })
const second = createWidgetPane({ id: 'second', widgetId: 'test.second', instanceId: 'second-instance' })
const third = createWidgetPane({ id: 'third', widgetId: 'test.third', instanceId: 'third-instance' })

describe('TabPane core', () => {
  it('keeps active tab and order as serializable pane state', () => {
    const tabs = createTabPane({ id: 'tabs', children: [first, second], activeId: 'first' })
    expect(JSON.parse(JSON.stringify(tabs))).toEqual(tabs)
    expect(setActiveTab(tabs, 'tabs', 'second')).toMatchObject({ kind: 'tabs', activeId: 'second' })
    const reordered = reorderTab(tabs, 'tabs', 'second', 0)
    expect(reordered.kind === 'tabs' ? reordered.children.map((child) => child.id) : []).toEqual(['second', 'first'])
  })

  it('maps center docking to tabs while edge docking stays a split', () => {
    const centered = dropPaneAt(first, 'first', second, 'center', 'tab-container')
    expect(centered).toMatchObject({ kind: 'tabs', id: 'tab-container', activeId: 'second' })

    const appended = dropPaneAt(centered, 'tab-container', third, 'center', 'unused')
    expect(appended.kind === 'tabs' ? appended.children.map((child) => child.id) : []).toEqual(['first', 'second', 'third'])

    const edge = dropPaneAt(first, 'first', second, 'right', 'split-container')
    expect(edge).toMatchObject({ kind: 'split', id: 'split-container', axis: 'horizontal' })
  })

  it('moves a tab child into another target without changing its identity', () => {
    const root = createTabPane({ id: 'tabs', children: [first, second, third], activeId: 'first' })
    const next = movePaneToTarget(root, 'third', 'first', 'center', 'nested-tabs')
    expect(findPane(next, 'third')).toMatchObject({ instanceId: 'third-instance' })
    expect(findPane(next, 'nested-tabs')).toMatchObject({ kind: 'tabs', activeId: 'third' })
  })
})

describe('PaneHost tabs', () => {
  it('switches tabs with pointer and keyboard without remounting tab widgets', async () => {
    let mounts = 0
    const Probe = defineComponent({
      props: { label: { type: String, default: '' } },
      setup(props) {
        onMounted(() => { mounts += 1 })
        return () => h('span', { class: 'tab-probe' }, props.label)
      },
    })
    const registry = createWidgetRegistry([
      defineWidget({ id: 'test.first', title: 'First', component: Probe }),
      defineWidget({ id: 'test.second', title: 'Second', component: Probe }),
    ])
    let pane: TabPane = createTabPane({ id: 'tabs', children: [first, second], activeId: 'first' })
    const wrapper = mount(PaneHost, { props: { pane, registry } })
    expect(mounts).toBe(2)
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(2)
    expect(wrapper.get('[data-tab-pane-id="first"]').attributes('aria-selected')).toBe('true')

    await wrapper.get('[data-tab-pane-id="second"]').trigger('click')
    pane = wrapper.emitted('update:pane')?.at(-1)?.[0] as TabPane
    await wrapper.setProps({ pane })
    expect(wrapper.get('[data-tab-pane-id="second"]').attributes('aria-selected')).toBe('true')
    expect(mounts).toBe(2)

    await wrapper.get('[data-tab-pane-id="second"]').trigger('keydown', { key: 'ArrowLeft' })
    pane = wrapper.emitted('update:pane')?.at(-1)?.[0] as TabPane
    await wrapper.setProps({ pane })
    await nextTick()
    expect(pane.activeId).toBe('first')
    expect(mounts).toBe(2)
  })
})

describe('TabPane workspace persistence', () => {
  it('restores tab order and active tab through workspace v2', () => {
    const Probe = defineComponent({ render: () => h('span', 'probe') })
    const registry = createWidgetRegistry([
      defineWidget({ id: 'test.first', title: 'First', component: Probe }),
      defineWidget({ id: 'test.second', title: 'Second', component: Probe }),
    ])
    const source = createWindowManager(registry)
    source.openPane({
      instanceId: 'tab-window',
      title: 'Tabs',
      pane: createTabPane({ id: 'tabs', children: [first, second], activeId: 'second' }),
    })
    const serialized = serializeWorkspace(source)
    const target = createWindowManager(registry)
    const result = restoreWorkspace(target, serialized)

    expect(result.issues).toEqual([])
    const restored = target.get('tab-window').rootPane
    expect(restored).toMatchObject({ kind: 'tabs', activeId: 'second' })
    expect(restored.kind === 'tabs' ? restored.children.map((child) => child.id) : []).toEqual(['first', 'second'])
  })
})
