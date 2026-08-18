import { inject, type ComputedRef, type InjectionKey } from 'vue'
import type { WidgetId } from '../core/widget'
import type { WidgetLifecycle } from '../core/widget-lifecycle'

export interface WidgetContext<TParameters extends Record<string, unknown> = Record<string, unknown>> {
  readonly instanceId: string
  readonly widgetId: ComputedRef<WidgetId>
  readonly parameters: ComputedRef<Readonly<TParameters>>
  readonly lifecycle: WidgetLifecycle
}

export const widgetContextKey: InjectionKey<WidgetContext> = Symbol('WidgetForgeWidgetContext')

export function useWidgetContext<
  TParameters extends Record<string, unknown> = Record<string, unknown>,
>(): WidgetContext<TParameters> {
  const context = inject(widgetContextKey)
  if (!context) throw new Error('useWidgetContext must be used inside WidgetHost')
  return context as WidgetContext<TParameters>
}
