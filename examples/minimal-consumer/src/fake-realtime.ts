import type {
  DataKey,
  DataUnsubscribe,
  MutationDefinition,
  MutationInvocationContext,
  RealtimeConnectionListener,
  RealtimeConnectionState,
  RealtimeMutationTransport,
  RealtimeResourceObserver,
  RealtimeTransport,
} from 'widgetforge'

interface ActiveSubscription {
  readonly key: DataKey<unknown>
  readonly observer: RealtimeResourceObserver<unknown>
  active: boolean
}

export class FakeSharedRealtimeTransport implements RealtimeTransport, RealtimeMutationTransport {
  private readonly connectionListeners = new Set<RealtimeConnectionListener>()
  private readonly subscriptions = new Set<ActiveSubscription>()
  private connectionState: RealtimeConnectionState = { status: 'disconnected', error: null }

  connect(): void {
    this.emit({ status: 'connecting', error: null })
    this.emit({ status: 'connected', error: null })
  }

  disconnect(): void {
    this.emit({ status: 'disconnected', error: null })
  }

  observeConnection(listener: RealtimeConnectionListener): DataUnsubscribe {
    this.connectionListeners.add(listener)
    return () => this.connectionListeners.delete(listener)
  }

  subscribe<T>(key: DataKey<T>, observer: RealtimeResourceObserver<T>): DataUnsubscribe {
    const subscription: ActiveSubscription = {
      key: key as DataKey<unknown>,
      observer: observer as RealtimeResourceObserver<unknown>,
      active: true,
    }
    this.subscriptions.add(subscription)

    if (this.connectionState.status === 'connected') {
      observer.snapshot({ label: key.id, value: 1 } as T)
    }

    return () => {
      if (!subscription.active) return
      subscription.active = false
      this.subscriptions.delete(subscription)
    }
  }

  request<Input, Result>(
    definition: MutationDefinition<Input, Result>,
    input: Input,
    context?: MutationInvocationContext,
  ): Promise<Result> {
    void definition
    void input
    void context
    if (this.connectionState.status !== 'connected') {
      return Promise.reject(new Error('fake transport is disconnected'))
    }
    return Promise.resolve({ accepted: true } as unknown as Result)
  }

  private emit(state: RealtimeConnectionState): void {
    this.connectionState = state
    for (const listener of [...this.connectionListeners]) listener(state)
    if (state.status === 'connected') {
      for (const subscription of this.subscriptions) {
        if (subscription.active) subscription.observer.snapshot({ label: subscription.key.id, value: 1 })
      }
    }
  }
}
