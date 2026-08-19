import type { NavigationIntent } from './navigation'
import type { WidgetId } from './widget'

export type WidgetActionTone = 'neutral' | 'accent' | 'danger'

export type WidgetActionTarget =
  | { readonly kind: 'navigation'; readonly intent: NavigationIntent }
  | { readonly kind: 'command'; readonly command: string }
  | { readonly kind: 'callback'; readonly ref: string }

export interface WidgetAction {
  readonly id: string
  readonly label: string
  readonly icon: string
  readonly shortcut?: string
  readonly tone?: WidgetActionTone
  readonly group?: string
  readonly priority?: number
  readonly alwaysVisible?: boolean
  readonly overflowOnly?: boolean
  readonly pressed?: boolean
  readonly disabled?: boolean
  readonly visible?: boolean
  readonly target?: WidgetActionTarget
}

export interface WidgetActionStatePatch {
  readonly label?: string
  readonly icon?: string
  readonly shortcut?: string | undefined
  readonly tone?: WidgetActionTone | undefined
  readonly group?: string | undefined
  readonly priority?: number | undefined
  readonly alwaysVisible?: boolean
  readonly overflowOnly?: boolean
  readonly pressed?: boolean
  readonly disabled?: boolean
  readonly visible?: boolean
}

export interface WidgetActionExecutionContext {
  readonly instanceId: string
  readonly widgetId: WidgetId
  readonly parameters: Readonly<Record<string, unknown>>
}

export type WidgetActionHandler = (context: WidgetActionExecutionContext) => void

export interface WidgetActionBinding {
  readonly action: WidgetAction
  execute(): void
}

export interface WidgetActionExecutor {
  executeCommand?(command: string, context: WidgetActionExecutionContext): void
  executeCallback?(ref: string, context: WidgetActionExecutionContext): void
}

export class WidgetActionDefinitionError extends Error {
  constructor(message: string) { super(message); this.name = 'WidgetActionDefinitionError' }
}

export class WidgetActionExecutionError extends Error {
  constructor(message: string) { super(message); this.name = 'WidgetActionExecutionError' }
}

const actionIdPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/

function optionalText(value: string | undefined, label: string): void {
  if (value !== undefined && !value.trim()) throw new WidgetActionDefinitionError(`${label} must not be empty`)
}

export function validateWidgetAction(action: WidgetAction): void {
  if (!actionIdPattern.test(action.id)) throw new WidgetActionDefinitionError(`invalid widget action id "${action.id}"`)
  if (!action.label.trim()) throw new WidgetActionDefinitionError(`widget action "${action.id}" label must not be empty`)
  if (!action.icon.trim()) throw new WidgetActionDefinitionError(`widget action "${action.id}" icon must not be empty`)
  optionalText(action.shortcut, `widget action "${action.id}" shortcut`)
  optionalText(action.group, `widget action "${action.id}" group`)
  if (action.tone !== undefined && !['neutral', 'accent', 'danger'].includes(action.tone)) throw new WidgetActionDefinitionError(`invalid widget action tone "${String(action.tone)}"`)
  if (action.priority !== undefined && (!Number.isFinite(action.priority) || !Number.isInteger(action.priority))) throw new WidgetActionDefinitionError(`widget action "${action.id}" priority must be a finite integer`)
  const target = action.target
  if (!target) return
  if (target.kind === 'navigation') {
    if (!target.intent.widgetId.trim()) throw new WidgetActionDefinitionError(`widget action "${action.id}" navigation widget id must not be empty`)
    return
  }
  if (target.kind === 'command') {
    if (!target.command.trim()) throw new WidgetActionDefinitionError(`widget action "${action.id}" command must not be empty`)
    return
  }
  if (target.kind === 'callback') {
    if (!target.ref.trim()) throw new WidgetActionDefinitionError(`widget action "${action.id}" callback ref must not be empty`)
    return
  }
  throw new WidgetActionDefinitionError(`widget action "${action.id}" has an invalid target`)
}

export function validateWidgetActions(actions: readonly WidgetAction[] = []): void {
  const ids = new Set<string>()
  for (const action of actions) {
    validateWidgetAction(action)
    if (ids.has(action.id)) throw new WidgetActionDefinitionError(`duplicate widget action id "${action.id}"`)
    ids.add(action.id)
  }
}

export function cloneWidgetAction(action: WidgetAction): WidgetAction {
  return {
    id: action.id,
    label: action.label,
    icon: action.icon,
    ...(action.shortcut !== undefined ? { shortcut: action.shortcut } : {}),
    ...(action.tone !== undefined ? { tone: action.tone } : {}),
    ...(action.group !== undefined ? { group: action.group } : {}),
    ...(action.priority !== undefined ? { priority: action.priority } : {}),
    ...(action.alwaysVisible !== undefined ? { alwaysVisible: action.alwaysVisible } : {}),
    ...(action.overflowOnly !== undefined ? { overflowOnly: action.overflowOnly } : {}),
    ...(action.pressed !== undefined ? { pressed: action.pressed } : {}),
    ...(action.disabled !== undefined ? { disabled: action.disabled } : {}),
    ...(action.visible !== undefined ? { visible: action.visible } : {}),
    ...(action.target ? { target: action.target.kind === 'navigation' ? { kind: 'navigation', intent: { ...action.target.intent, ...(action.target.intent.parameters ? { parameters: { ...action.target.intent.parameters } } : {}) } } : { ...action.target } } : {}),
  }
}
