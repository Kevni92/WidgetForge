import { describe, expect, it, vi } from 'vitest'
import {
  InvalidWidgetLifecycleTransitionError,
  createWidgetLifecycle,
} from '../src/core/widget-lifecycle'

describe('WidgetLifecycle', () => {
  it('follows create, mount, activate, minimize, restore, close and destroy deterministically', () => {
    const lifecycle = createWidgetLifecycle()
    const transitions: string[] = []
    lifecycle.subscribe(({ event, from, to }) => transitions.push(`${from}:${event}:${to}`))

    expect(lifecycle.state).toBe('created')
    lifecycle.transition('mount')
    lifecycle.transition('activate')
    lifecycle.transition('minimize')
    lifecycle.transition('restore')
    lifecycle.transition('close')
    lifecycle.transition('destroy')

    expect(lifecycle.state).toBe('destroyed')
    expect(transitions).toEqual([
      'created:mount:mounted',
      'mounted:activate:active',
      'active:minimize:minimized',
      'minimized:restore:active',
      'active:close:closed',
      'closed:destroy:destroyed',
    ])
  })

  it('rejects invalid transitions without changing state', () => {
    const lifecycle = createWidgetLifecycle()
    expect(() => lifecycle.transition('restore')).toThrow(InvalidWidgetLifecycleTransitionError)
    expect(lifecycle.state).toBe('created')
  })

  it('runs all registered cleanup resources once on destroy and aggregates failures', () => {
    const lifecycle = createWidgetLifecycle()
    const first = vi.fn()
    const second = vi.fn(() => { throw new Error('cleanup failed') })
    lifecycle.addCleanup(first)
    lifecycle.addCleanup(second)

    expect(() => lifecycle.transition('destroy')).toThrow(AggregateError)
    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()
    expect(lifecycle.state).toBe('destroyed')
  })
})
