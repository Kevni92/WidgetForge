export { default as ThemeProvider } from './vue/ThemeProvider.vue'
export { createTheme, defaultTheme, themeToCssVariables } from './vue/theme'
export type { DeepPartial, WidgetForgeTheme, WidgetForgeThemeOverride } from './vue/theme'
export { useTheme } from './vue/theme-context'
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
