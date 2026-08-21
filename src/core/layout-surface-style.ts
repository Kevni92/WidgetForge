export type LayoutSurfaceSide = 'top' | 'right' | 'bottom' | 'left'
export type LayoutSurfaceBackgroundMode = 'theme' | 'transparent' | 'custom'
export type LayoutSurfaceShadow = 'none' | 'sm' | 'md' | 'lg'

export interface LayoutSurfaceBackground {
  readonly mode: LayoutSurfaceBackgroundMode
  readonly color?: string
}

export interface LayoutSurfaceBorder {
  readonly enabled: boolean
  readonly width: number
  readonly color?: string
}

export interface LayoutSurfaceStyle {
  readonly background?: LayoutSurfaceBackground
  readonly border?: Partial<Record<LayoutSurfaceSide, LayoutSurfaceBorder>>
  readonly borderRadius?: number
  readonly padding?: Partial<Record<LayoutSurfaceSide, number>>
  readonly opacity?: number
  readonly shadow?: LayoutSurfaceShadow
}

export interface ResolvedLayoutSurfaceStyle {
  readonly background: LayoutSurfaceBackground
  readonly border: Record<LayoutSurfaceSide, LayoutSurfaceBorder>
  readonly borderRadius: number
  readonly padding: Record<LayoutSurfaceSide, number>
  readonly opacity: number
  readonly shadow: LayoutSurfaceShadow
}

export class LayoutSurfaceStyleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LayoutSurfaceStyleError'
  }
}

const surfaceSides: readonly LayoutSurfaceSide[] = ['top', 'right', 'bottom', 'left']
const backgroundModes: readonly LayoutSurfaceBackgroundMode[] = ['theme', 'transparent', 'custom']
const shadows: readonly LayoutSurfaceShadow[] = ['none', 'sm', 'md', 'lg']

export const defaultResolvedLayoutSurfaceStyle: ResolvedLayoutSurfaceStyle = {
  background: { mode: 'theme' },
  border: {
    top: { enabled: false, width: 0 },
    right: { enabled: false, width: 0 },
    bottom: { enabled: false, width: 0 },
    left: { enabled: false, width: 0 },
  },
  borderRadius: 0,
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
  opacity: 1,
  shadow: 'none',
}

function cloneBackground(background: LayoutSurfaceBackground): LayoutSurfaceBackground {
  return { mode: background.mode, ...(background.color !== undefined ? { color: background.color } : {}) }
}

function cloneBorder(border: LayoutSurfaceBorder): LayoutSurfaceBorder {
  return { enabled: border.enabled, width: border.width, ...(border.color !== undefined ? { color: border.color } : {}) }
}

function isSide(value: string): value is LayoutSurfaceSide {
  return surfaceSides.includes(value as LayoutSurfaceSide)
}

function validateFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) throw new LayoutSurfaceStyleError(`${label} must be finite and non-negative`)
}

function validateColor(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new LayoutSurfaceStyleError(`${label} must not be empty`)
}

export function createLayoutSurfaceStyle(style: LayoutSurfaceStyle = {}): LayoutSurfaceStyle {
  if (style.background !== undefined) {
    if (!backgroundModes.includes(style.background.mode)) throw new LayoutSurfaceStyleError(`unknown surface background mode "${String(style.background.mode)}"`)
    if (style.background.mode === 'custom') {
      validateColor(style.background.color, 'surface background color')
    } else if (style.background.color !== undefined) {
      throw new LayoutSurfaceStyleError('surface background color is only valid for custom backgrounds')
    }
  }
  if (style.border !== undefined) {
    for (const [side, border] of Object.entries(style.border)) {
      if (!isSide(side) || !border || typeof border !== 'object') throw new LayoutSurfaceStyleError(`invalid surface border side "${side}"`)
      if (typeof border.enabled !== 'boolean') throw new LayoutSurfaceStyleError(`surface border ${side} enabled must be boolean`)
      validateFiniteNonNegative(border.width, `surface border ${side} width`)
      if (border.color !== undefined) validateColor(border.color, `surface border ${side} color`)
    }
  }
  if (style.borderRadius !== undefined) validateFiniteNonNegative(style.borderRadius, 'surface borderRadius')
  if (style.padding !== undefined) {
    for (const [side, padding] of Object.entries(style.padding)) {
      if (!isSide(side) || typeof padding !== 'number') throw new LayoutSurfaceStyleError(`invalid surface padding side "${side}"`)
      validateFiniteNonNegative(padding, `surface padding ${side}`)
    }
  }
  if (style.opacity !== undefined && (!Number.isFinite(style.opacity) || style.opacity < 0 || style.opacity > 1)) {
    throw new LayoutSurfaceStyleError('surface opacity must be between 0 and 1')
  }
  if (style.shadow !== undefined && !shadows.includes(style.shadow)) throw new LayoutSurfaceStyleError(`unknown surface shadow "${String(style.shadow)}"`)

  return {
    ...(style.background ? { background: cloneBackground(style.background) } : {}),
    ...(style.border ? { border: Object.fromEntries(Object.entries(style.border).map(([side, border]) => [side, cloneBorder(border)])) as Partial<Record<LayoutSurfaceSide, LayoutSurfaceBorder>> } : {}),
    ...(style.borderRadius !== undefined ? { borderRadius: style.borderRadius } : {}),
    ...(style.padding ? { padding: { ...style.padding } } : {}),
    ...(style.opacity !== undefined ? { opacity: style.opacity } : {}),
    ...(style.shadow !== undefined ? { shadow: style.shadow } : {}),
  }
}

export function cloneLayoutSurfaceStyle(style: LayoutSurfaceStyle | undefined): LayoutSurfaceStyle | undefined {
  return style === undefined ? undefined : createLayoutSurfaceStyle(style)
}

export function resolveLayoutSurfaceStyle(
  style: LayoutSurfaceStyle | undefined,
  defaults: ResolvedLayoutSurfaceStyle = defaultResolvedLayoutSurfaceStyle,
): ResolvedLayoutSurfaceStyle {
  const normalized = createLayoutSurfaceStyle(style ?? {})
  const background = normalized.background ? cloneBackground(normalized.background) : cloneBackground(defaults.background)
  const border = Object.fromEntries(surfaceSides.map((side) => [side, cloneBorder(normalized.border?.[side] ?? defaults.border[side])])) as Record<LayoutSurfaceSide, LayoutSurfaceBorder>
  const padding = Object.fromEntries(surfaceSides.map((side) => [side, normalized.padding?.[side] ?? defaults.padding[side]])) as Record<LayoutSurfaceSide, number>
  return {
    background,
    border,
    borderRadius: normalized.borderRadius ?? defaults.borderRadius,
    padding,
    opacity: normalized.opacity ?? defaults.opacity,
    shadow: normalized.shadow ?? defaults.shadow,
  }
}

export function surfaceStyleToCssVars(style: LayoutSurfaceStyle | undefined): Record<string, string> {
  if (!style) return {}
  const normalized = createLayoutSurfaceStyle(style)
  const vars: Record<string, string> = {}
  if (normalized.background) {
    vars['--wf-surface-background'] = normalized.background.mode === 'theme'
      ? 'var(--wf-color-surface)'
      : normalized.background.mode === 'transparent' ? 'transparent' : normalized.background.color as string
  }
  for (const side of surfaceSides) {
    const border = normalized.border ? normalized.border[side] ?? { enabled: false, width: 0 } : undefined
    if (border) {
      vars[`--wf-surface-border-${side}-width`] = border.enabled ? `${border.width}px` : '0px'
      if (border.color !== undefined) vars[`--wf-surface-border-${side}-color`] = border.color
    }
    const padding = normalized.padding ? normalized.padding[side] ?? 0 : undefined
    if (padding !== undefined) vars[`--wf-surface-padding-${side}`] = `${padding}px`
  }
  if (normalized.borderRadius !== undefined) vars['--wf-surface-radius'] = `${normalized.borderRadius}px`
  if (normalized.opacity !== undefined) vars['--wf-surface-opacity'] = String(normalized.opacity)
  if (normalized.shadow !== undefined) vars['--wf-surface-shadow'] = normalized.shadow === 'none' ? 'none' : `var(--wf-shadow-${normalized.shadow})`
  return vars
}

export function parseLayoutSurfaceStyle(value: unknown): LayoutSurfaceStyle | undefined | null {
  if (value === undefined) return undefined
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  try { return createLayoutSurfaceStyle(value as LayoutSurfaceStyle) } catch { return null }
}

export interface LegacyPaneSurfaceSettings {
  readonly background?: 'transparent' | 'canvas' | 'surface' | 'surface-raised'
  readonly backgroundColor?: string
}

export function resolveLegacyPaneSurfaceStyle(settings: LegacyPaneSurfaceSettings | undefined): LayoutSurfaceStyle | undefined {
  if (!settings) return undefined
  if (settings.backgroundColor) return { background: { mode: 'custom', color: settings.backgroundColor } }
  switch (settings.background) {
    case 'transparent': return { background: { mode: 'transparent' } }
    case 'canvas': return { background: { mode: 'custom', color: 'var(--wf-color-canvas)' } }
    case 'surface': return { background: { mode: 'custom', color: 'var(--wf-color-surface)' } }
    case 'surface-raised': return { background: { mode: 'custom', color: 'var(--wf-color-surface-raised)' } }
    default: return undefined
  }
}
