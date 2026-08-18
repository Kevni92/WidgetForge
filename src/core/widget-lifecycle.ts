export type WidgetLifecycleState = 'created' | 'mounted' | 'active' | 'minimized' | 'closed' | 'destroyed'

export type WidgetLifecycleEventKind =
  | 'create'
  | 'mount'
  | 'unmount'
  | 'activate'
  | 'deactivate'
  | 'minimize'
  | 'restore'
  | 'close'
  | 'destroy'

export interface WidgetLifecycleEvent {
  readonly sequence: number
  readonly instanceId: string
  readonly kind: WidgetLifecycleEventKind
  readonly previousState: WidgetLifecycleState
  readonly currentState: WidgetLifecycleState
}

export type WidgetLifecycleListener = (event: WidgetLifecycleEvent) => void

export interface WidgetLifecycle {
  readonly instanceId: string
  readonly state: WidgetLifecycleState
  readonly mounted: boolean
  subscribe(listener: WidgetLifecycleListener): () => void
  history(): readonly WidgetLifecycleEvent[]
}

export class InvalidWidgetLifecycleTransitionError extends Error {
  constructor(
    public readonly instanceId: string,
    public readonly operation: WidgetLifecycleEventKind,
    public readonly state: WidgetLifecycleState,
  ) {
    super(`cannot ${operation} widget instance "${instanceId}" while lifecycle state is "${state}"`)
    this.name = 'InvalidWidgetLifecycleTransitionError'
  }
}

export class WidgetLifecycleController implements WidgetLifecycle {
  private readonly listeners = new Set<WidgetLifecycleListener>()
  private readonly events: WidgetLifecycleEvent[] = []
  private mountedFlag = false
  private activeRequested = false
  private minimizedFlag = false
  private closedFlag = false
  private destroyedFlag = false
  private nextSequence = 0

  constructor(public readonly instanceId: string) {
    this.record('create', 'created')
  }

  get state(): WidgetLifecycleState {
    if (this.destroyedFlag) return 'destroyed'
    if (this.closedFlag) return 'closed'
    if (this.minimizedFlag) return 'minimized'
    if (this.mountedFlag && this.activeRequested) return 'active'
    if (this.mountedFlag) return 'mounted'
    return 'created'
  }

  get mounted(): boolean {
    return this.mountedFlag
  }

  mount(): WidgetLifecycleState {
    this.assertOpen('mount')
    if (this.mountedFlag) return this.state
    const previous = this.state
    this.mountedFlag = true
    this.record('mount', previous)
    return this.state
  }

  unmount(): WidgetLifecycleState {
    if (!this.mountedFlag) return this.state
    if (this.destroyedFlag) throw new InvalidWidgetLifecycleTransitionError(this.instanceId, 'unmount', this.state)
    const previous = this.state
    this.mountedFlag = false
    this.record('unmount', previous)
    return this.state
  }

  activate(): WidgetLifecycleState {
    this.assertOpen('activate')
    if (this.minimizedFlag) throw new InvalidWidgetLifecycleTransitionError(this.instanceId, 'activate', this.state)
    if (this.activeRequested) return this.state
    const previous = this.state
    this.activeRequested = true
    this.record('activate', previous)
    return this.state
  }

  deactivate(): WidgetLifecycleState {
    if (this.closedFlag || this.destroyedFlag || !this.activeRequested) return this.state
    const previous = this.state
    this.activeRequested = false
    this.record('deactivate', previous)
    return this.state
  }

  minimize(): WidgetLifecycleState {
    this.assertOpen('minimize')
    if (this.minimizedFlag) return this.state
    const previous = this.state
    this.minimizedFlag = true
    this.activeRequested = false
    this.record('minimize', previous)
    return this.state
  }

  restore(): WidgetLifecycleState {
    this.assertOpen('restore')
    if (!this.minimizedFlag) return this.state
    const previous = this.state
    this.minimizedFlag = false
    this.record('restore', previous)
    return this.state
  }

  close(): WidgetLifecycleState {
    if (this.destroyedFlag) throw new InvalidWidgetLifecycleTransitionError(this.instanceId, 'close', this.state)
    if (this.closedFlag) return this.state
    const previous = this.state
    this.closedFlag = true
    this.activeRequested = false
    this.minimizedFlag = false
    this.record('close', previous)
    return this.state
  }

  destroy(): WidgetLifecycleState {
    if (this.destroyedFlag) return this.state
    if (!this.closedFlag || this.mountedFlag) {
      throw new InvalidWidgetLifecycleTransitionError(this.instanceId, 'destroy', this.state)
    }
    const previous = this.state
    this.destroyedFlag = true
    this.record('destroy', previous)
    return this.state
  }

  subscribe(listener: WidgetLifecycleListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  history(): readonly WidgetLifecycleEvent[] {
    return this.events.map((event) => ({ ...event }))
  }

  private assertOpen(operation: WidgetLifecycleEventKind): void {
    if (this.closedFlag || this.destroyedFlag) {
      throw new InvalidWidgetLifecycleTransitionError(this.instanceId, operation, this.state)
    }
  }

  private record(kind: WidgetLifecycleEventKind, previousState: WidgetLifecycleState): void {
    this.nextSequence += 1
    const event: WidgetLifecycleEvent = {
      sequence: this.nextSequence,
      instanceId: this.instanceId,
      kind,
      previousState,
      currentState: this.state,
    }
    this.events.push(event)

    for (const listener of [...this.listeners]) {
      try {
        listener({ ...event })
      } catch {
        // Lifecycle state is committed before notification. Listener failures are isolated and never roll state back.
      }
    }
  }
}

export function createWidgetLifecycle(instanceId: string): WidgetLifecycleController {
  return new WidgetLifecycleController(instanceId)
}
