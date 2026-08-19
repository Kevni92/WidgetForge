import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { createDockManager } from '../src/core/dock-manager'
import { createTabPane, createWidgetPane } from '../src/core/pane'
import { createWidgetNavigator } from '../src/core/navigation'
import { defineWidget, resolveWidgetCapabilities, WidgetDefinitionError } from '../src/core/widget'
import { WidgetCapabilityError } from '../src/core/widget-capabilities'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'

const Component = defineComponent({ template: '<div />' })

function widget(id: string, capabilities?: Parameters<typeof defineWidget>[0]['capabilities']) {
  return defineWidget({ id, title: id, component: Component, ...(capabilities ? { capabilities } : {}) })
}

describe('widget capabilities', () => {
  it('normalizes compatible defaults and exposes explicit hosting metadata through the registry', () => {
    const defaultWidget = widget('test.default')
    expect(resolveWidgetCapabilities(defaultWidget)).toEqual({ multipleInstances: true, dockable: true, tabCompatible: true, supportsCompactMode: true })

    const constrained = widget('test.constrained', {
      multipleInstances: false,
      dockable: false,
      tabCompatible: false,
      preferredAspectRatio: 16 / 9,
      minimumUsefulSize: { width: 320, height: 180 },
      supportsCompactMode: false,
    })
    const registry = createWidgetRegistry([constrained])
    expect(registry.getCapabilities('test.constrained')).toMatchObject({
      multipleInstances: false,
      dockable: false,
      tabCompatible: false,
      preferredAspectRatio: 16 / 9,
      minimumUsefulSize: { width: 320, height: 180 },
      supportsCompactMode: false,
    })
    expect(registry.get('test.constrained').window).toMatchObject({ singleton: true, minSize: { width: 320, height: 180 } })
  })

  it('rejects contradictory and invalid capability definitions early', () => {
    expect(() => defineWidget({ id: 'test.conflict', title: 'Conflict', component: Component, window: { singleton: true }, capabilities: { multipleInstances: true } })).toThrowError(WidgetDefinitionError)
    expect(() => widget('test.aspect', { preferredAspectRatio: 0 })).toThrowError(/preferredAspectRatio/)
    expect(() => defineWidget({ id: 'test.minimum', title: 'Minimum', component: Component, window: { defaultSize: { width: 200, height: 120 } }, capabilities: { minimumUsefulSize: { width: 300, height: 160 } } })).toThrowError(/minimumUsefulSize/)
  })

  it('preserves legacy singleton behavior and applies multipleInstances=false to navigation/window opens', () => {
    const legacy = defineWidget({ id: 'test.legacy-singleton', title: 'Legacy', component: Component, window: { singleton: true } })
    const modern = widget('test.modern-singleton', { multipleInstances: false })
    const registry = createWidgetRegistry([legacy, modern])
    expect(registry.getCapabilities(legacy.id).multipleInstances).toBe(false)

    const windows = createWindowManager(registry)
    const navigator = createWidgetNavigator(registry, windows)
    const first = navigator.navigate({ widgetId: modern.id })
    const second = navigator.navigate({ widgetId: modern.id })
    expect(second.instanceId).toBe(first.instanceId)
    expect(windows.list()).toHaveLength(1)
  })

  it('rejects non-dockable widgets and tab-incompatible widgets in DockManager operations', () => {
    const dockable = widget('test.dockable')
    const floatingOnly = widget('test.floating-only', { dockable: false })
    const noTabs = widget('test.no-tabs', { tabCompatible: false })
    const registry = createWidgetRegistry([dockable, floatingOnly, noTabs])
    const docks = createDockManager(registry)

    expect(() => docks.add({ id: 'bad-dock', position: 'left', thickness: 200, pane: createWidgetPane({ id: 'floating', widgetId: floatingOnly.id, instanceId: 'floating-1' }) })).toThrowError(WidgetCapabilityError)

    const tabs = createTabPane({
      id: 'tabs',
      activeId: 'good',
      children: [
        createWidgetPane({ id: 'good', widgetId: dockable.id, instanceId: 'good-1' }),
        createWidgetPane({ id: 'bad', widgetId: noTabs.id, instanceId: 'bad-1' }),
      ],
    })
    expect(() => docks.add({ id: 'bad-tabs', position: 'bottom', thickness: 180, pane: tabs })).toThrowError(WidgetCapabilityError)

    docks.add({ id: 'valid', position: 'top', thickness: 80, pane: createWidgetPane({ id: 'good-root', widgetId: dockable.id, instanceId: 'good-2' }) })
    expect(() => docks.setRootPane('valid', createWidgetPane({ id: 'bad-root', widgetId: floatingOnly.id, instanceId: 'floating-2' }))).toThrowError(WidgetCapabilityError)
  })
})
