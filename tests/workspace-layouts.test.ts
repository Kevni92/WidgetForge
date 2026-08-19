import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { createDockManager } from '../src/core/dock-manager'
import { createWidgetPane } from '../src/core/pane'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import { captureWorkspace, WORKSPACE_VERSION } from '../src/core/workspace'
import {
  createWorkspaceLayoutManager,
  WorkspaceLayoutError,
  type WorkspaceLayoutCollectionSnapshot,
  type WorkspaceLayoutStorage,
} from '../src/core/workspace-layouts'

const Probe = defineComponent({ template: '<div>probe</div>' })
function registry() {
  return createWidgetRegistry([
    defineWidget({ id: 'test.alpha', title: 'Alpha', component: Probe, parameters: { label: { type: 'string', default: 'A' } } }),
    defineWidget({ id: 'test.beta', title: 'Beta', component: Probe }),
  ])
}
function setup() {
  const widgets = registry()
  const windows = createWindowManager(widgets)
  const docks = createDockManager(widgets)
  return { widgets, windows, docks }
}
function openReference(windows: ReturnType<typeof createWindowManager>, docks: ReturnType<typeof createDockManager>) {
  windows.open({ widgetId: 'test.alpha', instanceId: 'alpha', parameters: { label: 'reference' }, position: { x: 20, y: 30 }, size: { width: 320, height: 220 } })
  docks.add({ id: 'top', position: 'top', pane: createWidgetPane({ id: 'dock-alpha', widgetId: 'test.alpha', instanceId: 'dock-alpha', parameters: { label: 'dock' } }), thickness: 48 })
}

class MemoryStorage implements WorkspaceLayoutStorage {
  value: unknown | null = null
  writes: WorkspaceLayoutCollectionSnapshot[] = []
  read(): unknown | null { return this.value }
  write(snapshot: WorkspaceLayoutCollectionSnapshot): void { this.value = structuredClone(snapshot); this.writes.push(structuredClone(snapshot)) }
}

describe('WorkspaceLayoutManager', () => {
  it('saves multiple independent layouts and deterministically restores windows and docks', () => {
    const { widgets, windows, docks } = setup()
    openReference(windows, docks)
    const layouts = createWorkspaceLayoutManager({ registry: widgets, windows, docks })
    layouts.saveLayout('Default', { setDefault: true })

    windows.setGeometry('alpha', { position: { x: 400, y: 180 }, size: { width: 500, height: 340 } })
    windows.open({ widgetId: 'test.beta', instanceId: 'beta', position: { x: 50, y: 80 }, size: { width: 240, height: 180 } })
    docks.setThickness('top', 72)
    layouts.saveLayout('Trading')

    const result = layouts.loadLayout('Default')
    expect(result.name).toBe('Default')
    expect(result.reusedWindows).toContain('alpha')
    expect(result.reopenedWindows).not.toContain('alpha')
    expect(windows.list().map((window) => window.instanceId)).toEqual(['alpha'])
    expect(windows.get('alpha').geometry).toEqual({ position: { x: 20, y: 30 }, size: { width: 320, height: 220 } })
    expect(docks.get('top').thickness).toBe(48)
    expect(layouts.getDefaultLayout()).toBe('Default')

    layouts.loadLayout('Trading')
    expect(windows.list().map((window) => window.instanceId)).toEqual(['alpha', 'beta'])
    expect(windows.get('alpha').geometry).toEqual({ position: { x: 400, y: 180 }, size: { width: 500, height: 340 } })
    expect(docks.get('top').thickness).toBe(72)
  })

  it('preserves lifecycle identity for compatible windows and reopens only structural incompatibilities', () => {
    const { widgets, windows, docks } = setup()
    openReference(windows, docks)
    const layouts = createWorkspaceLayoutManager({ registry: widgets, windows, docks })
    layouts.saveLayout('Original')
    const originalLifecycle = windows.getLifecycle('alpha')

    windows.setGeometry('alpha', { position: { x: 300, y: 250 }, size: { width: 360, height: 260 } })
    layouts.saveLayout('Moved')
    const reused = layouts.loadLayout('Original')
    expect(reused.reusedWindows).toEqual(['alpha'])
    expect(windows.getLifecycle('alpha')).toBe(originalLifecycle)

    windows.close('alpha')
    windows.open({ widgetId: 'test.alpha', instanceId: 'alpha', title: 'Different structural title', parameters: { label: 'runtime' } })
    const replacementLifecycle = windows.getLifecycle('alpha')
    const reopened = layouts.loadLayout('Original')
    expect(reopened.reopenedWindows).toEqual(['alpha'])
    expect(windows.getLifecycle('alpha')).not.toBe(replacementLifecycle)
    expect(windows.get('alpha').title).toBe('Alpha')
  })

  it('supports rename, duplicate, delete, defaults and defined name conflicts', () => {
    const { widgets, windows, docks } = setup()
    openReference(windows, docks)
    const layouts = createWorkspaceLayoutManager({ registry: widgets, windows, docks })
    layouts.saveLayout('Default', { setDefault: true })
    layouts.duplicateLayout('Default', 'Copy')
    layouts.renameLayout('Copy', 'Operations')
    expect(layouts.listLayouts().map((layout) => layout.name)).toEqual(['Default', 'Operations'])
    expect(layouts.getDefaultLayout()).toBe('Default')
    expect(() => layouts.saveLayout('Default')).toThrowError(expect.objectContaining({ code: 'name-conflict' }))
    expect(() => layouts.renameLayout('Operations', 'Default')).toThrowError(expect.objectContaining({ code: 'name-conflict' }))
    layouts.setDefaultLayout('Operations')
    expect(layouts.getDefaultLayout()).toBe('Operations')
    layouts.deleteLayout('Operations')
    expect(layouts.getDefaultLayout()).toBeNull()
    expect(() => layouts.loadLayout('Operations')).toThrowError(expect.objectContaining({ code: 'not-found' }))
  })

  it('persists through an injected backend and migrates legacy collection and workspace versions', () => {
    const first = setup()
    openReference(first.windows, first.docks)
    const legacyWorkspace = { ...captureWorkspace(first.windows, first.docks), version: 2 }
    const storage = new MemoryStorage()
    storage.value = [{ name: 'Legacy', workspace: legacyWorkspace }]

    const second = setup()
    const layouts = createWorkspaceLayoutManager({ registry: second.widgets, windows: second.windows, docks: second.docks, storage })
    const legacy = layouts.listLayouts()[0]
    expect(legacy?.name).toBe('Legacy')
    expect(legacy?.version).toBe(1)
    expect(legacy?.workspace.version).toBe(WORKSPACE_VERSION)
    layouts.setDefaultLayout('Legacy')
    expect(storage.writes.at(-1)?.defaultLayout).toBe('Legacy')
    layouts.loadDefaultLayout()
    expect(second.windows.get('alpha').rootPane).toMatchObject({ kind: 'widget', widgetId: 'test.alpha' })
  })

  it('reports invalid and unsupported stored presets with stable error codes', () => {
    const { widgets, windows, docks } = setup()
    const unsupported = new MemoryStorage()
    unsupported.value = { version: 999, defaultLayout: null, layouts: [] }
    expect(() => createWorkspaceLayoutManager({ registry: widgets, windows, docks, storage: unsupported })).toThrowError(expect.objectContaining({ code: 'unsupported-version' }))

    const invalid = new MemoryStorage()
    invalid.value = { layouts: [{ name: 'Broken', workspace: { version: WORKSPACE_VERSION, windows: [{ broken: true }], docks: [] } }] }
    expect(() => createWorkspaceLayoutManager({ registry: widgets, windows, docks, storage: invalid })).toThrowError(WorkspaceLayoutError)
  })

  it('captures layout state only and never serializes external domain data', () => {
    const { widgets, windows, docks } = setup()
    openReference(windows, docks)
    const externalDomainState = { privateGameState: 'DO_NOT_PERSIST', balance: 12345 }
    const layouts = createWorkspaceLayoutManager({ registry: widgets, windows, docks })
    const preset = layouts.saveLayout('UI only')
    expect(JSON.stringify(preset)).not.toContain(externalDomainState.privateGameState)
    expect(preset.workspace).toHaveProperty('windows')
    expect(preset.workspace).toHaveProperty('docks')
    expect(preset).not.toHaveProperty('domain')
  })
})
