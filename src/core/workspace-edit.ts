import type { ContextMenuItem } from './context-menu'
import { createWidgetPane, findPane, removePane, replacePane, type PaneNode, type PaneParameters } from './pane'
import type { WidgetId } from './widget'

export type WorkspaceEditMode = 'normal' | 'edit' | 'locked'
export type WorkspacePaneOwnerKind = 'window' | 'dock'
export type PaneEditActionId = 'split' | 'move' | 'retarget' | 'lock' | 'unlock' | 'delete'

export interface WorkspacePaneOwner {
  readonly kind: WorkspacePaneOwnerKind
  readonly id: string
}

export interface WorkspacePaneSelection {
  readonly owner: WorkspacePaneOwner
  readonly paneId: string
}

export interface WorkspaceEditSnapshot {
  readonly mode: WorkspaceEditMode
  readonly selection: WorkspacePaneSelection | null
}

export interface WorkspaceEditState extends WorkspaceEditSnapshot {
  readonly temporaryEdit: boolean
  readonly editActive: boolean
  readonly locked: boolean
}

export type WorkspaceEditListener = (state: WorkspaceEditState) => void

function cloneSelection(selection: WorkspacePaneSelection | null): WorkspacePaneSelection | null {
  return selection ? { owner: { ...selection.owner }, paneId: selection.paneId } : null
}

function isMode(value: unknown): value is WorkspaceEditMode {
  return value === 'normal' || value === 'edit' || value === 'locked'
}

export class WorkspaceEditController {
  private mode: WorkspaceEditMode
  private temporaryEdit = false
  private selection: WorkspacePaneSelection | null = null
  private readonly listeners = new Set<WorkspaceEditListener>()

  constructor(initial?: Partial<WorkspaceEditSnapshot>) {
    this.mode = initial?.mode ?? 'normal'
    if (!isMode(this.mode)) throw new Error(`invalid workspace edit mode "${String(this.mode)}"`)
    this.selection = cloneSelection(initial?.selection ?? null)
  }

  get state(): WorkspaceEditState {
    return {
      mode: this.mode,
      temporaryEdit: this.temporaryEdit,
      editActive: this.mode === 'edit' || (this.mode === 'normal' && this.temporaryEdit),
      locked: this.mode === 'locked',
      selection: cloneSelection(this.selection),
    }
  }

  setMode(mode: WorkspaceEditMode): WorkspaceEditState {
    if (!isMode(mode)) throw new Error(`invalid workspace edit mode "${String(mode)}"`)
    if (this.mode === mode && !this.temporaryEdit) return this.state
    this.mode = mode
    this.temporaryEdit = false
    if (mode !== 'edit') this.selection = null
    this.emit()
    return this.state
  }

  setTemporaryEdit(active: boolean): WorkspaceEditState {
    const next = this.mode === 'normal' && active
    if (next === this.temporaryEdit) return this.state
    this.temporaryEdit = next
    if (!next && this.mode !== 'edit') this.selection = null
    this.emit()
    return this.state
  }

  selectPane(selection: WorkspacePaneSelection | null): WorkspaceEditState {
    if (!this.state.editActive) return this.state
    const next = cloneSelection(selection)
    if (JSON.stringify(next) === JSON.stringify(this.selection)) return this.state
    this.selection = next
    this.emit()
    return this.state
  }

  snapshot(): WorkspaceEditSnapshot {
    return { mode: this.mode, selection: cloneSelection(this.selection) }
  }

  restore(snapshot: WorkspaceEditSnapshot): WorkspaceEditState {
    if (!isMode(snapshot.mode)) throw new Error(`invalid workspace edit mode "${String(snapshot.mode)}"`)
    this.mode = snapshot.mode
    this.temporaryEdit = false
    this.selection = snapshot.mode === 'edit' ? cloneSelection(snapshot.selection) : null
    this.emit()
    return this.state
  }

  subscribe(listener: WorkspaceEditListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    const state = this.state
    for (const listener of [...this.listeners]) listener(state)
  }
}

export function createWorkspaceEditController(initial?: Partial<WorkspaceEditSnapshot>): WorkspaceEditController {
  return new WorkspaceEditController(initial)
}

export function isPaneLayoutLocked(root: PaneNode, paneId: string): boolean {
  function visit(node: PaneNode, inherited: boolean): boolean | undefined {
    const locked = inherited || node.settings?.locked === true
    if (node.id === paneId) return locked
    if (node.kind === 'widget') return undefined
    for (const child of node.children) {
      const result = visit(child, locked)
      if (result !== undefined) return result
    }
    return undefined
  }
  return visit(root, false) ?? false
}

export function setPaneLayoutLocked(root: PaneNode, paneId: string, locked: boolean): PaneNode {
  const pane = findPane(root, paneId)
  if (!pane) return root
  const settings = { ...(pane.settings ?? {}), locked }
  return replacePane(root, paneId, { ...pane, settings } as PaneNode)
}

export function retargetWidgetPane(root: PaneNode, paneId: string, widgetId: WidgetId, parameters: PaneParameters = {}): PaneNode {
  const pane = findPane(root, paneId)
  if (!pane || pane.kind !== 'widget') return root
  return replacePane(root, paneId, createWidgetPane({
    id: pane.id,
    widgetId,
    instanceId: pane.instanceId,
    parameters,
    ...(pane.settings ? { settings: pane.settings } : {}),
  }))
}

export function removePaneForEdit(root: PaneNode, paneId: string): PaneNode | null {
  return removePane(root, paneId).root
}

export function createPaneEditContextMenuItems(root: PaneNode, paneId: string): readonly ContextMenuItem[] {
  const pane = findPane(root, paneId)
  if (!pane) return []
  const locked = isPaneLayoutLocked(root, paneId)
  const items: ContextMenuItem[] = []
  if (!locked) {
    items.push({ id: 'split', label: 'Split pane…' })
    if (root.id !== paneId) items.push({ id: 'move', label: 'Move pane…' })
    if (pane.kind === 'widget') items.push({ id: 'retarget', label: 'Change widget…' })
    items.push({ id: 'lock', label: 'Lock pane' })
    if (root.id !== paneId) items.push({ id: 'delete', label: 'Delete pane', tone: 'danger' })
  } else if (pane.settings?.locked === true) {
    items.push({ id: 'unlock', label: 'Unlock pane' })
  }
  return items
}
