import { moveWindowGroup, type WindowGeometry, type WindowPosition, type WindowSize } from './window-geometry'
import type { WindowInstanceId, WindowManager, WindowOperationOrigin } from './window-manager'

export type WindowGroupId = string

export interface WindowGroupState {
  readonly id: WindowGroupId
  readonly members: readonly WindowInstanceId[]
}

export interface WindowGroupMoveSnapshot {
  readonly groupId: WindowGroupId | null
  readonly members: readonly { readonly instanceId: WindowInstanceId; readonly geometry: WindowGeometry }[]
}

export interface WindowGroupChange {
  readonly groups: readonly WindowGroupState[]
}

export type WindowGroupListener = (change: WindowGroupChange) => void

export class WindowGroupDefinitionError extends Error {
  constructor(message: string) { super(message); this.name = 'WindowGroupDefinitionError' }
}

function cloneGeometry(geometry: WindowGeometry): WindowGeometry {
  return { position: { ...geometry.position }, size: { ...geometry.size } }
}

export class WindowGroupManager {
  private readonly groups = new Map<WindowGroupId, WindowInstanceId[]>()
  private readonly listeners = new Set<WindowGroupListener>()
  private readonly unsubscribeWindowManager: () => void

  constructor(private readonly windows: WindowManager) {
    this.unsubscribeWindowManager = windows.subscribe((change) => {
      if (change.kind === 'close' || change.kind === 'snap' || change.kind === 'maximize') this.remove(change.instanceId)
    })
  }

  list(): readonly WindowGroupState[] {
    return [...this.groups.entries()].map(([id, members]) => ({ id, members: [...members] }))
  }

  get(groupId: WindowGroupId): WindowGroupState | undefined {
    const members = this.groups.get(groupId)
    return members ? { id: groupId, members: [...members] } : undefined
  }

  groupOf(instanceId: WindowInstanceId): WindowGroupId | null {
    for (const [groupId, members] of this.groups) if (members.includes(instanceId)) return groupId
    return null
  }

  assign(groupId: WindowGroupId, instanceIds: readonly WindowInstanceId[]): WindowGroupState {
    const id = groupId.trim()
    if (!id) throw new WindowGroupDefinitionError('window group id must not be empty')
    const members = [...new Set(instanceIds)]
    if (members.length === 0) throw new WindowGroupDefinitionError('window group must contain at least one member')
    for (const instanceId of members) {
      const window = this.windows.get(instanceId)
      if (window.mode !== 'normal' || window.snap) throw new WindowGroupDefinitionError(`window "${instanceId}" must be floating before it can be grouped`)
      this.remove(instanceId, false)
    }
    this.groups.set(id, members)
    this.emit()
    return { id, members: [...members] }
  }

  add(groupId: WindowGroupId, instanceId: WindowInstanceId): WindowGroupState {
    const current = this.get(groupId)
    return this.assign(groupId, [...(current?.members ?? []), instanceId])
  }

  remove(instanceId: WindowInstanceId, emit = true): void {
    let changed = false
    for (const [groupId, members] of [...this.groups]) {
      if (!members.includes(instanceId)) continue
      const remaining = members.filter((member) => member !== instanceId)
      if (remaining.length === 0) this.groups.delete(groupId)
      else this.groups.set(groupId, remaining)
      changed = true
    }
    if (changed && emit) this.emit()
  }

  clear(groupId: WindowGroupId): void {
    if (!this.groups.delete(groupId)) return
    this.emit()
  }

  captureMove(instanceId: WindowInstanceId): WindowGroupMoveSnapshot {
    const groupId = this.groupOf(instanceId)
    const ids = groupId ? this.groups.get(groupId) ?? [instanceId] : [instanceId]
    return {
      groupId,
      members: ids.map((id) => ({ instanceId: id, geometry: cloneGeometry(this.windows.get(id).geometry) })),
    }
  }

  moveCaptured(snapshot: WindowGroupMoveSnapshot, delta: WindowPosition, container: WindowSize, origin: WindowOperationOrigin = 'user'): void {
    const moved = moveWindowGroup(snapshot.members.map((member) => ({ id: member.instanceId, geometry: member.geometry })), delta, container)
    for (const member of moved) this.windows.setGeometry(member.id, member.geometry, origin)
  }

  minimizeGroup(groupId: WindowGroupId, origin: WindowOperationOrigin = 'user'): void {
    for (const instanceId of this.groups.get(groupId) ?? []) if (this.windows.get(instanceId).mode !== 'minimized') this.windows.minimize(instanceId, origin)
  }

  restoreGroup(groupId: WindowGroupId, origin: WindowOperationOrigin = 'user'): void {
    for (const instanceId of this.groups.get(groupId) ?? []) if (this.windows.get(instanceId).mode === 'minimized') this.windows.restore(instanceId, origin)
  }

  closeGroup(groupId: WindowGroupId, origin: WindowOperationOrigin = 'user'): void {
    const members = [...(this.groups.get(groupId) ?? [])]
    for (const instanceId of members) this.windows.close(instanceId, origin)
  }

  subscribe(listener: WindowGroupListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  dispose(): void {
    this.unsubscribeWindowManager()
    this.listeners.clear()
    this.groups.clear()
  }

  private emit(): void {
    const change: WindowGroupChange = { groups: this.list() }
    for (const listener of [...this.listeners]) listener(change)
  }
}

export function createWindowGroupManager(windows: WindowManager): WindowGroupManager {
  return new WindowGroupManager(windows)
}
