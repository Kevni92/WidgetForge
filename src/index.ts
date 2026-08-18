export { default as ThemeProvider } from './vue/ThemeProvider.vue'
export { createTheme, defaultTheme, themeToCssVariables } from './vue/theme'
export type { DeepPartial, WidgetForgeTheme, WidgetForgeThemeOverride } from './vue/theme'
export { useTheme } from './vue/theme-context'
export { default as WidgetHost } from './vue/WidgetHost.vue'
export { useWidgetContext } from './vue/widget-context'
export type { WidgetContext } from './vue/widget-context'
export { default as WindowShell } from './vue/WindowShell.vue'
export { default as WindowManagerHost } from './vue/WindowManagerHost.vue'
export { forgeDarkTheme, forgeLightTheme } from './presets/forge'
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
