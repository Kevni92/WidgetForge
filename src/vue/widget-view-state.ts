import { computed, inject, provide, type ComputedRef, type InjectionKey } from 'vue'
import type { WidgetViewStateDefinition, WidgetViewStateHandle, WidgetViewStateValue, WidgetViewStateStore } from '../core/widget-view-state'

export interface WidgetViewStateHostContext {
  readonly store: WidgetViewStateStore
  readonly scopeId: ComputedRef<string>
}

export const widgetViewStateHostKey: InjectionKey<WidgetViewStateHostContext> = Symbol('WidgetForgeWidgetViewStateHost')

export function provideWidgetViewState(store: WidgetViewStateStore, scopeId: string | (() => string) = 'default'): void {
  provide(widgetViewStateHostKey, {
    store,
    scopeId: computed(() => typeof scopeId === 'function' ? scopeId() : scopeId),
  })
}

export function useWidgetViewStateHost(): WidgetViewStateHostContext | null { return inject(widgetViewStateHostKey, null) }

export interface WidgetViewStateContext<TState extends WidgetViewStateValue = WidgetViewStateValue> extends WidgetViewStateHandle<TState> {
  readonly definition: WidgetViewStateDefinition<TState>
}

export class WidgetViewStateUnavailableError extends Error {
  constructor() { super('widget view state is not available for the current widget'); this.name = 'WidgetViewStateUnavailableError' }
}

export const widgetViewStateContextKey: InjectionKey<WidgetViewStateContext> = Symbol('WidgetForgeWidgetViewStateContext')

export function useWidgetViewState<TState extends WidgetViewStateValue = WidgetViewStateValue>(): WidgetViewStateContext<TState> {
  const context = inject(widgetViewStateContextKey)
  if (!context) throw new WidgetViewStateUnavailableError()
  return context as WidgetViewStateContext<TState>
}
