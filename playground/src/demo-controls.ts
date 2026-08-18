import { inject, provide, type InjectionKey } from 'vue'

export type DemoThemeName = 'forge-dark' | 'forge-light'

export interface DemoControls {
  readonly theme: () => DemoThemeName
  readonly setTheme: (theme: DemoThemeName) => void
  readonly resetWorkspace: () => void
}

const key: InjectionKey<DemoControls> = Symbol('WidgetForgePlaygroundDemoControls')

export function provideDemoControls(controls: DemoControls): void {
  provide(key, controls)
}

export function useDemoControls(): DemoControls {
  const controls = inject(key)
  if (!controls) throw new Error('playground demo controls are unavailable')
  return controls
}
