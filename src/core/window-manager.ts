import { clonePaneTree, createCommandLauncherPane, createWidgetPane, isCommandLauncherPane, validatePaneTree, type PaneNode, type PaneParameters } from './pane'
import type { WidgetId } from './widget'
import { createWidgetLifecycle, type WidgetLifecycleController } from './widget-lifecycle'
import type { WidgetRegistry } from './widget-registry'
import { createWindowOptions, type WindowOptions, type WindowOptionsOverride } from './window-options'
import { maximizeWindowGeometry, restoreFloatingWindowGeometry, snapWindowGeometry, type WindowSnapState, type WindowSnapZone } from './window-snap'
import { DEFAULT_MIN_WINDOW_SIZE, DEFAULT_WINDOW_SIZE, normalizeWindowGeometry, constrainSize, sameGeometry, type WindowGeometry, type WindowPosition, type WindowSize, type WindowSizeConstraints } from './window-geometry'

export type WindowInstanceId = string
export type WindowOperationOrigin = 'api' | 'user'
export type WindowMode = 'normal' | 'minimized' | 'maximized'
export type WindowManagerChangeKind = 'open' | 'focus' | 'close' | 'geometry' | 'pane' | 'options' | 'snap' | 'maximize' | 'minimize' | 'restore' | 'lock' | 'unlock'

export const DEFAULT_LAUNCHER_WINDOW_TITLE = 'New Window'
export const DEFAULT_LAUNCHER_WINDOW_SIZE: WindowSize = { width: 420, height: 220 }

export interface WindowState {
  readonly instanceId: WindowInstanceId
  readonly title: string
  readonly titleIsCustom: boolean
  readonly rootPane: PaneNode
  readonly options: WindowOptions
  readonly snap: WindowSnapState | null
  readonly restoreGeometry: WindowGeometry | null
  readonly layoutLocked: boolean
  readonly focused: boolean
  readonly zIndex: number
  readonly mode: WindowMode
  readonly geometry: WindowGeometry
  readonly constraints: WindowSizeConstraints
}
export interface OpenWindowRequest { widgetId: WidgetId; parameters?: Readonly<Record<string, unknown>>; instanceId?: WindowInstanceId; title?: string; position?: WindowPosition; size?: WindowSize; options?: WindowOptionsOverride }
export interface OpenPaneWindowRequest { pane: PaneNode; instanceId?: WindowInstanceId; title?: string; /** Used by workspace restore to retain auto-title semantics for older snapshots. */ titleIsCustom?: boolean; position?: WindowPosition; size?: WindowSize; minSize?: WindowSize; maxSize?: WindowSize; options?: WindowOptionsOverride; snap?: WindowSnapState | null; restoreGeometry?: WindowGeometry | null; layoutLocked?: boolean }
export interface OpenLauncherWindowRequest { instanceId?: WindowInstanceId; title?: string; position?: WindowPosition; size?: WindowSize; minSize?: WindowSize; maxSize?: WindowSize; options?: WindowOptionsOverride; snap?: WindowSnapState | null; restoreGeometry?: WindowGeometry | null; layoutLocked?: boolean }
export interface ReplaceLauncherWindowRequest { widgetId: WidgetId; parameters?: Readonly<Record<string, unknown>> }
export interface WindowManagerChange { readonly kind: WindowManagerChangeKind; readonly origin: WindowOperationOrigin; readonly instanceId: WindowInstanceId; readonly windows: readonly WindowState[] }
export type WindowManagerListener = (change: WindowManagerChange) => void

export class DuplicateWindowInstanceError extends Error { constructor(public readonly instanceId: WindowInstanceId) { super(`window instance "${instanceId}" already exists`); this.name = 'DuplicateWindowInstanceError' } }
export class UnknownWindowInstanceError extends Error { constructor(public readonly instanceId: WindowInstanceId) { super(`unknown window instance "${instanceId}"`); this.name = 'UnknownWindowInstanceError' } }
export class WindowLayoutLockedError extends Error { constructor(public readonly instanceId: WindowInstanceId, operation: string) { super(`window "${instanceId}" is layout-locked; ${operation} is not allowed`); this.name = 'WindowLayoutLockedError' } }

function cloneSize(size: WindowSize): WindowSize { return { ...size } }
function cloneGeometry(geometry: WindowGeometry): WindowGeometry { return { position: { ...geometry.position }, size: cloneSize(geometry.size) } }
function cloneWindow(window: WindowState): WindowState { return { ...window, rootPane: clonePaneTree(window.rootPane), options: { ...window.options }, snap: window.snap ? { zone: window.snap.zone, floatingGeometry: cloneGeometry(window.snap.floatingGeometry) } : null, restoreGeometry: window.restoreGeometry ? cloneGeometry(window.restoreGeometry) : null, geometry: cloneGeometry(window.geometry), constraints: { minSize: cloneSize(window.constraints.minSize), maxSize: window.constraints.maxSize ? cloneSize(window.constraints.maxSize) : null } } }
function stackWindows(windows: readonly WindowState[], focusedId?: WindowInstanceId): WindowState[] { const locked = windows.filter((window) => window.layoutLocked); const normal = windows.filter((window) => !window.layoutLocked && window.options.layer === 'normal'); const alwaysOnTop = windows.filter((window) => !window.layoutLocked && window.options.layer === 'always-on-top'); return [...locked, ...normal, ...alwaysOnTop].map((window, zIndex) => ({ ...window, focused: focusedId === undefined ? window.focused : window.instanceId === focusedId, zIndex })) }
function focusWithinLayer(windows: readonly WindowState[], target: WindowState): WindowState[] { const remaining = windows.filter((window) => window.instanceId !== target.instanceId); if (target.layoutLocked) { const locked = remaining.filter((window) => window.layoutLocked); return stackWindows([...locked, target, ...remaining.filter((window) => !window.layoutLocked)], target.instanceId) } if (target.options.layer === 'normal') { const normal = remaining.filter((window) => !window.layoutLocked && window.options.layer === 'normal'), alwaysOnTop = remaining.filter((window) => !window.layoutLocked && window.options.layer === 'always-on-top'); return stackWindows([...remaining.filter((window) => window.layoutLocked), ...normal, target, ...alwaysOnTop], target.instanceId) } return stackWindows([...remaining, target], target.instanceId) }
function topVisibleWindowId(windows: readonly WindowState[]): WindowInstanceId | undefined { for (let index = windows.length - 1; index >= 0; index -= 1) { const candidate = windows[index]; if (candidate && candidate.mode !== 'minimized') return candidate.instanceId } return undefined }
function paneParameters(parameters: Readonly<Record<string, unknown>>): PaneParameters { const result: Record<string, string | number | boolean> = {}; for (const [key, value] of Object.entries(parameters)) if (typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) result[key] = value; return result }
function normalizePane(registry: WidgetRegistry, pane: PaneNode): PaneNode { validatePaneTree(pane); if (pane.kind === 'widget') { if (isCommandLauncherPane(pane)) return clonePaneTree(pane); const resolved = registry.resolve(pane.widgetId, pane.parameters); return { ...clonePaneTree(pane), parameters: paneParameters(resolved.parameters) } } return { ...clonePaneTree(pane), children: pane.children.map((child) => normalizePane(registry, child)) } }
function defaultPaneTitle(registry: WidgetRegistry, pane: PaneNode): string { return isCommandLauncherPane(pane) ? DEFAULT_LAUNCHER_WINDOW_TITLE : pane.kind === 'widget' ? registry.get(pane.widgetId).title : 'Workspace' }
function rootWidgetId(window: WindowState): WidgetId | undefined { return window.rootPane.kind === 'widget' ? window.rootPane.widgetId : undefined }

export class WindowManager {
  private windows: WindowState[] = []
  private readonly listeners = new Set<WindowManagerListener>()
  private readonly lifecycles = new Map<WindowInstanceId, WidgetLifecycleController>()
  private nextInstanceNumber = 0
  constructor(private readonly registry: WidgetRegistry) {}
  list(): readonly WindowState[] { return this.windows.map(cloneWindow) }
  get(instanceId: WindowInstanceId): WindowState { const window = this.windows.find((candidate) => candidate.instanceId === instanceId); if (!window) throw new UnknownWindowInstanceError(instanceId); return cloneWindow(window) }
  getLifecycle(instanceId: WindowInstanceId): WidgetLifecycleController { const lifecycle = this.lifecycles.get(instanceId); if (!lifecycle) throw new UnknownWindowInstanceError(instanceId); return lifecycle }

  open(request: OpenWindowRequest, origin: WindowOperationOrigin = 'api'): WindowState {
    const resolved = this.registry.resolve(request.widgetId, request.parameters ?? {}), manifestWindow = resolved.manifest.window
    if (manifestWindow?.singleton) { const existing = this.windows.find((window) => rootWidgetId(window) === request.widgetId); if (existing) return existing.mode === 'minimized' ? this.restore(existing.instanceId, origin) : this.focus(existing.instanceId, origin) }
    const instanceId = request.instanceId ?? this.createInstanceId()
    const pane = createWidgetPane({ id: `${instanceId}.root`, widgetId: request.widgetId, instanceId, parameters: paneParameters(resolved.parameters) })
    return this.openPaneState({ pane, instanceId, title: request.title ?? resolved.manifest.title, titleIsCustom: request.title !== undefined, position: request.position, size: request.size, minSize: manifestWindow?.minSize, maxSize: manifestWindow?.maxSize, defaultSize: manifestWindow?.defaultSize, options: createWindowOptions({ ...(manifestWindow?.options ?? {}), ...(request.options ?? {}) }), snap: null, restoreGeometry: null, layoutLocked: false }, origin)
  }
  openPane(request: OpenPaneWindowRequest, origin: WindowOperationOrigin = 'api'): WindowState { const instanceId = request.instanceId ?? this.createInstanceId(), pane = normalizePane(this.registry, request.pane); return this.openPaneState({ pane, instanceId, title: request.title ?? defaultPaneTitle(this.registry, pane), titleIsCustom: request.titleIsCustom ?? request.title !== undefined, position: request.position, size: request.size, minSize: request.minSize, maxSize: request.maxSize, options: createWindowOptions(request.options), snap: request.snap ?? null, restoreGeometry: request.restoreGeometry ?? null, layoutLocked: request.layoutLocked ?? false }, origin) }
  openEmptyWindow(request: OpenLauncherWindowRequest = {}, origin: WindowOperationOrigin = 'api'): WindowState {
    const instanceId = request.instanceId ?? this.createInstanceId()
    const pane = createCommandLauncherPane({ id: `${instanceId}.root`, instanceId: `${instanceId}.launcher` })
    return this.openPaneState({ pane, instanceId, title: request.title ?? DEFAULT_LAUNCHER_WINDOW_TITLE, titleIsCustom: request.title !== undefined, position: request.position, size: request.size, defaultSize: DEFAULT_LAUNCHER_WINDOW_SIZE, minSize: request.minSize, maxSize: request.maxSize, options: createWindowOptions(request.options), snap: request.snap ?? null, restoreGeometry: request.restoreGeometry ?? null, layoutLocked: request.layoutLocked ?? false }, origin)
  }
  openLauncherWindow(request: OpenLauncherWindowRequest = {}, origin: WindowOperationOrigin = 'api'): WindowState { return this.openEmptyWindow(request, origin) }
  focus(instanceId: WindowInstanceId, origin: WindowOperationOrigin = 'api'): WindowState { const current = this.windows.find((window) => window.instanceId === instanceId); if (!current) throw new UnknownWindowInstanceError(instanceId); if (current.mode === 'minimized') return this.restore(instanceId, origin); const sameLayer = this.windows.filter((window) => window.layoutLocked === current.layoutLocked && (current.layoutLocked || window.options.layer === current.options.layer)); if (sameLayer.at(-1)?.instanceId === instanceId && current.focused) { this.setActiveLifecycle(instanceId); return cloneWindow(current) } this.windows = focusWithinLayer(this.windows, current); this.setActiveLifecycle(instanceId); this.emit('focus', origin, instanceId); return this.get(instanceId) }

  minimize(instanceId: WindowInstanceId, origin: WindowOperationOrigin = 'api'): WindowState {
    const index = this.windows.findIndex((window) => window.instanceId === instanceId); if (index < 0) throw new UnknownWindowInstanceError(instanceId); const current = this.windows[index]; if (!current) throw new UnknownWindowInstanceError(instanceId); if (current.mode === 'minimized') return cloneWindow(current)
    this.getLifecycle(instanceId).minimize(); const remaining = this.windows.filter((window) => window.instanceId !== instanceId); const nextFocusedId = current.focused ? topVisibleWindowId(remaining) : this.windows.find((window) => window.focused && window.mode !== 'minimized')?.instanceId
    this.windows = stackWindows(this.windows.map((window) => window.instanceId === instanceId ? { ...window, mode: 'minimized' as const, focused: false } : window), nextFocusedId); this.setActiveLifecycle(nextFocusedId); this.emit('minimize', origin, instanceId); return this.get(instanceId)
  }

  restore(instanceId: WindowInstanceId, origin: WindowOperationOrigin = 'api'): WindowState {
    const current = this.windows.find((window) => window.instanceId === instanceId); if (!current) throw new UnknownWindowInstanceError(instanceId)
    if (current.mode === 'normal') return this.focus(instanceId, origin)
    if (current.mode === 'maximized') {
      const updated: WindowState = { ...current, mode: 'normal', geometry: cloneGeometry(current.restoreGeometry ?? current.geometry), restoreGeometry: null, snap: null }
      this.windows = focusWithinLayer(this.windows, updated); this.setActiveLifecycle(instanceId); this.emit('restore', origin, instanceId); return this.get(instanceId)
    }
    this.getLifecycle(instanceId).restore(); const restoredMode: WindowMode = current.restoreGeometry && !current.snap ? 'maximized' : 'normal'; const restored = { ...current, mode: restoredMode }
    this.windows = focusWithinLayer(this.windows, restored); this.setActiveLifecycle(instanceId); this.emit('restore', origin, instanceId); return this.get(instanceId)
  }

  maximizeWindow(instanceId: WindowInstanceId, container: WindowSize, origin: WindowOperationOrigin = 'user'): WindowState {
    const current = this.windows.find((window) => window.instanceId === instanceId); if (!current) throw new UnknownWindowInstanceError(instanceId); if (current.layoutLocked && origin === 'user') throw new WindowLayoutLockedError(instanceId, 'maximizing'); if (!current.options.maximizable) return cloneWindow(current)
    const floating = current.mode === 'maximized' ? current.restoreGeometry ?? current.geometry : current.snap?.floatingGeometry ?? current.restoreGeometry ?? current.geometry
    const floatingGeometry = normalizeWindowGeometry(floating, current.constraints, container)
    const updated: WindowState = { ...current, mode: 'maximized', geometry: maximizeWindowGeometry(container), snap: null, restoreGeometry: cloneGeometry(floatingGeometry) }
    this.windows = focusWithinLayer(this.windows, updated); this.setActiveLifecycle(instanceId); this.emit('maximize', origin, instanceId); return this.get(instanceId)
  }

  close(instanceId: WindowInstanceId, origin: WindowOperationOrigin = 'api'): void { const index = this.windows.findIndex((window) => window.instanceId === instanceId); if (index < 0) throw new UnknownWindowInstanceError(instanceId); const lifecycle = this.getLifecycle(instanceId); lifecycle.close(); const current = this.windows[index], remaining = this.windows.filter((window) => window.instanceId !== instanceId), nextFocusedId = current?.focused ? topVisibleWindowId(remaining) : remaining.find((window) => window.focused && window.mode !== 'minimized')?.instanceId; this.windows = stackWindows(remaining, nextFocusedId); this.setActiveLifecycle(nextFocusedId); this.emit('close', origin, instanceId); if (!lifecycle.mounted) lifecycle.destroy() }
  setRootPane(instanceId: WindowInstanceId, pane: PaneNode, origin: WindowOperationOrigin = 'api'): WindowState { const current = this.windows.find((window) => window.instanceId === instanceId); if (!current) throw new UnknownWindowInstanceError(instanceId); const updated: WindowState = { ...current, rootPane: normalizePane(this.registry, pane) }; this.windows = this.windows.map((window) => window.instanceId === instanceId ? updated : window); this.emit('pane', origin, instanceId); return cloneWindow(updated) }
  replaceLauncherWindow(instanceId: WindowInstanceId, request: ReplaceLauncherWindowRequest, origin: WindowOperationOrigin = 'user'): WindowState {
    const current = this.windows.find((window) => window.instanceId === instanceId)
    if (!current) throw new UnknownWindowInstanceError(instanceId)
    if (!isCommandLauncherPane(current.rootPane)) throw new Error(`window "${instanceId}" does not contain a command launcher`)

    const resolved = this.registry.resolve(request.widgetId, request.parameters ?? {})
    const manifestWindow = resolved.manifest.window
    const constraints: WindowSizeConstraints = {
      minSize: cloneSize(manifestWindow?.minSize ?? current.constraints.minSize),
      maxSize: manifestWindow?.maxSize ? cloneSize(manifestWindow.maxSize) : current.constraints.maxSize ? cloneSize(current.constraints.maxSize) : null,
    }
    const pane = createWidgetPane({ id: current.rootPane.id, widgetId: request.widgetId, instanceId: `${instanceId}.widget`, parameters: paneParameters(resolved.parameters) })
    const geometry: WindowGeometry = { position: { ...current.geometry.position }, size: constrainSize(current.geometry.size, constraints) }
    const restoreGeometry = current.restoreGeometry ? { position: { ...current.restoreGeometry.position }, size: constrainSize(current.restoreGeometry.size, constraints) } : null
    const snap = current.snap ? { zone: current.snap.zone, floatingGeometry: { position: { ...current.snap.floatingGeometry.position }, size: constrainSize(current.snap.floatingGeometry.size, constraints) } } : null
    const updated: WindowState = { ...current, title: current.titleIsCustom ? current.title : resolved.manifest.title, rootPane: pane, constraints, geometry, restoreGeometry, snap }
    this.windows = this.windows.map((window) => window.instanceId === instanceId ? updated : window)
    this.emit('pane', origin, instanceId)
    return cloneWindow(updated)
  }
  replaceLauncher(instanceId: WindowInstanceId, request: ReplaceLauncherWindowRequest, origin: WindowOperationOrigin = 'user'): WindowState { return this.replaceLauncherWindow(instanceId, request, origin) }
  setOptions(instanceId: WindowInstanceId, override: WindowOptionsOverride, origin: WindowOperationOrigin = 'api'): WindowState { const current = this.windows.find((window) => window.instanceId === instanceId); if (!current) throw new UnknownWindowInstanceError(instanceId); const updated: WindowState = { ...current, options: createWindowOptions({ ...current.options, ...override }) }, replaced = this.windows.map((window) => window.instanceId === instanceId ? updated : window); this.windows = updated.focused ? focusWithinLayer(replaced, updated) : stackWindows(replaced); this.emit('options', origin, instanceId); return this.get(instanceId) }

  snapWindow(instanceId: WindowInstanceId, zone: WindowSnapZone, container: WindowSize, origin: WindowOperationOrigin = 'user'): WindowState {
    const current = this.windows.find((window) => window.instanceId === instanceId); if (!current) throw new UnknownWindowInstanceError(instanceId); if (current.layoutLocked && origin === 'user') throw new WindowLayoutLockedError(instanceId, 'snapping')
    const floating = current.mode === 'maximized' ? current.restoreGeometry ?? current.geometry : current.snap?.floatingGeometry ?? current.restoreGeometry ?? current.geometry
    const floatingGeometry = normalizeWindowGeometry(floating, current.constraints, container)
    const updated: WindowState = { ...current, mode: 'normal', geometry: snapWindowGeometry(zone, container), snap: { zone, floatingGeometry: cloneGeometry(floatingGeometry) }, restoreGeometry: null }
    this.windows = focusWithinLayer(this.windows, updated); this.setActiveLifecycle(instanceId); this.emit('snap', origin, instanceId); return this.get(instanceId)
  }
  unsnapWindow(instanceId: WindowInstanceId, pointer?: WindowPosition, container?: WindowSize, origin: WindowOperationOrigin = 'user'): WindowState {
    const current = this.windows.find((window) => window.instanceId === instanceId); if (!current) throw new UnknownWindowInstanceError(instanceId); if (current.layoutLocked && origin === 'user') throw new WindowLayoutLockedError(instanceId, 'unsnapping'); if (!current.snap) return cloneWindow(current)
    const restored = pointer && container ? restoreFloatingWindowGeometry(current.snap.floatingGeometry, pointer, container) : cloneGeometry(current.snap.floatingGeometry)
    const geometry = container ? normalizeWindowGeometry(restored, current.constraints, container) : restored
    const updated: WindowState = { ...current, geometry, snap: null, restoreGeometry: null, mode: 'normal' }
    this.windows = this.windows.map((window) => window.instanceId === instanceId ? updated : window); this.emit('snap', origin, instanceId); return cloneWindow(updated)
  }
  setGeometry(instanceId: WindowInstanceId, geometry: WindowGeometry, origin: WindowOperationOrigin = 'api'): WindowState { const current = this.windows.find((window) => window.instanceId === instanceId); if (!current) throw new UnknownWindowInstanceError(instanceId); if (current.layoutLocked && origin === 'user') throw new WindowLayoutLockedError(instanceId, 'changing geometry'); const normalized: WindowGeometry = { position: { x: Number.isFinite(geometry.position.x) ? geometry.position.x : current.geometry.position.x, y: Number.isFinite(geometry.position.y) ? geometry.position.y : current.geometry.position.y }, size: constrainSize(geometry.size, current.constraints) }; if (sameGeometry(current.geometry, normalized)) return cloneWindow(current); const updated: WindowState = { ...current, geometry: normalized }; this.windows = this.windows.map((window) => window.instanceId === instanceId ? updated : window); this.emit('geometry', origin, instanceId); return cloneWindow(updated) }
  lockWindow(instanceId: WindowInstanceId, origin: WindowOperationOrigin = 'user'): WindowState { const current = this.windows.find((window) => window.instanceId === instanceId); if (!current) throw new UnknownWindowInstanceError(instanceId); if (current.layoutLocked) return cloneWindow(current); if (current.mode !== 'normal') throw new WindowLayoutLockedError(instanceId, 'locking a non-normal window'); const updated: WindowState = { ...current, layoutLocked: true }; this.windows = focusWithinLayer(this.windows, updated); this.emit('lock', origin, instanceId); return this.get(instanceId) }
  unlockWindow(instanceId: WindowInstanceId, origin: WindowOperationOrigin = 'user'): WindowState { const current = this.windows.find((window) => window.instanceId === instanceId); if (!current) throw new UnknownWindowInstanceError(instanceId); if (!current.layoutLocked) return cloneWindow(current); const updated: WindowState = { ...current, layoutLocked: false }; this.windows = focusWithinLayer(this.windows, updated); this.emit('unlock', origin, instanceId); return this.get(instanceId) }
  constrainToContainer(instanceId: WindowInstanceId, container: WindowSize, origin: WindowOperationOrigin = 'api'): WindowState {
    const current = this.get(instanceId)
    if (current.layoutLocked) return current
    const geometry = current.mode === 'maximized'
      ? maximizeWindowGeometry(container)
      : current.snap
        ? snapWindowGeometry(current.snap.zone, container)
        : normalizeWindowGeometry(current.geometry, current.constraints, container)
    const restoreGeometry = current.restoreGeometry ? normalizeWindowGeometry(current.restoreGeometry, current.constraints, container) : null
    const snap = current.snap ? { zone: current.snap.zone, floatingGeometry: normalizeWindowGeometry(current.snap.floatingGeometry, current.constraints, container) } : null
    const unchanged = sameGeometry(current.geometry, geometry)
      && (current.restoreGeometry === null ? restoreGeometry === null : restoreGeometry !== null && sameGeometry(current.restoreGeometry, restoreGeometry))
      && (current.snap === null ? snap === null : snap !== null && sameGeometry(current.snap.floatingGeometry, snap.floatingGeometry))
    if (unchanged) return current
    const updated: WindowState = { ...current, geometry, restoreGeometry, snap }
    this.windows = this.windows.map((window) => window.instanceId === instanceId ? updated : window)
    this.emit('geometry', origin, instanceId)
    return cloneWindow(updated)
  }
  subscribe(listener: WindowManagerListener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  snapshot(): { windows: readonly WindowState[] } { return { windows: this.list() } }

  private openPaneState(request: { pane: PaneNode; instanceId: WindowInstanceId; title: string; titleIsCustom: boolean; options: WindowOptions; snap: WindowSnapState | null; restoreGeometry: WindowGeometry | null; layoutLocked: boolean; position?: WindowPosition | undefined; size?: WindowSize | undefined; minSize?: WindowSize | undefined; maxSize?: WindowSize | undefined; defaultSize?: WindowSize | undefined }, origin: WindowOperationOrigin): WindowState {
    if (this.windows.some((window) => window.instanceId === request.instanceId)) throw new DuplicateWindowInstanceError(request.instanceId)
    const constraints: WindowSizeConstraints = { minSize: cloneSize(request.minSize ?? DEFAULT_MIN_WINDOW_SIZE), maxSize: request.maxSize ? cloneSize(request.maxSize) : null }, size = constrainSize(request.size ?? request.defaultSize ?? DEFAULT_WINDOW_SIZE, constraints), cascade = 24 + this.windows.length * 24, position = request.position ?? { x: cascade, y: cascade }
    const opened: WindowState = { instanceId: request.instanceId, title: request.title, titleIsCustom: request.titleIsCustom, rootPane: clonePaneTree(request.pane), options: { ...request.options }, snap: request.snap ? { zone: request.snap.zone, floatingGeometry: cloneGeometry(request.snap.floatingGeometry) } : null, restoreGeometry: request.restoreGeometry ? cloneGeometry(request.restoreGeometry) : null, layoutLocked: request.layoutLocked, focused: true, zIndex: 0, mode: 'normal', geometry: { position: { x: Number.isFinite(position.x) ? position.x : cascade, y: Number.isFinite(position.y) ? position.y : cascade }, size }, constraints }
    this.createLifecycle(request.instanceId); this.windows = focusWithinLayer([...this.windows.map((window) => ({ ...window, focused: false })), opened], opened); this.setActiveLifecycle(request.instanceId); this.emit('open', origin, request.instanceId); return this.get(request.instanceId)
  }
  private createInstanceId(): WindowInstanceId { let instanceId: WindowInstanceId; do { this.nextInstanceNumber += 1; instanceId = `wf-window-${this.nextInstanceNumber}` } while (this.windows.some((window) => window.instanceId === instanceId)); return instanceId }
  private createLifecycle(instanceId: WindowInstanceId): WidgetLifecycleController { const lifecycle = createWidgetLifecycle(instanceId); let unsubscribe: () => void = () => {}; unsubscribe = lifecycle.subscribe((event) => { if (event.kind !== 'destroy') return; if (this.lifecycles.get(instanceId) === lifecycle) this.lifecycles.delete(instanceId); unsubscribe() }); this.lifecycles.set(instanceId, lifecycle); return lifecycle }
  private setActiveLifecycle(instanceId?: WindowInstanceId): void { for (const window of this.windows) { const lifecycle = this.lifecycles.get(window.instanceId); if (!lifecycle) continue; if (window.instanceId === instanceId && window.mode !== 'minimized') lifecycle.activate(); else lifecycle.deactivate() } }
  private emit(kind: WindowManagerChangeKind, origin: WindowOperationOrigin, instanceId: WindowInstanceId): void { const change: WindowManagerChange = { kind, origin, instanceId, windows: this.list() }; for (const listener of [...this.listeners]) listener(change) }
}

export function createWindowManager(registry: WidgetRegistry): WindowManager { return new WindowManager(registry) }
