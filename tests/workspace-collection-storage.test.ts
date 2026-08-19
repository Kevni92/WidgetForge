import { describe, expect, it } from 'vitest'
import { createLocalStorageWorkspaceCollectionStorage } from '../src/vue/workspace-collection-storage'
import type { WorkspaceCollectionSnapshot } from '../src/core/workspace-collection'

describe('workspace collection local storage adapter', () => {
  it('round-trips serializable workspace collections through an injected Storage-like backend', () => {
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
    const adapter = createLocalStorageWorkspaceCollectionStorage(storage, 'test.workspaces')
    const snapshot: WorkspaceCollectionSnapshot = { version: 1, activeWorkspaceId: 'main', workspaces: [{ id: 'main', name: 'Main', workspace: { version: 3, windows: [], docks: [] } }] }
    adapter.write(snapshot)
    expect(adapter.read()).toEqual(snapshot)
  })

  it('rejects empty storage keys', () => {
    const storage = { getItem: () => null, setItem: () => undefined }
    expect(() => createLocalStorageWorkspaceCollectionStorage(storage, '  ')).toThrow('workspace collection storage key must not be empty')
  })
})
