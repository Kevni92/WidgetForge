import { inject, provide, type InjectionKey } from 'vue'
import type { SelectionKey, SelectionStore } from '../core/selection'

export const selectionStoreKey: InjectionKey<SelectionStore> = Symbol('WidgetForgeSelectionStore')

export class SelectionUnavailableError extends Error {
  constructor() { super('selection store is not available in the current Vue tree'); this.name = 'SelectionUnavailableError' }
}

export function provideSelectionStore(store: SelectionStore): void { provide(selectionStoreKey, store) }
export function useSelectionStore(): SelectionStore {
  const store = inject(selectionStoreKey)
  if (!store) throw new SelectionUnavailableError()
  return store
}

export interface SelectionBinding<T> {
  readonly value: ReturnType<SelectionStore['state<T>']>
  select(value: T): void
  clear(): void
}

export function useSelection<T>(key: SelectionKey<T>): SelectionBinding<T> {
  const store = useSelectionStore()
  return { value: store.state(key), select: (value) => store.select(key, value), clear: () => store.clear(key) }
}
