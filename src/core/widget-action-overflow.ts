import type { WidgetActionBinding } from './widget-actions'

export interface WidgetActionOverflowOptions {
  /** Available inline space in the toolbar's primary direction. */
  readonly availableSize?: number | undefined
  /** Width/height of one binding in the primary direction. */
  readonly actionSize?: ((binding: WidgetActionBinding) => number) | undefined
  /** Space reserved for the overflow trigger when it is needed. */
  readonly overflowSize?: number | undefined
  /** Gap between adjacent primary actions and the overflow trigger. */
  readonly gap?: number | undefined
  /** Optional hard cap used by compact chrome such as window titlebars. */
  readonly maxVisible?: number | undefined
}

export interface WidgetActionOverflowLayout {
  readonly visible: readonly WidgetActionBinding[]
  readonly overflow: readonly WidgetActionBinding[]
}

interface ActionUnit {
  bindings: readonly WidgetActionBinding[]
  readonly firstIndex: number
  readonly priority: number
  readonly alwaysVisible: boolean
}

function normalizedSize(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback
}

function actionPriority(binding: WidgetActionBinding): number {
  const priority = binding.action.priority
  return priority !== undefined && Number.isFinite(priority) ? priority : 0
}

function actionUnitKey(binding: WidgetActionBinding): string {
  const group = binding.action.group?.trim()
  const overflowMode = binding.action.overflowOnly ? 'overflow' : 'primary'
  return `${overflowMode}:${group ? `group:${group}` : `action:${binding.action.id}`}`
}

function unitWidth(unit: ActionUnit, actionSize: (binding: WidgetActionBinding) => number, gap: number): number {
  return unit.bindings.reduce((total, binding) => total + normalizedSize(actionSize(binding), 1), 0) + Math.max(0, unit.bindings.length - 1) * gap
}

function visibleWidth(units: readonly ActionUnit[], actionSize: (binding: WidgetActionBinding) => number, gap: number, includeOverflow: boolean, overflowSize: number): number {
  const actionsWidth = units.reduce((total, unit) => total + unitWidth(unit, actionSize, gap), 0)
  const actionGaps = Math.max(0, units.length - 1) * gap
  return actionsWidth + actionGaps + (includeOverflow && (units.length > 0 || overflowSize > 0) ? gap + overflowSize : 0)
}

function flatten(units: readonly ActionUnit[]): readonly WidgetActionBinding[] {
  return units.flatMap((unit) => unit.bindings)
}

/**
 * Selects complete action groups for the primary toolbar and keeps the
 * result stable for equal priorities and during resize transitions.
 */
export function calculateWidgetActionOverflow(
  bindings: readonly WidgetActionBinding[],
  options: WidgetActionOverflowOptions = {},
): WidgetActionOverflowLayout {
  const actionSize = options.actionSize ?? (() => 1)
  const gap = normalizedSize(options.gap, 0)
  const overflowSize = normalizedSize(options.overflowSize, 1)
  const maxVisible = options.maxVisible === undefined || !Number.isFinite(options.maxVisible)
    ? Number.POSITIVE_INFINITY
    : Math.max(0, Math.floor(options.maxVisible))

  const eligible = bindings
    .map((binding, index) => ({ binding, index }))
    .filter(({ binding }) => binding.action.visible !== false)
    .sort((left, right) => actionPriority(right.binding) - actionPriority(left.binding) || left.index - right.index)

  const unitsByKey = new Map<string, ActionUnit>()
  for (const { binding, index } of eligible) {
    const key = actionUnitKey(binding)
    const existing = unitsByKey.get(key)
    if (existing) {
      existing.bindings = [...existing.bindings, binding]
      continue
    }
    unitsByKey.set(key, {
      bindings: [binding],
      firstIndex: index,
      priority: actionPriority(binding),
      alwaysVisible: binding.action.alwaysVisible === true,
    })
  }

  const units = [...unitsByKey.values()].sort((left, right) => right.priority - left.priority || left.firstIndex - right.firstIndex)
  const overflowOnlyUnits = units.filter((unit) => unit.bindings.every((binding) => binding.action.overflowOnly === true))
  const primaryUnits = units.filter((unit) => !overflowOnlyUnits.includes(unit))
  const forcedUnits = primaryUnits.filter((unit) => unit.alwaysVisible)
  const optionalUnits = primaryUnits.filter((unit) => !unit.alwaysVisible)
  const selected = new Set<ActionUnit>(forcedUnits)

  const canAdd = (unit: ActionUnit): boolean => {
    if (selected.has(unit)) return false
    if ([...selected].reduce((count, current) => count + current.bindings.length, 0) + unit.bindings.length > maxVisible) return false
    const candidate = [...primaryUnits.filter((candidateUnit) => selected.has(candidateUnit)), unit]
    const remaining = optionalUnits.some((candidateUnit) => !selected.has(candidateUnit) && candidateUnit !== unit) || overflowOnlyUnits.length > 0
    const available = options.availableSize
    if (available === undefined || !Number.isFinite(available) || available <= 0) return true
    if (visibleWidth(candidate, actionSize, gap, remaining, overflowSize) <= available) return true
    return !remaining && visibleWidth(candidate, actionSize, gap, false, overflowSize) <= available
  }

  for (const unit of optionalUnits) {
    if (canAdd(unit)) selected.add(unit)
  }

  const visibleUnits = primaryUnits.filter((unit) => selected.has(unit))
  const overflowUnits = units.filter((unit) => !selected.has(unit))
  return { visible: flatten(visibleUnits), overflow: flatten(overflowUnits) }
}
