import { inject, provide, type InjectionKey } from 'vue'
import type { CommandRegistry } from '../core/commands'
import type { CommandDocumentationView, WidgetDocumentationView } from '../core/documentation'
import type { WidgetRegistry } from '../core/widget-registry'

export interface WidgetDocumentationProvider {
  listWidgets(): readonly WidgetDocumentationView[]
  listCommands(): readonly CommandDocumentationView[]
}

export class WidgetDocumentationUnavailableError extends Error {
  constructor() {
    super('widget documentation is not available in the current Vue tree')
    this.name = 'WidgetDocumentationUnavailableError'
  }
}

export const widgetDocumentationKey: InjectionKey<WidgetDocumentationProvider> = Symbol('WidgetForgeWidgetDocumentation')

export function createWidgetDocumentationProvider(registry: WidgetRegistry, commands?: CommandRegistry): WidgetDocumentationProvider {
  return {
    listWidgets: () => registry.listDocumentation(),
    listCommands: () => commands?.listDocumentation() ?? [],
  }
}

export function provideWidgetDocumentation(provider: WidgetDocumentationProvider): void {
  provide(widgetDocumentationKey, provider)
}

export function useOptionalWidgetDocumentation(): WidgetDocumentationProvider | null {
  return inject(widgetDocumentationKey, null)
}

export function useWidgetDocumentation(): WidgetDocumentationProvider {
  const provider = useOptionalWidgetDocumentation()
  if (!provider) throw new WidgetDocumentationUnavailableError()
  return provider
}

export function provideWidgetDocumentationForHost(registry: WidgetRegistry, commands?: CommandRegistry): void {
  if (!useOptionalWidgetDocumentation()) provideWidgetDocumentation(createWidgetDocumentationProvider(registry, commands))
}
