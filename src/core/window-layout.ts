import type { WindowSnapZone } from './window-snap'
import { constrainSize, type WindowGeometry, type WindowSize, type WindowSizeConstraints } from './window-geometry'

export type WindowLayoutUnit = 'px' | 'percent'
export type WindowLayoutAxis = 'horizontal' | 'vertical'
export type WindowLayoutEdge = 'left' | 'right' | 'top' | 'bottom'

/** The mutually exclusive sizing models exposed by the responsive editor. */
export type WindowLayoutAxisMode = 'start-size' | 'end-size' | 'stretch'

/** Convert a layout value without changing the represented physical length. */
export function convertWindowLayoutValue(value: number, fromUnit: WindowLayoutUnit, toUnit: WindowLayoutUnit, available: number): number {
  if (!Number.isFinite(value)) throw new Error('layout value must be finite')
  if (!Number.isFinite(available) || available <= 0) throw new Error('layout conversion requires a positive available size')
  if (fromUnit === toUnit) return value
  return fromUnit === 'px' ? value * 100 / available : value * available / 100
}

/**
 * Map the durable start/end/size contract to the safe, directional editor
 * model. Legacy over-defined specs intentionally prefer their start anchor so
 * opening the editor never creates a new invalid combination.
 */
export function deriveWindowLayoutAxisMode(axisSpec: WindowLayoutAxisSpec): WindowLayoutAxisMode {
  if (axisSpec.start && axisSpec.end && (axisSpec.size === undefined || axisSpec.size === 'auto')) return 'stretch'
  if (axisSpec.end && !axisSpec.start && axisSpec.size !== undefined && axisSpec.size !== 'auto') return 'end-size'
  return 'start-size'
}

/** The durable relationship between a window and its responsive rule. */
export type WindowLayoutRuleState = 'none' | 'active' | 'dormant' | 'materialized'

/** The interaction state of a window surface. */
export type WindowLayoutSurfaceState = 'floating' | 'snapped' | 'locked'

export interface WindowLayoutStatusInput {
  readonly layoutLocked: boolean
  readonly layoutSpec?: WindowLayoutSpec | null
  readonly layoutSpecState?: WindowLayoutRuleState
  readonly snap?: { readonly zone: WindowSnapZone } | null
}

export interface WindowLayoutStatus {
  readonly surface: WindowLayoutSurfaceState
  readonly rule: WindowLayoutRuleState
  readonly hasResponsiveSpec: boolean
}

/**
 * Derive the user-facing layout state without relying on DOM state.  The
 * optional rule state keeps the distinction between an untouched floating
 * window and a responsive rule that was deliberately materialized.
 */
export function deriveWindowLayoutStatus(input: WindowLayoutStatusInput): WindowLayoutStatus {
  const surface: WindowLayoutSurfaceState = input.layoutLocked ? 'locked' : input.snap ? 'snapped' : 'floating'
  const rule = input.layoutSpecState === 'materialized'
    ? 'materialized'
    : input.layoutSpec
      ? input.layoutLocked ? 'active' : 'dormant'
    : input.layoutSpecState ?? (input.layoutLocked ? 'materialized' : 'none')
  return { surface, rule, hasResponsiveSpec: input.layoutSpec !== undefined && input.layoutSpec !== null }
}

export interface WindowLayoutLength {
  readonly value: number
  readonly unit: WindowLayoutUnit
}

export interface WindowLayoutWorkspaceTarget {
  readonly kind: 'workspace'
  readonly edge: WindowLayoutEdge
}

export interface WindowLayoutWindowTarget {
  readonly kind: 'window'
  readonly instanceId: string
  readonly edge: WindowLayoutEdge
}

export type WindowLayoutTarget = WindowLayoutWorkspaceTarget | WindowLayoutWindowTarget

export interface WindowLayoutAnchor {
  readonly target: WindowLayoutTarget
  readonly offset?: WindowLayoutLength
}

export type WindowLayoutSize = WindowLayoutLength | 'auto'

export interface WindowLayoutAxisSpec {
  readonly start?: WindowLayoutAnchor
  readonly end?: WindowLayoutAnchor
  readonly size?: WindowLayoutSize
}

export interface WindowLayoutSpec {
  readonly horizontal: WindowLayoutAxisSpec
  readonly vertical: WindowLayoutAxisSpec
}

export interface ResponsiveLayoutWindow {
  readonly instanceId: string
  readonly geometry: WindowGeometry
  readonly constraints: WindowSizeConstraints
  readonly layoutSpec?: WindowLayoutSpec | null
}

export type WindowLayoutValidationErrorCode =
  | 'invalid-container'
  | 'invalid-spec'
  | 'invalid-number'
  | 'invalid-unit'
  | 'invalid-edge'
  | 'invalid-axis-constraints'
  | 'invalid-size'
  | 'unknown-window'
  | 'self-reference'
  | 'cycle'
  | 'contradictory-anchors'

export class WindowLayoutValidationError extends Error {
  constructor(
    public readonly code: WindowLayoutValidationErrorCode,
    message: string,
    public readonly instanceId?: string,
  ) {
    super(message)
    this.name = 'WindowLayoutValidationError'
  }
}

const HORIZONTAL_EDGES = new Set<WindowLayoutEdge>(['left', 'right'])
const VERTICAL_EDGES = new Set<WindowLayoutEdge>(['top', 'bottom'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneLength(length: WindowLayoutLength): WindowLayoutLength {
  return { value: length.value, unit: length.unit }
}

function cloneAnchor(anchor: WindowLayoutAnchor): WindowLayoutAnchor {
  return {
    target: { ...anchor.target },
    ...(anchor.offset ? { offset: cloneLength(anchor.offset) } : {}),
  }
}

function cloneAxis(axis: WindowLayoutAxisSpec): WindowLayoutAxisSpec {
  return {
    ...(axis.start ? { start: cloneAnchor(axis.start) } : {}),
    ...(axis.end ? { end: cloneAnchor(axis.end) } : {}),
    ...(axis.size ? { size: axis.size === 'auto' ? 'auto' : cloneLength(axis.size) } : {}),
  }
}

export function cloneWindowLayoutSpec(spec: WindowLayoutSpec): WindowLayoutSpec {
  return { horizontal: cloneAxis(spec.horizontal), vertical: cloneAxis(spec.vertical) }
}

function fail(code: WindowLayoutValidationErrorCode, message: string, instanceId?: string): never {
  throw new WindowLayoutValidationError(code, message, instanceId)
}

function validateLength(value: unknown, label: string, instanceId?: string): asserts value is WindowLayoutLength {
  if (!isRecord(value) || !Number.isFinite(value.value)) fail('invalid-number', `${label} must contain a finite value`, instanceId)
  if (value.unit !== 'px' && value.unit !== 'percent') fail('invalid-unit', `${label} has an unsupported unit`, instanceId)
}

function validateTarget(target: unknown, axis: WindowLayoutAxis, label: string, instanceId?: string): asserts target is WindowLayoutTarget {
  if (!isRecord(target) || (target.kind !== 'workspace' && target.kind !== 'window') || typeof target.edge !== 'string') {
    fail('invalid-spec', `${label} must be a workspace or window edge`, instanceId)
  }
  const validEdges = axis === 'horizontal' ? HORIZONTAL_EDGES : VERTICAL_EDGES
  if (!validEdges.has(target.edge as WindowLayoutEdge)) fail('invalid-edge', `${label} is not valid for the ${axis} axis`, instanceId)
  if (target.kind === 'window' && (typeof target.instanceId !== 'string' || !target.instanceId.trim())) {
    fail('invalid-spec', `${label} must contain a window instance id`, instanceId)
  }
}

function validateAnchor(anchor: unknown, axis: WindowLayoutAxis, label: string, instanceId?: string): asserts anchor is WindowLayoutAnchor {
  if (!isRecord(anchor)) fail('invalid-spec', `${label} must be an anchor`, instanceId)
  validateTarget(anchor.target, axis, `${label} target`, instanceId)
  if (anchor.offset !== undefined) validateLength(anchor.offset, `${label} offset`, instanceId)
}

function validateAxis(axisSpec: unknown, axis: WindowLayoutAxis, instanceId?: string): asserts axisSpec is WindowLayoutAxisSpec {
  if (!isRecord(axisSpec)) fail('invalid-spec', `${axis} constraints must be an object`, instanceId)
  if (axisSpec.start !== undefined) validateAnchor(axisSpec.start, axis, `${axis} start`, instanceId)
  if (axisSpec.end !== undefined) validateAnchor(axisSpec.end, axis, `${axis} end`, instanceId)
  if (axisSpec.size !== undefined && axisSpec.size !== 'auto') validateLength(axisSpec.size, `${axis} size`, instanceId)
  const hasStart = axisSpec.start !== undefined
  const hasEnd = axisSpec.end !== undefined
  const hasSize = axisSpec.size !== undefined
  if (hasStart && hasEnd && hasSize && axisSpec.size !== 'auto') fail('invalid-axis-constraints', `${axis} cannot combine start, end and size`, instanceId)
  if (!hasStart && !hasEnd && !hasSize) fail('invalid-axis-constraints', `${axis} must define anchors or a size`, instanceId)
  if ((!hasStart && !hasEnd) || (hasStart !== hasEnd && !hasSize)) fail('invalid-axis-constraints', `${axis} must use start + size, end + size or start + end`, instanceId)
  if (axisSpec.size === 'auto' && (!hasStart || !hasEnd)) fail('invalid-axis-constraints', `${axis} auto size requires start and end anchors`, instanceId)
  if (axisSpec.size !== undefined && axisSpec.size !== 'auto' && axisSpec.size.value < 0) fail('invalid-size', `${axis} size must not be negative`, instanceId)
}

export function validateWindowLayoutSpec(spec: unknown, instanceId?: string): asserts spec is WindowLayoutSpec {
  if (!isRecord(spec)) fail('invalid-spec', 'window layout spec must be an object', instanceId)
  validateAxis(spec.horizontal, 'horizontal', instanceId)
  validateAxis(spec.vertical, 'vertical', instanceId)
}

function axisLength(length: WindowLayoutLength, available: number): number {
  return length.unit === 'percent' ? available * length.value / 100 : length.value
}

function targetValue(
  anchor: WindowLayoutAnchor,
  axis: WindowLayoutAxis,
  container: WindowSize,
  geometry: WindowGeometry,
): number {
  const edge = anchor.target.edge
  const base = anchor.target.kind === 'workspace'
    ? edge === 'left' || edge === 'top' ? 0 : axis === 'horizontal' ? container.width : container.height
    : edge === 'left' || edge === 'top' ? (axis === 'horizontal' ? geometry.position.x : geometry.position.y) : axis === 'horizontal' ? geometry.position.x + geometry.size.width : geometry.position.y + geometry.size.height
  return base + (anchor.offset ? axisLength(anchor.offset, axis === 'horizontal' ? container.width : container.height) : 0)
}

function dimensionConstraints(window: ResponsiveLayoutWindow, axis: WindowLayoutAxis, requested: number): number {
  const other = axis === 'horizontal' ? window.geometry.size.height : window.geometry.size.width
  const constrained = constrainSize(
    axis === 'horizontal' ? { width: requested, height: other } : { width: other, height: requested },
    window.constraints,
  )
  return axis === 'horizontal' ? constrained.width : constrained.height
}

function resolveAxis(
  axisSpec: WindowLayoutAxisSpec,
  axis: WindowLayoutAxis,
  window: ResponsiveLayoutWindow,
  container: WindowSize,
  resolvedTarget: (target: WindowLayoutWindowTarget) => WindowGeometry,
): { position: number; size: number } {
  const available = axis === 'horizontal' ? container.width : container.height
  const start = axisSpec.start
    ? axisSpec.start.target.kind === 'window'
      ? targetValue(axisSpec.start, axis, container, resolvedTarget(axisSpec.start.target))
      : targetValue(axisSpec.start, axis, container, window.geometry)
    : undefined
  const end = axisSpec.end
    ? axisSpec.end.target.kind === 'window'
      ? targetValue(axisSpec.end, axis, container, resolvedTarget(axisSpec.end.target))
      : targetValue(axisSpec.end, axis, container, window.geometry)
    : undefined

  if (start !== undefined && end !== undefined) {
    const rawSize = end - start
    if (rawSize < 0) fail('contradictory-anchors', `${axis} end is before start`, window.instanceId)
    const size = dimensionConstraints(window, axis, rawSize)
    return { position: start, size }
  }

  const requested = axisSpec.size === 'auto' || axisSpec.size === undefined ? undefined : axisLength(axisSpec.size, available)
  if (requested === undefined || requested < 0) fail('invalid-size', `${axis} requires a finite size`, window.instanceId)
  const size = dimensionConstraints(window, axis, requested)
  if (start !== undefined) return { position: start, size }
  if (end !== undefined) return { position: end - size, size }
  fail('invalid-axis-constraints', `${axis} has no usable anchor`, window.instanceId)
}

function cloneGeometry(geometry: WindowGeometry): WindowGeometry {
  return { position: { ...geometry.position }, size: { ...geometry.size } }
}

export function resolveWindowLayoutSpecs(
  windows: readonly ResponsiveLayoutWindow[],
  container: WindowSize,
): ReadonlyMap<string, WindowGeometry> {
  if (!Number.isFinite(container.width) || !Number.isFinite(container.height) || container.width <= 0 || container.height <= 0) {
    fail('invalid-container', 'responsive layout requires a positive finite workspace size')
  }
  const byId = new Map(windows.map((window) => [window.instanceId, window]))
  const resolved = new Map<string, WindowGeometry>()
  const visiting = new Set<string>()

  function resolve(instanceId: string): WindowGeometry {
    const existing = resolved.get(instanceId)
    if (existing) return existing
    if (visiting.has(instanceId)) fail('cycle', `responsive layout contains a dependency cycle at window "${instanceId}"`, instanceId)
    const window = byId.get(instanceId)
    if (!window) fail('unknown-window', `responsive layout references unknown window "${instanceId}"`, instanceId)
    visiting.add(instanceId)
    const spec = window.layoutSpec
    if (!spec) {
      const geometry = cloneGeometry(window.geometry)
      resolved.set(instanceId, geometry)
      visiting.delete(instanceId)
      return geometry
    }
    validateWindowLayoutSpec(spec, instanceId)
    const resolveTarget = (target: WindowLayoutWindowTarget): WindowGeometry => {
      if (target.instanceId === instanceId) fail('self-reference', `window "${instanceId}" cannot reference itself`, instanceId)
      return resolve(target.instanceId)
    }
    const horizontal = resolveAxis(spec.horizontal, 'horizontal', window, container, resolveTarget)
    const vertical = resolveAxis(spec.vertical, 'vertical', window, container, resolveTarget)
    const geometry: WindowGeometry = { position: { x: horizontal.position, y: vertical.position }, size: { width: horizontal.size, height: vertical.size } }
    resolved.set(instanceId, geometry)
    visiting.delete(instanceId)
    return geometry
  }

  for (const window of [...windows].sort((left, right) => left.instanceId.localeCompare(right.instanceId))) resolve(window.instanceId)
  return new Map([...resolved.entries()].sort(([left], [right]) => left.localeCompare(right)))
}

export function createAbsoluteWindowLayoutSpec(geometry: WindowGeometry): WindowLayoutSpec {
  return {
    horizontal: { start: { target: { kind: 'workspace', edge: 'left' }, offset: { value: geometry.position.x, unit: 'px' } }, size: { value: geometry.size.width, unit: 'px' } },
    vertical: { start: { target: { kind: 'workspace', edge: 'top' }, offset: { value: geometry.position.y, unit: 'px' } }, size: { value: geometry.size.height, unit: 'px' } },
  }
}

function axisForEdge(edge: WindowLayoutEdge): WindowLayoutAxis {
  return edge === 'left' || edge === 'right' ? 'horizontal' : 'vertical'
}

function axisSizeFromGeometry(geometry: WindowGeometry, axis: WindowLayoutAxis): WindowLayoutLength {
  return { value: axis === 'horizontal' ? geometry.size.width : geometry.size.height, unit: 'px' }
}

/**
 * Create the durable spec represented by a direct canvas connection. The
 * operation deliberately keeps the source edge as the start/end anchor and
 * drops an explicit size only while the opposite edge is not constrained.
 */
export function setWindowLayoutConstraint(
  currentSpec: WindowLayoutSpec | null | undefined,
  geometry: WindowGeometry,
  sourceEdge: WindowLayoutEdge,
  target: WindowLayoutTarget,
): WindowLayoutSpec {
  const axis = axisForEdge(sourceEdge)
  const sourceIsStart = sourceEdge === 'left' || sourceEdge === 'top'
  const anchor: WindowLayoutAnchor = { target: { ...target }, offset: { value: 0, unit: 'px' } }
  const currentAxis = currentSpec
    ? cloneAxis(axis === 'horizontal' ? currentSpec.horizontal : currentSpec.vertical)
    : null
  const size = currentAxis?.size && currentAxis.size !== 'auto'
    ? cloneLength(currentAxis.size)
    : axisSizeFromGeometry(geometry, axis)

  let nextAxis: WindowLayoutAxisSpec
  if (!currentAxis) {
    nextAxis = sourceIsStart ? { start: anchor, size } : { end: anchor, size }
  } else if (sourceIsStart) {
    nextAxis = currentAxis.end ? { start: anchor, end: currentAxis.end } : { start: anchor, size }
  } else {
    nextAxis = currentAxis.start ? { start: currentAxis.start, end: anchor } : { end: anchor, size }
  }

  const base = currentSpec ? cloneWindowLayoutSpec(currentSpec) : createAbsoluteWindowLayoutSpec(geometry)
  return axis === 'horizontal'
    ? { horizontal: nextAxis, vertical: base.vertical }
    : { horizontal: base.horizontal, vertical: nextAxis }
}

/**
 * Remove one direct edge relationship while keeping the current physical
 * geometry representable by the remaining axis anchors.
 */
export function removeWindowLayoutConstraint(
  currentSpec: WindowLayoutSpec,
  geometry: WindowGeometry,
  sourceEdge: WindowLayoutEdge,
): WindowLayoutSpec {
  const axis = axisForEdge(sourceEdge)
  const sourceIsStart = sourceEdge === 'left' || sourceEdge === 'top'
  const currentAxis = cloneAxis(axis === 'horizontal' ? currentSpec.horizontal : currentSpec.vertical)
  const nextAxis: WindowLayoutAxisSpec = sourceIsStart
    ? currentAxis.end
      ? { end: currentAxis.end, size: axisSizeFromGeometry(geometry, axis) }
      : { start: { target: { kind: 'workspace', edge: sourceEdge }, offset: { value: axis === 'horizontal' ? geometry.position.x : geometry.position.y, unit: 'px' } }, size: axisSizeFromGeometry(geometry, axis) }
    : currentAxis.start
      ? { start: currentAxis.start, size: axisSizeFromGeometry(geometry, axis) }
      : { start: { target: { kind: 'workspace', edge: axis === 'horizontal' ? 'left' : 'top' }, offset: { value: axis === 'horizontal' ? geometry.position.x : geometry.position.y, unit: 'px' } }, size: axisSizeFromGeometry(geometry, axis) }
  return axis === 'horizontal'
    ? { horizontal: nextAxis, vertical: cloneAxis(currentSpec.vertical) }
    : { horizontal: cloneAxis(currentSpec.horizontal), vertical: nextAxis }
}

/**
 * Build and validate a direct-constraint draft against the complete window
 * graph before the WindowManager is asked to commit it.
 */
export function createWindowLayoutConstraintDraft(
  windows: readonly ResponsiveLayoutWindow[],
  sourceInstanceId: string,
  sourceEdge: WindowLayoutEdge,
  target: WindowLayoutTarget,
): WindowLayoutSpec {
  const source = windows.find((window) => window.instanceId === sourceInstanceId)
  if (!source) fail('unknown-window', `responsive layout references unknown window "${sourceInstanceId}"`, sourceInstanceId)
  const spec = setWindowLayoutConstraint(source.layoutSpec, source.geometry, sourceEdge, target)
  const candidates = windows.map((window) => window.instanceId === sourceInstanceId ? { ...window, layoutSpec: spec } : window)
  validateWindowLayoutReferences(candidates)
  return spec
}

function workspaceAnchor(edge: WindowLayoutEdge): WindowLayoutAnchor { return { target: { kind: 'workspace', edge } } }
function percent(value: number): WindowLayoutLength { return { value, unit: 'percent' } }

export function createWindowLayoutSpecFromSnap(zone: WindowSnapZone): WindowLayoutSpec {
  const half = percent(50)
  const third = percent(100 / 3)
  const twoThirds = percent(200 / 3)
  const horizontalFill: WindowLayoutAxisSpec = { start: workspaceAnchor('left'), end: workspaceAnchor('right') }
  const verticalFill: WindowLayoutAxisSpec = { start: workspaceAnchor('top'), end: workspaceAnchor('bottom') }
  switch (zone) {
    case 'left': return { horizontal: { start: workspaceAnchor('left'), size: half }, vertical: verticalFill }
    case 'right': return { horizontal: { end: workspaceAnchor('right'), size: half }, vertical: verticalFill }
    case 'top': return { horizontal: horizontalFill, vertical: { start: workspaceAnchor('top'), size: half } }
    case 'bottom': return { horizontal: horizontalFill, vertical: { end: workspaceAnchor('bottom'), size: half } }
    case 'top-left': return { horizontal: { start: workspaceAnchor('left'), size: half }, vertical: { start: workspaceAnchor('top'), size: half } }
    case 'top-right': return { horizontal: { end: workspaceAnchor('right'), size: half }, vertical: { start: workspaceAnchor('top'), size: half } }
    case 'bottom-left': return { horizontal: { start: workspaceAnchor('left'), size: half }, vertical: { end: workspaceAnchor('bottom'), size: half } }
    case 'bottom-right': return { horizontal: { end: workspaceAnchor('right'), size: half }, vertical: { end: workspaceAnchor('bottom'), size: half } }
    case 'left-third': return { horizontal: { start: workspaceAnchor('left'), size: third }, vertical: verticalFill }
    case 'right-third': return { horizontal: { end: workspaceAnchor('right'), size: third }, vertical: verticalFill }
    case 'left-two-thirds': return { horizontal: { start: workspaceAnchor('left'), size: twoThirds }, vertical: verticalFill }
    case 'right-two-thirds': return { horizontal: { end: workspaceAnchor('right'), size: twoThirds }, vertical: verticalFill }
  }
}

export function layoutSpecReferencesWindow(spec: WindowLayoutSpec, instanceId: string): boolean {
  return [spec.horizontal.start, spec.horizontal.end, spec.vertical.start, spec.vertical.end].some((anchor) => anchor?.target.kind === 'window' && anchor.target.instanceId === instanceId)
}

/** Return direct and transitive responsive consumers of a window. */
export function findWindowLayoutDependents(
  windows: readonly Pick<ResponsiveLayoutWindow, 'instanceId' | 'layoutSpec'>[],
  instanceId: string,
): readonly string[] {
  const dependents = new Set<string>()
  let changed = true
  while (changed) {
    changed = false
    for (const window of windows) {
      if (!window.layoutSpec || dependents.has(window.instanceId)) continue
      const references = layoutSpecReferencesWindow(window.layoutSpec, instanceId)
        || [...dependents].some((dependency) => layoutSpecReferencesWindow(window.layoutSpec as WindowLayoutSpec, dependency))
      if (references) {
        dependents.add(window.instanceId)
        changed = true
      }
    }
  }
  return [...dependents].sort()
}

export function validateWindowLayoutReferences(windows: readonly Pick<ResponsiveLayoutWindow, 'instanceId' | 'layoutSpec'>[]): void {
  const byId = new Map(windows.map((window) => [window.instanceId, window]))
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const visit = (instanceId: string): void => {
    if (visited.has(instanceId)) return
    if (visiting.has(instanceId)) fail('cycle', `responsive layout contains a dependency cycle at window "${instanceId}"`, instanceId)
    const window = byId.get(instanceId)
    if (!window) fail('unknown-window', `responsive layout references unknown window "${instanceId}"`, instanceId)
    visiting.add(instanceId)
    if (window.layoutSpec) {
      validateWindowLayoutSpec(window.layoutSpec, instanceId)
      for (const anchor of [window.layoutSpec.horizontal.start, window.layoutSpec.horizontal.end, window.layoutSpec.vertical.start, window.layoutSpec.vertical.end]) {
        if (anchor?.target.kind !== 'window') continue
        if (anchor.target.instanceId === instanceId) fail('self-reference', `window "${instanceId}" cannot reference itself`, instanceId)
        visit(anchor.target.instanceId)
      }
    }
    visiting.delete(instanceId)
    visited.add(instanceId)
  }
  for (const window of [...windows].sort((left, right) => left.instanceId.localeCompare(right.instanceId))) visit(window.instanceId)
}
