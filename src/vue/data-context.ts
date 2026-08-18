import { inject, onUnmounted, provide, type InjectionKey } from 'vue'
import type { DataClient, DataKey, DataStateRef } from '../data/data-client'

const dataClientKey: InjectionKey<DataClient> = Symbol('WidgetForgeDataClient')

export class DataClientUnavailableError extends Error {
  constructor() {
    super('WidgetForge data client is not available in the current Vue context')
    this.name = 'DataClientUnavailableError'
  }
}

export function provideDataClient(client: DataClient): void {
  provide(dataClientKey, client)
}

export function useDataClient(): DataClient {
  const client = inject(dataClientKey)
  if (!client) throw new DataClientUnavailableError()
  return client
}

export function useData<T>(key: DataKey<T>): DataStateRef<T> {
  const handle = useDataClient().acquire(key)
  onUnmounted(handle.release)
  return handle.state
}
