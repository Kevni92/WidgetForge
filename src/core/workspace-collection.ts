import { createDockManager, type DockManager } from './dock-manager'
import type { WidgetRegistry } from './widget-registry'
import { createWindowManager, type WindowManager } from './window-manager'
import { captureWorkspace, restoreWorkspace, type WorkspaceSnapshot } from './workspace'

export const WORKSPACE_COLLECTION_VERSION = 1 as const
export type WorkspaceId = string
export type WorkspaceCollectionChangeKind = 'create' | 'rename' | 'duplicate' | 'delete' | 'activate' | 'workspace'

export interface WorkspaceRuntime {
  readonly id: WorkspaceId
  readonly name: string
  readonly windows: WindowManager
  readonly docks: DockManager
}

export interface WorkspaceCollectionEntrySnapshot {
  readonly id: WorkspaceId
  readonly name: string
  readonly workspace: WorkspaceSnapshot
}

export interface WorkspaceCollectionSnapshot {
  readonly version: typeof WORKSPACE_COLLECTION_VERSION
  readonly activeWorkspaceId: WorkspaceId
  readonly workspaces: readonly WorkspaceCollectionEntrySnapshot[]
}

export interface WorkspaceCollectionStorage {
  read(): unknown | null
  write(snapshot: WorkspaceCollectionSnapshot): void
}

export interface WorkspaceCollectionOptions {
  readonly registry: WidgetRegistry
  readonly storage?: WorkspaceCollectionStorage | undefined
}

export interface CreateWorkspaceRequest {
  readonly id: WorkspaceId
  readonly name: string
  readonly workspace?: WorkspaceSnapshot | undefined
  readonly activate?: boolean
}

export interface DuplicateWorkspaceRequest {
  readonly id: WorkspaceId
  readonly name?: string | undefined
  readonly activate?: boolean
}

export interface WorkspaceCollectionChange {
  readonly kind: WorkspaceCollectionChangeKind
  readonly workspaceId: WorkspaceId
  readonly activeWorkspaceId: WorkspaceId
  readonly workspaces: readonly WorkspaceRuntime[]
}

export type WorkspaceCollectionListener = (change: WorkspaceCollectionChange) => void
export type WorkspaceCollectionErrorCode = 'invalid-id' | 'invalid-name' | 'duplicate-id' | 'not-found' | 'last-workspace' | 'invalid-snapshot' | 'unsupported-version' | 'storage-failed'

export class WorkspaceCollectionError extends Error {
  constructor(public readonly code: WorkspaceCollectionErrorCode, message: string) {
    super(message)
    this.name = 'WorkspaceCollectionError'
  }
}

interface RuntimeRecord {
  name: string
  windows: WindowManager
  docks: DockManager
  unsubscribeWindows: () => void
  unsubscribeDocks: () => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeId(id: string): WorkspaceId {
  const value = id.trim()
  if (!value) throw new WorkspaceCollectionError('invalid-id', 'workspace id must not be empty')
  return value
}

function normalizeName(name: string): string {
  const value = name.trim()
  if (!value) throw new WorkspaceCollectionError('invalid-name', 'workspace name must not be empty')
  return value
}

function cloneSnapshot(snapshot: WorkspaceCollectionSnapshot): WorkspaceCollectionSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as WorkspaceCollectionSnapshot
}

export class WorkspaceCollectionManager {
  private readonly records = new Map<WorkspaceId, RuntimeRecord>()
  private readonly listeners = new Set<WorkspaceCollectionListener>()
  private activeId: WorkspaceId | null = null
  private restoring = false

  constructor(private readonly options: WorkspaceCollectionOptions) {
    const stored = this.readStorage()
    if (stored !== null) this.restoreCollection(stored)
  }

  list(): readonly WorkspaceRuntime[] {
    return [...this.records.entries()].map(([id, record]) => this.runtime(id, record))
  }

  get(id: WorkspaceId): WorkspaceRuntime {
    const normalized = normalizeId(id)
    const record = this.records.get(normalized)
    if (!record) throw new WorkspaceCollectionError('not-found', `unknown workspace "${normalized}"`)
    return this.runtime(normalized, record)
  }

  getActiveWorkspaceId(): WorkspaceId | null { return this.activeId }

  getActive(): WorkspaceRuntime {
    if (!this.activeId) throw new WorkspaceCollectionError('not-found', 'no active workspace is configured')
    return this.get(this.activeId)
  }

  createWorkspace(request: CreateWorkspaceRequest): WorkspaceRuntime {
    const id = normalizeId(request.id), name = normalizeName(request.name)
    if (this.records.has(id)) throw new WorkspaceCollectionError('duplicate-id', `workspace "${id}" already exists`)
    const record = this.createRecord(id, name, request.workspace)
    this.records.set(id, record)
    if (this.activeId === null || request.activate) this.activeId = id
    this.persist()
    this.emit('create', id)
    return this.runtime(id, record)
  }

  renameWorkspace(id: WorkspaceId, name: string): WorkspaceRuntime {
    const normalized = normalizeId(id), record = this.records.get(normalized)
    if (!record) throw new WorkspaceCollectionError('not-found', `unknown workspace "${normalized}"`)
    record.name = normalizeName(name)
    this.persist()
    this.emit('rename', normalized)
    return this.runtime(normalized, record)
  }

  duplicateWorkspace(sourceId: WorkspaceId, request: DuplicateWorkspaceRequest): WorkspaceRuntime {
    const source = this.get(sourceId)
    const id = normalizeId(request.id)
    if (this.records.has(id)) throw new WorkspaceCollectionError('duplicate-id', `workspace "${id}" already exists`)
    const name = normalizeName(request.name ?? `${source.name} Copy`)
    const record = this.createRecord(id, name, captureWorkspace(source.windows, source.docks))
    this.records.set(id, record)
    if (request.activate) this.activeId = id
    this.persist()
    this.emit('duplicate', id)
    return this.runtime(id, record)
  }

  deleteWorkspace(id: WorkspaceId): void {
    const normalized = normalizeId(id), record = this.records.get(normalized)
    if (!record) throw new WorkspaceCollectionError('not-found', `unknown workspace "${normalized}"`)
    if (this.records.size === 1) throw new WorkspaceCollectionError('last-workspace', 'the last workspace cannot be deleted')
    record.unsubscribeWindows(); record.unsubscribeDocks()
    this.records.delete(normalized)
    if (this.activeId === normalized) this.activeId = this.records.keys().next().value as WorkspaceId
    this.persist()
    this.emit('delete', normalized)
  }

  activateWorkspace(id: WorkspaceId): WorkspaceRuntime {
    const workspace = this.get(id)
    if (this.activeId === workspace.id) return workspace
    this.activeId = workspace.id
    this.persist()
    this.emit('activate', workspace.id)
    return workspace
  }

  snapshot(): WorkspaceCollectionSnapshot {
    if (!this.activeId) throw new WorkspaceCollectionError('invalid-snapshot', 'workspace collection must contain an active workspace')
    return {
      version: WORKSPACE_COLLECTION_VERSION,
      activeWorkspaceId: this.activeId,
      workspaces: this.list().map((workspace) => ({ id: workspace.id, name: workspace.name, workspace: captureWorkspace(workspace.windows, workspace.docks) })),
    }
  }

  subscribe(listener: WorkspaceCollectionListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  dispose(): void {
    for (const record of this.records.values()) { record.unsubscribeWindows(); record.unsubscribeDocks() }
    this.listeners.clear()
  }

  private runtime(id: WorkspaceId, record: RuntimeRecord): WorkspaceRuntime {
    return { id, name: record.name, windows: record.windows, docks: record.docks }
  }

  private createRecord(id: WorkspaceId, name: string, snapshot?: WorkspaceSnapshot): RuntimeRecord {
    const windows = createWindowManager(this.options.registry), docks = createDockManager(this.options.registry)
    if (snapshot) {
      const restored = restoreWorkspace(windows, snapshot, docks)
      if (!restored.valid || restored.issues.length > 0) {
        throw new WorkspaceCollectionError('invalid-snapshot', restored.issues.map((issue) => issue.message).join('; ') || `workspace "${id}" could not be restored`)
      }
    }
    const onWorkspaceChange = () => {
      if (this.restoring) return
      this.persist()
      this.emit('workspace', id)
    }
    return { name, windows, docks, unsubscribeWindows: windows.subscribe(onWorkspaceChange), unsubscribeDocks: docks.subscribe(onWorkspaceChange) }
  }

  private readStorage(): unknown | null {
    if (!this.options.storage) return null
    try { return this.options.storage.read() }
    catch (error) { throw new WorkspaceCollectionError('storage-failed', error instanceof Error ? error.message : 'workspace collection storage read failed') }
  }

  private restoreCollection(value: unknown): void {
    if (!isRecord(value)) throw new WorkspaceCollectionError('invalid-snapshot', 'workspace collection must be an object')
    if (value.version !== WORKSPACE_COLLECTION_VERSION) throw new WorkspaceCollectionError('unsupported-version', `unsupported workspace collection version "${String(value.version)}"`)
    if (!Array.isArray(value.workspaces) || value.workspaces.length === 0 || typeof value.activeWorkspaceId !== 'string') {
      throw new WorkspaceCollectionError('invalid-snapshot', 'workspace collection must contain workspaces and an active workspace id')
    }
    this.restoring = true
    try {
      for (const candidate of value.workspaces) {
        if (!isRecord(candidate) || typeof candidate.id !== 'string' || typeof candidate.name !== 'string' || !isRecord(candidate.workspace)) {
          throw new WorkspaceCollectionError('invalid-snapshot', 'workspace collection contains an invalid workspace entry')
        }
        const id = normalizeId(candidate.id), name = normalizeName(candidate.name)
        if (this.records.has(id)) throw new WorkspaceCollectionError('duplicate-id', `workspace "${id}" already exists`)
        this.records.set(id, this.createRecord(id, name, candidate.workspace as unknown as WorkspaceSnapshot))
      }
      const active = normalizeId(value.activeWorkspaceId)
      if (!this.records.has(active)) throw new WorkspaceCollectionError('invalid-snapshot', `active workspace "${active}" does not exist`)
      this.activeId = active
    } catch (error) {
      for (const record of this.records.values()) { record.unsubscribeWindows(); record.unsubscribeDocks() }
      this.records.clear(); this.activeId = null
      throw error
    } finally { this.restoring = false }
  }

  private persist(): void {
    if (!this.options.storage || this.restoring || this.records.size === 0 || !this.activeId) return
    try { this.options.storage.write(cloneSnapshot(this.snapshot())) }
    catch (error) { throw new WorkspaceCollectionError('storage-failed', error instanceof Error ? error.message : 'workspace collection storage write failed') }
  }

  private emit(kind: WorkspaceCollectionChangeKind, workspaceId: WorkspaceId): void {
    if (!this.activeId) return
    const change: WorkspaceCollectionChange = { kind, workspaceId, activeWorkspaceId: this.activeId, workspaces: this.list() }
    for (const listener of [...this.listeners]) listener(change)
  }
}

export function createWorkspaceCollection(options: WorkspaceCollectionOptions): WorkspaceCollectionManager {
  return new WorkspaceCollectionManager(options)
}
