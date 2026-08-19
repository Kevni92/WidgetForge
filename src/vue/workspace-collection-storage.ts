import type { WorkspaceCollectionSnapshot, WorkspaceCollectionStorage } from '../core/workspace-collection'

export const DEFAULT_WORKSPACE_COLLECTION_STORAGE_KEY = 'widgetforge.workspaces'

export function createLocalStorageWorkspaceCollectionStorage(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  key = DEFAULT_WORKSPACE_COLLECTION_STORAGE_KEY,
): WorkspaceCollectionStorage {
  if (!key.trim()) throw new Error('workspace collection storage key must not be empty')
  return {
    read(): unknown | null {
      const value = storage.getItem(key)
      return value === null ? null : JSON.parse(value) as unknown
    },
    write(snapshot: WorkspaceCollectionSnapshot): void {
      storage.setItem(key, JSON.stringify(snapshot))
    },
  }
}
