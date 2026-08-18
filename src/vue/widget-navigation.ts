import { inject, provide, type InjectionKey } from 'vue'
import type { WidgetNavigator } from '../core/navigation'

export class WidgetNavigationUnavailableError extends Error {
  constructor() {
    super('widget navigation is not available in the current Vue tree')
    this.name = 'WidgetNavigationUnavailableError'
  }
}

export const widgetNavigationKey: InjectionKey<WidgetNavigator> = Symbol('WidgetForgeWidgetNavigation')

export function provideWidgetNavigation(navigator: WidgetNavigator): void {
  provide(widgetNavigationKey, navigator)
}

export function useWidgetNavigation(): WidgetNavigator {
  const navigator = inject(widgetNavigationKey)
  if (!navigator) throw new WidgetNavigationUnavailableError()
  return navigator
}
