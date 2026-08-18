import type { WidgetId } from './widget'
import {
  DuplicateWindowInstanceError,
  type WindowManager,
  type WindowMode,
  type WindowState,
} from './window-manager'
import type { WindowGeometry } from './window-geometry'
import { UnknownWidgetError, WidgetParameterValidationError } from './widget-registry'

export const WORKSPACE_VERSION = 1 as const

export type WorkspaceParameterValue = string | number | boolean
export type WorkspaceParameters = Readonly<Record<string, WorkspaceParameterValue>>

export interface WorkspaceWindowSnapshot {
  readonly instanceId: string
  readonly widgetId: WidgetId
  readonly parameters: WorkspaceParameters
  readonly geometry: WindowGeometry
  readonly mode: WindowMode
  readonly focused: boolean
  readonly zIndex: number
}

export interface WorkspaceSnapshot {
  readonly version: typeof WORKSPACE_VERSION
  readonly windows: readonly WorkspaceWindowSnapshot[]
}

export type WorkspaceRestoreIssueCode =
  | 'invalid-workspace'
  | 'unsupported-version'
  | 'manager-not-empty'
  | 'invalid-window'
  | 'duplicate-instance'
  | 'unknown-widget'
  | 'invalid-parameters'
  | 'singleton-conflict'
  | 'open-failed'

export interface WorkspaceRestoreIssue {
  readonly code: WorkspaceRestoreIssueCode
  readonly message: string
  readonly index?: number
  readonly instanceId?: string
  readonly widgetId?: WidgetId
}

export interface WorkspaceRestoreResult {
  readonly valid: boolean
  readonly restored: readonly WindowState[]
  readonly issues: readonly WorkspaceRestoreIssue[]
}

export class WorkspaceSerializationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkspaceSerializationError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function cloneWorkspaceParameters(parameters: Readonly<Record<string, unknown>>): Record<string, WorkspaceParameterValue> {
  const cloned: Record<string, WorkspaceParameterValue> = {}

  for (const [key, value] of Object.entries(parameters)) {
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      throw new WorkspaceSerializationError(`parameter "${key}" is not workspace-serializable`)
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new WorkspaceSerializationError(`parameter "${key}" must be a finite number`)
    }
    cloned[key] = value
  }

  return cloned
}

function cloneGeometry(geometry: WindowGeometry): WindowGeometry {
  return {
    position: { ...geometry.position },
    size: { ...geometry.size },
  }
}

export function captureWorkspace(manager: WindowManager): WorkspaceSnapshot {
  const windows = manager.list()
    .slice()
    .sort((left, right) => left.zIndex - right.zIndex)
    .map((window) => ({
      instanceId: window.instanceId,
      widgetId: window.widgetId,
      parameters: cloneWorkspaceParameters(window.parameters),
      geometry: cloneGeometry(window.geometry),
      mode: window.mode,
      focused: window.focused,
      zIndex: window.zIndex,
    }))

  return { version: WORKSPACE_VERSION, windows }
}

export function serializeWorkspace(manager: WindowManager): string {
  return JSON.stringify(captureWorkspace(manager))
}

function invalidRoot(code: WorkspaceRestoreIssueCode, message: string): WorkspaceRestoreResult {
  return {
    valid: false,
    restored: [],
    issues: [{ code, message }],
  }
}

function parseInput(input: unknown): unknown {
  if (typeof input !== 'string') return input

  try {
    return JSON.parse(input) as unknown
  } catch {
    return undefined
  }
}

function readParameters(value: unknown): Record<string, WorkspaceParameterValue> | null {
  if (!isRecord(value)) return null
  const parameters: Record<string, WorkspaceParameterValue> = {}

  for (const [key, candidate] of Object.entries(value)) {
    if (typeof candidate !== 'string' && typeof candidate !== 'number' && typeof candidate !== 'boolean') return null
    if (typeof candidate === 'number' && !Number.isFinite(candidate)) return null
    parameters[key] = candidate
  }

  return parameters
}

function readGeometry(value: unknown): WindowGeometry | null {
  if (!isRecord(value) || !isRecord(value.position) || !isRecord(value.size)) return null

  const { x, y } = value.position
  const { width, height } = value.size
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(width) || !isFiniteNumber(height)) return null
  if (width <= 0 || height <= 0) return null

  return {
    position: { x, y },
    size: { width, height },
  }
}

function readWindow(value: unknown): WorkspaceWindowSnapshot | null {
  if (!isRecord(value)) return null
  if (typeof value.instanceId !== 'string' || !value.instanceId.trim()) return null
  if (typeof value.widgetId !== 'string' || !value.widgetId.trim()) return null
  if (value.mode !== 'normal' && value.mode !== 'minimized') return null
  if (typeof value.focused !== 'boolean') return null
  if (!Number.isInteger(value.zIndex) || (value.zIndex as number) < 0) return null

  const parameters = readParameters(value.parameters)
  const geometry = readGeometry(value.geometry)
  if (!parameters || !geometry) return null

  return {
    instanceId: value.instanceId,
    widgetId: value.widgetId,
    parameters,
    geometry,
    mode: value.mode,
    focused: value.focused,
    zIndex: value.zIndex as number,
  }
}

function restoreIssue(
  code: WorkspaceRestoreIssueCode,
  message: string,
  entry: WorkspaceWindowSnapshot | null,
  index: number,
): WorkspaceRestoreIssue {
  return {
    code,
    message,
    index,
    ...(entry ? { instanceId: entry.instanceId, widgetId: entry.widgetId } : {}),
  }
}

export function restoreWorkspace(manager: WindowManager, input: unknown): WorkspaceRestoreResult {
  if (manager.list().length > 0) {
    return invalidRoot('manager-not-empty', 'workspace restore requires an empty WindowManager')
  }

  const parsed = parseInput(input)
  if (!isRecord(parsed)) return invalidRoot('invalid-workspace', 'workspace must be a valid object or JSON document')
  if (parsed.version !== WORKSPACE_VERSION) {
    return invalidRoot('unsupported-version', `unsupported workspace version "${String(parsed.version)}"`)
  }
  if (!Array.isArray(parsed.windows)) return invalidRoot('invalid-workspace', 'workspace windows must be an array')

  const issues: WorkspaceRestoreIssue[] = []
  const candidates: Array<{ entry: WorkspaceWindowSnapshot; index: number }> = []

  parsed.windows.forEach((value, index) => {
    const entry = readWindow(value)
    if (!entry) {
      issues.push(restoreIssue('invalid-window', 'invalid workspace window entry', null, index))
      return
    }
    candidates.push({ entry, index })
  })

  candidates.sort((left, right) => left.entry.zIndex - right.entry.zIndex || left.index - right.index)

  const seenInstanceIds = new Set<string>()
  const openedIds = new Set<string>()

  for (const { entry, index } of candidates) {
    if (seenInstanceIds.has(entry.instanceId)) {
      issues.push(restoreIssue('duplicate-instance', 'duplicate workspace instance id', entry, index))
      continue
    }
    seenInstanceIds.add(entry.instanceId)

    try {
      const opened = manager.open({
        widgetId: entry.widgetId,
        instanceId: entry.instanceId,
        parameters: entry.parameters,
        position: entry.geometry.position,
        size: entry.geometry.size,
      })

      if (opened.instanceId !== entry.instanceId) {
        issues.push(restoreIssue('singleton-conflict', 'singleton widget was already restored', entry, index))
        continue
      }

      openedIds.add(entry.instanceId)
    } catch (error) {
      if (error instanceof UnknownWidgetError) {
        issues.push(restoreIssue('unknown-widget', error.message, entry, index))
      } else if (error instanceof WidgetParameterValidationError) {
        issues.push(restoreIssue('invalid-parameters', error.message, entry, index))
      } else if (error instanceof DuplicateWindowInstanceError) {
        issues.push(restoreIssue('duplicate-instance', error.message, entry, index))
      } else {
        issues.push(restoreIssue('open-failed', error instanceof Error ? error.message : 'window restore failed', entry, index))
      }
    }
  }

  for (const { entry } of candidates) {
    if (!openedIds.has(entry.instanceId) || entry.mode !== 'minimized') continue
    manager.minimize(entry.instanceId)
  }

  const focused = candidates.find(({ entry }) => openedIds.has(entry.instanceId) && entry.focused && entry.mode === 'normal')
  if (focused) manager.focus(focused.entry.instanceId)

  return {
    valid: true,
    restored: manager.list(),
    issues,
  }
}
