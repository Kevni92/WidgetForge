import { createLayoutSurfaceStyle, type LayoutSurfaceStyle } from './layout-surface-style'

export type WindowLayer = 'normal' | 'always-on-top'
export type WindowHeaderMode = 'always' | 'focused' | 'hover' | 'hidden'
export type WindowRole = 'normal' | 'utility' | 'modal' | 'overlay'
export type WindowChromeMode = 'default' | 'borderless' | 'none'
export type WindowHeaderActionSide = 'left' | 'right'

export interface WindowHeaderAction {
  readonly id: string
  readonly label: string
  readonly side: WindowHeaderActionSide
  readonly icon?: string
  readonly tooltip?: string
  readonly actionRef?: string
  readonly disabled?: boolean
}

export type WindowHeaderActionInput = Omit<WindowHeaderAction, 'side'> & {
  readonly side?: WindowHeaderActionSide
}

export interface WindowOptions {
  readonly role: WindowRole
  readonly layer: WindowLayer
  readonly movable: boolean
  readonly resizable: boolean
  readonly minimizable: boolean
  readonly maximizable: boolean
  readonly closable: boolean
  readonly opacity: number
  readonly surfaceStyle?: LayoutSurfaceStyle
  readonly header: WindowHeaderMode
  readonly chrome: WindowChromeMode
  readonly glass: boolean
  readonly icon?: string
  readonly badge?: string
  readonly status?: string
  readonly headerActions: readonly WindowHeaderAction[]
}

export type WindowOptionsOverride = Partial<Omit<WindowOptions, 'headerActions' | 'surfaceStyle'>> & {
  readonly headerActions?: readonly WindowHeaderActionInput[]
  readonly surfaceStyle?: LayoutSurfaceStyle | undefined
}

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
  chrome: 'default',
  glass: false,
  headerActions: [],
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

function optionalText(value: string | undefined, label: string): string | undefined {
  if (value === undefined) return undefined
  const normalized = value.trim()
  if (!normalized) throw new WindowOptionsError(`${label} must not be empty`)
  return normalized
}

function normalizeHeaderActions(actions: WindowOptionsOverride['headerActions']): readonly WindowHeaderAction[] {
  if (!actions) return []
  const ids = new Set<string>()
  return actions.map((action) => {
    const id = action.id.trim()
    const label = action.label.trim()
    if (!id) throw new WindowOptionsError('window header action id must not be empty')
    if (!label) throw new WindowOptionsError(`window header action "${id}" label must not be empty`)
    if (ids.has(id)) throw new WindowOptionsError(`duplicate window header action id "${id}"`)
    ids.add(id)
    const side = action.side ?? 'right'
    if (side !== 'left' && side !== 'right') throw new WindowOptionsError(`unknown window header action side "${String(side)}"`)
    const icon = optionalText(action.icon, `window header action "${id}" icon`)
    const tooltip = optionalText(action.tooltip, `window header action "${id}" tooltip`)
    const actionRef = optionalText(action.actionRef, `window header action "${id}" actionRef`)
    return {
      id,
      label,
      side,
      ...(icon ? { icon } : {}),
      ...(tooltip ? { tooltip } : {}),
      ...(actionRef ? { actionRef } : {}),
      ...(action.disabled === true ? { disabled: true } : {}),
    }
  })
}

export function createWindowOptions(override: WindowOptionsOverride = {}): WindowOptions {
  const role = override.role ?? 'normal'
  const roleDefaults: WindowOptionsOverride = role === 'overlay'
    ? { header: 'hidden', chrome: 'borderless', glass: true, minimizable: false, maximizable: false }
    : role === 'modal'
      ? { minimizable: false, maximizable: false }
      : {}
  const merged = { ...defaultWindowOptions, ...roleDefaults, ...override, role }
  if (!['normal', 'utility', 'modal', 'overlay'].includes(merged.role)) throw new WindowOptionsError(`unknown window role "${String(merged.role)}"`)
  if (merged.layer !== 'normal' && merged.layer !== 'always-on-top') throw new WindowOptionsError(`unknown window layer "${String(merged.layer)}"`)
  if (!['always', 'focused', 'hover', 'hidden'].includes(merged.header)) throw new WindowOptionsError(`unknown window header mode "${String(merged.header)}"`)
  if (!['default', 'borderless', 'none'].includes(merged.chrome)) throw new WindowOptionsError(`unknown window chrome mode "${String(merged.chrome)}"`)
  let surfaceStyle: LayoutSurfaceStyle | undefined
  try { surfaceStyle = override.surfaceStyle ? createLayoutSurfaceStyle(override.surfaceStyle) : undefined } catch (error) {
    throw new WindowOptionsError(error instanceof Error ? error.message : 'invalid window surface style')
  }
  const opacity = surfaceStyle?.opacity ?? merged.opacity
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) throw new WindowOptionsError('window opacity must be between 0 and 1')

  const icon = optionalText(override.icon, 'window icon')
  const badge = optionalText(override.badge, 'window badge')
  const status = optionalText(override.status, 'window status')
  return {
    role: merged.role,
    layer: merged.layer,
    movable: merged.movable,
    resizable: merged.resizable,
    minimizable: merged.minimizable,
    maximizable: merged.maximizable,
    closable: merged.closable,
    opacity,
    header: merged.header,
    chrome: merged.chrome,
    glass: merged.glass,
    ...(icon ? { icon } : {}),
    ...(badge ? { badge } : {}),
    ...(status ? { status } : {}),
    ...(surfaceStyle ? { surfaceStyle } : {}),
    headerActions: normalizeHeaderActions(override.headerActions),
  }
}

export function cloneWindowOptions(options: WindowOptions): WindowOptions {
  return createWindowOptions(options)
}
