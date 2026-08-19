import { defineComponent, h } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { captureWidgetForgeDevToolsSnapshot } from '../src/core/devtools'
import { createDockManager } from '../src/core/dock-manager'
import { createSplitPane, createWidgetPane } from '../src/core/pane'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import { createDataClient, createDataKey, type DataObserver, type DataProvider } from '../src/data/data-client'

const component = defineComponent(() => () => h('div'))
const registry = createWidgetRegistry([
  defineWidget({ id: 'test.widget', title: 'Test widget', component }),
])

class Provider implements DataProvider {
  observer: DataObserver<number> | null = null
  subscribe<T>(_key: { kind: string; id: string }, observer: DataObserver<T>): () => void {
    this.observer = observer as DataObserver<number>
    observer.loading()
    return () => { this.observer = null }
  }
}

describe('WidgetForge DevTools diagnostics', () => {
  it('captures windows, docks and a flattened pane tree without exposing mutation methods', () => {
    const windows = createWindowManager(registry)
    const docks = createDockManager(registry)
    windows.openPane({
      instanceId: 'workspace-window',
      pane: createSplitPane({
        id: 'root-split',
        axis: 'horizontal',
        children: [
          createWidgetPane({ id: 'left-pane', widgetId: 'test.widget', instanceId: 'left-widget' }),
          createWidgetPane({ id: 'right-pane', widgetId: 'test.widget', instanceId: 'right-widget' }),
        ],
      }),
    })
    docks.add({ id: 'top-dock', position: 'top', thickness: 40, pane: createWidgetPane({ id: 'dock-pane', widgetId: 'test.widget', instanceId: 'dock-widget' }) })

    const snapshot = captureWidgetForgeDevToolsSnapshot(windows, docks)
    expect(snapshot.windows).toHaveLength(1)
    expect(snapshot.windows[0]).toMatchObject({ instanceId: 'workspace-window', focused: true, zIndex: 0, layer: 'normal', rootPaneId: 'root-split' })
    expect(snapshot.docks[0]).toMatchObject({ id: 'top-dock', position: 'top', rootPaneId: 'dock-pane' })
    expect(snapshot.panes.map((pane) => [pane.id, pane.ownerKind, pane.depth])).toEqual([
      ['root-split', 'window', 0],
      ['left-pane', 'window', 1],
      ['right-pane', 'window', 1],
      ['dock-pane', 'dock', 0],
    ])
    expect(snapshot.panes.find((pane) => pane.id === 'left-pane')).toMatchObject({ widgetId: 'test.widget', instanceId: 'left-widget', parentId: 'root-split' })
    expect('setGeometry' in snapshot).toBe(false)
  })

  it('reports DataClient resources and consumers without exposing domain values', () => {
    vi.useFakeTimers()
    try {
      const provider = new Provider()
      const client = createDataClient(provider, { cacheTimeMs: 1000 })
      const key = createDataKey<number>('metric', 'power')
      const changes: number[] = []
      client.subscribeDiagnostics((diagnostics) => changes.push(diagnostics.totalConsumers))
      const first = client.acquire(key)
      const second = client.acquire(key)
      provider.observer?.next(42)

      const active = client.diagnostics()
      expect(active).toMatchObject({ activeResources: 1, totalConsumers: 2 })
      expect(active.resources[0]).toMatchObject({ status: 'ready', consumers: 2, subscribed: true, cached: false })
      expect(active.resources[0]).not.toHaveProperty('data')

      first.release()
      second.release()
      expect(client.diagnostics().resources[0]).toMatchObject({ consumers: 0, subscribed: false, cached: true, pendingEviction: true })
      vi.advanceTimersByTime(1000)
      expect(client.diagnostics().resources).toHaveLength(0)
      expect(changes).toContain(2)
    } finally {
      vi.useRealTimers()
    }
  })
})
