import { describe, expect, it, vi } from 'vitest'
import {
  createDataClient,
  createDataKey,
  type DataKey,
  type DataObserver,
  type DataProvider,
} from '../src/data/data-client'

class RecordingProvider implements DataProvider {
  subscriptions: Array<{ key: DataKey<unknown>; observer: DataObserver<unknown>; unsubscribe: ReturnType<typeof vi.fn> }> = []

  subscribe<T>(key: DataKey<T>, observer: DataObserver<T>): () => void {
    const unsubscribe = vi.fn()
    this.subscriptions.push({
      key: key as DataKey<unknown>,
      observer: observer as DataObserver<unknown>,
      unsubscribe,
    })
    return unsubscribe
  }
}

describe('DataClient cache', () => {
  it('shares one reactive state and one provider subscription per resource key', () => {
    const provider = new RecordingProvider()
    const client = createDataClient(provider)
    const key = createDataKey<number>('counter', 'main')

    const first = client.acquire(key)
    const second = client.acquire(key)

    expect(provider.subscriptions).toHaveLength(1)
    expect(first.state).toBe(second.state)

    provider.subscriptions[0]?.observer.next(7)
    expect(first.state.value).toEqual({ status: 'ready', data: 7, error: null })
    expect(second.state.value).toEqual({ status: 'ready', data: 7, error: null })

    first.release()
    expect(provider.subscriptions[0]?.unsubscribe).not.toHaveBeenCalled()

    second.release()
    expect(provider.subscriptions[0]?.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('keeps separate subscriptions for distinct resource keys', () => {
    const provider = new RecordingProvider()
    const client = createDataClient(provider)

    client.acquire(createDataKey<number>('counter', 'one'))
    client.acquire(createDataKey<number>('counter', 'two'))

    expect(provider.subscriptions).toHaveLength(2)
  })

  it('retains cached state for the configured cache lifetime and then evicts it', () => {
    vi.useFakeTimers()
    try {
      const provider = new RecordingProvider()
      const client = createDataClient(provider, { cacheTimeMs: 1_000 })
      const key = createDataKey<number>('counter', 'retained')

      const first = client.acquire(key)
      provider.subscriptions[0]?.observer.next(42)
      first.release()

      const second = client.acquire(key)
      expect(second.state).toBe(first.state)
      expect(second.state.value).toEqual({ status: 'ready', data: 42, error: null })
      expect(provider.subscriptions).toHaveLength(2)
      second.release()

      vi.advanceTimersByTime(1_000)
      const third = client.acquire(key)

      expect(third.state).not.toBe(first.state)
      expect(third.state.value).toEqual({ status: 'loading', data: null, error: null })
    } finally {
      vi.useRealTimers()
    }
  })

  it('ignores late events from an obsolete underlying subscription', () => {
    const provider = new RecordingProvider()
    const client = createDataClient(provider, { cacheTimeMs: 10_000 })
    const key = createDataKey<string>('resource', 'race')

    const first = client.acquire(key)
    first.release()
    const second = client.acquire(key)

    provider.subscriptions[0]?.observer.next('stale')
    expect(second.state.value.status).toBe('loading')

    provider.subscriptions[1]?.observer.next('fresh')
    expect(second.state.value).toEqual({ status: 'ready', data: 'fresh', error: null })

    second.release()
  })

  it('rejects invalid cache lifetimes', () => {
    const provider = new RecordingProvider()

    expect(() => createDataClient(provider, { cacheTimeMs: -1 })).toThrow(RangeError)
    expect(() => createDataClient(provider, { cacheTimeMs: Number.POSITIVE_INFINITY })).toThrow(RangeError)
  })
})
