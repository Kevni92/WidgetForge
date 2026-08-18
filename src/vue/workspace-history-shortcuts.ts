import type { WorkspaceHistory } from '../core/workspace-history'

export interface WorkspaceHistoryShortcutEvent {
  readonly key: string
  readonly ctrlKey: boolean
  readonly metaKey: boolean
  readonly shiftKey: boolean
  readonly target: EventTarget | null
  preventDefault(): void
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    && (target.matches('input,textarea,select,[contenteditable="true"]') || target.closest('[contenteditable="true"]') !== null)
}

export function handleWorkspaceHistoryShortcut(
  history: WorkspaceHistory,
  event: WorkspaceHistoryShortcutEvent,
  enabled = true,
): boolean {
  if (!enabled || !(event.ctrlKey || event.metaKey) || isEditableTarget(event.target)) return false

  const key = event.key.toLowerCase()
  if (key === 'z') {
    event.preventDefault()
    return event.shiftKey ? history.redo() : history.undo()
  }
  if (key === 'y') {
    event.preventDefault()
    return history.redo()
  }
  return false
}
