import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { createActiveWorkspaceNavigator, createWidgetNavigator, WidgetNavigationError } from '../src/core/navigation'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import { createWorkspaceCollection } from '../src/core/workspace-collection'

const EmptyWidget = defineComponent({ template: '<span />' })

function createSetup() {
  const registry = createWidgetRegistry([
    defineWidget({
      id: 'test.detail',
      title: 'Detail',
      component: EmptyWidget,
      parameters: { id: { type: 'string', required: true } },
    }),
    defineWidget({
      id: 'test.singleton',
      title: 'Singleton',
      component: EmptyWidget,
      window: { singleton: true },
    }),
  ])
  const manager = createWindowManager(registry)
  return { registry, manager, navigator: createWidgetNavigator(registry, manager) }
}

describe('WidgetNavigator', () => {
  it('opens parameterized widgets through the normal WindowManager pipeline', () => {
    const { manager, navigator } = createSetup()
    const result = navigator.navigate({ widgetId: 'test.detail', parameters: { id: 'A-1' } })

    expect(result.widgetId).toBe('test.detail')
    const pane = manager.get(result.instanceId).rootPane
    expect(pane.kind).toBe('widget')
    if (pane.kind === 'widget') expect(pane.parameters).toEqual({ id: 'A-1' })
  })

  it('reuses singleton instances', () => {
    const { manager, navigator } = createSetup()
    const first = navigator.navigate({ widgetId: 'test.singleton' })
    manager.minimize(first.instanceId)
    const second = navigator.navigate({ widgetId: 'test.singleton' })

    expect(second.instanceId).toBe(first.instanceId)
    expect(manager.list()).toHaveLength(1)
    expect(manager.get(first.instanceId).mode).toBe('normal')
  })

  it('returns structured navigation errors for unknown targets and invalid parameters', () => {
    const { navigator } = createSetup()

    expect(() => navigator.navigate({ widgetId: 'missing.widget' })).toThrowError(
      expect.objectContaining<Partial<WidgetNavigationError>>({ code: 'unknown-widget' }),
    )
    expect(() => navigator.navigate({ widgetId: 'test.detail', parameters: {} })).toThrowError(
      expect.objectContaining<Partial<WidgetNavigationError>>({ code: 'invalid-parameters' }),
    )
  })

  it('resolves each navigation call against the currently active workspace', () => {
    const { registry } = createSetup()
    const collection = createWorkspaceCollection({ registry })
    const command = collection.createWorkspace({ id: 'command', name: 'Command', activate: true })
    const trading = collection.createWorkspace({ id: 'trading', name: 'Trading' })
    const operations = collection.createWorkspace({ id: 'operations', name: 'Operations' })
    const navigator = createActiveWorkspaceNavigator(registry, collection)

    const commandDetail = navigator.navigate({ widgetId: 'test.detail', parameters: { id: 'command' } })
    const commandSingleton = navigator.navigate({ widgetId: 'test.singleton' })
    const commandState = command.windows.list().map((window) => ({
      instanceId: window.instanceId,
      zIndex: window.zIndex,
      mode: window.mode,
      focused: window.focused,
    }))

    collection.activateWorkspace('trading')
    const tradingDetail = navigator.navigate({ widgetId: 'test.detail', parameters: { id: 'trading' } })
    const tradingSingleton = navigator.navigate({ widgetId: 'test.singleton' })

    expect(tradingDetail.instanceId).toBe(commandDetail.instanceId)
    expect(tradingSingleton.instanceId).toBe(commandSingleton.instanceId)
    expect(command.windows.list().map((window) => ({
      instanceId: window.instanceId,
      zIndex: window.zIndex,
      mode: window.mode,
      focused: window.focused,
    }))).toEqual(commandState)
    expect(command.windows.list()).toHaveLength(2)
    expect(trading.windows.list()).toHaveLength(2)
    expect(operations.windows.list()).toHaveLength(0)

    collection.activateWorkspace('operations')
    navigator.navigate({ widgetId: 'test.detail', parameters: { id: 'operations' } })

    expect(command.windows.list()).toHaveLength(2)
    expect(trading.windows.list()).toHaveLength(2)
    expect(operations.windows.list()).toHaveLength(1)

    collection.activateWorkspace('command')
    expect(command.windows.get(commandDetail.instanceId).focused).toBe(false)
    expect(command.windows.get(commandSingleton.instanceId).focused).toBe(true)
  })
})
