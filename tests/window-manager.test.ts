import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import {
  createWindowManager,
  DuplicateWindowInstanceError,
  UnknownWindowInstanceError,
} from '../src/core/window-manager'

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
  ])
}

describe('WindowManager', () => {
  it('opens multiple normalized widget instances with stable IDs and a single focus', () => {
    const manager = createWindowManager(createRegistry())

    const first = manager.open({ widgetId: 'test.planet', parameters: { planetId: 'A' } })
    const second = manager.open({ widgetId: 'test.planet', parameters: { planetId: 'B' } })

    expect(first.instanceId).toBe('wf-window-1')
    expect(second.instanceId).toBe('wf-window-2')
    expect(first.parameters).toEqual({ planetId: 'A', compact: false })
    expect(manager.list().map((window) => [window.instanceId, window.focused, window.zIndex])).toEqual([
      ['wf-window-1', false, 0],
      ['wf-window-2', true, 1],
    ])
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
