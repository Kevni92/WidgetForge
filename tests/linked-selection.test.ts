import { defineComponent, h, onMounted } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createSelectionKey, createSelectionStore } from '../src/core/selection'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWidgetViewStateStore, type WidgetViewStateStorage } from '../src/core/widget-view-state'
import SelectionProvider from '../src/vue/SelectionProvider.vue'
import WidgetHost from '../src/vue/WidgetHost.vue'
import WidgetViewStateProvider from '../src/vue/WidgetViewStateProvider.vue'
import { useLinkedSelection } from '../src/vue/linked-selection'

type ViewState = { selection: { followSelection: boolean; pinnedSelection: string | null } }
const selectionKey = createSelectionKey<string>('entity', 'workspace')
const definition = {
  version: 1,
  defaultState: { selection: { followSelection: true, pinnedSelection: null } },
  validate: (value: unknown): value is ViewState => {
    if (typeof value !== 'object' || value === null) return false
    const selection = (value as { selection?: unknown }).selection
    if (typeof selection !== 'object' || selection === null) return false
    const candidate = selection as { followSelection?: unknown; pinnedSelection?: unknown }
    return typeof candidate.followSelection === 'boolean' && (candidate.pinnedSelection === null || typeof candidate.pinnedSelection === 'string')
  },
} as const

function memoryStorage(): { storage: WidgetViewStateStorage; read: () => unknown } {
  let snapshot: unknown = null
  return { storage: { read: () => snapshot, write: (next) => { snapshot = next } }, read: () => snapshot }
}

describe('linked selection', () => {
  it('pins locally, ignores later global changes, restores pinned state and follows again without new instances', async () => {
    let mounts = 0
    const Probe = defineComponent({
      setup() {
        const linked = useLinkedSelection<string, ViewState>(selectionKey, {
          read: (state) => state.selection,
          write: (state, selection) => ({ ...state, selection }),
        })
        onMounted(() => { mounts += 1 })
        return () => h('div', [
          h('span', { class: 'selection' }, linked.selection.value ?? 'none'),
          h('span', { class: 'mode' }, linked.following.value ? 'follow' : 'pinned'),
          h('button', { class: 'pin', onClick: () => linked.pin() }, 'pin'),
          h('button', { class: 'follow', onClick: () => linked.follow() }, 'follow'),
        ])
      },
    })
    const widget = defineWidget({ id: 'test.linked-selection', title: 'Linked', component: Probe, viewState: definition })
    const registry = createWidgetRegistry([widget])
    const selectionStore = createSelectionStore()
    const memory = memoryStorage()
    selectionStore.select(selectionKey, 'ENTITY-A')

    const mountProbe = (viewStore = createWidgetViewStateStore(memory.storage)) => {
      const Root = defineComponent({
        setup: () => () => h(SelectionProvider, { store: selectionStore }, () => h(WidgetViewStateProvider, { store: viewStore, scopeId: 'workspace-a' }, () => h(WidgetHost, { registry, widgetId: widget.id, instanceId: 'stable-instance' }))),
      })
      return mount(Root)
    }

    const first = mountProbe()
    expect(first.get('.selection').text()).toBe('ENTITY-A')
    expect(first.get('.mode').text()).toBe('follow')
    expect(mounts).toBe(1)

    await first.get('.pin').trigger('click')
    expect(first.get('.mode').text()).toBe('pinned')
    selectionStore.select(selectionKey, 'ENTITY-B')
    await first.vm.$nextTick()
    expect(first.get('.selection').text()).toBe('ENTITY-A')
    expect(mounts).toBe(1)
    first.unmount()

    selectionStore.select(selectionKey, 'ENTITY-C')
    const second = mountProbe(createWidgetViewStateStore(memory.storage))
    expect(second.get('.mode').text()).toBe('pinned')
    expect(second.get('.selection').text()).toBe('ENTITY-A')
    expect(mounts).toBe(2)

    await second.get('.follow').trigger('click')
    expect(second.get('.mode').text()).toBe('follow')
    expect(second.get('.selection').text()).toBe('ENTITY-C')
    expect(mounts).toBe(2)
    expect(memory.read()).toBeTruthy()
    second.unmount()
  })
})
