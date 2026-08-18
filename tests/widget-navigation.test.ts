import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { createWidgetNavigator, WidgetNavigationError } from '../src/core/navigation'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'

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
    expect(manager.get(result.instanceId).parameters).toEqual({ id: 'A-1' })
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
})
