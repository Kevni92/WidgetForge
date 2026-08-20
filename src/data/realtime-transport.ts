import { shallowRef, type ShallowRef } from 'vue'
import {
  type DataKey,
  type DataObserver,
  type DataProvider,
  type DataUnsubscribe,
} from './data-client'
import {
  MutationError,
  normalizeMutationError,
  type MutationDefinition,
  type MutationInvocationContext,
  type MutationProvider,
} from './mutation-client'

export type RealtimeConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'

export type RealtimeConnectionState =
  | { readonly status: Exclude<RealtimeConnectionStatus, 'error'>; readonly error: null }
  | { readonly status: 'error'; readonly error: Error }

export type RealtimeConnectionStateRef = Readonly<ShallowRef<RealtimeConnectionState>>
export type RealtimeConnectionListener = (state: RealtimeConnectionState) => void

export interface RealtimeConnectionTransport {
  connect(): void | Promise<void>
  disconnect(): void | Promise<void>
  observeConnection(listener: RealtimeConnectionListener): DataUnsubscribe
}

export interface RealtimeResourceObserver<T> {
  snapshot(value: T): void
  update(value: T): void
  error(error: unknown): void
}

export interface RealtimeTransport extends RealtimeConnectionTransport {
  subscribe<T>(key: DataKey<T>, observer: RealtimeResourceObserver<T>): DataUnsubscribe
}

export interface RealtimeMutationTransport extends RealtimeConnectionTransport {
  request<Input, Result>(
    definition: MutationDefinition<Input, Result>,
    input: Input,
    context?: MutationInvocationContext,
  ): Promise<Result>
}

interface ActiveRealtimeMutation {
  active: boolean
  resolve(value: unknown): void
  reject(error: MutationError): void
}

interface ActiveRealtimeSubscription<T> {
  readonly key: DataKey<T>
  readonly observer: DataObserver<T>
  active: boolean
  transportUnsubscribe: DataUnsubscribe | null
  generation: number
}

function normalizeConnectionState(state: RealtimeConnectionState): RealtimeConnectionState {
  if (state.status === 'error') {
    return {
      status: 'error',
      error: state.error instanceof Error ? state.error : new Error(String(state.error)),
    }
  }
  return { status: state.status, error: null }
}

function createNotConnectedError(status: RealtimeConnectionStatus): MutationError {
  return new MutationError('transport', `Realtime mutation requires a connected transport (status: ${status})`, {
    code: 'REALTIME_NOT_CONNECTED',
    details: { status },
  })
}

function createConnectionLostError(): MutationError {
  return new MutationError('transport', 'Realtime connection lost while a mutation was pending', {
    code: 'REALTIME_CONNECTION_LOST',
    details: { outcome: 'unknown' },
  })
}

function createDisposedError(): MutationError {
  return new MutationError('transport', 'Realtime mutation provider has been disposed', {
    code: 'REALTIME_PROVIDER_DISPOSED',
  })
}

function normalizeRealtimeMutationError(error: unknown): MutationError {
  const normalized = normalizeMutationError(error)
  if (normalized.kind !== 'unknown') return normalized
  return new MutationError('transport', normalized.message, {
    code: 'REALTIME_REQUEST_FAILED',
    cause: error,
  })
}

export class RealtimeDataProvider implements DataProvider {
  private readonly subscriptions = new Set<ActiveRealtimeSubscription<unknown>>()
  private readonly connectionStateInternal = shallowRef<RealtimeConnectionState>({
    status: 'disconnected',
    error: null,
  })
  private readonly stopObservingConnection: DataUnsubscribe

  readonly connectionState: RealtimeConnectionStateRef = this.connectionStateInternal

  constructor(private readonly transport: RealtimeTransport) {
    this.stopObservingConnection = transport.observeConnection((state) => this.applyConnectionState(state))
  }

  connect(): void | Promise<void> {
    return this.transport.connect()
  }

  disconnect(): void | Promise<void> {
    return this.transport.disconnect()
  }

  subscribe<T>(key: DataKey<T>, observer: DataObserver<T>): DataUnsubscribe {
    const subscription: ActiveRealtimeSubscription<T> = {
      key,
      observer,
      active: true,
      transportUnsubscribe: null,
      generation: 0,
    }
    this.subscriptions.add(subscription as ActiveRealtimeSubscription<unknown>)

    if (this.connectionStateInternal.value.status === 'connected') this.bind(subscription)

    return () => {
      if (!subscription.active) return
      subscription.active = false
      this.unbind(subscription)
      this.subscriptions.delete(subscription as ActiveRealtimeSubscription<unknown>)
    }
  }

  dispose(): void {
    for (const subscription of [...this.subscriptions]) {
      subscription.active = false
      this.unbind(subscription)
    }
    this.subscriptions.clear()
    this.stopObservingConnection()
  }

  private applyConnectionState(state: RealtimeConnectionState): void {
    const normalized = normalizeConnectionState(state)
    const previousStatus = this.connectionStateInternal.value.status
    this.connectionStateInternal.value = normalized

    if (normalized.status === 'connected') {
      if (previousStatus === 'connected') return
      for (const subscription of this.subscriptions) this.bind(subscription)
      return
    }

    if (previousStatus === 'connected') {
      for (const subscription of this.subscriptions) this.unbind(subscription)
    }
  }

  private bind<T>(subscription: ActiveRealtimeSubscription<T>): void {
    if (!subscription.active || subscription.transportUnsubscribe) return

    subscription.generation += 1
    const generation = subscription.generation
    const isCurrent = (): boolean => (
      subscription.active
      && subscription.generation === generation
      && this.connectionStateInternal.value.status === 'connected'
    )

    const transportObserver: RealtimeResourceObserver<T> = {
      snapshot: (value) => {
        if (isCurrent()) subscription.observer.next(value)
      },
      update: (value) => {
        if (isCurrent()) subscription.observer.next(value)
      },
      error: (error) => {
        if (isCurrent()) subscription.observer.error(error)
      },
    }

    try {
      subscription.transportUnsubscribe = this.transport.subscribe(subscription.key, transportObserver)
    } catch (error) {
      subscription.transportUnsubscribe = null
      if (isCurrent()) subscription.observer.error(error)
    }
  }

  private unbind<T>(subscription: ActiveRealtimeSubscription<T>): void {
    subscription.generation += 1
    const unsubscribe = subscription.transportUnsubscribe
    subscription.transportUnsubscribe = null
    unsubscribe?.()
  }
}

export class RealtimeMutationProvider implements MutationProvider {
  private readonly connectionStateInternal = shallowRef<RealtimeConnectionState>({
    status: 'disconnected',
    error: null,
  })
  private readonly pendingMutations = new Set<ActiveRealtimeMutation>()
  private readonly stopObservingConnection: DataUnsubscribe
  private disposed = false

  readonly connectionState: RealtimeConnectionStateRef = this.connectionStateInternal

  constructor(private readonly transport: RealtimeMutationTransport) {
    this.stopObservingConnection = transport.observeConnection((state) => this.applyConnectionState(state))
  }

  connect(): void | Promise<void> {
    return this.transport.connect()
  }

  disconnect(): void | Promise<void> {
    return this.transport.disconnect()
  }

  execute<Input, Result>(
    definition: MutationDefinition<Input, Result>,
    input: Input,
    context?: MutationInvocationContext,
  ): Promise<Result> {
    if (this.disposed) return Promise.reject(createDisposedError())

    const status = this.connectionStateInternal.value.status
    if (status !== 'connected') return Promise.reject(createNotConnectedError(status))

    let resolveResult!: (value: Result | PromiseLike<Result>) => void
    let rejectResult!: (error: unknown) => void
    const result = new Promise<Result>((resolve, reject) => {
      resolveResult = resolve
      rejectResult = reject
    })
    const pending: ActiveRealtimeMutation = {
      active: true,
      resolve: (value) => resolveResult(value as Result),
      reject: (error) => rejectResult(error),
    }
    this.pendingMutations.add(pending)

    try {
      const request = this.transport.request(definition, input, context)
      Promise.resolve(request).then(
        (value) => this.settleMutation(pending, () => pending.resolve(value)),
        (error: unknown) => this.settleMutation(pending, () => pending.reject(normalizeRealtimeMutationError(error))),
      )
    } catch (error) {
      this.settleMutation(pending, () => pending.reject(normalizeRealtimeMutationError(error)))
    }

    return result
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.rejectPendingMutations(createDisposedError())
    this.stopObservingConnection()
  }

  private applyConnectionState(state: RealtimeConnectionState): void {
    const normalized = normalizeConnectionState(state)
    const previousStatus = this.connectionStateInternal.value.status
    this.connectionStateInternal.value = normalized

    if (previousStatus === 'connected' && normalized.status !== 'connected') {
      this.rejectPendingMutations(createConnectionLostError())
    }
  }

  private rejectPendingMutations(error: MutationError): void {
    for (const pending of [...this.pendingMutations]) {
      this.settleMutation(pending, () => pending.reject(error))
    }
  }

  private settleMutation(pending: ActiveRealtimeMutation, settle: () => void): void {
    if (!pending.active) return
    pending.active = false
    this.pendingMutations.delete(pending)
    settle()
  }
}

export function createRealtimeDataProvider(transport: RealtimeTransport): RealtimeDataProvider {
  return new RealtimeDataProvider(transport)
}

export function createRealtimeMutationProvider(transport: RealtimeMutationTransport): RealtimeMutationProvider {
  return new RealtimeMutationProvider(transport)
}
