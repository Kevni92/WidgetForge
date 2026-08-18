export type WidgetLifecycleState =
  | 'created'
  | 'mounted'
  | 'active'
  | 'minimized'
  | 'closed'
  | 'destroyed'

export type WidgetLifecycleEvent =
  | 'mount'
  | 'activate'
  | 'minimize'
  | 'restore'
  | 'close'
  | 'destroy'

export interface WidgetLifecycleTransition {
  readonly event: WidgetLifecycleEvent
  readonly from: WidgetLifecycleState
  readonly to: WidgetLifecycleState
}

export type WidgetLifecycleListener = (transition: WidgetLifecycleTransition) => void
export type WidgetLifecycleCleanup = () => void

export class InvalidWidgetLifecycleTransitionError extends Error {
  constructor(
    public readonly state: WidgetLifecycleState,
    public readonly event: WidgetLifecycleEvent,
  ) {
    super(`cannot ${event} widget lifecycle from ${state}`)
    this.name = 'InvalidWidgetLifecycleTransitionError'
  }
}

const transitions: Record<WidgetLifecycleState, Partial<Record<WidgetLifecycleEvent, WidgetLifecycleState>>> = {
  created: { mount: 'mounted', close: 'closed', destroy: 'destroyed' },
  mounted: { activate: 'active', close: 'closed', destroy: 'destroyed' },
  active: { minimize: 'minimized', close: 'closed', destroy: 'destroyed' },
  minimized: { restore: 'active', close: 'closed', destroy: 'destroyed' },
  closed: { destroy: 'destroyed' },
  destroyed: {},
}

export class WidgetLifecycle {
  private currentState: WidgetLifecycleState = 'created'
  private readonly listeners = new Set<WidgetLifecycleListener>()
  private readonly cleanups = new Set<WidgetLifecycleCleanup>()

  get state(): WidgetLifecycleState {
    return this.currentState
  }

  transition(event: WidgetLifecycleEvent): WidgetLifecycleState {
    const next = transitions[this.currentState][event]
    if (!next) throw new InvalidWidgetLifecycleTransitionError(this.currentState, event)

    const from = this.currentState
    this.currentState = next
    const transition = { event, from, to: next } satisfies WidgetLifecycleTransition
    for (const listener of [...this.listeners]) listener(transition)

    if (next === 'destroyed') this.runCleanups()
    return next
  }

  transitionIfPossible(event: WidgetLifecycleEvent): WidgetLifecycleState {
    const next = transitions[this.currentState][event]
    return next ? this.transition(event) : this.currentState
  }

  subscribe(listener: WidgetLifecycleListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  addCleanup(cleanup: WidgetLifecycleCleanup): () => void {
    if (this.currentState === 'destroyed') {
      cleanup()
      return () => undefined
    }

    this.cleanups.add(cleanup)
    return () => this.cleanups.delete(cleanup)
  }

  private runCleanups(): void {
    const errors: unknown[] = []
    for (const cleanup of [...this.cleanups]) {
      try {
        cleanup()
      } catch (error) {
        errors.push(error)
      }
    }
    this.cleanups.clear()
    this.listeners.clear()
    if (errors.length > 0) throw new AggregateError(errors, 'widget lifecycle cleanup failed')
  }
}

export function createWidgetLifecycle(): WidgetLifecycle {
  return new WidgetLifecycle()
}
