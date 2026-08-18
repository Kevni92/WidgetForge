import { shallowRef, type ShallowRef } from 'vue'
import {
  type DataKey,
  type DataObserver,
  type DataProvider,
  type DataUnsubscribe,
} from './data-client'

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

export interface RealtimeResourceObserver<T> {
  snapshot(value: T): void
  update(value: T): void
  error(error: unknown): void
}

export interface RealtimeTransport {
  connect(): void | Promise<void>
  disconnect(): void | Promise<void>
  observeConnection(listener: RealtimeConnectionListener): DataUnsubscribe
  subscribe<T>(key: DataKey<T>, observer: RealtimeResourceObserver<T>): DataUnsubscribe
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

export function createRealtimeDataProvider(transport: RealtimeTransport): RealtimeDataProvider {
  return new RealtimeDataProvider(transport)
}
