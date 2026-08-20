import { describe, expect, it, vi } from 'vitest'
import {
  createDataClient,
  createDataKey,
  createMutationClient,
  createMutationDefinition,
  createRealtimeDataProvider,
  createRealtimeMutationProvider,
  MutationError,
  type DataKey,
  type DataUnsubscribe,
  type MutationDefinition,
  type MutationInvocationContext,
  type RealtimeConnectionListener,
  type RealtimeConnectionState,
  type RealtimeMutationTransport,
  type RealtimeResourceObserver,
  type RealtimeTransport,
} from '../src/index'

interface MutationRequest {
  readonly definition: MutationDefinition<unknown, unknown>
  readonly input: unknown
  readonly context: MutationInvocationContext | undefined
  readonly resolve: (value: unknown) => void
  readonly reject: (error: unknown) => void
}

interface Subscription {
  readonly key: DataKey<unknown>
  readonly observer: RealtimeResourceObserver<unknown>
  readonly unsubscribe: () => void
  active: boolean
}

class SharedRealtimeTransport implements RealtimeTransport, RealtimeMutationTransport {
  readonly connectCalls = vi.fn()
  readonly disconnectCalls = vi.fn()
  readonly listeners = new Set<RealtimeConnectionListener>()
  readonly subscriptions: Subscription[] = []
  readonly requests: MutationRequest[] = []

  connect(): void {
    this.connectCalls()
    this.emit({ status: 'connecting', error: null })
    this.emit({ status: 'connected', error: null })
  }

  disconnect(): void {
    this.disconnectCalls()
    this.emit({ status: 'disconnected', error: null })
  }

  observeConnection(listener: RealtimeConnectionListener): DataUnsubscribe {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  subscribe<T>(key: DataKey<T>, observer: RealtimeResourceObserver<T>): DataUnsubscribe {
    const subscription: Subscription = {
      key: key as DataKey<unknown>,
      observer: observer as RealtimeResourceObserver<unknown>,
      unsubscribe: vi.fn(),
      active: true,
    }
    this.subscriptions.push(subscription)
    return () => {
      if (!subscription.active) return
      subscription.active = false
      subscription.unsubscribe()
    }
  }

  request<Input, Result>(
    definition: MutationDefinition<Input, Result>,
    input: Input,
    context?: MutationInvocationContext,
  ): Promise<Result> {
    return new Promise<Result>((resolve, reject) => {
      this.requests.push({
        definition: definition as MutationDefinition<unknown, unknown>,
        input,
        context,
        resolve: (value) => resolve(value as Result),
        reject,
      })
    })
  }

  reconnect(): void {
    this.emit({ status: 'reconnecting', error: null })
    this.emit({ status: 'connected', error: null })
  }

  emitError(message: string): void {
    this.emit({ status: 'error', error: new Error(message) })
  }

  resolveRequest(index: number, value: unknown): void {
    this.requests[index]?.resolve(value)
  }

  rejectRequest(index: number, error: unknown): void {
    this.requests[index]?.reject(error)
  }

  snapshot(index: number, value: unknown): void {
    this.subscriptions[index]?.observer.snapshot(value)
  }

  private emit(state: RealtimeConnectionState): void {
    for (const listener of [...this.listeners]) listener(state)
  }
}

describe('RealtimeMutationProvider', () => {
  it('executes a request on a connected transport and forwards context', async () => {
    const transport = new SharedRealtimeTransport()
    const provider = createRealtimeMutationProvider(transport)
    const client = createMutationClient(provider)
    const definition = createMutationDefinition<{ orderId: string }, { accepted: boolean }>('order.place')
    const context = { metadata: { source: 'test' } }

    transport.connect()
    const resultPromise = client.createHandle(definition).execute({ orderId: 'one' }, context)

    expect(transport.connectCalls).toHaveBeenCalledTimes(1)
    expect(transport.requests).toHaveLength(1)
    expect(transport.requests[0]?.definition).toEqual(definition)
    expect(transport.requests[0]?.input).toEqual({ orderId: 'one' })
    expect(transport.requests[0]?.context).toBe(context)

    transport.resolveRequest(0, { accepted: true })
    await expect(resultPromise).resolves.toEqual({ accepted: true })
  })

  it('rejects before sending when disconnected or reconnecting without queueing', async () => {
    const transport = new SharedRealtimeTransport()
    const provider = createRealtimeMutationProvider(transport)
    const client = createMutationClient(provider)
    const definition = createMutationDefinition<Record<string, never>, string>('demo.offline')
    const handle = client.createHandle(definition)

    await expect(handle.execute({})).rejects.toMatchObject({
      kind: 'transport',
      code: 'REALTIME_NOT_CONNECTED',
    })
    expect(transport.requests).toHaveLength(0)

    transport.connect()
    transport.disconnect()
    await expect(handle.execute({})).rejects.toMatchObject({ code: 'REALTIME_NOT_CONNECTED' })
    expect(transport.requests).toHaveLength(0)
  })

  it('normalizes request failures as transport errors and does not retry them', async () => {
    const transport = new SharedRealtimeTransport()
    const provider = createRealtimeMutationProvider(transport)
    const handle = createMutationClient(provider).createHandle(createMutationDefinition('demo.failure'))

    transport.connect()
    const resultPromise = handle.execute({})
    transport.rejectRequest(0, new Error('socket write failed'))

    await expect(resultPromise).rejects.toMatchObject({
      kind: 'transport',
      code: 'REALTIME_REQUEST_FAILED',
      message: 'socket write failed',
    })
    expect(transport.requests).toHaveLength(1)
    expect(handle.state.value.error).toBeInstanceOf(MutationError)
  })

  it('ends a pending invocation on disconnect without replaying a late response', async () => {
    const transport = new SharedRealtimeTransport()
    const provider = createRealtimeMutationProvider(transport)
    const handle = createMutationClient(provider).createHandle(createMutationDefinition('demo.disconnect'))

    transport.connect()
    const resultPromise = handle.execute({})
    transport.disconnect()

    await expect(resultPromise).rejects.toMatchObject({
      kind: 'transport',
      code: 'REALTIME_CONNECTION_LOST',
      details: { outcome: 'unknown' },
    })
    expect(handle.state.value.status).toBe('error')

    transport.resolveRequest(0, 'late response')
    await Promise.resolve()
    expect(handle.state.value.error?.code).toBe('REALTIME_CONNECTION_LOST')
    expect(transport.requests).toHaveLength(1)
  })

  it('allows new requests after reconnect while preserving the no-replay rule', async () => {
    const transport = new SharedRealtimeTransport()
    const provider = createRealtimeMutationProvider(transport)
    const handle = createMutationClient(provider).createHandle(createMutationDefinition('demo.reconnect'))

    transport.connect()
    const oldRequest = handle.execute({ sequence: 1 })
    transport.disconnect()
    await expect(oldRequest).rejects.toMatchObject({ code: 'REALTIME_CONNECTION_LOST' })

    transport.reconnect()
    expect(transport.requests).toHaveLength(1)
    const newRequest = handle.execute({ sequence: 2 })
    expect(transport.requests).toHaveLength(2)
    transport.resolveRequest(1, 'new result')

    await expect(newRequest).resolves.toBe('new result')
    expect(handle.state.value).toEqual({ status: 'success', result: 'new result', error: null })
  })

  it('sends identical explicit inputs as separate requests', async () => {
    const transport = new SharedRealtimeTransport()
    const provider = createRealtimeMutationProvider(transport)
    const handle = createMutationClient(provider).createHandle(createMutationDefinition('demo.duplicates'))

    transport.connect()
    const first = handle.execute({ value: 1 })
    const second = handle.execute({ value: 1 })
    expect(transport.requests).toHaveLength(2)
    transport.resolveRequest(0, 'first')
    transport.resolveRequest(1, 'second')

    await expect(first).resolves.toBe('first')
    await expect(second).resolves.toBe('second')
  })

  it('shares connection capabilities with RealtimeDataProvider and preserves data resubscribe semantics', async () => {
    const transport = new SharedRealtimeTransport()
    const dataProvider = createRealtimeDataProvider(transport)
    const mutationProvider = createRealtimeMutationProvider(transport)
    const dataHandle = createDataClient(dataProvider).acquire(createDataKey<number>('metric', 'one'))
    const mutationHandle = createMutationClient(mutationProvider).createHandle(createMutationDefinition('demo.shared'))

    transport.connect()
    expect(transport.subscriptions).toHaveLength(1)
    const pendingMutation = mutationHandle.execute({})
    transport.disconnect()

    await expect(pendingMutation).rejects.toMatchObject({ code: 'REALTIME_CONNECTION_LOST' })
    expect(transport.subscriptions[0]?.unsubscribe).toHaveBeenCalledTimes(1)

    transport.reconnect()
    expect(transport.subscriptions).toHaveLength(2)
    const newMutation = mutationHandle.execute({})
    transport.resolveRequest(1, 'accepted')
    await expect(newMutation).resolves.toBe('accepted')

    dataHandle.release()
  })

  it('dispose removes listeners, settles pending work and does not disconnect consumer-owned transport', async () => {
    const transport = new SharedRealtimeTransport()
    const provider = createRealtimeMutationProvider(transport)
    const handle = createMutationClient(provider).createHandle(createMutationDefinition('demo.dispose'))

    transport.connect()
    const pending = handle.execute({})
    provider.dispose()

    await expect(pending).rejects.toMatchObject({ code: 'REALTIME_PROVIDER_DISPOSED' })
    expect(transport.disconnectCalls).not.toHaveBeenCalled()

    transport.emitError('late connection event')
    expect(provider.connectionState.value.status).toBe('connected')
  })
})
