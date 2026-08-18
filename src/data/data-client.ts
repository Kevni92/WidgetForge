import { shallowRef, type ShallowRef } from 'vue'

export interface DataKey<T = unknown> {
  readonly kind: string
  readonly id: string
  readonly __valueType?: T
}

export type DataState<T> =
  | { readonly status: 'loading'; readonly data: null; readonly error: null }
  | { readonly status: 'ready'; readonly data: T; readonly error: null }
  | { readonly status: 'error'; readonly data: T | null; readonly error: Error }

export type DataStateRef<T> = Readonly<ShallowRef<DataState<T>>>

export interface DataObserver<T> {
  loading(): void
  next(value: T): void
  error(error: unknown): void
}

export type DataUnsubscribe = () => void

export interface DataProvider {
  subscribe<T>(key: DataKey<T>, observer: DataObserver<T>): DataUnsubscribe
}

export interface DataHandle<T> {
  readonly key: DataKey<T>
  readonly state: DataStateRef<T>
  release(): void
}

export interface DataClientOptions {
  readonly cacheTimeMs?: number
}

interface DataCacheEntry<T> {
  readonly key: DataKey<T>
  readonly state: ShallowRef<DataState<T>>
  consumers: number
  unsubscribe: DataUnsubscribe | null
  subscriptionVersion: number
  evictionTimer: ReturnType<typeof setTimeout> | null
}

export class InvalidDataKeyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidDataKeyError'
  }
}

export class DataClient {
  private readonly cache = new Map<string, DataCacheEntry<unknown>>()
  private readonly cacheTimeMs: number

  constructor(
    private readonly provider: DataProvider,
    options: DataClientOptions = {},
  ) {
    const cacheTimeMs = options.cacheTimeMs ?? 0
    if (!Number.isFinite(cacheTimeMs) || cacheTimeMs < 0) {
      throw new RangeError('data cacheTimeMs must be a finite non-negative number')
    }
    this.cacheTimeMs = cacheTimeMs
  }

  acquire<T>(key: DataKey<T>): DataHandle<T> {
    const normalizedKey = createDataKey<T>(key.kind, key.id)
    const cacheKey = dataKeyId(normalizedKey)
    let entry = this.cache.get(cacheKey) as DataCacheEntry<T> | undefined

    if (!entry) {
      entry = {
        key: normalizedKey,
        state: shallowRef<DataState<T>>({ status: 'loading', data: null, error: null }),
        consumers: 0,
        unsubscribe: null,
        subscriptionVersion: 0,
        evictionTimer: null,
      }
      this.cache.set(cacheKey, entry as DataCacheEntry<unknown>)
    }

    if (entry.evictionTimer) {
      clearTimeout(entry.evictionTimer)
      entry.evictionTimer = null
    }

    entry.consumers += 1
    if (entry.consumers === 1) this.subscribeEntry(entry)

    let active = true
    return {
      key: entry.key,
      state: entry.state,
      release: () => {
        if (!active) return
        active = false
        this.releaseEntry(cacheKey, entry)
      },
    }
  }

  private subscribeEntry<T>(entry: DataCacheEntry<T>): void {
    entry.subscriptionVersion += 1
    const version = entry.subscriptionVersion

    const isCurrent = (): boolean => entry.consumers > 0 && entry.subscriptionVersion === version
    const observer: DataObserver<T> = {
      loading: () => {
        if (!isCurrent()) return
        entry.state.value = { status: 'loading', data: null, error: null }
      },
      next: (value) => {
        if (!isCurrent()) return
        entry.state.value = { status: 'ready', data: value, error: null }
      },
      error: (error) => {
        if (!isCurrent()) return
        const previous = entry.state.value.status === 'ready' || entry.state.value.status === 'error'
          ? entry.state.value.data
          : null
        entry.state.value = {
          status: 'error',
          data: previous,
          error: error instanceof Error ? error : new Error(String(error)),
        }
      },
    }

    try {
      entry.unsubscribe = this.provider.subscribe(entry.key, observer)
    } catch (error) {
      entry.unsubscribe = null
      observer.error(error)
    }
  }

  private releaseEntry<T>(cacheKey: string, entry: DataCacheEntry<T>): void {
    entry.consumers = Math.max(0, entry.consumers - 1)
    if (entry.consumers > 0) return

    entry.subscriptionVersion += 1
    const unsubscribe = entry.unsubscribe
    entry.unsubscribe = null

    try {
      unsubscribe?.()
    } finally {
      this.scheduleEviction(cacheKey, entry)
    }
  }

  private scheduleEviction<T>(cacheKey: string, entry: DataCacheEntry<T>): void {
    if (this.cacheTimeMs === 0) {
      if (entry.consumers === 0) this.cache.delete(cacheKey)
      return
    }

    entry.evictionTimer = setTimeout(() => {
      entry.evictionTimer = null
      if (entry.consumers === 0 && this.cache.get(cacheKey) === entry) this.cache.delete(cacheKey)
    }, this.cacheTimeMs)
  }
}

export function createDataKey<T>(kind: string, id: string): DataKey<T> {
  const normalizedKind = kind.trim()
  const normalizedId = id.trim()
  if (!normalizedKind) throw new InvalidDataKeyError('data key kind must not be empty')
  if (!normalizedId) throw new InvalidDataKeyError('data key id must not be empty')
  return Object.freeze({ kind: normalizedKind, id: normalizedId })
}

export function dataKeyId(key: DataKey): string {
  return JSON.stringify([key.kind, key.id])
}

export function createDataClient(provider: DataProvider, options: DataClientOptions = {}): DataClient {
  return new DataClient(provider, options)
}
