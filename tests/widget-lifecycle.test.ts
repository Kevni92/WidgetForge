import { describe, expect, it } from 'vitest'
import {
  createWidgetLifecycle,
  InvalidWidgetLifecycleTransitionError,
} from '../src/core/widget-lifecycle'

describe('WidgetLifecycleController', () => {
  it('keeps create, mount, activation, minimize, restore, close and destroy deterministic', () => {
    const lifecycle = createWidgetLifecycle('widget-1')

    expect(lifecycle.state).toBe('created')
    lifecycle.activate()
    expect(lifecycle.state).toBe('created')

    lifecycle.mount()
    expect(lifecycle.state).toBe('active')

    lifecycle.deactivate()
    expect(lifecycle.state).toBe('mounted')

    lifecycle.minimize()
    expect(lifecycle.state).toBe('minimized')
    expect(lifecycle.mounted).toBe(true)

    lifecycle.restore()
    expect(lifecycle.state).toBe('mounted')
    lifecycle.activate()
    expect(lifecycle.state).toBe('active')

    lifecycle.close()
    expect(lifecycle.state).toBe('closed')
    expect(() => lifecycle.destroy()).toThrow(InvalidWidgetLifecycleTransitionError)

    lifecycle.unmount()
    lifecycle.destroy()
    expect(lifecycle.state).toBe('destroyed')

    expect(lifecycle.history().map((event) => event.kind)).toEqual([
      'create',
      'activate',
      'mount',
      'deactivate',
      'minimize',
      'restore',
      'activate',
      'close',
      'unmount',
      'destroy',
    ])
  })

  it('rejects invalid transitions without changing state', () => {
    const lifecycle = createWidgetLifecycle('widget-2')

    expect(() => lifecycle.destroy()).toThrow(InvalidWidgetLifecycleTransitionError)
    expect(lifecycle.state).toBe('created')

    lifecycle.close()
    expect(() => lifecycle.mount()).toThrow(InvalidWidgetLifecycleTransitionError)
    expect(() => lifecycle.restore()).toThrow(InvalidWidgetLifecycleTransitionError)
    expect(lifecycle.state).toBe('closed')

    lifecycle.destroy()
    expect(lifecycle.state).toBe('destroyed')
  })

  it('isolates listener failures after committing the lifecycle transition', () => {
    const lifecycle = createWidgetLifecycle('widget-3')
    const events: string[] = []

    lifecycle.subscribe(() => {
      throw new Error('consumer listener failed')
    })
    lifecycle.subscribe((event) => events.push(event.kind))

    expect(() => lifecycle.mount()).not.toThrow()
    expect(lifecycle.state).toBe('mounted')
    expect(events).toEqual(['mount'])
  })
})
