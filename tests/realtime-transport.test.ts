import { describe, expect, it, vi } from 'vitest'
import { createDataClient, createDataKey, type DataKey, type DataUnsubscribe } from '../src/data/data-client'
import {
  createRealtimeDataProvider,
  type RealtimeConnectionListener,
  type RealtimeConnectionState,
  type RealtimeResourceObserver,
  type RealtimeTransport,
} from '../src/data/realtime-transport'

interface TransportSubscription {
  readonly key: DataKey<unknown>
  readonly observer: RealtimeResourceObserver<unknown>
  readonly unsubscribe: ReturnType<typeof vi.fn>
  active: boolean
}

class FakeRealtimeTransport implements RealtimeTransport {
  readonly connectCalls = vi.fn()
  readonly disconnectCalls = vi.fn()
  readonly subscriptions: TransportSubscription[] = []
  private readonly listeners = new Set<RealtimeConnectionListener>()

  connect(): void {
    this.connectCalls()
    this.emitConnection({ status: 'connecting', error: null })
    this.emitConnection({ status: 'connected', error: null })
  }

  disconnect(): void {
    this.disconnectCalls()
    this.emitConnection({ status: 'disconnected', error: null })
  }

  observeConnection(listener: RealtimeConnectionListener): DataUnsubscribe {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  subscribe<T>(key: DataKey<T>, observer: RealtimeResourceObserver<T>): DataUnsubscribe {
    const record: TransportSubscription = {
      key: key as DataKey<unknown>,
      observer: observer as RealtimeResourceObserver<unknown>,
      unsubscribe: vi.fn(),
      active: true,
    }
    this.subscriptions.push(record)
    return () => {
      if (!record.active) return
      record.active = false
      record.unsubscribe()
    }
  }

  reconnect(): void {
    this.emitConnection({ status: 'reconnecting', error: null })
    this.emitConnection({ status: 'connected', error: null })
  }

  failConnection(message: string): void {
    this.emitConnection({ status: 'error', error: new Error(message) })
  }

  snapshot(index: number, value: unknown): void {
    this.subscriptions[index]?.observer.snapshot(value)
  }

  update(index: number, value: unknown): void {
    this.subscriptions[index]?.observer.update(value)
  }

  resourceError(index: number, error: unknown): void {
    this.subscriptions[index]?.observer.error(error)
  }

  private emitConnection(state: RealtimeConnectionState): void {
    for (const listener of [...this.listeners]) listener(state)
  }
}

describe('RealtimeDataProvider', () => {
  it('adapts transport snapshots and updates to the normal DataClient state', () => {
    const transport = new FakeRealtimeTransport()
    const provider = createRealtimeDataProvider(transport)
    const client = createDataClient(provider)
    const key = createDataKey<number>('external.metric', 'one')

    provider.connect()
    const handle = client.acquire(key)

    expect(provider.connectionState.value).toEqual({ status: 'connected', error: null })
    expect(transport.subscriptions).toHaveLength(1)

    transport.snapshot(0, 10)
    expect(handle.state.value).toEqual({ status: 'ready', data: 10, error: null })

    transport.update(0, 12)
    expect(handle.state.value).toEqual({ status: 'ready', data: 12, error: null })

    transport.resourceError(0, new Error('resource failed'))
    expect(handle.state.value.status).toBe('error')
    expect(handle.state.value.data).toBe(12)
  })

  it('queues active resources while disconnected and binds them after connect', () => {
    const transport = new FakeRealtimeTransport()
    const provider = createRealtimeDataProvider(transport)
    const handle = createDataClient(provider).acquire(createDataKey<string>('external.metric', 'queued'))

    expect(handle.state.value.status).toBe('loading')
    expect(transport.subscriptions).toHaveLength(0)

    provider.connect()
    expect(transport.subscriptions).toHaveLength(1)

    transport.snapshot(0, 'online')
    expect(handle.state.value.data).toBe('online')
  })

  it('unbinds on interruption and restores every still-active subscription after reconnect', () => {
    const transport = new FakeRealtimeTransport()
    const provider = createRealtimeDataProvider(transport)
    provider.connect()

    const client = createDataClient(provider)
    const first = client.acquire(createDataKey<number>('external.metric', 'first'))
    const second = client.acquire(createDataKey<number>('external.metric', 'second'))
    expect(transport.subscriptions).toHaveLength(2)

    transport.reconnect()

    expect(transport.subscriptions[0]?.unsubscribe).toHaveBeenCalledTimes(1)
    expect(transport.subscriptions[1]?.unsubscribe).toHaveBeenCalledTimes(1)
    expect(transport.subscriptions).toHaveLength(4)

    transport.snapshot(0, 999)
    expect(first.state.value.status).toBe('loading')

    transport.snapshot(2, 3)
    transport.snapshot(3, 4)
    expect(first.state.value.data).toBe(3)
    expect(second.state.value.data).toBe(4)
  })

  it('does not resubscribe a resource released during a disconnect', () => {
    const transport = new FakeRealtimeTransport()
    const provider = createRealtimeDataProvider(transport)
    provider.connect()
    const handle = createDataClient(provider).acquire(createDataKey<number>('external.metric', 'temporary'))
    expect(transport.subscriptions).toHaveLength(1)

    transport.disconnect()
    handle.release()
    provider.connect()

    expect(transport.subscriptions).toHaveLength(1)
  })

  it('still relies on DataClient sharing for multiple widgets of the same resource', () => {
    const transport = new FakeRealtimeTransport()
    const provider = createRealtimeDataProvider(transport)
    provider.connect()
    const client = createDataClient(provider)
    const key = createDataKey<number>('external.metric', 'shared')

    const first = client.acquire(key)
    const second = client.acquire(key)

    expect(first.state).toBe(second.state)
    expect(transport.subscriptions).toHaveLength(1)

    first.release()
    expect(transport.subscriptions[0]?.unsubscribe).not.toHaveBeenCalled()
    second.release()
    expect(transport.subscriptions[0]?.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('exposes connection state separately from resource data and delegates connect/disconnect', () => {
    const transport = new FakeRealtimeTransport()
    const provider = createRealtimeDataProvider(transport)

    provider.connect()
    expect(transport.connectCalls).toHaveBeenCalledTimes(1)
    expect(provider.connectionState.value.status).toBe('connected')

    transport.failConnection('network unavailable')
    expect(provider.connectionState.value.status).toBe('error')
    expect(provider.connectionState.value.error?.message).toBe('network unavailable')

    provider.disconnect()
    expect(transport.disconnectCalls).toHaveBeenCalledTimes(1)
    expect(provider.connectionState.value).toEqual({ status: 'disconnected', error: null })
  })

  it('dispose detaches active transport subscriptions and the connection listener', () => {
    const transport = new FakeRealtimeTransport()
    const provider = createRealtimeDataProvider(transport)
    provider.connect()
    createDataClient(provider).acquire(createDataKey<number>('external.metric', 'dispose'))

    provider.dispose()
    expect(transport.subscriptions[0]?.unsubscribe).toHaveBeenCalledTimes(1)

    transport.failConnection('late')
    expect(provider.connectionState.value.status).toBe('connected')
  })
})
