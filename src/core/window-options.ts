export type WindowLayer = 'normal' | 'always-on-top'
export type WindowHeaderMode = 'always' | 'focused' | 'hidden'
export type WindowRole = 'normal' | 'utility' | 'modal' | 'overlay'

export interface WindowOptions {
  readonly role: WindowRole
  readonly layer: WindowLayer
  readonly movable: boolean
  readonly resizable: boolean
  readonly minimizable: boolean
  readonly maximizable: boolean
  readonly closable: boolean
  readonly opacity: number
  readonly header: WindowHeaderMode
}

export type WindowOptionsOverride = Partial<WindowOptions>

export const defaultWindowOptions: WindowOptions = {
  role: 'normal',
  layer: 'normal',
  movable: true,
  resizable: true,
  minimizable: true,
  maximizable: true,
  closable: true,
  opacity: 1,
  header: 'always',
}

export class WindowOptionsError extends Error {
  constructor(message: string) { super(message); this.name = 'WindowOptionsError' }
}

export function windowRoleRank(role: WindowRole): number {
  switch (role) {
    case 'normal': return 0
    case 'utility': return 1
    case 'overlay': return 2
    case 'modal': return 3
  }
}

export function createWindowOptions(override: WindowOptionsOverride = {}): WindowOptions {
  const role = override.role ?? 'normal'
  const roleDefaults: WindowOptionsOverride = role === 'overlay'
    ? { header: 'hidden', minimizable: false, maximizable: false }
    : role === 'modal'
      ? { minimizable: false, maximizable: false }
      : {}
  const options: WindowOptions = { ...defaultWindowOptions, ...roleDefaults, ...override, role }
  if (!['normal', 'utility', 'modal', 'overlay'].includes(options.role)) throw new WindowOptionsError(`unknown window role "${String(options.role)}"`)
  if (options.layer !== 'normal' && options.layer !== 'always-on-top') throw new WindowOptionsError(`unknown window layer "${String(options.layer)}"`)
  if (options.header !== 'always' && options.header !== 'focused' && options.header !== 'hidden') throw new WindowOptionsError(`unknown window header mode "${String(options.header)}"`)
  if (!Number.isFinite(options.opacity) || options.opacity < 0 || options.opacity > 1) throw new WindowOptionsError('window opacity must be between 0 and 1')
  return options
}
