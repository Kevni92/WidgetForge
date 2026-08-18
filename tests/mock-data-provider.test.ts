import { describe, expect, it, vi } from 'vitest'
import { createDataClient, createDataKey } from '../src/data/data-client'
import { createMockDataProvider, DuplicateMockDataResourceError } from '../src/data/mock-data-provider'

describe('MockDataProvider', () => {
  it('delivers an initial snapshot and deterministic interval updates', () => {
    vi.useFakeTimers()
    try {
      const provider = createMockDataProvider()
      const key = createDataKey<number>('demo.metric', 'power')
      const update = vi.fn((current: number) => current + 1)
      provider.register({ key, initial: 10, intervalMs: 1_000, update })

      const handle = createDataClient(provider).acquire(key)
      expect(handle.state.value).toEqual({ status: 'ready', data: 10, error: null })

      vi.advanceTimersByTime(3_000)
      expect(handle.state.value).toEqual({ status: 'ready', data: 13, error: null })
      expect(update).toHaveBeenCalledTimes(3)

      handle.release()
      vi.advanceTimersByTime(2_000)
      expect(update).toHaveBeenCalledTimes(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps multiple consumers of one DataClient synchronized through one mock stream', () => {
    const provider = createMockDataProvider()
    const key = createDataKey<{ value: number }>('demo.metric', 'shared')
    provider.register({ key, initial: { value: 1 } })
    const client = createDataClient(provider)

    const first = client.acquire(key)
    const second = client.acquire(key)
    provider.set(key, { value: 9 })

    expect(first.state).toBe(second.state)
    expect(first.state.value).toEqual({ status: 'ready', data: { value: 9 }, error: null })
    expect(second.state.value).toEqual(first.state.value)
  })

  it('simulates error and recovery using only the normal Data API states', () => {
    const provider = createMockDataProvider()
    const key = createDataKey<number>('demo.metric', 'recover')
    provider.register({ key, initial: 5 })
    const handle = createDataClient(provider).acquire(key)

    provider.fail(key, new Error('simulated disconnect'))
    expect(handle.state.value.status).toBe('error')
    expect(handle.state.value.data).toBe(5)

    provider.set(key, 7)
    provider.recover(key)
    expect(handle.state.value).toEqual({ status: 'ready', data: 7, error: null })
  })

  it('supports manual deterministic advancement without timers', () => {
    const provider = createMockDataProvider()
    const key = createDataKey<number>('demo.metric', 'manual')
    provider.register({ key, initial: 2, update: (current, tick) => current + tick })
    const handle = createDataClient(provider).acquire(key)

    expect(provider.advance(key)).toBe(3)
    expect(provider.advance(key)).toBe(5)
    expect(handle.state.value.data).toBe(5)
  })

  it('validates mock resource definitions', () => {
    const provider = createMockDataProvider()
    const key = createDataKey<number>('demo.metric', 'duplicate')
    provider.register({ key, initial: 1 })

    expect(() => provider.register({ key, initial: 2 })).toThrow(DuplicateMockDataResourceError)
    expect(() => provider.register({
      key: createDataKey<number>('demo.metric', 'bad-interval'),
      initial: 1,
      intervalMs: 0,
      update: (value) => value,
    })).toThrow(RangeError)
  })
})
