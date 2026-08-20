import { createDockManager, type DockManager, type DockState } from './dock-manager'
import type { WidgetRegistry } from './widget-registry'
import { createWindowManager, type WindowManager, type WindowState } from './window-manager'
import { captureWorkspace, restoreWorkspace, validateWorkspaceSnapshot, type WorkspaceDockSnapshot, type WorkspaceSnapshot, type WorkspaceWindowSnapshot } from './workspace'

export const WORKSPACE_LAYOUT_PRESET_VERSION = 1 as const
export const WORKSPACE_LAYOUT_COLLECTION_VERSION = 1 as const

export type WorkspaceLayoutErrorCode =
  | 'invalid-name'
  | 'not-found'
  | 'name-conflict'
  | 'invalid-preset'
  | 'unsupported-version'
  | 'restore-failed'
  | 'storage-failed'

export interface WorkspaceLayoutPreset {
  readonly version: typeof WORKSPACE_LAYOUT_PRESET_VERSION
  readonly name: string
  readonly workspace: WorkspaceSnapshot
}

export interface WorkspaceLayoutCollectionSnapshot {
  readonly version: typeof WORKSPACE_LAYOUT_COLLECTION_VERSION
  readonly defaultLayout: string | null
  readonly layouts: readonly WorkspaceLayoutPreset[]
}

export interface WorkspaceLayoutStorage {
  read(): unknown | null
  write(snapshot: WorkspaceLayoutCollectionSnapshot): void
}

export interface WorkspaceLayoutManagerOptions {
  readonly registry: WidgetRegistry
  readonly windows: WindowManager
  readonly docks?: DockManager | undefined
  readonly storage?: WorkspaceLayoutStorage | undefined
}

export interface SaveWorkspaceLayoutOptions {
  readonly overwrite?: boolean
  readonly setDefault?: boolean
}

export interface WorkspaceLayoutLoadResult {
  readonly name: string
  readonly reusedWindows: readonly string[]
  readonly reopenedWindows: readonly string[]
  readonly reusedDocks: readonly string[]
  readonly reopenedDocks: readonly string[]
}

export class WorkspaceLayoutError extends Error {
  constructor(public readonly code: WorkspaceLayoutErrorCode, message: string) {
    super(message)
    this.name = 'WorkspaceLayoutError'
  }
}

function cloneSerializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function clonePreset(preset: WorkspaceLayoutPreset): WorkspaceLayoutPreset {
  return { version: WORKSPACE_LAYOUT_PRESET_VERSION, name: preset.name, workspace: cloneSerializable(preset.workspace) }
}

function normalizeName(name: string): string {
  const normalized = name.trim()
  if (!normalized) throw new WorkspaceLayoutError('invalid-name', 'workspace layout name must not be empty')
  return normalized
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function normalizeWorkspace(registry: WidgetRegistry, value: unknown): WorkspaceSnapshot {
  const windows = createWindowManager(registry)
  const docks = createDockManager(registry)
  const result = restoreWorkspace(windows, value, docks)
  if (!result.valid) {
    const issue = result.issues[0]
    if (issue?.code === 'unsupported-version') throw new WorkspaceLayoutError('unsupported-version', issue.message)
    throw new WorkspaceLayoutError('invalid-preset', issue?.message ?? 'invalid workspace layout preset')
  }
  if (result.issues.length > 0) {
    throw new WorkspaceLayoutError('restore-failed', result.issues.map((issue) => issue.message).join('; '))
  }
  return captureWorkspace(windows, docks)
}

function normalizePreset(registry: WidgetRegistry, value: unknown): WorkspaceLayoutPreset {
  if (!isRecord(value)) throw new WorkspaceLayoutError('invalid-preset', 'workspace layout preset must be an object')
  if (value.version !== undefined && value.version !== WORKSPACE_LAYOUT_PRESET_VERSION) {
    throw new WorkspaceLayoutError('unsupported-version', `unsupported workspace layout preset version "${String(value.version)}"`)
  }
  if (typeof value.name !== 'string') throw new WorkspaceLayoutError('invalid-preset', 'workspace layout preset name must be a string')
  const name = normalizeName(value.name)
  if (value.workspace === undefined) throw new WorkspaceLayoutError('invalid-preset', `workspace layout "${name}" has no workspace snapshot`)
  return { version: WORKSPACE_LAYOUT_PRESET_VERSION, name, workspace: normalizeWorkspace(registry, value.workspace) }
}

function normalizeCollection(registry: WidgetRegistry, value: unknown): WorkspaceLayoutCollectionSnapshot {
  if (value === null || value === undefined) return { version: WORKSPACE_LAYOUT_COLLECTION_VERSION, defaultLayout: null, layouts: [] }
  let layoutsValue: unknown
  let defaultLayout: unknown = null
  if (Array.isArray(value)) {
    layoutsValue = value
  } else if (isRecord(value)) {
    if (value.version !== undefined && value.version !== WORKSPACE_LAYOUT_COLLECTION_VERSION) {
      throw new WorkspaceLayoutError('unsupported-version', `unsupported workspace layout collection version "${String(value.version)}"`)
    }
    layoutsValue = value.layouts
    defaultLayout = value.defaultLayout ?? null
  } else {
    throw new WorkspaceLayoutError('invalid-preset', 'workspace layout collection must be an object or legacy array')
  }
  if (!Array.isArray(layoutsValue)) throw new WorkspaceLayoutError('invalid-preset', 'workspace layout collection layouts must be an array')
  const layouts = layoutsValue.map((preset) => normalizePreset(registry, preset))
  const names = new Set<string>()
  for (const preset of layouts) {
    if (names.has(preset.name)) throw new WorkspaceLayoutError('invalid-preset', `duplicate workspace layout name "${preset.name}"`)
    names.add(preset.name)
  }
  if (defaultLayout !== null && typeof defaultLayout !== 'string') throw new WorkspaceLayoutError('invalid-preset', 'default workspace layout must be a string or null')
  const normalizedDefault = typeof defaultLayout === 'string' ? normalizeName(defaultLayout) : null
  if (normalizedDefault !== null && !names.has(normalizedDefault)) {
    throw new WorkspaceLayoutError('invalid-preset', `default workspace layout "${normalizedDefault}" does not exist`)
  }
  return { version: WORKSPACE_LAYOUT_COLLECTION_VERSION, defaultLayout: normalizedDefault, layouts }
}

function compatibleWindow(current: WindowState, target: WorkspaceWindowSnapshot): boolean {
  if (current.title !== target.title || current.titleIsCustom !== (target.titleIsCustom === true) || !sameValue(current.constraints, target.constraints)) return false
  if (target.mode === 'normal' && target.restoreGeometry !== null && target.snap === null) return false
  if (target.snap !== null && target.restoreGeometry !== null) return false
  return true
}

function normalizeWindowToFloating(windows: WindowManager, instanceId: string): void {
  let current = windows.get(instanceId)
  if (current.mode === 'minimized') current = windows.restore(instanceId, 'api')
  if (current.mode === 'maximized') current = windows.restore(instanceId, 'api')
  if (current.snap) windows.unsnapWindow(instanceId, undefined, undefined, 'api')
}

function snapContainer(target: WorkspaceWindowSnapshot): { width: number; height: number } {
  const width = Math.max(1, Math.round(target.geometry.size.width * 3))
  const height = Math.max(1, Math.round(target.geometry.size.height * 2))
  return { width, height }
}

function patchWindow(windows: WindowManager, target: WorkspaceWindowSnapshot): void {
  normalizeWindowToFloating(windows, target.instanceId)
  windows.setRootPane(target.instanceId, target.rootPane, 'api')
  windows.setOptions(target.instanceId, target.options, 'api')

  if (target.snap) {
    windows.setGeometry(target.instanceId, target.snap.floatingGeometry, 'api')
    windows.snapWindow(target.instanceId, target.snap.zone, snapContainer(target), 'api')
    windows.setGeometry(target.instanceId, target.geometry, 'api')
    if (target.mode === 'minimized') windows.minimize(target.instanceId, 'api')
    return
  }

  if (target.mode === 'maximized' || (target.mode === 'minimized' && target.restoreGeometry)) {
    windows.setGeometry(target.instanceId, target.restoreGeometry ?? target.geometry, 'api')
    windows.maximizeWindow(target.instanceId, target.geometry.size, 'api')
    if (target.mode === 'minimized') windows.minimize(target.instanceId, 'api')
    return
  }

  windows.setGeometry(target.instanceId, target.geometry, 'api')
  if (target.mode === 'minimized') windows.minimize(target.instanceId, 'api')
}

function openWindow(windows: WindowManager, target: WorkspaceWindowSnapshot): void {
  windows.openPane({
    pane: target.rootPane,
    instanceId: target.instanceId,
    title: target.title,
    titleIsCustom: target.titleIsCustom === true,
    position: target.geometry.position,
    size: target.geometry.size,
    minSize: target.constraints.minSize,
    ...(target.constraints.maxSize ? { maxSize: target.constraints.maxSize } : {}),
    options: target.options,
    snap: target.snap,
    restoreGeometry: target.restoreGeometry,
  }, 'api')
  if (target.mode === 'maximized') windows.maximizeWindow(target.instanceId, target.geometry.size, 'api')
  else if (target.mode === 'minimized') windows.minimize(target.instanceId, 'api')
}

function reorderWindows(windows: WindowManager, targets: readonly WorkspaceWindowSnapshot[]): void {
  for (const target of [...targets].sort((left, right) => left.zIndex - right.zIndex)) {
    const current = windows.get(target.instanceId)
    if (current.mode === 'minimized') {
      windows.restore(target.instanceId, 'api')
      windows.minimize(target.instanceId, 'api')
    } else {
      windows.focus(target.instanceId, 'api')
    }
  }
  const focused = targets.find((target) => target.focused && target.mode !== 'minimized')
  if (focused) windows.focus(focused.instanceId, 'api')
}

function compatibleDock(current: DockState, target: WorkspaceDockSnapshot): boolean {
  return current.position === target.position && current.minThickness === target.minThickness && current.maxThickness === target.maxThickness && current.resizable === target.resizable
}

function sameDockOrder(current: readonly DockState[], target: readonly WorkspaceDockSnapshot[]): boolean {
  const targetIds = new Set(target.map((dock) => dock.id))
  const currentIds = new Set(current.map((dock) => dock.id))
  const currentCommon = current.filter((dock) => targetIds.has(dock.id)).map((dock) => dock.id)
  const targetCommon = target.filter((dock) => currentIds.has(dock.id)).map((dock) => dock.id)
  return sameValue(currentCommon, targetCommon)
}

function addDock(docks: DockManager, target: WorkspaceDockSnapshot): void {
  docks.add({
    id: target.id,
    position: target.position,
    pane: target.rootPane,
    thickness: target.thickness,
    minThickness: target.minThickness,
    ...(target.maxThickness !== null ? { maxThickness: target.maxThickness } : {}),
    resizable: target.resizable,
  })
}

function applyWorkspace(windows: WindowManager, docks: DockManager | undefined, workspace: WorkspaceSnapshot): WorkspaceLayoutLoadResult {
  const reusedWindows: string[] = []
  const reopenedWindows: string[] = []
  const reusedDocks: string[] = []
  const reopenedDocks: string[] = []
  const targetWindowIds = new Set(workspace.windows.map((window) => window.instanceId))

  for (const current of windows.list()) {
    if (!targetWindowIds.has(current.instanceId)) windows.close(current.instanceId, 'api')
  }

  for (const target of [...workspace.windows].sort((left, right) => left.zIndex - right.zIndex)) {
    const current = windows.list().find((window) => window.instanceId === target.instanceId)
    if (current && compatibleWindow(current, target)) {
      patchWindow(windows, target)
      reusedWindows.push(target.instanceId)
    } else {
      if (current) windows.close(target.instanceId, 'api')
      openWindow(windows, target)
      reopenedWindows.push(target.instanceId)
    }
  }
  reorderWindows(windows, workspace.windows)

  if (workspace.docks.length > 0 && !docks) {
    throw new WorkspaceLayoutError('restore-failed', 'workspace layout contains docks but no DockManager was provided')
  }
  if (docks) {
    const currentDocks = docks.list()
    const rebuildAll = !sameDockOrder(currentDocks, workspace.docks)
    if (rebuildAll) {
      for (const current of currentDocks) docks.remove(current.id)
      for (const target of workspace.docks) { addDock(docks, target); reopenedDocks.push(target.id) }
    } else {
      const targetDockIds = new Set(workspace.docks.map((dock) => dock.id))
      for (const current of currentDocks) if (!targetDockIds.has(current.id)) docks.remove(current.id)
      for (const target of workspace.docks) {
        const current = docks.list().find((dock) => dock.id === target.id)
        if (current && compatibleDock(current, target)) {
          docks.setRootPane(target.id, target.rootPane)
          docks.setThickness(target.id, target.thickness)
          reusedDocks.push(target.id)
        } else {
          if (current) docks.remove(target.id)
          addDock(docks, target)
          reopenedDocks.push(target.id)
        }
      }
    }
  }

  return { name: '', reusedWindows, reopenedWindows, reusedDocks, reopenedDocks }
}

export class WorkspaceLayoutManager {
  private layouts = new Map<string, WorkspaceLayoutPreset>()
  private defaultLayout: string | null = null

  constructor(private readonly options: WorkspaceLayoutManagerOptions) {
    if (options.storage) {
      let stored: unknown
      try { stored = options.storage.read() }
      catch (error) { throw new WorkspaceLayoutError('storage-failed', error instanceof Error ? error.message : 'workspace layout storage read failed') }
      const collection = normalizeCollection(options.registry, stored)
      this.layouts = new Map(collection.layouts.map((preset) => [preset.name, preset]))
      this.defaultLayout = collection.defaultLayout
    }
  }

  listLayouts(): readonly WorkspaceLayoutPreset[] {
    return [...this.layouts.values()].map(clonePreset)
  }

  getDefaultLayout(): string | null { return this.defaultLayout }

  saveLayout(name: string, options: SaveWorkspaceLayoutOptions = {}): WorkspaceLayoutPreset {
    const normalized = normalizeName(name)
    if (this.layouts.has(normalized) && !options.overwrite) throw new WorkspaceLayoutError('name-conflict', `workspace layout "${normalized}" already exists`)
    const preset: WorkspaceLayoutPreset = { version: WORKSPACE_LAYOUT_PRESET_VERSION, name: normalized, workspace: captureWorkspace(this.options.windows, this.options.docks) }
    this.layouts.set(normalized, preset)
    if (options.setDefault) this.defaultLayout = normalized
    this.persist()
    return clonePreset(preset)
  }

  loadLayout(name: string): WorkspaceLayoutLoadResult {
    const normalized = normalizeName(name)
    const preset = this.layouts.get(normalized)
    if (!preset) throw new WorkspaceLayoutError('not-found', `unknown workspace layout "${normalized}"`)
    const before = captureWorkspace(this.options.windows, this.options.docks)
    try {
      const result = applyWorkspace(this.options.windows, this.options.docks, preset.workspace)
      validateWorkspaceSnapshot(captureWorkspace(this.options.windows, this.options.docks))
      return { ...result, name: normalized }
    } catch (error) {
      try {
        for (const window of [...this.options.windows.list()]) this.options.windows.close(window.instanceId, 'api')
        if (this.options.docks) for (const dock of [...this.options.docks.list()]) this.options.docks.remove(dock.id)
        const restored = restoreWorkspace(this.options.windows, before, this.options.docks, undefined, { atomic: true })
        if (!restored.valid || restored.issues.length > 0) throw new WorkspaceLayoutError('restore-failed', 'workspace layout rollback reported issues')
      } catch (rollbackError) {
        throw new WorkspaceLayoutError('restore-failed', `workspace layout load failed and rollback also failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`)
      }
      if (error instanceof WorkspaceLayoutError) throw error
      throw new WorkspaceLayoutError('restore-failed', error instanceof Error ? error.message : 'workspace layout restore failed')
    }
  }

  loadDefaultLayout(): WorkspaceLayoutLoadResult {
    if (!this.defaultLayout) throw new WorkspaceLayoutError('not-found', 'no default workspace layout is configured')
    return this.loadLayout(this.defaultLayout)
  }

  renameLayout(name: string, nextName: string): WorkspaceLayoutPreset {
    const currentName = normalizeName(name), normalizedNext = normalizeName(nextName)
    const preset = this.layouts.get(currentName)
    if (!preset) throw new WorkspaceLayoutError('not-found', `unknown workspace layout "${currentName}"`)
    if (currentName !== normalizedNext && this.layouts.has(normalizedNext)) throw new WorkspaceLayoutError('name-conflict', `workspace layout "${normalizedNext}" already exists`)
    this.layouts.delete(currentName)
    const renamed = { ...preset, name: normalizedNext }
    this.layouts.set(normalizedNext, renamed)
    if (this.defaultLayout === currentName) this.defaultLayout = normalizedNext
    this.persist()
    return clonePreset(renamed)
  }

  duplicateLayout(name: string, copyName: string): WorkspaceLayoutPreset {
    const currentName = normalizeName(name), normalizedCopy = normalizeName(copyName)
    const preset = this.layouts.get(currentName)
    if (!preset) throw new WorkspaceLayoutError('not-found', `unknown workspace layout "${currentName}"`)
    if (this.layouts.has(normalizedCopy)) throw new WorkspaceLayoutError('name-conflict', `workspace layout "${normalizedCopy}" already exists`)
    const copy: WorkspaceLayoutPreset = { ...clonePreset(preset), name: normalizedCopy }
    this.layouts.set(normalizedCopy, copy)
    this.persist()
    return clonePreset(copy)
  }

  deleteLayout(name: string): void {
    const normalized = normalizeName(name)
    if (!this.layouts.delete(normalized)) throw new WorkspaceLayoutError('not-found', `unknown workspace layout "${normalized}"`)
    if (this.defaultLayout === normalized) this.defaultLayout = null
    this.persist()
  }

  setDefaultLayout(name: string | null): void {
    if (name === null) { this.defaultLayout = null; this.persist(); return }
    const normalized = normalizeName(name)
    if (!this.layouts.has(normalized)) throw new WorkspaceLayoutError('not-found', `unknown workspace layout "${normalized}"`)
    this.defaultLayout = normalized
    this.persist()
  }

  snapshot(): WorkspaceLayoutCollectionSnapshot {
    return { version: WORKSPACE_LAYOUT_COLLECTION_VERSION, defaultLayout: this.defaultLayout, layouts: this.listLayouts() }
  }

  private persist(): void {
    if (!this.options.storage) return
    try { this.options.storage.write(this.snapshot()) }
    catch (error) { throw new WorkspaceLayoutError('storage-failed', error instanceof Error ? error.message : 'workspace layout storage write failed') }
  }
}

export function createWorkspaceLayoutManager(options: WorkspaceLayoutManagerOptions): WorkspaceLayoutManager {
  return new WorkspaceLayoutManager(options)
}
