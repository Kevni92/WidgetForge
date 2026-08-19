import type { WorkspaceLayoutCollectionSnapshot, WorkspaceLayoutStorage } from '../core/workspace-layouts'

export const DEFAULT_WORKSPACE_LAYOUT_STORAGE_KEY = 'widgetforge.workspace.layouts'

export function createLocalStorageWorkspaceLayoutStorage(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  key = DEFAULT_WORKSPACE_LAYOUT_STORAGE_KEY,
): WorkspaceLayoutStorage {
  if (!key.trim()) throw new Error('workspace layout storage key must not be empty')
  return {
    read(): unknown | null {
      const value = storage.getItem(key)
      return value === null ? null : JSON.parse(value) as unknown
    },
    write(snapshot: WorkspaceLayoutCollectionSnapshot): void {
      storage.setItem(key, JSON.stringify(snapshot))
    },
  }
}
