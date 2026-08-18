export { default as ThemeProvider } from './vue/ThemeProvider.vue'
export { createTheme, defaultTheme, themeToCssVariables } from './vue/theme'
export type { DeepPartial, WidgetForgeTheme, WidgetForgeThemeOverride } from './vue/theme'
export { useTheme } from './vue/theme-context'
export { default as WidgetHost } from './vue/WidgetHost.vue'
export { useWidgetContext } from './vue/widget-context'
export type { WidgetContext } from './vue/widget-context'
export {
  provideWidgetNavigation,
  useWidgetNavigation,
  WidgetNavigationUnavailableError,
} from './vue/widget-navigation'
export { default as CommandInput } from './vue/CommandInput.vue'
export { default as DataClientProvider } from './vue/DataClientProvider.vue'
export {
  DataClientUnavailableError,
  provideDataClient,
  useData,
  useDataClient,
} from './vue/data-context'
export { default as WindowShell } from './vue/WindowShell.vue'
export { default as WindowManagerHost } from './vue/WindowManagerHost.vue'
export { forgeDarkTheme, forgeLightTheme } from './presets/forge'
export {
  createDataClient,
  createDataKey,
  dataKeyId,
  DataClient,
  InvalidDataKeyError,
} from './data/data-client'
export type {
  DataHandle,
  DataKey,
  DataObserver,
  DataProvider,
  DataState,
  DataStateRef,
  DataUnsubscribe,
} from './data/data-client'
export { defineWidget, WidgetDefinitionError } from './core/widget'
export type {
  InferWidgetParameters,
  WidgetId,
  WidgetManifest,
  WidgetParameterDefinition,
  WidgetParameterSchema,
  WidgetSize,
  WidgetWindowMetadata,
} from './core/widget'
export {
  createWidgetLifecycle,
  InvalidWidgetLifecycleTransitionError,
  WidgetLifecycleController,
} from './core/widget-lifecycle'
export type {
  WidgetLifecycle,
  WidgetLifecycleEvent,
  WidgetLifecycleEventKind,
  WidgetLifecycleListener,
  WidgetLifecycleState,
} from './core/widget-lifecycle'
export {
  createWidgetRegistry,
  DuplicateWidgetIdError,
  UnknownWidgetError,
  validateWidgetParameters,
  WidgetParameterValidationError,
  WidgetRegistry,
} from './core/widget-registry'
export type {
  ResolvedWidget,
  WidgetParameterIssue,
  WidgetParameterIssueCode,
  WidgetParameterValidationResult,
} from './core/widget-registry'
export {
  createWidgetNavigator,
  WidgetNavigationError,
  WidgetNavigatorService,
} from './core/navigation'
export type {
  NavigationIntent,
  NavigationResult,
  WidgetNavigationErrorCode,
  WidgetNavigator,
} from './core/navigation'
export {
  CommandDefinitionError,
  CommandParseError,
  CommandRegistry,
  createCommandRegistry,
} from './core/commands'
export type {
  CommandArgumentDefinition,
  CommandArgumentType,
  CommandDefinition,
  CommandParseErrorCode,
} from './core/commands'
export {
  captureWorkspace,
  restoreWorkspace,
  serializeWorkspace,
  WORKSPACE_VERSION,
  WorkspaceSerializationError,
} from './core/workspace'
export type {
  WorkspaceParameters,
  WorkspaceParameterValue,
  WorkspaceRestoreIssue,
  WorkspaceRestoreIssueCode,
  WorkspaceRestoreResult,
  WorkspaceSnapshot,
  WorkspaceWindowSnapshot,
} from './core/workspace'
export {
  createWindowManager,
  DuplicateWindowInstanceError,
  UnknownWindowInstanceError,
  WindowManager,
} from './core/window-manager'
export type {
  OpenWindowRequest,
  WindowInstanceId,
  WindowManagerChange,
  WindowManagerChangeKind,
  WindowManagerListener,
  WindowMode,
  WindowOperationOrigin,
  WindowState,
} from './core/window-manager'
export {
  DEFAULT_MIN_VISIBLE,
  DEFAULT_MIN_WINDOW_SIZE,
  DEFAULT_WINDOW_SIZE,
  constrainGeometry,
  constrainPosition,
  constrainSize,
  moveWindow,
  resizeWindow,
  sameGeometry,
} from './core/window-geometry'
export type {
  ResizeHandle,
  WindowGeometry,
  WindowPosition,
  WindowSize,
  WindowSizeConstraints,
} from './core/window-geometry'
