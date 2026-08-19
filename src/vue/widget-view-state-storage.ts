import type { WidgetViewStateSnapshot, WidgetViewStateStorage } from '../core/widget-view-state'

export const DEFAULT_WIDGET_VIEW_STATE_STORAGE_KEY = 'widgetforge.widget-view-state.v1'

export function createLocalStorageWidgetViewStateStorage(storage: Storage, key = DEFAULT_WIDGET_VIEW_STATE_STORAGE_KEY): WidgetViewStateStorage {
  return {
    read(): unknown {
      const value = storage.getItem(key)
      return value === null ? null : JSON.parse(value) as unknown
    },
    write(snapshot: WidgetViewStateSnapshot): void { storage.setItem(key, JSON.stringify(snapshot)) },
  }
}
