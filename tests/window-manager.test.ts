import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { createSplitPane, createWidgetPane } from '../src/core/pane'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import {
  createWindowManager,
  DuplicateWindowInstanceError,
  UnknownWindowInstanceError,
  WindowLayoutLockedError,
} from '../src/core/window-manager'
import { createWidgetNavigator } from '../src/core/navigation'
import { WindowLayoutValidationError } from '../src/core/window-layout'

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

  it('keeps locked windows geometrically fixed in a dedicated lower layer', () => {
    const manager = createWindowManager(createRegistry())
    const lockedCandidate = manager.open({ widgetId: 'test.market', instanceId: 'locked', position: { x: 40, y: 50 }, size: { width: 280, height: 180 } })
    const normal = manager.open({ widgetId: 'test.market', instanceId: 'normal' })
    manager.snapWindow(lockedCandidate.instanceId, 'left', { width: 1000, height: 700 }, 'api')
    const before = manager.get(lockedCandidate.instanceId)

    manager.lockWindow(lockedCandidate.instanceId, 'user')
    manager.focus(normal.instanceId, 'user')
    manager.focus(lockedCandidate.instanceId, 'user')

    expect(manager.list().map((window) => window.instanceId)).toEqual(['locked', 'normal'])
    expect(manager.get('locked')).toMatchObject({ layoutLocked: true, geometry: before.geometry, snap: before.snap, rootPane: before.rootPane })
    expect(manager.get('locked').focused).toBe(true)
    expect(manager.get('normal').focused).toBe(false)
    expect(() => manager.setGeometry('locked', { position: { x: 500, y: 500 }, size: { width: 400, height: 300 } }, 'user')).toThrow(WindowLayoutLockedError)
    expect(() => manager.snapWindow('locked', 'right', { width: 1000, height: 700 }, 'user')).toThrow(WindowLayoutLockedError)
    expect(() => manager.unsnapWindow('locked', undefined, undefined, 'user')).toThrow(WindowLayoutLockedError)
    expect(() => manager.maximizeWindow('locked', { width: 1000, height: 700 }, 'user')).toThrow(WindowLayoutLockedError)

    manager.unlockWindow('locked', 'user')
    expect(manager.get('locked').layoutLocked).toBe(false)
    manager.setGeometry('locked', { position: { x: 500, y: 500 }, size: before.geometry.size }, 'user')
    expect(manager.get('locked').geometry.position).toEqual({ x: 500, y: 500 })
  })

  it('resolves responsive locked geometry on workspace resize and materializes after unlock', () => {
    const manager = createWindowManager(createRegistry())
    manager.open({ widgetId: 'test.market', instanceId: 'sidebar', position: { x: 20, y: 20 }, size: { width: 200, height: 120 } })
    manager.setLayoutSpec('sidebar', {
      horizontal: { start: { target: { kind: 'workspace', edge: 'left' } }, size: { value: 25, unit: 'percent' } },
      vertical: { start: { target: { kind: 'workspace', edge: 'top' } }, end: { target: { kind: 'workspace', edge: 'bottom' } } },
    }, { width: 800, height: 600 }, 'user')
    manager.lockWindow('sidebar', 'user')
    expect(manager.get('sidebar').geometry).toEqual({ position: { x: 0, y: 0 }, size: { width: 200, height: 600 } })

    manager.resolveResponsiveLayouts({ width: 1200, height: 700 }, 'api')
    expect(manager.get('sidebar').geometry).toEqual({ position: { x: 0, y: 0 }, size: { width: 300, height: 700 } })
    manager.unlockWindow('sidebar', 'user')
    manager.setGeometry('sidebar', { position: { x: 40, y: 50 }, size: { width: 300, height: 700 } }, 'user')
    expect(manager.get('sidebar').layoutSpec).toBeNull()
    expect(manager.get('sidebar').geometry.position).toEqual({ x: 40, y: 50 })
  })

  it('does not reapply a dormant layout when an unrelated window changes', () => {
    const manager = createWindowManager(createRegistry())
    manager.open({ widgetId: 'test.market', instanceId: 'a', position: { x: 40, y: 50 }, size: { width: 280, height: 180 } })
    manager.setLayoutSpec('a', {
      horizontal: { start: { target: { kind: 'workspace', edge: 'left' } }, size: { value: 50, unit: 'percent' } },
      vertical: { start: { target: { kind: 'workspace', edge: 'top' } }, end: { target: { kind: 'workspace', edge: 'bottom' } } },
    }, { width: 1000, height: 600 }, 'user')
    manager.lockWindow('a', 'user')
    manager.unlockWindow('a', 'user')
    manager.snapWindow('a', 'right', { width: 1000, height: 600 }, 'user')
    const before = manager.get('a')

    manager.open({ widgetId: 'test.market', instanceId: 'b', position: { x: 20, y: 20 }, size: { width: 240, height: 160 } })
    manager.focus('b', 'user')
    manager.setGeometry('b', { position: { x: 180, y: 120 }, size: { width: 260, height: 180 } }, 'user')

    expect(manager.get('a').geometry).toEqual(before.geometry)
    expect(manager.get('a').layoutSpec).toEqual(before.layoutSpec)
  })

  it('keeps dormant geometry on workspace resize while active layouts recompute', () => {
    const manager = createWindowManager(createRegistry())
    manager.open({ widgetId: 'test.market', instanceId: 'dormant', position: { x: 40, y: 50 }, size: { width: 280, height: 180 } })
    manager.setLayoutSpec('dormant', {
      horizontal: { start: { target: { kind: 'workspace', edge: 'left' } }, size: { value: 25, unit: 'percent' } },
      vertical: { start: { target: { kind: 'workspace', edge: 'top' } }, end: { target: { kind: 'workspace', edge: 'bottom' } } },
    }, { width: 800, height: 600 }, 'user')
    const dormantGeometry = manager.get('dormant').geometry

    manager.open({ widgetId: 'test.market', instanceId: 'active', position: { x: 10, y: 10 }, size: { width: 180, height: 120 } })
    manager.setLayoutSpec('active', {
      horizontal: { start: { target: { kind: 'workspace', edge: 'left' } }, size: { value: 25, unit: 'percent' } },
      vertical: { start: { target: { kind: 'workspace', edge: 'top' } }, end: { target: { kind: 'workspace', edge: 'bottom' } } },
    }, { width: 800, height: 600 }, 'user')
    manager.lockWindow('active', 'user')
    manager.resolveResponsiveLayouts({ width: 1200, height: 700 }, 'api')

    expect(manager.get('dormant').geometry).toEqual(dormantGeometry)
    expect(manager.get('active').geometry).toEqual({ position: { x: 0, y: 0 }, size: { width: 300, height: 700 } })
  })

  it('converts snap zones to semantic specs and materializes dependents on delete', () => {
    const manager = createWindowManager(createRegistry())
    manager.open({ widgetId: 'test.market', instanceId: 'base', position: { x: 10, y: 20 }, size: { width: 200, height: 100 } })
    manager.open({ widgetId: 'test.market', instanceId: 'dependent', position: { x: 0, y: 0 }, size: { width: 100, height: 80 } })
    manager.setLayoutSpec('dependent', {
      horizontal: { start: { target: { kind: 'window', instanceId: 'base', edge: 'right' } }, size: { value: 100, unit: 'px' } },
      vertical: { start: { target: { kind: 'window', instanceId: 'base', edge: 'top' } }, size: { value: 80, unit: 'px' } },
    }, { width: 800, height: 600 }, 'user')
    manager.snapWindow('base', 'left', { width: 800, height: 600 }, 'api')
    manager.lockWindow('base', 'user')
    expect(manager.get('base').layoutSpec?.horizontal.size).toEqual({ value: 50, unit: 'percent' })
    manager.close('base', 'user')
    const materialized = manager.get('dependent')
    expect(materialized.layoutSpec?.horizontal.start?.target).toEqual({ kind: 'workspace', edge: 'left' })
    expect(materialized.layoutSpec?.vertical.start?.target).toEqual({ kind: 'workspace', edge: 'top' })
  })

  it('rejects unknown responsive references before mutating state', () => {
    const manager = createWindowManager(createRegistry())
    manager.open({ widgetId: 'test.market', instanceId: 'window' })
    expect(() => manager.setLayoutSpec('window', {
      horizontal: { start: { target: { kind: 'window', instanceId: 'missing', edge: 'left' } }, size: { value: 20, unit: 'px' } },
      vertical: { start: { target: { kind: 'workspace', edge: 'top' } }, size: { value: 20, unit: 'px' } },
    }, { width: 800, height: 600 }, 'user')).toThrow(WindowLayoutValidationError)
    expect(manager.get('window').layoutSpec).toBeUndefined()
  })

  it('re-resolves locked dependents when an unlocked reference is manually moved', () => {
    const manager = createWindowManager(createRegistry())
    manager.open({ widgetId: 'test.market', instanceId: 'reference', position: { x: 50, y: 40 }, size: { width: 180, height: 120 } })
    manager.open({ widgetId: 'test.market', instanceId: 'dependent', position: { x: 0, y: 0 }, size: { width: 100, height: 80 } })
    manager.resolveResponsiveLayouts({ width: 800, height: 600 }, 'api')
    manager.setLayoutSpec('dependent', {
      horizontal: { start: { target: { kind: 'window', instanceId: 'reference', edge: 'right' } }, size: { value: 100, unit: 'px' } },
      vertical: { start: { target: { kind: 'workspace', edge: 'top' } }, size: { value: 80, unit: 'px' } },
    }, { width: 800, height: 600 }, 'user')
    manager.lockWindow('dependent', 'user')
    manager.setGeometry('reference', { position: { x: 200, y: 40 }, size: { width: 180, height: 120 } }, 'user')
    expect(manager.get('dependent').geometry.position.x).toBe(380)
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
