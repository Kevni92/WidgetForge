import { shallowRef, type ShallowRef } from 'vue'
import type { WidgetId } from './widget'

export type WidgetViewStatePrimitive = string | number | boolean | null
export type WidgetViewStateValue = WidgetViewStatePrimitive | readonly WidgetViewStateValue[] | { readonly [key: string]: WidgetViewStateValue }

export interface WidgetViewStateDefinition<TState extends WidgetViewStateValue = WidgetViewStateValue> {
  readonly version: number
  readonly defaultState: TState
  readonly validate?: (value: unknown) => value is TState
  readonly migrate?: (value: unknown, fromVersion: number) => unknown
}

export interface WidgetViewStateSnapshotEntry {
  readonly scopeId: string
  readonly instanceId: string
  readonly widgetId: WidgetId
  readonly version: number
  readonly state: WidgetViewStateValue
}

export interface WidgetViewStateSnapshot {
  readonly version: 1
  readonly entries: readonly WidgetViewStateSnapshotEntry[]
}

export interface WidgetViewStateStorage {
  read(): unknown
  write(snapshot: WidgetViewStateSnapshot): void
}

export interface WidgetViewStateHandle<TState extends WidgetViewStateValue = WidgetViewStateValue> {
  readonly state: Readonly<ShallowRef<TState>>
  replace(next: TState): void
  update(updater: (current: TState) => TState): void
  reset(): void
}

interface BoundEntry {
  readonly scopeId: string
  readonly instanceId: string
  readonly widgetId: WidgetId
  readonly version: number
  readonly state: ShallowRef<WidgetViewStateValue>
}

export class WidgetViewStateError extends Error {
  constructor(message: string) { super(message); this.name = 'WidgetViewStateError' }
}

function key(scopeId: string, instanceId: string): string { return JSON.stringify([scopeId, instanceId]) }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }

export function isWidgetViewStateValue(value: unknown, seen = new Set<object>()): value is WidgetViewStateValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'object') return false
  if (seen.has(value)) return false
  seen.add(value)
  if (Array.isArray(value)) return value.every((entry) => isWidgetViewStateValue(entry, seen))
  if (Object.getPrototypeOf(value) !== Object.prototype) return false
  return Object.values(value as Record<string, unknown>).every((entry) => isWidgetViewStateValue(entry, seen))
}

function clone<T extends WidgetViewStateValue>(value: T): T {
  if (!isWidgetViewStateValue(value)) throw new WidgetViewStateError('widget view state must be JSON-serializable and contain only finite numbers')
  return JSON.parse(JSON.stringify(value)) as T
}

export function validateWidgetViewStateDefinition(definition: WidgetViewStateDefinition): void {
  if (!Number.isInteger(definition.version) || definition.version < 1) throw new WidgetViewStateError('widget view state version must be a positive integer')
  clone(definition.defaultState)
  if (definition.validate && !definition.validate(clone(definition.defaultState))) throw new WidgetViewStateError('widget view state defaultState does not satisfy its validator')
}

function readSnapshot(input: unknown): readonly WidgetViewStateSnapshotEntry[] {
  if (!isRecord(input) || input.version !== 1 || !Array.isArray(input.entries)) return []
  const entries: WidgetViewStateSnapshotEntry[] = []
  for (const candidate of input.entries) {
    if (!isRecord(candidate) || typeof candidate.scopeId !== 'string' || !candidate.scopeId || typeof candidate.instanceId !== 'string' || !candidate.instanceId || typeof candidate.widgetId !== 'string' || !candidate.widgetId || !Number.isInteger(candidate.version) || (candidate.version as number) < 1 || !isWidgetViewStateValue(candidate.state)) continue
    entries.push({ scopeId: candidate.scopeId, instanceId: candidate.instanceId, widgetId: candidate.widgetId, version: candidate.version as number, state: clone(candidate.state) })
  }
  return entries
}

export class WidgetViewStateStore {
  private readonly bound = new Map<string, BoundEntry>()
  private readonly persisted = new Map<string, WidgetViewStateSnapshotEntry>()

  constructor(private readonly storage?: WidgetViewStateStorage) {
    if (!storage) return
    let input: unknown
    try { input = storage.read() } catch { return }
    for (const entry of readSnapshot(input)) this.persisted.set(key(entry.scopeId, entry.instanceId), entry)
  }

  bind<TState extends WidgetViewStateValue>(scopeId: string, instanceId: string, widgetId: WidgetId, definition: WidgetViewStateDefinition<TState>): WidgetViewStateHandle<TState> {
    const normalizedScope = scopeId.trim() || 'default'
    if (!instanceId.trim()) throw new WidgetViewStateError('widget view state instanceId must not be empty')
    validateWidgetViewStateDefinition(definition)
    const entryKey = key(normalizedScope, instanceId)
    let entry = this.bound.get(entryKey)
    if (entry && entry.widgetId !== widgetId) throw new WidgetViewStateError(`widget view state instance "${instanceId}" is already bound to "${entry.widgetId}"`)
    if (!entry) {
      const stored = this.persisted.get(entryKey)
      let initial: TState = clone(definition.defaultState)
      if (stored?.widgetId === widgetId) {
        let candidate: unknown = stored.state
        if (stored.version !== definition.version && definition.migrate) {
          try { candidate = definition.migrate(clone(stored.state), stored.version) } catch { candidate = undefined }
        }
        if ((stored.version === definition.version || definition.migrate) && isWidgetViewStateValue(candidate) && (!definition.validate || definition.validate(candidate))) initial = clone(candidate as TState)
      }
      entry = { scopeId: normalizedScope, instanceId, widgetId, version: definition.version, state: shallowRef<WidgetViewStateValue>(initial) }
      this.bound.set(entryKey, entry)
      this.persistEntry(entry)
    }
    const bound = entry
    const replace = (next: TState): void => {
      const value = clone(next)
      if (definition.validate && !definition.validate(value)) throw new WidgetViewStateError('widget view state update does not satisfy its validator')
      bound.state.value = value
      this.persistEntry(bound)
    }
    return {
      state: bound.state as ShallowRef<TState>,
      replace,
      update: (updater) => replace(updater(clone(bound.state.value as TState))),
      reset: () => replace(clone(definition.defaultState)),
    }
  }

  remove(scopeId: string, instanceId: string): void {
    const entryKey = key(scopeId.trim() || 'default', instanceId)
    this.bound.delete(entryKey); this.persisted.delete(entryKey); this.persist()
  }

  snapshot(): WidgetViewStateSnapshot {
    const entries = [...this.persisted.values()].map((entry) => ({ ...entry, state: clone(entry.state) })).sort((a, b) => a.scopeId.localeCompare(b.scopeId) || a.instanceId.localeCompare(b.instanceId))
    return { version: 1, entries }
  }

  private persistEntry(entry: BoundEntry): void {
    this.persisted.set(key(entry.scopeId, entry.instanceId), { scopeId: entry.scopeId, instanceId: entry.instanceId, widgetId: entry.widgetId, version: entry.version, state: clone(entry.state.value) })
    this.persist()
  }

  private persist(): void { if (!this.storage) return; this.storage.write(this.snapshot()) }
}

export function createWidgetViewStateStore(storage?: WidgetViewStateStorage): WidgetViewStateStore { return new WidgetViewStateStore(storage) }
