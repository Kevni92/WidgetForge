import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createTabPane, createWidgetPane } from '../src/core/pane'
import { defineWidget, WidgetDefinitionError } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWidgetViewStateStore, type WidgetViewStateSnapshot, type WidgetViewStateStorage } from '../src/core/widget-view-state'
import PaneHost from '../src/vue/PaneHost.vue'
import WidgetViewStateProvider from '../src/vue/WidgetViewStateProvider.vue'
import { useWidgetViewState } from '../src/vue/widget-view-state'

type TestState = { count: number; filter: string }
const definition = {
  version: 2,
  defaultState: { count: 0, filter: '' },
  validate: (value: unknown): value is TestState => typeof value === 'object' && value !== null && typeof (value as TestState).count === 'number' && Number.isFinite((value as TestState).count) && typeof (value as TestState).filter === 'string',
  migrate: (value: unknown, fromVersion: number): unknown => fromVersion === 1 && typeof value === 'object' && value !== null ? { count: Number((value as { count?: unknown }).count ?? 0), filter: '' } : value,
} as const

function memoryStorage(initial?: unknown): { storage: WidgetViewStateStorage; read: () => unknown } {
  let value = initial
  return {
    storage: { read: () => value, write: (snapshot) => { value = snapshot } },
    read: () => value,
  }
}

describe('widget view state', () => {
  it('persists separately by scope and instance and restores across store recreation', () => {
    const memory = memoryStorage()
    const first = createWidgetViewStateStore(memory.storage)
    first.bind('command', 'market-1', 'test.market', definition).replace({ count: 4, filter: 'metal' })
    first.bind('command', 'market-2', 'test.market', definition).replace({ count: 8, filter: 'fuel' })
    first.bind('trading', 'market-1', 'test.market', definition).replace({ count: 12, filter: 'food' })

    const snapshot = memory.read() as WidgetViewStateSnapshot
    expect(snapshot.entries).toHaveLength(3)
    const restored = createWidgetViewStateStore(memory.storage)
    expect(restored.bind('command', 'market-1', 'test.market', definition).state.value).toEqual({ count: 4, filter: 'metal' })
    expect(restored.bind('command', 'market-2', 'test.market', definition).state.value).toEqual({ count: 8, filter: 'fuel' })
    expect(restored.bind('trading', 'market-1', 'test.market', definition).state.value).toEqual({ count: 12, filter: 'food' })
    expect(restored.bind('command', 'new-instance', 'test.market', definition).state.value).toEqual({ count: 0, filter: '' })
  })

  it('migrates older state and falls back to default for invalid stored state', () => {
    const migratedStorage = memoryStorage({ version: 1, entries: [{ scopeId: 'default', instanceId: 'one', widgetId: 'test.market', version: 1, state: { count: 7 } }] })
    const migrated = createWidgetViewStateStore(migratedStorage.storage).bind('default', 'one', 'test.market', definition)
    expect(migrated.state.value).toEqual({ count: 7, filter: '' })

    const invalidStorage = memoryStorage({ version: 1, entries: [{ scopeId: 'default', instanceId: 'bad', widgetId: 'test.market', version: 2, state: { count: 'domain-object', filter: 3 } }] })
    const invalid = createWidgetViewStateStore(invalidStorage.storage).bind('default', 'bad', 'test.market', definition)
    expect(invalid.state.value).toEqual({ count: 0, filter: '' })
  })

  it('rejects non-serializable defaults at widget definition time', () => {
    const Component = defineComponent({ template: '<div />' })
    expect(() => defineWidget({ id: 'test.bad-view-state', title: 'Bad', component: Component, viewState: { version: 1, defaultState: { value: Number.NaN } } })).toThrowError(WidgetDefinitionError)
  })

  it('keeps state through inactive tabs and a later remount with the same instance identity', async () => {
    const Probe = defineComponent({
      setup() {
        const viewState = useWidgetViewState<TestState>()
        return () => h('button', { class: 'increment', onClick: () => viewState.update((state) => ({ ...state, count: state.count + 1 })) }, String(viewState.state.value.count))
      },
    })
    const widget = defineWidget({ id: 'test.view-state', title: 'View State', component: Probe, viewState: definition })
    const other = defineWidget({ id: 'test.other-view', title: 'Other', component: defineComponent({ template: '<div>other</div>' }) })
    const registry = createWidgetRegistry([widget, other])
    const store = createWidgetViewStateStore()
    const firstPane = createTabPane({ id: 'tabs', activeId: 'view', children: [createWidgetPane({ id: 'view', widgetId: widget.id, instanceId: 'stable' }), createWidgetPane({ id: 'other', widgetId: other.id, instanceId: 'other' })] })
    const Root = defineComponent({ props: { pane: { type: Object, required: true } }, setup(props) { return () => h(WidgetViewStateProvider, { store, scopeId: 'workspace-a' }, () => h(PaneHost, { pane: props.pane as never, registry })) } })
    const wrapper = mount(Root, { props: { pane: firstPane } })
    await wrapper.get('.increment').trigger('click')
    expect(wrapper.get('.increment').text()).toBe('1')
    await wrapper.get('[data-tab-pane-id="other"]').trigger('click')
    await wrapper.get('[data-tab-pane-id="view"]').trigger('click')
    expect(wrapper.get('.increment').text()).toBe('1')
    wrapper.unmount()

    const reparented = createWidgetPane({ id: 'moved-pane', widgetId: widget.id, instanceId: 'stable' })
    const remounted = mount(Root, { props: { pane: reparented } })
    expect(remounted.get('.increment').text()).toBe('1')
    remounted.unmount()
  })
})
