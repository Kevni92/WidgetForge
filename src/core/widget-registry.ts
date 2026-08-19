import {
  defineWidget,
  resolveWidgetCapabilities,
  type ResolvedWidgetCapabilities,
  type WidgetId,
  type WidgetManifest,
  type WidgetParameterDefinition,
} from './widget'

export type WidgetParameterIssueCode = 'missing' | 'type' | 'unknown'

export interface WidgetParameterIssue {
  parameter: string
  code: WidgetParameterIssueCode
  message: string
}

export type WidgetParameterValidationResult =
  | { valid: true; parameters: Record<string, unknown> }
  | { valid: false; issues: WidgetParameterIssue[] }

export interface ResolvedWidget {
  manifest: WidgetManifest
  parameters: Record<string, unknown>
}

export class DuplicateWidgetIdError extends Error {
  constructor(public readonly widgetId: WidgetId) { super(`widget "${widgetId}" is already registered`); this.name = 'DuplicateWidgetIdError' }
}
export class UnknownWidgetError extends Error {
  constructor(public readonly widgetId: WidgetId) { super(`unknown widget "${widgetId}"`); this.name = 'UnknownWidgetError' }
}
export class WidgetParameterValidationError extends Error {
  constructor(public readonly widgetId: WidgetId, public readonly issues: WidgetParameterIssue[]) { super(`invalid parameters for widget "${widgetId}"`); this.name = 'WidgetParameterValidationError' }
}

function matchesParameterType(value: unknown, definition: WidgetParameterDefinition): boolean {
  if (definition.type === 'number') return typeof value === 'number' && Number.isFinite(value)
  return typeof value === definition.type
}

export function validateWidgetParameters(manifest: WidgetManifest, input: Readonly<Record<string, unknown>> = {}): WidgetParameterValidationResult {
  const schema = manifest.parameters ?? {}, issues: WidgetParameterIssue[] = [], parameters: Record<string, unknown> = {}
  for (const parameter of Object.keys(input)) if (!(parameter in schema)) issues.push({ parameter, code: 'unknown', message: `unknown parameter "${parameter}"` })
  for (const [parameter, definition] of Object.entries(schema)) {
    const supplied = Object.prototype.hasOwnProperty.call(input, parameter)
    if (!supplied) {
      if (definition.default !== undefined) parameters[parameter] = definition.default
      else if (definition.required) issues.push({ parameter, code: 'missing', message: `required parameter "${parameter}" is missing` })
      continue
    }
    const value = input[parameter]
    if (!matchesParameterType(value, definition)) { issues.push({ parameter, code: 'type', message: `parameter "${parameter}" must be a ${definition.type}` }); continue }
    parameters[parameter] = value
  }
  return issues.length > 0 ? { valid: false, issues } : { valid: true, parameters }
}

export class WidgetRegistry {
  private readonly manifests = new Map<WidgetId, WidgetManifest>()
  constructor(manifests: readonly WidgetManifest[] = []) { for (const manifest of manifests) this.register(manifest) }
  register(manifest: WidgetManifest): void { const validatedManifest = defineWidget(manifest); if (this.manifests.has(validatedManifest.id)) throw new DuplicateWidgetIdError(validatedManifest.id); this.manifests.set(validatedManifest.id, validatedManifest) }
  unregister(widgetId: WidgetId): boolean { return this.manifests.delete(widgetId) }
  has(widgetId: WidgetId): boolean { return this.manifests.has(widgetId) }
  get(widgetId: WidgetId): WidgetManifest { const manifest = this.manifests.get(widgetId); if (!manifest) throw new UnknownWidgetError(widgetId); return manifest }
  getCapabilities(widgetId: WidgetId): ResolvedWidgetCapabilities { return resolveWidgetCapabilities(this.get(widgetId)) }
  list(): readonly WidgetManifest[] { return [...this.manifests.values()] }
  validate(widgetId: WidgetId, parameters: Readonly<Record<string, unknown>> = {}): WidgetParameterValidationResult { return validateWidgetParameters(this.get(widgetId), parameters) }
  resolve(widgetId: WidgetId, parameters: Readonly<Record<string, unknown>> = {}): ResolvedWidget {
    const manifest = this.get(widgetId), result = validateWidgetParameters(manifest, parameters)
    if (!result.valid) throw new WidgetParameterValidationError(widgetId, result.issues)
    return { manifest, parameters: result.parameters }
  }
}

export function createWidgetRegistry(manifests: readonly WidgetManifest[] = []): WidgetRegistry { return new WidgetRegistry(manifests) }
