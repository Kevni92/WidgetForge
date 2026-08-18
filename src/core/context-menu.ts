import type { NavigationIntent } from './navigation'

export type ContextMenuItemTone = 'default' | 'danger'

export interface ContextMenuItem {
  readonly id: string
  readonly label: string
  readonly disabled?: boolean
  readonly tone?: ContextMenuItemTone
  readonly target?: NavigationIntent
}

export interface ContextMenuRequest {
  readonly x: number
  readonly y: number
  readonly items: readonly ContextMenuItem[]
  readonly onSelect?: (item: ContextMenuItem) => void
}

export interface ContextMenuState {
  readonly open: boolean
  readonly x: number
  readonly y: number
  readonly items: readonly ContextMenuItem[]
}

export type ContextMenuListener = (state: ContextMenuState) => void
export type ContextMenuUnsubscribe = () => void

export class ContextMenuDefinitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ContextMenuDefinitionError'
  }
}

const CLOSED_STATE: ContextMenuState = { open: false, x: 0, y: 0, items: [] }

export class ContextMenuController {
  private state: ContextMenuState = CLOSED_STATE
  private onSelect: ((item: ContextMenuItem) => void) | undefined
  private readonly listeners = new Set<ContextMenuListener>()

  show(request: ContextMenuRequest): void {
    if (request.items.length === 0) throw new ContextMenuDefinitionError('context menu must contain at least one item')
    const ids = new Set<string>()
    for (const item of request.items) {
      if (!item.id.trim()) throw new ContextMenuDefinitionError('context menu item id must not be empty')
      if (!item.label.trim()) throw new ContextMenuDefinitionError('context menu item label must not be empty')
      if (ids.has(item.id)) throw new ContextMenuDefinitionError(`duplicate context menu item id "${item.id}"`)
      ids.add(item.id)
    }

    this.onSelect = request.onSelect
    this.state = {
      open: true,
      x: Math.max(0, request.x),
      y: Math.max(0, request.y),
      items: [...request.items],
    }
    this.emit()
  }

  close(): void {
    if (!this.state.open) return
    this.state = CLOSED_STATE
    this.onSelect = undefined
    this.emit()
  }

  select(id: string): ContextMenuItem | null {
    const item = this.state.items.find((candidate) => candidate.id === id)
    if (!item || item.disabled) return null
    const callback = this.onSelect
    this.state = CLOSED_STATE
    this.onSelect = undefined
    this.emit()
    callback?.(item)
    return item
  }

  getSnapshot(): ContextMenuState {
    return {
      ...this.state,
      items: [...this.state.items],
    }
  }

  subscribe(listener: ContextMenuListener): ContextMenuUnsubscribe {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    const snapshot = this.getSnapshot()
    for (const listener of this.listeners) listener(snapshot)
  }
}

export function createContextMenuController(): ContextMenuController {
  return new ContextMenuController()
}
