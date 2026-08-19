import { shallowRef, type ShallowRef } from 'vue'

export interface SelectionKey<T = unknown> {
  readonly channel: string
  readonly scope: string
  readonly __valueType?: T
}

export interface SelectionChange<T = unknown> {
  readonly key: SelectionKey<T>
  readonly value: T | null
  readonly previous: T | null
}

export type SelectionListener = (change: SelectionChange) => void

export class SelectionDefinitionError extends Error {
  constructor(message: string) { super(message); this.name = 'SelectionDefinitionError' }
}

function normalizeName(value: string, label: string): string {
  const normalized = value.trim()
  if (!normalized) throw new SelectionDefinitionError(`${label} must not be empty`)
  return normalized
}

export function createSelectionKey<T>(channel: string, scope = 'global'): SelectionKey<T> {
  return Object.freeze({ channel: normalizeName(channel, 'selection channel'), scope: normalizeName(scope, 'selection scope') })
}

export function selectionKeyId(key: SelectionKey): string { return JSON.stringify([key.scope, key.channel]) }

export class SelectionStore {
  private readonly values = new Map<string, unknown>()
  private readonly refs = new Map<string, ShallowRef<unknown | null>>()
  private readonly keys = new Map<string, SelectionKey>()
  private readonly listeners = new Set<SelectionListener>()

  get<T>(key: SelectionKey<T>): T | null {
    const value = this.values.get(selectionKeyId(key))
    return value === undefined ? null : value as T
  }

  state<T>(key: SelectionKey<T>): Readonly<ShallowRef<T | null>> {
    const id = selectionKeyId(key)
    let state = this.refs.get(id)
    if (!state) {
      state = shallowRef<unknown | null>(this.values.has(id) ? this.values.get(id) ?? null : null)
      this.refs.set(id, state)
      this.keys.set(id, Object.freeze({ channel: key.channel, scope: key.scope }))
    }
    return state as ShallowRef<T | null>
  }

  select<T>(key: SelectionKey<T>, value: T): void {
    const id = selectionKeyId(key)
    const previous = this.get(key)
    if (Object.is(previous, value)) return
    this.values.set(id, value)
    this.keys.set(id, Object.freeze({ channel: key.channel, scope: key.scope }))
    const state = this.refs.get(id)
    if (state) state.value = value
    this.emit({ key, value, previous })
  }

  clear<T>(key: SelectionKey<T>): void {
    const id = selectionKeyId(key)
    const previous = this.get(key)
    if (previous === null && !this.values.has(id)) return
    this.values.delete(id)
    const state = this.refs.get(id)
    if (state) state.value = null
    this.emit({ key, value: null, previous })
  }

  subscribe(listener: SelectionListener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener) }

  private emit(change: SelectionChange): void { for (const listener of [...this.listeners]) listener(change) }
}

export function createSelectionStore(): SelectionStore { return new SelectionStore() }
