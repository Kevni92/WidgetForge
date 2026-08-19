import { constrainPosition, type WindowGeometry, type WindowPosition, type WindowSize } from './window-geometry'

export type WindowSnapZone =
  | 'left' | 'right' | 'top' | 'bottom'
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  | 'left-third' | 'right-third' | 'left-two-thirds' | 'right-two-thirds'

export interface WindowSnapState { readonly zone: WindowSnapZone; readonly floatingGeometry: WindowGeometry }
export interface WindowSnapPreview { readonly zone: WindowSnapZone; readonly geometry: WindowGeometry }
export interface WindowSnapLayoutDefinition { readonly zone: WindowSnapZone; readonly label: string }

export const DEFAULT_SNAP_THRESHOLD = 28
export const WINDOW_SNAP_LAYOUTS: readonly WindowSnapLayoutDefinition[] = [
  { zone: 'left', label: 'Left half' }, { zone: 'right', label: 'Right half' },
  { zone: 'top', label: 'Top half' }, { zone: 'bottom', label: 'Bottom half' },
  { zone: 'top-left', label: 'Top left quarter' }, { zone: 'top-right', label: 'Top right quarter' },
  { zone: 'bottom-left', label: 'Bottom left quarter' }, { zone: 'bottom-right', label: 'Bottom right quarter' },
  { zone: 'left-third', label: 'Left third' }, { zone: 'right-two-thirds', label: 'Right two thirds' },
  { zone: 'left-two-thirds', label: 'Left two thirds' }, { zone: 'right-third', label: 'Right third' },
]
export const WINDOW_SNAP_ZONES: readonly WindowSnapZone[] = WINDOW_SNAP_LAYOUTS.map((layout) => layout.zone)
export function isWindowSnapZone(value: unknown): value is WindowSnapZone { return typeof value === 'string' && (WINDOW_SNAP_ZONES as readonly string[]).includes(value) }

export function detectWindowSnapZone(point: WindowPosition, container: WindowSize, threshold = DEFAULT_SNAP_THRESHOLD): WindowSnapZone | null {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null
  if (!Number.isFinite(container.width) || !Number.isFinite(container.height) || container.width <= 0 || container.height <= 0) return null
  const distance = Math.max(0, threshold)
  const nearLeft = point.x <= distance && point.x >= -distance
  const nearRight = point.x >= container.width - distance && point.x <= container.width + distance
  const nearTop = point.y <= distance && point.y >= -distance
  const nearBottom = point.y >= container.height - distance && point.y <= container.height + distance
  if (nearTop && nearLeft) return 'top-left'
  if (nearTop && nearRight) return 'top-right'
  if (nearBottom && nearLeft) return 'bottom-left'
  if (nearBottom && nearRight) return 'bottom-right'
  if (nearTop) return 'top'
  if (nearBottom) return 'bottom'
  if (nearLeft) return 'left'
  if (nearRight) return 'right'
  return null
}

export function snapWindowGeometry(zone: WindowSnapZone, container: WindowSize): WindowGeometry {
  const width = Math.max(0, Math.round(container.width))
  const height = Math.max(0, Math.round(container.height))
  const halfWidth = Math.floor(width / 2), halfHeight = Math.floor(height / 2)
  const thirdWidth = Math.floor(width / 3), twoThirdWidth = width - thirdWidth
  switch (zone) {
    case 'left': return { position: { x: 0, y: 0 }, size: { width: halfWidth, height } }
    case 'right': return { position: { x: halfWidth, y: 0 }, size: { width: width - halfWidth, height } }
    case 'top': return { position: { x: 0, y: 0 }, size: { width, height: halfHeight } }
    case 'bottom': return { position: { x: 0, y: halfHeight }, size: { width, height: height - halfHeight } }
    case 'top-left': return { position: { x: 0, y: 0 }, size: { width: halfWidth, height: halfHeight } }
    case 'top-right': return { position: { x: halfWidth, y: 0 }, size: { width: width - halfWidth, height: halfHeight } }
    case 'bottom-left': return { position: { x: 0, y: halfHeight }, size: { width: halfWidth, height: height - halfHeight } }
    case 'bottom-right': return { position: { x: halfWidth, y: halfHeight }, size: { width: width - halfWidth, height: height - halfHeight } }
    case 'left-third': return { position: { x: 0, y: 0 }, size: { width: thirdWidth, height } }
    case 'right-third': return { position: { x: twoThirdWidth, y: 0 }, size: { width: width - twoThirdWidth, height } }
    case 'left-two-thirds': return { position: { x: 0, y: 0 }, size: { width: twoThirdWidth, height } }
    case 'right-two-thirds': return { position: { x: thirdWidth, y: 0 }, size: { width: width - thirdWidth, height } }
  }
}

export function maximizeWindowGeometry(container: WindowSize): WindowGeometry {
  return { position: { x: 0, y: 0 }, size: { width: Math.max(0, Math.round(container.width)), height: Math.max(0, Math.round(container.height)) } }
}

export function restoreFloatingWindowGeometry(floating: WindowGeometry, pointer: WindowPosition, container: WindowSize): WindowGeometry {
  const size = { ...floating.size }
  const proposed = { x: pointer.x - size.width / 2, y: pointer.y - Math.min(18, size.height / 4) }
  return { position: constrainPosition(proposed, size, container), size }
}
