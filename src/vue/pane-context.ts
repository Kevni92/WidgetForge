import { inject, provide, type InjectionKey, type Ref } from 'vue'
import type { PaneId } from '../core/pane'
import type { WindowSize } from '../core/window-geometry'

export type PaneHostType = 'window' | 'dock' | 'standalone'

export interface PaneContext {
  readonly paneId: Readonly<Ref<PaneId>>
  readonly hostType: Readonly<Ref<PaneHostType>>
  readonly size: Readonly<Ref<WindowSize>>
  readonly active: Readonly<Ref<boolean>>
  readonly visible: Readonly<Ref<boolean>>
  readonly focused: Readonly<Ref<boolean>>
  readonly collapsed: Readonly<Ref<boolean>>
}

export class PaneContextUnavailableError extends Error {
  constructor() {
    super('pane context is unavailable; widgets using usePaneContext() must be rendered by PaneHost')
    this.name = 'PaneContextUnavailableError'
  }
}

const paneContextKey: InjectionKey<PaneContext> = Symbol('WidgetForgePaneContext')

export function providePaneContext(context: PaneContext): void {
  provide(paneContextKey, context)
}

export function usePaneContext(): PaneContext {
  const context = inject(paneContextKey, null)
  if (!context) throw new PaneContextUnavailableError()
  return context
}
