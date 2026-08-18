import type { NavigationIntent } from './navigation'

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error'
export type NotificationId = string

export interface NotificationInput {
  readonly title: string
  readonly message?: string
  readonly severity?: NotificationSeverity
  readonly persistent?: boolean
  readonly durationMs?: number
  readonly target?: NavigationIntent
  readonly actionLabel?: string
}

export interface NotificationItem {
  readonly id: NotificationId
  readonly title: string
  readonly message?: string
  readonly severity: NotificationSeverity
  readonly persistent: boolean
  readonly durationMs: number | null
  readonly target?: NavigationIntent
  readonly actionLabel?: string
  readonly createdAt: number
}

export type NotificationStoreListener = (notifications: readonly NotificationItem[]) => void
export type NotificationStoreUnsubscribe = () => void

export interface NotificationStoreOptions {
  readonly defaultDurationMs?: number
  readonly now?: () => number
  readonly idFactory?: () => string
}

export class NotificationDefinitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotificationDefinitionError'
  }
}

export class NotificationStore {
  private readonly listeners = new Set<NotificationStoreListener>()
  private readonly items: NotificationItem[] = []
  private readonly defaultDurationMs: number
  private readonly now: () => number
  private readonly idFactory: () => string
  private sequence = 0

  constructor(options: NotificationStoreOptions = {}) {
    this.defaultDurationMs = options.defaultDurationMs ?? 5_000
    this.now = options.now ?? Date.now
    this.idFactory = options.idFactory ?? (() => `notification-${++this.sequence}`)

    if (this.defaultDurationMs < 0) {
      throw new NotificationDefinitionError('default notification duration must not be negative')
    }
  }

  notify(input: NotificationInput): NotificationItem {
    if (!input.title.trim()) {
      throw new NotificationDefinitionError('notification title must not be empty')
    }
    if (input.durationMs !== undefined && input.durationMs < 0) {
      throw new NotificationDefinitionError('notification duration must not be negative')
    }

    const persistent = input.persistent ?? false
    const item: NotificationItem = {
      id: this.idFactory(),
      title: input.title,
      ...(input.message !== undefined ? { message: input.message } : {}),
      severity: input.severity ?? 'info',
      persistent,
      durationMs: persistent ? null : (input.durationMs ?? this.defaultDurationMs),
      ...(input.target !== undefined ? { target: input.target } : {}),
      ...(input.actionLabel !== undefined ? { actionLabel: input.actionLabel } : {}),
      createdAt: this.now(),
    }

    this.items.push(item)
    this.emit()
    return item
  }

  dismiss(id: NotificationId): boolean {
    const index = this.items.findIndex((item) => item.id === id)
    if (index < 0) return false
    this.items.splice(index, 1)
    this.emit()
    return true
  }

  clear(): void {
    if (this.items.length === 0) return
    this.items.splice(0, this.items.length)
    this.emit()
  }

  getSnapshot(): readonly NotificationItem[] {
    return [...this.items]
  }

  subscribe(listener: NotificationStoreListener): NotificationStoreUnsubscribe {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    const snapshot = this.getSnapshot()
    for (const listener of this.listeners) listener(snapshot)
  }
}

export function createNotificationStore(options: NotificationStoreOptions = {}): NotificationStore {
  return new NotificationStore(options)
}
