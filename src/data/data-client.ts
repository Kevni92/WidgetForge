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

export class InvalidDataKeyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidDataKeyError'
  }
}

export class DataClient {
  constructor(private readonly provider: DataProvider) {}

  acquire<T>(key: DataKey<T>): DataHandle<T> {
    const normalizedKey = createDataKey<T>(key.kind, key.id)
    const state = shallowRef<DataState<T>>({ status: 'loading', data: null, error: null })
    let active = true
    let unsubscribe: DataUnsubscribe = () => {}

    const observer: DataObserver<T> = {
      loading: () => {
        if (!active) return
        state.value = { status: 'loading', data: null, error: null }
      },
      next: (value) => {
        if (!active) return
        state.value = { status: 'ready', data: value, error: null }
      },
      error: (error) => {
        if (!active) return
        const previous = state.value.status === 'ready' || state.value.status === 'error' ? state.value.data : null
        state.value = {
          status: 'error',
          data: previous,
          error: error instanceof Error ? error : new Error(String(error)),
        }
      },
    }

    try {
      unsubscribe = this.provider.subscribe(normalizedKey, observer)
    } catch (error) {
      observer.error(error)
    }

    return {
      key: normalizedKey,
      state,
      release: () => {
        if (!active) return
        active = false
        unsubscribe()
      },
    }
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

export function createDataClient(provider: DataProvider): DataClient {
  return new DataClient(provider)
}
