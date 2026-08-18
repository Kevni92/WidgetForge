import type { WidgetId } from './widget'
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
export type WindowManagerChangeKind = 'open' | 'focus' | 'close' | 'geometry'

export interface WindowState {
  readonly instanceId: WindowInstanceId
  readonly widgetId: WidgetId
  readonly title: string
  readonly parameters: Readonly<Record<string, unknown>>
  readonly focused: boolean
  readonly zIndex: number
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

export class WindowManager {
  private windows: WindowState[] = []
  private readonly listeners = new Set<WindowManagerListener>()
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

  open(request: OpenWindowRequest, origin: WindowOperationOrigin = 'api'): WindowState {
    const resolved = this.registry.resolve(request.widgetId, request.parameters ?? {})
    const instanceId = request.instanceId ?? this.createInstanceId()

    if (this.windows.some((window) => window.instanceId === instanceId)) {
      throw new DuplicateWindowInstanceError(instanceId)
    }

    const manifestWindow = resolved.manifest.window
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
      geometry: {
        position: {
          x: Number.isFinite(position.x) ? position.x : cascade,
          y: Number.isFinite(position.y) ? position.y : cascade,
        },
        size,
      },
      constraints,
    }

    this.windows = [...unfocused, opened]
    this.emit('open', origin, instanceId)
    return cloneWindow(opened)
  }

  focus(instanceId: WindowInstanceId, origin: WindowOperationOrigin = 'api'): WindowState {
    const index = this.windows.findIndex((window) => window.instanceId === instanceId)
    if (index < 0) throw new UnknownWindowInstanceError(instanceId)

    const focusedWindow = this.windows[index]
    if (!focusedWindow) throw new UnknownWindowInstanceError(instanceId)

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

  close(instanceId: WindowInstanceId, origin: WindowOperationOrigin = 'api'): void {
    const index = this.windows.findIndex((window) => window.instanceId === instanceId)
    if (index < 0) throw new UnknownWindowInstanceError(instanceId)

    const wasFocused = this.windows[index]?.focused ?? false
    const remaining = this.windows.filter((window) => window.instanceId !== instanceId)
    const nextFocusedId = wasFocused ? remaining.at(-1)?.instanceId : remaining.find((window) => window.focused)?.instanceId

    this.windows = remaining.map((window, zIndex) => ({
      ...window,
      focused: window.instanceId === nextFocusedId,
      zIndex,
    }))

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
