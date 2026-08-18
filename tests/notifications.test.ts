import { describe, expect, it, vi } from 'vitest'
import {
  createNotificationStore,
  NotificationDefinitionError,
} from '../src/core/notifications'

describe('NotificationStore', () => {
  it('defines transient and persistent lifecycle centrally', () => {
    let id = 0
    const store = createNotificationStore({
      defaultDurationMs: 1_500,
      now: () => 42,
      idFactory: () => `n-${++id}`,
    })
    const listener = vi.fn()
    store.subscribe(listener)

    const toast = store.notify({ title: 'Saved', severity: 'success' })
    const persistent = store.notify({
      title: 'Market warning',
      persistent: true,
      target: { widgetId: 'market.ticker', parameters: { commodity: 'STEEL' } },
    })

    expect(toast).toMatchObject({ id: 'n-1', durationMs: 1_500, persistent: false, createdAt: 42 })
    expect(persistent).toMatchObject({ id: 'n-2', durationMs: null, persistent: true })
    expect(store.getSnapshot()).toHaveLength(2)
    expect(listener).toHaveBeenCalledTimes(2)

    expect(store.dismiss('n-1')).toBe(true)
    expect(store.dismiss('missing')).toBe(false)
    expect(store.getSnapshot().map((item) => item.id)).toEqual(['n-2'])

    store.clear()
    expect(store.getSnapshot()).toEqual([])
  })

  it('rejects invalid notification definitions', () => {
    const store = createNotificationStore()
    expect(() => store.notify({ title: '   ' })).toThrow(NotificationDefinitionError)
    expect(() => store.notify({ title: 'Invalid', durationMs: -1 })).toThrow(NotificationDefinitionError)
    expect(() => createNotificationStore({ defaultDurationMs: -1 })).toThrow(NotificationDefinitionError)
  })
})
