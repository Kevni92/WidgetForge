import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { createSplitPane, createWidgetPane } from '../src/core/pane'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import {
  createWindowManager,
  DuplicateWindowInstanceError,
  UnknownWindowInstanceError,
} from '../src/core/window-manager'
import { createWidgetNavigator } from '../src/core/navigation'

const EmptyWidget = defineComponent({ template: '<div />' })

function createRegistry() {
  return createWidgetRegistry([
    defineWidget({
      id: 'test.planet',
      title: 'Planet',
      component: EmptyWidget,
      parameters: {
        planetId: { type: 'string', required: true },
        compact: { type: 'boolean', default: false },
      },
    }),
    defineWidget({ id: 'test.market', title: 'Market', component: EmptyWidget }),
    defineWidget({ id: 'test.constrained', title: 'Constrained', component: EmptyWidget, window: { minSize: { width: 360, height: 240 }, maxSize: { width: 560, height: 420 } } }),
  ])
}

describe('WindowManager', () => {
  it('opens multiple normalized widget instances as root panes with stable IDs and a single focus', () => {
    const manager = createWindowManager(createRegistry())

    const first = manager.open({ widgetId: 'test.planet', parameters: { planetId: 'A' } })
    const second = manager.open({ widgetId: 'test.planet', parameters: { planetId: 'B' } })

    expect(first.instanceId).toBe('wf-window-1')
    expect(second.instanceId).toBe('wf-window-2')
    expect(first.rootPane).toMatchObject({
      kind: 'widget',
      id: 'wf-window-1.root',
      widgetId: 'test.planet',
      instanceId: 'wf-window-1',
      parameters: { planetId: 'A', compact: false },
    })
    expect(manager.list().map((window) => [window.instanceId, window.focused, window.zIndex])).toEqual([
      ['wf-window-1', false, 0],
      ['wf-window-2', true, 1],
    ])
  })

  it('opens and updates a complete nested pane tree without duplicating direct widget state', () => {
    const manager = createWindowManager(createRegistry())
    const pane = createSplitPane({
      id: 'root',
      axis: 'horizontal',
      children: [
        createWidgetPane({ id: 'planet', widgetId: 'test.planet', instanceId: 'planet-leaf', parameters: { planetId: 'P1' } }),
        createWidgetPane({ id: 'market', widgetId: 'test.market', instanceId: 'market-leaf' }),
      ],
    })

    const opened = manager.openPane({ pane, instanceId: 'multi', title: 'Operations' })
    expect(opened.rootPane.kind).toBe('split')
    expect('widgetId' in opened).toBe(false)

    const updated = manager.setRootPane('multi', { ...pane, weights: [2, 1] }, 'user')
    expect(updated.rootPane.kind === 'split' ? updated.rootPane.weights : []).toEqual([2, 1])
  })

  it('opens an empty launcher window and atomically replaces its root with a widget', () => {
    const manager = createWindowManager(createRegistry())
    manager.open({ widgetId: 'test.market', instanceId: 'existing' })
    const launcher = manager.openEmptyWindow({ instanceId: 'launcher', position: { x: 80, y: 90 }, size: { width: 300, height: 180 }, options: { opacity: 0.8 } })
    const before = { geometry: launcher.geometry, options: launcher.options, zIndex: launcher.zIndex, rootPaneId: launcher.rootPane.id }
    const navigator = createWidgetNavigator(createRegistry(), manager)

    const result = navigator.navigate({ widgetId: 'test.constrained' }, { target: { kind: 'launcher-window', windowInstanceId: 'launcher' } })
    const replaced = manager.get('launcher')

    expect(result).toEqual({ widgetId: 'test.constrained', instanceId: 'launcher' })
    expect(replaced.instanceId).toBe('launcher')
    expect(replaced.rootPane).toMatchObject({ kind: 'widget', id: before.rootPaneId, widgetId: 'test.constrained', instanceId: 'launcher.widget' })
    expect(replaced.geometry.position).toEqual(before.geometry.position)
    expect(replaced.geometry.size).toEqual({ width: 360, height: 240 })
    expect(replaced.options).toEqual(before.options)
    expect(replaced.zIndex).toBe(before.zIndex)
    expect(replaced.title).toBe('Constrained')
    expect(replaced.titleIsCustom).toBe(false)
  })

  it('keeps a custom launcher title and rolls back invalid replacements', () => {
    const manager = createWindowManager(createRegistry())
    const launcher = manager.openEmptyWindow({ instanceId: 'custom-launcher', title: 'Pick a view' })
    const before = manager.get(launcher.instanceId)

    expect(() => manager.replaceLauncherWindow('custom-launcher', { widgetId: 'missing.widget' })).toThrow()
    expect(manager.get('custom-launcher').rootPane).toEqual(before.rootPane)
    expect(manager.get('custom-launcher').title).toBe('Pick a view')
    expect(manager.get('custom-launcher').titleIsCustom).toBe(true)
  })

  it('focuses deterministically by moving only the requested instance to the front', () => {
    const manager = createWindowManager(createRegistry())
    const first = manager.open({ widgetId: 'test.market' })
    const second = manager.open({ widgetId: 'test.market' })
    const third = manager.open({ widgetId: 'test.market' })

    manager.focus(first.instanceId)
    expect(manager.list().map((window) => window.instanceId)).toEqual([
      second.instanceId,
      third.instanceId,
      first.instanceId,
    ])
    expect(manager.list().filter((window) => window.focused).map((window) => window.instanceId)).toEqual([
      first.instanceId,
    ])

    manager.focus(first.instanceId)
    expect(manager.list().map((window) => window.zIndex)).toEqual([0, 1, 2])
  })

  it('closes only the requested instance and restores focus consistently', () => {
    const manager = createWindowManager(createRegistry())
    const first = manager.open({ widgetId: 'test.market' })
    const second = manager.open({ widgetId: 'test.market' })
    const third = manager.open({ widgetId: 'test.market' })

    manager.close(second.instanceId)
    expect(manager.list().map((window) => window.instanceId)).toEqual([first.instanceId, third.instanceId])
    expect(manager.get(third.instanceId).focused).toBe(true)

    manager.close(third.instanceId)
    expect(manager.list()).toHaveLength(1)
    expect(manager.get(first.instanceId).focused).toBe(true)
    expect(manager.get(first.instanceId).zIndex).toBe(0)
  })

  it('rejects duplicate and unknown instance operations with defined errors', () => {
    const manager = createWindowManager(createRegistry())
    manager.open({ widgetId: 'test.market', instanceId: 'fixed' })

    expect(() => manager.open({ widgetId: 'test.market', instanceId: 'fixed' })).toThrow(DuplicateWindowInstanceError)
    expect(() => manager.focus('missing')).toThrow(UnknownWindowInstanceError)
    expect(() => manager.close('missing')).toThrow(UnknownWindowInstanceError)
  })

  it('keeps state serializable and reports operation origin without exposing internals', () => {
    const manager = createWindowManager(createRegistry())
    const changes: Array<{ kind: string; origin: string }> = []
    const unsubscribe = manager.subscribe((change) => {
      changes.push({ kind: change.kind, origin: change.origin })
    })

    const opened = manager.open({ widgetId: 'test.market' })
    manager.focus(opened.instanceId, 'user')
    manager.close(opened.instanceId, 'user')
    unsubscribe()

    expect(() => JSON.stringify(manager.snapshot())).not.toThrow()
    expect(manager.snapshot()).toEqual({ windows: [] })
    expect(changes).toEqual([
      { kind: 'open', origin: 'api' },
      { kind: 'close', origin: 'user' },
    ])
  })
})
