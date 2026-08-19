import { describe, expect, it } from 'vitest'
import { createLocalStorageWorkspaceLayoutStorage } from '../src/vue/workspace-layout-storage'
import type { WorkspaceLayoutCollectionSnapshot } from '../src/core/workspace-layouts'

class FakeStorage {
  readonly values = new Map<string, string>()
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  setItem(key: string, value: string): void { this.values.set(key, value) }
}

describe('createLocalStorageWorkspaceLayoutStorage', () => {
  it('serializes and parses collections through an explicit Storage-like backend', () => {
    const storage = new FakeStorage()
    const adapter = createLocalStorageWorkspaceLayoutStorage(storage, 'test.layouts')
    const snapshot: WorkspaceLayoutCollectionSnapshot = { version: 1, defaultLayout: null, layouts: [] }
    adapter.write(snapshot)
    expect(storage.values.get('test.layouts')).toBe(JSON.stringify(snapshot))
    expect(adapter.read()).toEqual(snapshot)
  })

  it('returns null for missing data and exposes malformed JSON to the manager as a storage failure', () => {
    const storage = new FakeStorage()
    const adapter = createLocalStorageWorkspaceLayoutStorage(storage, 'test.layouts')
    expect(adapter.read()).toBeNull()
    storage.values.set('test.layouts', '{broken')
    expect(() => adapter.read()).toThrow(SyntaxError)
  })

  it('rejects an empty storage key', () => {
    expect(() => createLocalStorageWorkspaceLayoutStorage(new FakeStorage(), '  ')).toThrow('storage key must not be empty')
  })
})
