import type { WidgetId } from './widget'
import { createWidgetLifecycle, type WidgetLifecycle } from './widget-lifecycle'
import type { WidgetRegistry } from './widget-registry'
import {
  DEFAULT_MIN_WINDOW_SIZE,
  DEFAULT_WINDOW_SIZE,
  constrainGeometry,
  constrainSize,
  sameGeometry,
  type WindowGeometry,
  type WindowPosition,
  type WindowSize,
  type WindowSizeConstraints,
} from './window-geometry'

export type WindowInstanceId = string
export type WindowOperationOrigin = 'api' | 'user'
export type WindowMode = 'normal' | 'minimized'
export type WindowManagerChangeKind = 'open' | 'focus' | 'close' | 'geometry' | 'minimize' | 'restore'

export interface WindowState {
  readonly instanceId: WindowInstanceId
  readonly widgetId: WidgetId
  readonly title: string
  readonly parameters: Readonly<Record<string, unknown>>
  readonly focused: boolean
  readonly zIndex: number
  readonly mode: WindowMode
  readonly geometry: WindowGeometry
  readonly constraints: WindowSizeConstraints
}

export interface OpenWindowRequest {
  widgetId: WidgetId
  parameters?: Readonly<Record<string, unknown>>
  instanceId?: WindowInstanceId
  title?: string
  position?: WindowPosition
  size?: WindowSize
}

export interface WindowManagerChange {
  readonly kind: WindowManagerChangeKind
  readonly origin: WindowOperationOrigin
  readonly instanceId: WindowInstanceId
  readonly windows: readonly WindowState[]
}

export type WindowManagerListener = (change: WindowManagerChange) => void

export class DuplicateWindowInstanceError extends Error {
  constructor(public readonly instanceId: WindowInstanceId) {
    super(`window instance "${instanceId}" already exists`)
    this.name = 'DuplicateWindowInstanceError'
  }
}

export class UnknownWindowInstanceError extends Error {
  constructor(public readonly instanceId: WindowInstanceId) {
    super(`unknown window instance "${instanceId}"`)
    this.name = 'UnknownWindowInstanceError'
  }
}

function cloneSize(size: WindowSize): WindowSize {
  return { ...size }
}

function cloneWindow(window: WindowState): WindowState {
  return {
    ...window,
    parameters: { ...window.parameters },
    geometry: {
      position: { ...window.geometry.position },
      size: cloneSize(window.geometry.size),
    },
    constraints: {
      minSize: cloneSize(window.constraints.minSize),
      maxSize: window.constraints.maxSize ? cloneSize(window.constraints.maxSize) : null,
    },
  }
}

function topNormalWindowId(windows: readonly WindowState[]): WindowInstanceId | undefined {
  for (let index = windows.length - 1; index >= 0; index -= 1) {
    const candidate = windows[index]
    if (candidate?.mode === 'normal') return candidate.instanceId
  }
  return undefined
}

export class WindowManager {
  private windows: WindowState[] = []
  private readonly listeners = new Set<WindowManagerListener>()
  private readonly lifecycles = new Map<WindowInstanceId, WidgetLifecycle>()
  private nextInstanceNumber = 0

  constructor(private readonly registry: WidgetRegistry) {}

  list(): readonly WindowState[] {
    return this.windows.map(cloneWindow)
  }

  get(instanceId: WindowInstanceId): WindowState {
    const window = this.windows.find((candidate) => candidate.instanceId === instanceId)
    if (!window) throw new UnknownWindowInstanceError(instanceId)
    return cloneWindow(window)
  }

  getLifecycle(instanceId: WindowInstanceId): WidgetLifecycle {
    const lifecycle = this.lifecycles.get(instanceId)
    if (!lifecycle) throw new UnknownWindowInstanceError(instanceId)
    return lifecycle
  }

  open(request: OpenWindowRequest, origin: WindowOperationOrigin = 'api'): WindowState {
    const resolved = this.registry.resolve(request.widgetId, request.parameters ?? {})
    const manifestWindow = resolved.manifest.window

    if (manifestWindow?.singleton) {
      const existing = this.windows.find((window) => window.widgetId === request.widgetId)
      if (existing) {
        return existing.mode === 'minimized'
          ? this.restore(existing.instanceId, origin)
          : this.focus(existing.instanceId, origin)
      }
    }

    const instanceId = request.instanceId ?? this.createInstanceId()
    if (this.windows.some((window) => window.instanceId === instanceId)) {
      throw new DuplicateWindowInstanceError(instanceId)
    }

    const constraints: WindowSizeConstraints = {
      minSize: cloneSize(manifestWindow?.minSize ?? DEFAULT_MIN_WINDOW_SIZE),
      maxSize: manifestWindow?.maxSize ? cloneSize(manifestWindow.maxSize) : null,
    }
    const size = constrainSize(request.size ?? manifestWindow?.defaultSize ?? DEFAULT_WINDOW_SIZE, constraints)
    const cascade = 24 + this.windows.length * 24
    const position = request.position ?? { x: cascade, y: cascade }

    const unfocused = this.windows.map((window) => ({ ...window, focused: false }))
    const opened: WindowState = {
      instanceId,
      widgetId: request.widgetId,
      title: request.title ?? resolved.manifest.title,
      parameters: { ...resolved.parameters },
      focused: true,
      zIndex: unfocused.length,
      mode: 'normal',
      geometry: {
        position: {
          x: Number.isFinite(position.x) ? position.x : cascade,
          y: Number.isFinite(position.y) ? position.y : cascade,
        },
        size,
      },
      constraints,
    }

    this.lifecycles.set(instanceId, createWidgetLifecycle())
    this.windows = [...unfocused, opened]
    this.emit('open', origin, instanceId)
    return cloneWindow(opened)
  }

  focus(instanceId: WindowInstanceId, origin: WindowOperationOrigin = 'api'): WindowState {
    const index = this.windows.findIndex((window) => window.instanceId === instanceId)
    if (index < 0) throw new UnknownWindowInstanceError(instanceId)

    const focusedWindow = this.windows[index]
    if (!focusedWindow) throw new UnknownWindowInstanceError(instanceId)
    if (focusedWindow.mode === 'minimized') return this.restore(instanceId, origin)

    if (index === this.windows.length - 1 && focusedWindow.focused) {
      return cloneWindow(focusedWindow)
    }

    const reordered = this.windows.filter((window) => window.instanceId !== instanceId)
    reordered.push(focusedWindow)
    this.windows = reordered.map((window, zIndex) => ({
      ...window,
      focused: window.instanceId === instanceId,
      zIndex,
    }))

    this.emit('focus', origin, instanceId)
    return this.get(instanceId)
  }

  minimize(instanceId: WindowInstanceId, origin: WindowOperationOrigin = 'api'): WindowState {
    const index = this.windows.findIndex((window) => window.instanceId === instanceId)
    if (index < 0) throw new UnknownWindowInstanceError(instanceId)

    const current = this.windows[index]
    if (!current) throw new UnknownWindowInstanceError(instanceId)
    if (current.mode === 'minimized') return cloneWindow(current)

    const nextFocusedId = current.focused
      ? topNormalWindowId(this.windows.filter((window) => window.instanceId !== instanceId))
      : this.windows.find((window) => window.focused && window.mode === 'normal')?.instanceId

    this.windows = this.windows.map((window) => {
      if (window.instanceId === instanceId) return { ...window, mode: 'minimized' as const, focused: false }
      return { ...window, focused: window.instanceId === nextFocusedId }
    })

    this.getLifecycle(instanceId).transitionIfPossible('minimize')
    this.emit('minimize', origin, instanceId)
    return this.get(instanceId)
  }

  restore(instanceId: WindowInstanceId, origin: WindowOperationOrigin = 'api'): WindowState {
    const index = this.windows.findIndex((window) => window.instanceId === instanceId)
    if (index < 0) throw new UnknownWindowInstanceError(instanceId)

    const current = this.windows[index]
    if (!current) throw new UnknownWindowInstanceError(instanceId)
    if (current.mode === 'normal') return this.focus(instanceId, origin)

    const reordered = this.windows.filter((window) => window.instanceId !== instanceId)
    reordered.push({ ...current, mode: 'normal' })
    this.windows = reordered.map((window, zIndex) => ({
      ...window,
      focused: window.instanceId === instanceId,
      zIndex,
    }))

    this.getLifecycle(instanceId).transitionIfPossible('restore')
    this.emit('restore', origin, instanceId)
    return this.get(instanceId)
  }

  close(instanceId: WindowInstanceId, origin: WindowOperationOrigin = 'api'): void {
    const index = this.windows.findIndex((window) => window.instanceId === instanceId)
    if (index < 0) throw new UnknownWindowInstanceError(instanceId)

    const wasFocused = this.windows[index]?.focused ?? false
    const remaining = this.windows.filter((window) => window.instanceId !== instanceId)
    const nextFocusedId = wasFocused
      ? topNormalWindowId(remaining)
      : remaining.find((window) => window.focused && window.mode === 'normal')?.instanceId

    this.windows = remaining.map((window, zIndex) => ({
      ...window,
      focused: window.instanceId === nextFocusedId,
      zIndex,
    }))

    const lifecycle = this.getLifecycle(instanceId)
    lifecycle.transitionIfPossible('close')
    try {
      lifecycle.transitionIfPossible('destroy')
    } finally {
      this.lifecycles.delete(instanceId)
    }
    this.emit('close', origin, instanceId)
  }

  setGeometry(
    instanceId: WindowInstanceId,
    geometry: WindowGeometry,
    origin: WindowOperationOrigin = 'api',
  ): WindowState {
    const index = this.windows.findIndex((window) => window.instanceId === instanceId)
    if (index < 0) throw new UnknownWindowInstanceError(instanceId)

    const current = this.windows[index]
    if (!current) throw new UnknownWindowInstanceError(instanceId)

    const normalized: WindowGeometry = {
      position: {
        x: Number.isFinite(geometry.position.x) ? geometry.position.x : current.geometry.position.x,
        y: Number.isFinite(geometry.position.y) ? geometry.position.y : current.geometry.position.y,
      },
      size: constrainSize(geometry.size, current.constraints),
    }

    if (sameGeometry(current.geometry, normalized)) return cloneWindow(current)

    const updated: WindowState = { ...current, geometry: normalized }
    this.windows = this.windows.map((window) => window.instanceId === instanceId ? updated : window)
    this.emit('geometry', origin, instanceId)
    return cloneWindow(updated)
  }

  constrainToContainer(
    instanceId: WindowInstanceId,
    container: WindowSize,
    origin: WindowOperationOrigin = 'api',
  ): WindowState {
    const current = this.get(instanceId)
    return this.setGeometry(
      instanceId,
      constrainGeometry(current.geometry, current.constraints, container),
      origin,
    )
  }

  subscribe(listener: WindowManagerListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  snapshot(): { windows: readonly WindowState[] } {
    return { windows: this.list() }
  }

  private createInstanceId(): WindowInstanceId {
    this.nextInstanceNumber += 1
    return `wf-window-${this.nextInstanceNumber}`
  }

  private emit(kind: WindowManagerChangeKind, origin: WindowOperationOrigin, instanceId: WindowInstanceId): void {
    const change: WindowManagerChange = {
      kind,
      origin,
      instanceId,
      windows: this.list(),
    }
    for (const listener of [...this.listeners]) listener(change)
  }
}

export function createWindowManager(registry: WidgetRegistry): WindowManager {
  return new WindowManager(registry)
}
