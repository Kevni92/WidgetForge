import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import { restoreWorkspace } from '../src/core/workspace'
import { createDefaultWorkspaceMigrationRegistry, createWorkspaceMigrationRegistry, defaultWorkspaceMigrationRegistry, WorkspaceMigrationError } from '../src/core/workspace-migrations'
import { workspaceV1Fixture, workspaceV2Fixture } from './fixtures/workspace-documents.fixture'

const Probe = defineComponent({ template: '<div>fixture</div>' })
function registry() {
  return createWidgetRegistry([
    defineWidget({ id: 'fixture.alpha', title: 'Alpha', component: Probe, parameters: { planet: { type: 'string', required: true } } }),
    defineWidget({ id: 'fixture.beta', title: 'Beta', component: Probe }),
  ])
}

describe('WorkspaceMigrationRegistry', () => {
  it('runs adjacent migrations deterministically in order without mutating the input', () => {
    const input = { version: 1, trace: ['source'], extensionData: { marker: 'keep' } }
    const registry = createWorkspaceMigrationRegistry([
      { fromVersion: 1, toVersion: 2, migrate: (document) => ({ ...document, version: 2, trace: [...document.trace as string[], '1-2'] }) },
      { fromVersion: 2, toVersion: 3, migrate: (document) => ({ ...document, version: 3, trace: [...document.trace as string[], '2-3'] }) },
    ])
    const result = registry.migrate(input, 3)
    expect(result.appliedVersions).toEqual([2, 3])
    expect(result.document).toEqual({ version: 3, trace: ['source', '1-2', '2-3'], extensionData: { marker: 'keep' } })
    expect(input).toEqual({ version: 1, trace: ['source'], extensionData: { marker: 'keep' } })
  })

  it('rejects invalid registration, duplicates, missing paths, future versions and invalid step output', () => {
    const registry = createWorkspaceMigrationRegistry()
    expect(() => registry.register({ fromVersion: 1, toVersion: 3, migrate: (document) => document })).toThrowError(expect.objectContaining({ code: 'invalid-step' }))
    registry.register({ fromVersion: 1, toVersion: 2, migrate: (document) => ({ ...document, version: 2 }) })
    expect(() => registry.register({ fromVersion: 1, toVersion: 2, migrate: (document) => ({ ...document, version: 2 }) })).toThrowError(expect.objectContaining({ code: 'duplicate-step' }))
    expect(() => registry.migrate({ version: 1 }, 3)).toThrowError(expect.objectContaining({ code: 'missing-path' }))
    expect(() => registry.migrate({ version: 4 }, 3)).toThrowError(expect.objectContaining({ code: 'future-version' }))
    const invalid = createWorkspaceMigrationRegistry([{ fromVersion: 1, toVersion: 2, migrate: (document) => ({ ...document, version: 99 }) }])
    expect(() => invalid.migrate({ version: 1 }, 2)).toThrowError(expect.objectContaining({ code: 'invalid-step' }))
  })

  it('migrates real v1 and v2 fixture documents to the current workspace shape while preserving unrelated serializable fields', () => {
    const v1 = defaultWorkspaceMigrationRegistry.migrate(workspaceV1Fixture, 3)
    expect(v1.appliedVersions).toEqual([2, 3])
    expect(v1.document.version).toBe(3)
    expect(v1.document.extensionData).toEqual({ marker: 'preserve-me' })
    expect(v1.document.docks).toEqual([])
    const windows = v1.document.windows as Array<Record<string, unknown>>
    expect(windows[0]?.rootPane).toEqual(expect.objectContaining({ kind: 'widget', widgetId: 'fixture.alpha', instanceId: 'legacy-alpha' }))

    const v2 = createDefaultWorkspaceMigrationRegistry().migrate(workspaceV2Fixture, 3)
    expect(v2.appliedVersions).toEqual([3])
    expect(v2.document.extensionData).toEqual({ marker: 'preserve-v2' })
    expect(v2.document.docks).toEqual([])
  })

  it('restores legacy fixtures only after migration and reports missing migration paths explicitly', () => {
    const windows = createWindowManager(registry())
    const restored = restoreWorkspace(windows, workspaceV1Fixture)
    expect(restored.valid).toBe(true)
    expect(restored.issues).toEqual([])
    expect(windows.get('legacy-alpha').geometry.position).toEqual({ x: 24, y: 36 })
    expect(windows.get('legacy-alpha').focused).toBe(true)
    expect(windows.get('legacy-beta').mode).toBe('minimized')

    const missingPathRegistry = createWorkspaceMigrationRegistry([{ fromVersion: 1, toVersion: 2, migrate: (document) => ({ ...document, version: 2 }) }])
    const failed = restoreWorkspace(createWindowManager(registry()), workspaceV1Fixture, undefined, missingPathRegistry)
    expect(failed.valid).toBe(false)
    expect(failed.issues[0]?.code).toBe('migration-failed')
    expect(failed.issues[0]?.message).toContain('v2 -> v3')
  })

  it('uses defined migration errors for malformed and non-serializable documents', () => {
    expect(() => defaultWorkspaceMigrationRegistry.migrate({ version: 0 }, 3)).toThrowError(WorkspaceMigrationError)
    const cyclic: Record<string, unknown> = { version: 1 }; cyclic.self = cyclic
    expect(() => defaultWorkspaceMigrationRegistry.migrate(cyclic, 3)).toThrowError(expect.objectContaining({ code: 'invalid-document' }))
  })
})
