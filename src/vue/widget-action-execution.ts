import { inject, provide, type InjectionKey } from 'vue'
import type { WidgetActionExecutor } from '../core/widget-actions'

export const widgetActionExecutorKey: InjectionKey<WidgetActionExecutor> = Symbol('WidgetForgeWidgetActionExecutor')

export function provideWidgetActionExecutor(executor: WidgetActionExecutor): void {
  provide(widgetActionExecutorKey, executor)
}

export function useWidgetActionExecutor(): WidgetActionExecutor | null {
  return inject(widgetActionExecutorKey, null)
}
