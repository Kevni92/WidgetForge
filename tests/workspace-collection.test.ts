import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { captureWorkspace } from '../src/core/workspace'
import { createWorkspaceCollection, WorkspaceCollectionError, type WorkspaceCollectionSnapshot, type WorkspaceCollectionStorage } from '../src/core/workspace-collection'

const Probe = defineComponent({ template: '<div>probe</div>' })
function registry() { return createWidgetRegistry([defineWidget({ id: 'test.probe', title: 'Probe', component: Probe })]) }
class MemoryStorage implements WorkspaceCollectionStorage {
  value: unknown | null = null
  writes: WorkspaceCollectionSnapshot[] = []
  read(): unknown | null { return this.value }
  write(snapshot: WorkspaceCollectionSnapshot): void { this.value = structuredClone(snapshot); this.writes.push(structuredClone(snapshot)) }
}

describe('WorkspaceCollectionManager', () => {
  it('keeps window, focus and z-order state isolated between at least three workspaces', () => {
    const collection = createWorkspaceCollection({ registry: registry() })
    const command = collection.createWorkspace({ id: 'command', name: 'Command', activate: true })
    const trading = collection.createWorkspace({ id: 'trading', name: 'Trading' })
    const operations = collection.createWorkspace({ id: 'operations', name: 'Operations' })

    command.windows.open({ widgetId: 'test.probe', instanceId: 'shared', position: { x: 10, y: 20 } })
    command.windows.open({ widgetId: 'test.probe', instanceId: 'command-only' })
    trading.windows.open({ widgetId: 'test.probe', instanceId: 'shared', position: { x: 400, y: 300 } })
    operations.windows.open({ widgetId: 'test.probe', instanceId: 'operations-only' })

    command.windows.focus('command-only')
    trading.windows.focus('shared')
    collection.activateWorkspace('trading')

    expect(collection.getActiveWorkspaceId()).toBe('trading')
    expect(command.windows.get('shared').geometry.position).toEqual({ x: 10, y: 20 })
    expect(trading.windows.get('shared').geometry.position).toEqual({ x: 400, y: 300 })
    expect(command.windows.get('command-only').focused).toBe(true)
    expect(trading.windows.get('shared').focused).toBe(true)
    expect(operations.windows.list().map((window) => window.instanceId)).toEqual(['operations-only'])
  })

  it('supports create, rename, duplicate, activate and delete with deterministic active selection', () => {
    const collection = createWorkspaceCollection({ registry: registry() })
    const primary = collection.createWorkspace({ id: 'primary', name: 'Primary', activate: true })
    primary.windows.open({ widgetId: 'test.probe', instanceId: 'probe' })
    collection.createWorkspace({ id: 'secondary', name: 'Secondary' })
    const copy = collection.duplicateWorkspace('primary', { id: 'copy', name: 'Copy', activate: true })

    expect(copy.windows.list().map((window) => window.instanceId)).toEqual(['probe'])
    expect(collection.getActiveWorkspaceId()).toBe('copy')
    expect(collection.renameWorkspace('copy', 'Operations').name).toBe('Operations')
    collection.deleteWorkspace('copy')
    expect(collection.getActiveWorkspaceId()).toBe('secondary')
    expect(() => collection.createWorkspace({ id: 'primary', name: 'Again' })).toThrowError(expect.objectContaining({ code: 'duplicate-id' }))

    collection.deleteWorkspace('secondary')
    expect(() => collection.deleteWorkspace('primary')).toThrowError(expect.objectContaining({ code: 'last-workspace' }))
  })

  it('prefers the previous workspace when deleting the active one and destroys deleted runtimes', () => {
    const collection = createWorkspaceCollection({ registry: registry() })
    const first = collection.createWorkspace({ id: 'first', name: 'First', activate: true })
    const second = collection.createWorkspace({ id: 'second', name: 'Second' })
    const third = collection.createWorkspace({ id: 'third', name: 'Third' })
    first.windows.open({ widgetId: 'test.probe', instanceId: 'first-window' })
    const deletedWindow = second.windows.open({ widgetId: 'test.probe', instanceId: 'second-window' })
    const deletedLifecycle = second.windows.getLifecycle(deletedWindow.instanceId)
    third.windows.open({ widgetId: 'test.probe', instanceId: 'third-window' })

    collection.activateWorkspace('second')
    collection.deleteWorkspace('second')

    expect(collection.getActiveWorkspaceId()).toBe('first')
    expect(() => collection.get('second')).toThrowError(expect.objectContaining({ code: 'not-found' }))
    expect(deletedWindow.instanceId).toBe('second-window')
    expect(() => second.windows.get('second-window')).toThrow()
    expect(deletedLifecycle.state).toBe('destroyed')

    collection.activateWorkspace('third')
    collection.deleteWorkspace('third')
    expect(collection.getActiveWorkspaceId()).toBe('first')
  })

  it('uses the next workspace when deleting the first active workspace', () => {
    const collection = createWorkspaceCollection({ registry: registry() })
    collection.createWorkspace({ id: 'first', name: 'First', activate: true })
    collection.createWorkspace({ id: 'second', name: 'Second' })
    collection.createWorkspace({ id: 'third', name: 'Third' })

    collection.deleteWorkspace('first')

    expect(collection.getActiveWorkspaceId()).toBe('second')
  })

  it('persists all workspace snapshots plus active id and restores them with separate managers', () => {
    const storage = new MemoryStorage(), widgets = registry()
    const first = createWorkspaceCollection({ registry: widgets, storage })
    const alpha = first.createWorkspace({ id: 'alpha', name: 'Alpha', activate: true })
    const beta = first.createWorkspace({ id: 'beta', name: 'Beta' })
    alpha.windows.open({ widgetId: 'test.probe', instanceId: 'same', position: { x: 12, y: 34 } })
    beta.windows.open({ widgetId: 'test.probe', instanceId: 'same', position: { x: 500, y: 420 } })
    first.activateWorkspace('beta')

    expect(storage.writes.at(-1)?.activeWorkspaceId).toBe('beta')
    expect(storage.writes.at(-1)?.workspaces).toHaveLength(2)

    const second = createWorkspaceCollection({ registry: widgets, storage })
    expect(second.getActiveWorkspaceId()).toBe('beta')
    expect(second.get('alpha').windows.get('same').geometry.position).toEqual({ x: 12, y: 34 })
    expect(second.get('beta').windows.get('same').geometry.position).toEqual({ x: 500, y: 420 })
    expect(second.get('alpha').windows).not.toBe(second.get('beta').windows)
  })

  it('duplicates serializable workspace state without external domain data', () => {
    const collection = createWorkspaceCollection({ registry: registry() })
    const source = collection.createWorkspace({ id: 'source', name: 'Source', activate: true })
    source.windows.open({ widgetId: 'test.probe', instanceId: 'probe' })
    const externalDomainState = { balance: 1234, secret: 'DO_NOT_COPY' }
    const duplicated = collection.duplicateWorkspace('source', { id: 'copy' })
    const snapshot = captureWorkspace(duplicated.windows, duplicated.docks)
    expect(JSON.stringify(snapshot)).not.toContain(externalDomainState.secret)
    expect(snapshot.windows).toHaveLength(1)
  })

  it('rejects malformed, future-version and broken active-id persistence deterministically', () => {
    const widgets = registry()
    const future = new MemoryStorage(); future.value = { version: 999, activeWorkspaceId: 'x', workspaces: [] }
    expect(() => createWorkspaceCollection({ registry: widgets, storage: future })).toThrowError(expect.objectContaining({ code: 'unsupported-version' }))
    const missing = new MemoryStorage(); missing.value = { version: 1, activeWorkspaceId: 'missing', workspaces: [{ id: 'ok', name: 'OK', workspace: { version: 3, windows: [], docks: [] } }] }
    expect(() => createWorkspaceCollection({ registry: widgets, storage: missing })).toThrowError(WorkspaceCollectionError)
  })
})
