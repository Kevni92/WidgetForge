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

export interface WidgetNavigationContext {
  readonly target?: {
    readonly kind: 'launcher-window'
    readonly windowInstanceId: string
  }
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
  navigate(intent: NavigationIntent, context?: WidgetNavigationContext): NavigationResult
}

export interface ActiveWorkspaceNavigationSource {
  getActive(): { readonly windows: WindowManager }
}

function navigateWidget(
  registry: WidgetRegistry,
  windowManager: WindowManager,
  intent: NavigationIntent,
  context?: WidgetNavigationContext,
): NavigationResult {
  try {
    registry.resolve(intent.widgetId, intent.parameters ?? {})
  } catch (error) {
    if (error instanceof UnknownWidgetError) {
      throw new WidgetNavigationError('unknown-widget', intent)
    }
    if (error instanceof WidgetParameterValidationError) {
      throw new WidgetNavigationError('invalid-parameters', intent, error.issues)
    }
    throw error
  }

  const window = context?.target?.kind === 'launcher-window'
    ? windowManager.replaceLauncherWindow(context.target.windowInstanceId, { widgetId: intent.widgetId, parameters: intent.parameters ?? {} })
    : windowManager.open({ widgetId: intent.widgetId, parameters: intent.parameters ?? {} })
  return { widgetId: intent.widgetId, instanceId: window.instanceId }
}

export class WidgetNavigatorService implements WidgetNavigator {
  constructor(
    private readonly registry: WidgetRegistry,
    private readonly windowManager: WindowManager,
  ) {}

  navigate(intent: NavigationIntent, context?: WidgetNavigationContext): NavigationResult { return navigateWidget(this.registry, this.windowManager, intent, context) }
}

export class ActiveWorkspaceNavigatorService implements WidgetNavigator {
  constructor(
    private readonly registry: WidgetRegistry,
    private readonly source: ActiveWorkspaceNavigationSource,
  ) {}

  navigate(intent: NavigationIntent, context?: WidgetNavigationContext): NavigationResult {
    return navigateWidget(this.registry, this.source.getActive().windows, intent, context)
  }
}

export function createWidgetNavigator(registry: WidgetRegistry, windowManager: WindowManager): WidgetNavigatorService {
  return new WidgetNavigatorService(registry, windowManager)
}

export function createActiveWorkspaceNavigator(
  registry: WidgetRegistry,
  source: ActiveWorkspaceNavigationSource,
): ActiveWorkspaceNavigatorService {
  return new ActiveWorkspaceNavigatorService(registry, source)
}
