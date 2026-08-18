import { computed, inject, type ComputedRef, type InjectionKey } from 'vue'
import { defaultTheme, type WidgetForgeTheme } from './theme'

export const themeKey: InjectionKey<ComputedRef<WidgetForgeTheme>> = Symbol('WidgetForgeTheme')

export function useTheme(): ComputedRef<WidgetForgeTheme> {
  return inject(themeKey, computed(() => defaultTheme))
}
