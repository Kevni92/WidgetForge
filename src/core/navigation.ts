import type { WidgetId } from './widget'
import {
  UnknownWidgetError,
  WidgetParameterValidationError,
  type WidgetParameterIssue,
  type WidgetRegistry,
} from './widget-registry'
import type { WindowManager } from './window-manager'

export interface NavigationIntent {
  readonly widgetId: WidgetId
  readonly parameters?: Readonly<Record<string, unknown>>
}

export interface NavigationResult {
  readonly widgetId: WidgetId
  readonly instanceId: string
}

export type WidgetNavigationErrorCode = 'unknown-widget' | 'invalid-parameters'

export class WidgetNavigationError extends Error {
  constructor(
    public readonly code: WidgetNavigationErrorCode,
    public readonly intent: NavigationIntent,
    public readonly issues: readonly WidgetParameterIssue[] = [],
  ) {
    super(code === 'unknown-widget'
      ? `cannot navigate to unknown widget "${intent.widgetId}"`
      : `cannot navigate to widget "${intent.widgetId}" with invalid parameters`)
    this.name = 'WidgetNavigationError'
  }
}

export interface WidgetNavigator {
  navigate(intent: NavigationIntent): NavigationResult
}

export class WidgetNavigatorService implements WidgetNavigator {
  constructor(
    private readonly registry: WidgetRegistry,
    private readonly windowManager: WindowManager,
  ) {}

  navigate(intent: NavigationIntent): NavigationResult {
    try {
      this.registry.resolve(intent.widgetId, intent.parameters ?? {})
    } catch (error) {
      if (error instanceof UnknownWidgetError) {
        throw new WidgetNavigationError('unknown-widget', intent)
      }
      if (error instanceof WidgetParameterValidationError) {
        throw new WidgetNavigationError('invalid-parameters', intent, error.issues)
      }
      throw error
    }

    const window = this.windowManager.open({
      widgetId: intent.widgetId,
      parameters: intent.parameters ?? {},
    })
    return { widgetId: intent.widgetId, instanceId: window.instanceId }
  }
}

export function createWidgetNavigator(registry: WidgetRegistry, windowManager: WindowManager): WidgetNavigatorService {
  return new WidgetNavigatorService(registry, windowManager)
}
