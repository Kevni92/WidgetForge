import { getCurrentInstance, inject, markRaw, provide, type InjectionKey, type ShallowRef } from 'vue'
import { createSelectionStore, type SelectionKey, type SelectionStore } from '../core/selection'

export const selectionStoreKey: InjectionKey<SelectionStore> = Symbol('WidgetForgeSelectionStore')
const appSelectionStores = new WeakMap<object, SelectionStore>()

export class SelectionUnavailableError extends Error {
  constructor() { super('selection store is only available inside a Vue component setup context'); this.name = 'SelectionUnavailableError' }
}

export function provideSelectionStore(store: SelectionStore): void { provide(selectionStoreKey, store) }
export function useSelectionStore(): SelectionStore {
  const instance = getCurrentInstance()
  if (!instance) throw new SelectionUnavailableError()
  const injected = inject(selectionStoreKey, null)
  if (injected) return injected
  const appContext = instance.appContext
  let fallback = appSelectionStores.get(appContext)
  if (!fallback) {
    fallback = markRaw(createSelectionStore())
    appSelectionStores.set(appContext, fallback)
  }
  return fallback
}

export interface SelectionBinding<T> {
  readonly value: Readonly<ShallowRef<T | null>>
  select(value: T): void
  clear(): void
}

export function useSelection<T>(key: SelectionKey<T>): SelectionBinding<T> {
  const store = useSelectionStore()
  return { value: store.state(key), select: (value) => store.select(key, value), clear: () => store.clear(key) }
}
