import { DuplicateDockError, type DockManager, type DockPosition, type DockRestoreWindow, type DockState } from './dock-manager'
import { clonePaneTree, validatePaneTree, type PaneNode, type PaneSettings } from './pane'
import { cloneLayoutSurfaceStyle, parseLayoutSurfaceStyle, createLayoutSurfaceStyle, type LayoutSurfaceStyle } from './layout-surface-style'
import type { WidgetId } from './widget'
import { DuplicateWindowInstanceError, type WindowManager, type WindowMode, type WindowState } from './window-manager'
import type { WindowGeometry, WindowSize, WindowSizeConstraints } from './window-geometry'
import { cloneWindowLayoutSpec, validateWindowLayoutReferences, validateWindowLayoutSpec, type WindowLayoutRuleState, type WindowLayoutSpec } from './window-layout'
import { cloneWindowOptions, createWindowOptions, type WindowOptions } from './window-options'
import { isWindowSnapZone, type WindowSnapState } from './window-snap'
import { UnknownWidgetError, WidgetParameterValidationError } from './widget-registry'
import { defaultWorkspaceMigrationRegistry, WorkspaceMigrationError, type WorkspaceMigrationRegistry } from './workspace-migrations'

export const WORKSPACE_VERSION = 3 as const
export type WorkspaceParameterValue = string | number | boolean
export type WorkspaceParameters = Readonly<Record<string, WorkspaceParameterValue>>

export interface WorkspaceWindowSnapshot {
  readonly instanceId: string
  readonly title: string
  readonly titleIsCustom?: boolean
  readonly rootPane: PaneNode
  readonly geometry: WindowGeometry
  readonly constraints: WindowSizeConstraints
  readonly options: WindowOptions
  readonly snap: WindowSnapState | null
  readonly restoreGeometry: WindowGeometry | null
  readonly layoutLocked?: boolean
  readonly layoutSpec?: WindowLayoutSpec | null
  readonly layoutSpecState?: WindowLayoutRuleState
  readonly mode: WindowMode
  readonly focused: boolean
  readonly zIndex: number
}

export interface WorkspaceDockSnapshot {
  readonly id: string
  readonly position: DockPosition
  readonly rootPane: PaneNode
  readonly thickness: number
  readonly minThickness: number
  readonly maxThickness: number | null
  readonly resizable: boolean
  readonly surfaceStyle?: LayoutSurfaceStyle
  readonly restoreWindow?: DockRestoreWindow
}

export interface WorkspaceSnapshot {
  readonly version: typeof WORKSPACE_VERSION
  readonly windows: readonly WorkspaceWindowSnapshot[]
  readonly docks: readonly WorkspaceDockSnapshot[]
}

export type WorkspaceRestoreIssueCode =
  | 'invalid-workspace' | 'unsupported-version' | 'migration-failed' | 'manager-not-empty' | 'dock-manager-not-empty'
  | 'dock-manager-required' | 'invalid-window' | 'invalid-dock' | 'duplicate-instance'
  | 'duplicate-dock' | 'unknown-widget' | 'invalid-parameters' | 'singleton-conflict'
  | 'open-failed' | 'dock-open-failed'

export interface WorkspaceRestoreIssue {
  readonly code: WorkspaceRestoreIssueCode
  readonly message: string
  readonly index?: number
  readonly instanceId?: string
  readonly widgetId?: WidgetId
  readonly dockId?: string
}

export interface WorkspaceRestoreResult {
  readonly valid: boolean
  readonly restored: readonly WindowState[]
  readonly restoredDocks: readonly DockState[]
  readonly issues: readonly WorkspaceRestoreIssue[]
}

export class WorkspaceSerializationError extends Error {
  constructor(message: string) { super(message); this.name = 'WorkspaceSerializationError' }
}

export class WorkspaceInvariantError extends Error {
  constructor(message: string) { super(message); this.name = 'WorkspaceInvariantError' }
}

export class WorkspaceMutationError extends Error {
  constructor(message: string, public override readonly cause?: unknown) { super(message); this.name = 'WorkspaceMutationError' }
}

export interface WorkspaceRestoreOptions {
  readonly atomic?: boolean
  /** Current floating workspace rectangle used to recover persisted geometry. */
  readonly container?: WindowSize
}

export interface WorkspaceMutationOwner {
  readonly kind: 'window' | 'dock'
  readonly id: string
}

export interface WorkspacePaneMutation {
  readonly owner: WorkspaceMutationOwner
  readonly rootPane: PaneNode | null
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function isFiniteNumber(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) }
function cloneGeometry(geometry: WindowGeometry): WindowGeometry { return { position: { ...geometry.position }, size: { ...geometry.size } } }
function cloneConstraints(constraints: WindowSizeConstraints): WindowSizeConstraints { return { minSize: { ...constraints.minSize }, maxSize: constraints.maxSize ? { ...constraints.maxSize } : null } }
function cloneSnap(snap: WindowSnapState | null): WindowSnapState | null { return snap ? { zone: snap.zone, floatingGeometry: cloneGeometry(snap.floatingGeometry) } : null }
function cloneDockRestoreWindow(window: DockRestoreWindow): DockRestoreWindow {
  return { ...window, geometry: cloneGeometry(window.geometry), constraints: cloneConstraints(window.constraints), options: cloneWindowOptions(window.options) }
}

function validateGeometry(geometry: WindowGeometry, label: string): void {
  if (!isFiniteNumber(geometry.position.x) || !isFiniteNumber(geometry.position.y) || !isFiniteNumber(geometry.size.width) || !isFiniteNumber(geometry.size.height) || geometry.size.width <= 0 || geometry.size.height <= 0) {
    throw new WorkspaceInvariantError(`${label} must contain finite positive geometry`)
  }
}

function validateDockRestoreWindow(window: DockRestoreWindow, dockId: string): void {
  if (!window.instanceId.trim() || !window.title.trim()) throw new WorkspaceInvariantError(`dock "${dockId}" has invalid restore window identity`)
  validateGeometry(window.geometry, `dock "${dockId}" restore geometry`)
  if (!isFiniteNumber(window.constraints.minSize.width) || !isFiniteNumber(window.constraints.minSize.height) || window.constraints.minSize.width <= 0 || window.constraints.minSize.height <= 0) {
    throw new WorkspaceInvariantError(`dock "${dockId}" has invalid restore window minimum size`)
  }
  if (window.constraints.maxSize && (!isFiniteNumber(window.constraints.maxSize.width) || !isFiniteNumber(window.constraints.maxSize.height) || window.constraints.maxSize.width < window.constraints.minSize.width || window.constraints.maxSize.height < window.constraints.minSize.height)) {
    throw new WorkspaceInvariantError(`dock "${dockId}" has invalid restore window maximum size`)
  }
  try { createWindowOptions(window.options) } catch (error) { throw new WorkspaceInvariantError(error instanceof Error ? error.message : `dock "${dockId}" has invalid restore window options`) }
}

function validatePaneOwnership(root: PaneNode, paneIds: Set<string>, widgetInstances: Set<string>): void {
  const ownership = collectPaneOwnership(root)
  for (const paneId of ownership.paneIds) {
    if (paneIds.has(paneId)) throw new WorkspaceInvariantError(`duplicate pane id "${paneId}" in workspace`)
  }
  for (const instanceId of ownership.widgetInstances) {
    if (widgetInstances.has(instanceId)) throw new WorkspaceInvariantError(`duplicate widget instance id "${instanceId}" in workspace`)
  }
  for (const paneId of ownership.paneIds) paneIds.add(paneId)
  for (const instanceId of ownership.widgetInstances) widgetInstances.add(instanceId)
}

function collectPaneOwnership(root: PaneNode): { paneIds: readonly string[]; widgetInstances: readonly string[] } {
  const paneIds: string[] = [], widgetInstances: string[] = []
  function visit(pane: PaneNode): void {
    paneIds.push(pane.id)
    if (pane.kind === 'widget') { widgetInstances.push(pane.instanceId); return }
    for (const child of pane.children) visit(child)
  }
  visit(root)
  return { paneIds, widgetInstances }
}

export function validateWorkspaceSnapshot(snapshot: WorkspaceSnapshot): void {
  if (snapshot.version !== WORKSPACE_VERSION) throw new WorkspaceInvariantError(`unsupported workspace version "${String(snapshot.version)}"`)
  if (!Array.isArray(snapshot.windows) || !Array.isArray(snapshot.docks)) throw new WorkspaceInvariantError('workspace windows and docks must be arrays')

  const windowIds = new Set<string>(), restoreWindowIds = new Set<string>(), dockIds = new Set<string>(), paneIds = new Set<string>(), widgetInstances = new Set<string>(), zIndexes = new Set<number>()
  let focusedCount = 0
  for (const window of snapshot.windows) {
    if (windowIds.has(window.instanceId)) throw new WorkspaceInvariantError(`duplicate window instance id "${window.instanceId}" in workspace`)
    windowIds.add(window.instanceId)
    if (zIndexes.has(window.zIndex)) throw new WorkspaceInvariantError(`duplicate window z-index "${window.zIndex}" in workspace`)
    zIndexes.add(window.zIndex)
    if (window.focused) focusedCount += 1
    if (window.layoutLocked !== undefined && typeof window.layoutLocked !== 'boolean') throw new WorkspaceInvariantError(`invalid layout lock state for window "${window.instanceId}"`)
    if (window.layoutSpecState !== undefined && !['none', 'active', 'dormant', 'materialized'].includes(window.layoutSpecState)) throw new WorkspaceInvariantError(`invalid layout rule state for window "${window.instanceId}"`)
    if (window.layoutSpec !== undefined && window.layoutSpec !== null) {
      try { validateWindowLayoutSpec(window.layoutSpec, window.instanceId) } catch (error) { throw new WorkspaceInvariantError(error instanceof Error ? error.message : `invalid layout spec for window "${window.instanceId}"`) }
    }
    if (!Number.isInteger(window.zIndex) || window.zIndex < 0) throw new WorkspaceInvariantError(`invalid z-index for window "${window.instanceId}"`)
    validateGeometry(window.geometry, `window "${window.instanceId}" geometry`)
    if (window.restoreGeometry) validateGeometry(window.restoreGeometry, `window "${window.instanceId}" restore geometry`)
    if (window.mode === 'maximized' && !window.restoreGeometry) throw new WorkspaceInvariantError(`maximized window "${window.instanceId}" must have restore geometry`)
    if (window.snap && window.restoreGeometry) throw new WorkspaceInvariantError(`window "${window.instanceId}" cannot have snap and restore geometry simultaneously`)
    try { createWindowOptions(window.options) } catch (error) { throw new WorkspaceInvariantError(error instanceof Error ? error.message : `invalid options for window "${window.instanceId}"`) }
    try { validatePaneTree(window.rootPane) } catch (error) { throw new WorkspaceInvariantError(error instanceof Error ? error.message : `invalid pane tree for window "${window.instanceId}"`) }
    validatePaneOwnership(window.rootPane, paneIds, widgetInstances)
  }
  if (focusedCount > 1) throw new WorkspaceInvariantError('workspace may contain at most one focused window')
  try { validateWindowLayoutReferences(snapshot.windows) } catch (error) { throw new WorkspaceInvariantError(error instanceof Error ? error.message : 'invalid responsive window references') }

  for (const dock of snapshot.docks) {
    if (dockIds.has(dock.id)) throw new WorkspaceInvariantError(`duplicate dock id "${dock.id}" in workspace`)
    dockIds.add(dock.id)
    if (!isFiniteNumber(dock.minThickness) || dock.minThickness < 0 || !isFiniteNumber(dock.thickness) || dock.thickness < dock.minThickness || (dock.maxThickness !== null && (!isFiniteNumber(dock.maxThickness) || dock.maxThickness < dock.minThickness || dock.thickness > dock.maxThickness))) {
      throw new WorkspaceInvariantError(`invalid thickness constraints for dock "${dock.id}"`)
    }
    if (dock.surfaceStyle) {
      try { createLayoutSurfaceStyle(dock.surfaceStyle) } catch (error) { throw new WorkspaceInvariantError(error instanceof Error ? error.message : `invalid surface style for dock "${dock.id}"`) }
    }
    try { validatePaneTree(dock.rootPane) } catch (error) { throw new WorkspaceInvariantError(error instanceof Error ? error.message : `invalid pane tree for dock "${dock.id}"`) }
    if (dock.restoreWindow) {
      if (windowIds.has(dock.restoreWindow.instanceId) || restoreWindowIds.has(dock.restoreWindow.instanceId)) throw new WorkspaceInvariantError(`duplicate restore window instance id "${dock.restoreWindow.instanceId}" in workspace`)
      restoreWindowIds.add(dock.restoreWindow.instanceId)
      validateDockRestoreWindow(dock.restoreWindow, dock.id)
    }
    validatePaneOwnership(dock.rootPane, paneIds, widgetInstances)
  }
}

export function captureWorkspace(manager: WindowManager, dockManager?: DockManager): WorkspaceSnapshot {
  const windows = manager.list().slice().sort((a, b) => a.zIndex - b.zIndex).map((window) => ({
    instanceId: window.instanceId,
    title: window.title,
    titleIsCustom: window.titleIsCustom,
    rootPane: clonePaneTree(window.rootPane),
    geometry: cloneGeometry(window.geometry),
    constraints: cloneConstraints(window.constraints),
    options: cloneWindowOptions(window.options),
    snap: cloneSnap(window.snap),
    restoreGeometry: window.restoreGeometry ? cloneGeometry(window.restoreGeometry) : null,
    layoutLocked: window.layoutLocked,
    ...(window.layoutSpec !== undefined ? { layoutSpec: window.layoutSpec ? cloneWindowLayoutSpec(window.layoutSpec) : null } : {}),
    ...(window.layoutSpecState ? { layoutSpecState: window.layoutSpecState } : {}),
    mode: window.mode,
    focused: window.focused,
    zIndex: window.zIndex,
  }))
  const docks = (dockManager?.list() ?? []).map((dock): WorkspaceDockSnapshot => {
    const surfaceStyle = cloneLayoutSurfaceStyle(dock.surfaceStyle)
    const snapshot: WorkspaceDockSnapshot = { ...dock, rootPane: clonePaneTree(dock.rootPane), ...(surfaceStyle ? { surfaceStyle } : {}) }
    return dock.restoreWindow ? { ...snapshot, restoreWindow: cloneDockRestoreWindow(dock.restoreWindow) } : snapshot
  })
  const snapshot: WorkspaceSnapshot = { version: WORKSPACE_VERSION, windows, docks }
  validateWorkspaceSnapshot(snapshot)
  return snapshot
}

export function serializeWorkspace(manager: WindowManager, dockManager?: DockManager): string {
  return JSON.stringify(captureWorkspace(manager, dockManager))
}

function invalidRoot(code: WorkspaceRestoreIssueCode, message: string): WorkspaceRestoreResult {
  return { valid: false, restored: [], restoredDocks: [], issues: [{ code, message }] }
}

function clearWorkspaceManagers(manager: WindowManager, dockManager?: DockManager): void {
  for (const window of [...manager.list()]) manager.close(window.instanceId, 'api')
  if (dockManager) for (const dock of [...dockManager.list()]) dockManager.remove(dock.id)
}

function parseInput(input: unknown): unknown {
  if (typeof input !== 'string') return input
  try { return JSON.parse(input) as unknown } catch { return undefined }
}

function readParameters(value: unknown): Record<string, WorkspaceParameterValue> | null {
  if (!isRecord(value)) return null
  const result: Record<string, WorkspaceParameterValue> = {}
  for (const [key, candidate] of Object.entries(value)) {
    if (typeof candidate !== 'string' && typeof candidate !== 'number' && typeof candidate !== 'boolean') return null
    if (typeof candidate === 'number' && !Number.isFinite(candidate)) return null
    result[key] = candidate
  }
  return result
}

function readGeometry(value: unknown): WindowGeometry | null {
  if (!isRecord(value) || !isRecord(value.position) || !isRecord(value.size)) return null
  const { x, y } = value.position, { width, height } = value.size
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(width) || !isFiniteNumber(height) || width <= 0 || height <= 0) return null
  return { position: { x, y }, size: { width, height } }
}

function readSize(value: unknown): { width: number; height: number } | null {
  if (!isRecord(value) || !isFiniteNumber(value.width) || !isFiniteNumber(value.height) || value.width <= 0 || value.height <= 0) return null
  return { width: value.width, height: value.height }
}

function readConstraints(value: unknown): WindowSizeConstraints | null {
  if (!isRecord(value)) return null
  const minSize = readSize(value.minSize), maxSize = value.maxSize === null ? null : readSize(value.maxSize)
  if (!minSize || (value.maxSize !== null && !maxSize) || (maxSize && (minSize.width > maxSize.width || minSize.height > maxSize.height))) return null
  return { minSize, maxSize }
}

function readWindowOptions(value: unknown): WindowOptions | null {
  if (value === undefined) return createWindowOptions()
  if (!isRecord(value)) return null
  try { return createWindowOptions(value) } catch { return null }
}

function readWindowSnap(value: unknown): WindowSnapState | null | undefined {
  if (value === undefined || value === null) return null
  if (!isRecord(value) || !isWindowSnapZone(value.zone)) return undefined
  const floatingGeometry = readGeometry(value.floatingGeometry)
  return floatingGeometry ? { zone: value.zone, floatingGeometry } : undefined
}

function readPaneSettings(value: unknown): PaneSettings | undefined | null {
  if (value === undefined) return undefined
  if (!isRecord(value)) return null
  const settings: {
    resizable?: boolean; minSize?: number; maxSize?: number; grow?: number; sizeMode?: 'flex' | 'fixed' | 'content'; size?: number
    collapsible?: boolean; collapsed?: boolean; locked?: boolean; background?: 'transparent' | 'canvas' | 'surface' | 'surface-raised'
    backgroundColor?: string; surfaceStyle?: LayoutSurfaceStyle; overflow?: 'auto' | 'hidden' | 'visible'
  } = {}
  for (const key of ['resizable', 'collapsible', 'collapsed', 'locked'] as const) {
    const candidate = value[key]
    if (candidate === undefined) continue
    if (typeof candidate !== 'boolean') return null
    settings[key] = candidate
  }
  for (const key of ['minSize', 'maxSize', 'grow', 'size'] as const) {
    const candidate = value[key]
    if (candidate === undefined) continue
    if (!isFiniteNumber(candidate) || candidate < 0) return null
    settings[key] = candidate
  }
  if (settings.minSize !== undefined && settings.maxSize !== undefined && settings.minSize > settings.maxSize) return null
  if (value.sizeMode !== undefined) {
    if (!['flex', 'fixed', 'content'].includes(String(value.sizeMode))) return null
    settings.sizeMode = value.sizeMode as 'flex' | 'fixed' | 'content'
  }
  if (settings.sizeMode === 'fixed' && settings.size === undefined) return null
  if (settings.size !== undefined && settings.sizeMode !== 'fixed') return null
  if (settings.collapsed && !settings.collapsible) return null
  if (value.background !== undefined) {
    if (!['transparent', 'canvas', 'surface', 'surface-raised'].includes(String(value.background))) return null
    settings.background = value.background as NonNullable<PaneSettings['background']>
  }
  if (value.backgroundColor !== undefined) {
    if (typeof value.backgroundColor !== 'string' || !value.backgroundColor.trim()) return null
    settings.backgroundColor = value.backgroundColor
  }
  const surfaceStyle = parseLayoutSurfaceStyle(value.surfaceStyle)
  if (surfaceStyle === null) return null
  if (surfaceStyle) settings.surfaceStyle = surfaceStyle
  if (value.overflow !== undefined) {
    if (!['auto', 'hidden', 'visible'].includes(String(value.overflow))) return null
    settings.overflow = value.overflow as NonNullable<PaneSettings['overflow']>
  }
  return settings
}

function readPane(value: unknown): PaneNode | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id.trim()) return null
  const settings = readPaneSettings(value.settings)
  if (settings === null) return null
  let pane: PaneNode | null = null
  if (value.kind === 'widget') {
    if (typeof value.widgetId !== 'string' || !value.widgetId.trim() || typeof value.instanceId !== 'string' || !value.instanceId.trim()) return null
    const parameters = readParameters(value.parameters)
    if (!parameters) return null
    pane = { kind: 'widget', id: value.id, widgetId: value.widgetId, instanceId: value.instanceId, parameters, ...(settings ? { settings } : {}) }
  } else if (value.kind === 'split') {
    if ((value.axis !== 'horizontal' && value.axis !== 'vertical') || !Array.isArray(value.children) || !Array.isArray(value.weights)) return null
    const children = value.children.map(readPane)
    if (children.some((child) => child === null) || !value.weights.every((weight) => isFiniteNumber(weight) && weight > 0)) return null
    pane = { kind: 'split', id: value.id, axis: value.axis, children: children as PaneNode[], weights: value.weights as number[], ...(settings ? { settings } : {}) }
  } else if (value.kind === 'tabs') {
    if (!Array.isArray(value.children) || typeof value.activeId !== 'string' || !value.activeId.trim()) return null
    const children = value.children.map(readPane)
    if (children.some((child) => child === null)) return null
    pane = { kind: 'tabs', id: value.id, children: children as PaneNode[], activeId: value.activeId, ...(settings ? { settings } : {}) }
  } else if (value.kind === 'stack') {
    if (!Array.isArray(value.children)) return null
    const children = value.children.map(readPane)
    if (children.some((child) => child === null)) return null
    pane = { kind: 'stack', id: value.id, children: children as PaneNode[], ...(settings ? { settings } : {}) }
  }
  if (!pane) return null
  try { validatePaneTree(pane); return pane } catch { return null }
}

function readWindow(value: unknown): WorkspaceWindowSnapshot | null {
  if (!isRecord(value) || typeof value.instanceId !== 'string' || !value.instanceId.trim() || typeof value.title !== 'string' || !value.title.trim()) return null
  if (!['normal', 'minimized', 'maximized'].includes(String(value.mode)) || typeof value.focused !== 'boolean' || !Number.isInteger(value.zIndex) || (value.zIndex as number) < 0) return null
  const rootPane = readPane(value.rootPane), geometry = readGeometry(value.geometry), constraints = readConstraints(value.constraints), options = readWindowOptions(value.options), snap = readWindowSnap(value.snap)
  const restoreGeometry = value.restoreGeometry === undefined || value.restoreGeometry === null ? null : readGeometry(value.restoreGeometry)
  if (!rootPane || !geometry || !constraints || !options || snap === undefined || (value.restoreGeometry !== undefined && value.restoreGeometry !== null && !restoreGeometry)) return null
  if (value.mode === 'maximized' && !restoreGeometry) return null
  if (value.titleIsCustom !== undefined && typeof value.titleIsCustom !== 'boolean') return null
  if (value.layoutLocked !== undefined && typeof value.layoutLocked !== 'boolean') return null
  if (value.layoutSpecState !== undefined && !['none', 'active', 'dormant', 'materialized'].includes(String(value.layoutSpecState))) return null
  let layoutSpec: WindowLayoutSpec | null | undefined
  if (value.layoutSpec !== undefined && value.layoutSpec !== null) {
    try { validateWindowLayoutSpec(value.layoutSpec, value.instanceId); layoutSpec = cloneWindowLayoutSpec(value.layoutSpec) } catch { return null }
  } else if (value.layoutSpec === null) layoutSpec = null
  return { instanceId: value.instanceId, title: value.title, ...(value.titleIsCustom === true ? { titleIsCustom: true } : {}), rootPane, geometry, constraints, options, snap, restoreGeometry, layoutLocked: value.layoutLocked === true, ...(layoutSpec !== undefined ? { layoutSpec } : {}), ...(value.layoutSpecState ? { layoutSpecState: value.layoutSpecState as WindowLayoutRuleState } : {}), mode: value.mode as WindowMode, focused: value.focused, zIndex: value.zIndex as number }
}

function readDockRestoreWindow(value: unknown): DockRestoreWindow | undefined | null {
  if (value === undefined || value === null) return undefined
  if (!isRecord(value) || typeof value.instanceId !== 'string' || !value.instanceId.trim() || typeof value.title !== 'string' || !value.title.trim()) return null
  const geometry = readGeometry(value.geometry), constraints = readConstraints(value.constraints), options = readWindowOptions(value.options)
  if (!geometry || !constraints || !options) return null
  return { instanceId: value.instanceId, title: value.title, geometry, constraints, options }
}

function readDock(value: unknown): WorkspaceDockSnapshot | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id.trim() || !['top', 'bottom', 'left', 'right'].includes(String(value.position))) return null
  const rootPane = readPane(value.rootPane), restoreWindow = readDockRestoreWindow(value.restoreWindow), surfaceStyle = parseLayoutSurfaceStyle(value.surfaceStyle)
  if (!rootPane || !isFiniteNumber(value.thickness) || value.thickness < 0 || !isFiniteNumber(value.minThickness) || value.minThickness < 0) return null
  if (restoreWindow === null || surfaceStyle === null) return null
  const max = value.maxThickness === null ? null : value.maxThickness
  if (value.thickness < value.minThickness || (max !== null && (!isFiniteNumber(max) || max < value.minThickness || value.thickness > max)) || typeof value.resizable !== 'boolean') return null
  return { id: value.id, position: value.position as DockPosition, rootPane, thickness: value.thickness, minThickness: value.minThickness, maxThickness: max, resizable: value.resizable, ...(surfaceStyle ? { surfaceStyle } : {}), ...(restoreWindow ? { restoreWindow } : {}) }
}

interface RestoreCandidate {
  readonly index: number
  readonly instanceId: string
  readonly focused: boolean
  readonly mode: WindowMode
  readonly zIndex: number
  readonly widgetId?: WidgetId | undefined
  open(manager: WindowManager): WindowState
}

function restoreIssue(code: WorkspaceRestoreIssueCode, message: string, candidate: RestoreCandidate | null, index: number): WorkspaceRestoreIssue {
  return { code, message, index, ...(candidate ? { instanceId: candidate.instanceId, ...(candidate.widgetId ? { widgetId: candidate.widgetId } : {}) } : {}) }
}

export function restoreWorkspace(
  manager: WindowManager,
  input: unknown,
  dockManager?: DockManager,
  migrationRegistry: WorkspaceMigrationRegistry = defaultWorkspaceMigrationRegistry,
  options: WorkspaceRestoreOptions = {},
): WorkspaceRestoreResult {
  if (manager.list().length > 0) return invalidRoot('manager-not-empty', 'workspace restore requires an empty WindowManager')
  if (dockManager && dockManager.list().length > 0) return invalidRoot('dock-manager-not-empty', 'workspace restore requires an empty DockManager')
  const inputDocument = parseInput(input)
  if (!isRecord(inputDocument)) return invalidRoot('invalid-workspace', 'workspace must be a valid object or JSON document')

  let parsed: Record<string, unknown>
  try {
    parsed = migrationRegistry.migrate(inputDocument, WORKSPACE_VERSION).document as Record<string, unknown>
  } catch (error) {
    if (error instanceof WorkspaceMigrationError) {
      if (error.code === 'future-version') return invalidRoot('unsupported-version', error.message)
      if (error.code === 'invalid-document' || error.code === 'invalid-version') return invalidRoot('invalid-workspace', error.message)
      return invalidRoot('migration-failed', error.message)
    }
    return invalidRoot('migration-failed', error instanceof Error ? error.message : 'workspace migration failed')
  }

  if (!Array.isArray(parsed.windows)) return invalidRoot('invalid-workspace', 'workspace windows must be an array')
  const dockValues = parsed.docks === undefined ? [] : parsed.docks
  if (!Array.isArray(dockValues)) return invalidRoot('invalid-workspace', 'workspace docks must be an array')
  if (dockValues.length > 0 && !dockManager) return invalidRoot('dock-manager-required', 'workspace contains docks but no DockManager was provided')

  const issues: WorkspaceRestoreIssue[] = [], candidates: RestoreCandidate[] = []
  parsed.windows.forEach((value, index) => {
    const entry = readWindow(value)
    if (!entry) { issues.push(restoreIssue('invalid-window', 'invalid workspace window entry', null, index)); return }
    candidates.push({
      index, instanceId: entry.instanceId, widgetId: entry.rootPane.kind === 'widget' ? entry.rootPane.widgetId : undefined, focused: entry.focused, mode: entry.mode, zIndex: entry.zIndex,
      open: (target) => {
        target.openPane({ pane: entry.rootPane, instanceId: entry.instanceId, title: entry.title, titleIsCustom: entry.titleIsCustom === true, position: entry.geometry.position, size: entry.geometry.size, minSize: entry.constraints.minSize, ...(entry.constraints.maxSize ? { maxSize: entry.constraints.maxSize } : {}), options: entry.options, snap: entry.snap, restoreGeometry: entry.restoreGeometry, layoutLocked: entry.layoutLocked === true, ...(entry.layoutSpec !== undefined ? { layoutSpec: entry.layoutSpec } : {}), ...(entry.layoutSpecState ? { layoutSpecState: entry.layoutSpecState } : {}) })
        if (entry.mode === 'maximized') target.maximizeWindow(entry.instanceId, options.container ?? entry.geometry.size, 'api')
        else if (options.container && !(entry.layoutLocked === true && entry.layoutSpec)) target.constrainToContainer(entry.instanceId, options.container, 'api')
        return target.get(entry.instanceId)
      },
    })
  })

  candidates.sort((a, b) => a.zIndex - b.zIndex || a.index - b.index)
  const seen = new Set<string>(), openedIds = new Set<string>(), paneIds = new Set<string>(), widgetInstances = new Set<string>()
  for (const candidate of candidates) {
    if (seen.has(candidate.instanceId)) { issues.push(restoreIssue('duplicate-instance', 'duplicate workspace instance id', candidate, candidate.index)); continue }
    seen.add(candidate.instanceId)
    try {
      const opened = candidate.open(manager)
      if (opened.instanceId !== candidate.instanceId) { issues.push(restoreIssue('singleton-conflict', 'singleton widget was already restored', candidate, candidate.index)); continue }
      try { validatePaneOwnership(opened.rootPane, paneIds, widgetInstances) } catch (error) {
        manager.close(opened.instanceId, 'api')
        issues.push(restoreIssue('invalid-workspace', error instanceof Error ? error.message : 'workspace pane identities are not unique', candidate, candidate.index))
        continue
      }
      openedIds.add(candidate.instanceId)
    } catch (error) {
      if (error instanceof UnknownWidgetError) issues.push(restoreIssue('unknown-widget', error.message, candidate, candidate.index))
      else if (error instanceof WidgetParameterValidationError) issues.push(restoreIssue('invalid-parameters', error.message, candidate, candidate.index))
      else if (error instanceof DuplicateWindowInstanceError) issues.push(restoreIssue('duplicate-instance', error.message, candidate, candidate.index))
      else issues.push(restoreIssue('open-failed', error instanceof Error ? error.message : 'window restore failed', candidate, candidate.index))
    }
  }
  if (manager.list().some((window) => window.layoutSpec)) {
    try {
      manager.resolveResponsiveLayouts(options.container ?? { width: 1000, height: 1000 }, 'api')
    } catch (error) {
      issues.push({ code: 'invalid-workspace', message: error instanceof Error ? error.message : 'responsive layout restore failed' })
    }
  }
  for (const candidate of candidates) if (openedIds.has(candidate.instanceId) && candidate.mode === 'minimized') manager.minimize(candidate.instanceId)
  const focused = candidates.find((candidate) => openedIds.has(candidate.instanceId) && candidate.focused && candidate.mode !== 'minimized')
  if (focused) manager.focus(focused.instanceId)

  if (dockManager) dockValues.forEach((value, index) => {
    const dock = readDock(value)
    if (!dock) { issues.push({ code: 'invalid-dock', message: 'invalid workspace dock entry', index }); return }
    try {
      const added = dockManager.add({ id: dock.id, position: dock.position, pane: dock.rootPane, thickness: dock.thickness, minThickness: dock.minThickness, ...(dock.maxThickness !== null ? { maxThickness: dock.maxThickness } : {}), resizable: dock.resizable, ...(dock.surfaceStyle ? { surfaceStyle: dock.surfaceStyle } : {}), ...(dock.restoreWindow ? { restoreWindow: dock.restoreWindow } : {}) })
      try { validatePaneOwnership(added.rootPane, paneIds, widgetInstances) } catch (error) {
        dockManager.remove(dock.id)
        issues.push({ code: 'invalid-workspace', message: error instanceof Error ? error.message : 'workspace pane identities are not unique', index, dockId: dock.id })
      }
    } catch (error) {
      issues.push({ code: error instanceof DuplicateDockError ? 'duplicate-dock' : 'dock-open-failed', message: error instanceof Error ? error.message : 'dock restore failed', index, dockId: dock.id })
    }
  })
  const result: WorkspaceRestoreResult = { valid: true, restored: manager.list(), restoredDocks: dockManager?.list() ?? [], issues }
  if (options.atomic && issues.length > 0) {
    clearWorkspaceManagers(manager, dockManager)
    return { valid: false, restored: [], restoredDocks: [], issues }
  }
  return result
}

function applyPaneMutation(manager: WindowManager, dockManager: DockManager | undefined, mutation: WorkspacePaneMutation): void {
  if (mutation.owner.kind === 'window') {
    if (mutation.rootPane === null) manager.close(mutation.owner.id, 'user')
    else manager.setRootPane(mutation.owner.id, mutation.rootPane, 'user')
    return
  }
  if (!dockManager) throw new WorkspaceMutationError('workspace mutation requires a DockManager')
  if (mutation.rootPane === null) throw new WorkspaceMutationError(`dock "${mutation.owner.id}" cannot be removed by a pane mutation`)
  dockManager.setRootPane(mutation.owner.id, mutation.rootPane)
}

export function commitWorkspacePaneMutations(
  manager: WindowManager,
  dockManager: DockManager | undefined,
  mutations: readonly WorkspacePaneMutation[],
): void {
  if (mutations.length === 0) return
  const before = captureWorkspace(manager, dockManager)
  const mutationKeys = new Set<string>()
  const nextWindows: WorkspaceWindowSnapshot[] = [], nextDocks: WorkspaceDockSnapshot[] = []
  const byOwner = new Map<string, WorkspacePaneMutation>()
  for (const mutation of mutations) {
    const key = `${mutation.owner.kind}:${mutation.owner.id}`
    if (mutationKeys.has(key)) throw new WorkspaceMutationError(`workspace owner "${key}" has multiple pane mutations`)
    mutationKeys.add(key); byOwner.set(key, mutation)
  }

  for (const window of before.windows) {
    const mutation = byOwner.get(`window:${window.instanceId}`)
    if (!mutation) { nextWindows.push(window); continue }
    if (mutation.rootPane === null) continue
    nextWindows.push({ ...window, rootPane: clonePaneTree(mutation.rootPane) })
  }
  for (const dock of before.docks) {
    const mutation = byOwner.get(`dock:${dock.id}`)
    if (!mutation) { nextDocks.push(dock); continue }
    if (mutation.rootPane === null) throw new WorkspaceMutationError(`dock "${dock.id}" cannot be removed by a pane mutation`)
    nextDocks.push({ ...dock, rootPane: clonePaneTree(mutation.rootPane) })
  }
  for (const mutation of mutations) {
    const exists = mutation.owner.kind === 'window'
      ? before.windows.some((window) => window.instanceId === mutation.owner.id)
      : before.docks.some((dock) => dock.id === mutation.owner.id)
    if (!exists) throw new WorkspaceMutationError(`unknown workspace owner "${mutation.owner.kind}:${mutation.owner.id}"`)
  }

  const next: WorkspaceSnapshot = { version: WORKSPACE_VERSION, windows: nextWindows, docks: nextDocks }
  validateWorkspaceSnapshot(next)
  try {
    for (const mutation of mutations) if (mutation.rootPane === null) applyPaneMutation(manager, dockManager, mutation)
    for (const mutation of mutations) if (mutation.rootPane !== null) applyPaneMutation(manager, dockManager, mutation)
    validateWorkspaceSnapshot(captureWorkspace(manager, dockManager))
  } catch (error) {
    try {
      clearWorkspaceManagers(manager, dockManager)
      const restored = restoreWorkspace(manager, before, dockManager, defaultWorkspaceMigrationRegistry, { atomic: true })
      if (!restored.valid || restored.issues.length > 0) throw new WorkspaceMutationError('workspace rollback restore reported issues', restored.issues)
    } catch (rollbackError) {
      throw new WorkspaceMutationError('workspace mutation failed and rollback also failed', rollbackError)
    }
    throw error
  }
}
