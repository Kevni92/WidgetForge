import type { DockManager } from './dock-manager'
import type { WindowManager, WindowManagerChange } from './window-manager'
import { restoreWorkspace, serializeWorkspace } from './workspace'

export interface WorkspaceHistoryOptions {
  readonly limit?: number
}

export interface WorkspaceHistoryState {
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly undoDepth: number
  readonly redoDepth: number
  readonly transactionActive: boolean
}

export type WorkspaceHistoryListener = (state: WorkspaceHistoryState) => void

export class WorkspaceHistoryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkspaceHistoryError'
  }
}

function validateLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1) throw new WorkspaceHistoryError('history limit must be a positive integer')
  return limit
}

export class WorkspaceHistory {
  private readonly limit: number
  private undoEntries: string[] = []
  private redoEntries: string[] = []
  private current: string
  private transactionStart: string | null = null
  private applying = false
  private readonly listeners = new Set<WorkspaceHistoryListener>()
  private readonly unsubscribeWindow: () => void
  private readonly unsubscribeDock: (() => void) | null

  constructor(
    private readonly windows: WindowManager,
    private readonly docks?: DockManager,
    options: WorkspaceHistoryOptions = {},
  ) {
    this.limit = validateLimit(options.limit ?? 50)
    this.current = this.capture()
    this.unsubscribeWindow = windows.subscribe((change) => this.onWindowChange(change))
    this.unsubscribeDock = docks?.subscribe(() => this.onChange()) ?? null
  }

  get state(): WorkspaceHistoryState {
    return {
      canUndo: this.undoEntries.length > 0,
      canRedo: this.redoEntries.length > 0,
      undoDepth: this.undoEntries.length,
      redoDepth: this.redoEntries.length,
      transactionActive: this.transactionStart !== null,
    }
  }

  subscribe(listener: WorkspaceHistoryListener): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  beginTransaction(): void {
    if (this.transactionStart !== null) return
    this.transactionStart = this.current
    this.emit()
  }

  commitTransaction(): boolean {
    if (this.transactionStart === null) return false
    const start = this.transactionStart
    this.transactionStart = null
    const changed = start !== this.current
    if (changed) this.pushUndo(start)
    this.emit()
    return changed
  }

  cancelTransaction(): boolean {
    if (this.transactionStart === null) return false
    const start = this.transactionStart
    this.transactionStart = null
    if (start !== this.current) this.apply(start)
    this.emit()
    return true
  }

  undo(): boolean {
    if (this.transactionStart !== null) this.commitTransaction()
    const target = this.undoEntries.pop()
    if (!target) return false
    this.redoEntries.push(this.current)
    this.apply(target)
    this.emit()
    return true
  }

  redo(): boolean {
    if (this.transactionStart !== null) this.commitTransaction()
    const target = this.redoEntries.pop()
    if (!target) return false
    this.undoEntries.push(this.current)
    if (this.undoEntries.length > this.limit) this.undoEntries.shift()
    this.apply(target)
    this.emit()
    return true
  }

  clear(): void {
    this.undoEntries = []
    this.redoEntries = []
    this.transactionStart = null
    this.current = this.capture()
    this.emit()
  }

  dispose(): void {
    this.unsubscribeWindow()
    this.unsubscribeDock?.()
    this.listeners.clear()
  }

  private capture(): string {
    return serializeWorkspace(this.windows, this.docks)
  }

  private onWindowChange(change: WindowManagerChange): void {
    if (this.applying) return
    const next = this.capture()
    if (change.kind === 'focus' || (change.kind === 'geometry' && change.origin === 'api')) {
      this.current = next
      if (this.transactionStart !== null && change.kind === 'focus') this.transactionStart = next
      return
    }
    this.record(next)
  }

  private onChange(): void {
    if (this.applying) return
    const next = this.capture()
    this.record(next)
  }

  private record(next: string): void {
    if (next === this.current) return
    if (this.transactionStart !== null) {
      this.current = next
      return
    }
    this.pushUndo(this.current)
    this.current = next
    this.emit()
  }

  private pushUndo(snapshot: string): void {
    this.undoEntries.push(snapshot)
    if (this.undoEntries.length > this.limit) this.undoEntries.shift()
    this.redoEntries = []
  }

  private apply(snapshot: string): void {
    const previous = this.current
    this.applying = true
    try {
      for (const window of [...this.windows.list()]) this.windows.close(window.instanceId, 'api')
      if (this.docks) for (const dock of [...this.docks.list()]) this.docks.remove(dock.id)
      const container = this.windows.getResponsiveContainer()
      const restored = restoreWorkspace(this.windows, snapshot, this.docks, undefined, { atomic: true, ...(container ? { container } : {}) })
      if (!restored.valid || restored.issues.length > 0) {
        throw new WorkspaceHistoryError(`history snapshot restore failed: ${restored.issues.map((issue) => issue.message).join('; ')}`)
      }
      this.current = this.capture()
    } catch (error) {
      try {
        for (const window of [...this.windows.list()]) this.windows.close(window.instanceId, 'api')
        if (this.docks) for (const dock of [...this.docks.list()]) this.docks.remove(dock.id)
        const container = this.windows.getResponsiveContainer()
        const restored = restoreWorkspace(this.windows, previous, this.docks, undefined, { atomic: true, ...(container ? { container } : {}) })
        if (!restored.valid || restored.issues.length > 0) throw new WorkspaceHistoryError('history rollback restore reported issues')
        this.current = this.capture()
      } catch (rollbackError) {
        throw new WorkspaceHistoryError(`history apply failed and rollback also failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`)
      }
      throw error
    } finally {
      this.applying = false
    }
  }

  private emit(): void {
    const state = this.state
    for (const listener of [...this.listeners]) listener(state)
  }
}

export function createWorkspaceHistory(windows: WindowManager, docks?: DockManager, options?: WorkspaceHistoryOptions): WorkspaceHistory {
  return new WorkspaceHistory(windows, docks, options)
}
