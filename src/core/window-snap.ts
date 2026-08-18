import { constrainPosition, type WindowGeometry, type WindowPosition, type WindowSize } from './window-geometry'

export type WindowSnapZone = 'left' | 'right' | 'top'

export interface WindowSnapState {
  readonly zone: WindowSnapZone
  readonly floatingGeometry: WindowGeometry
}

export interface WindowSnapPreview {
  readonly zone: WindowSnapZone
  readonly geometry: WindowGeometry
}

export const DEFAULT_SNAP_THRESHOLD = 28

export function detectWindowSnapZone(
  point: WindowPosition,
  container: WindowSize,
  threshold = DEFAULT_SNAP_THRESHOLD,
): WindowSnapZone | null {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null
  if (!Number.isFinite(container.width) || !Number.isFinite(container.height) || container.width <= 0 || container.height <= 0) return null
  const distance = Math.max(0, threshold)
  if (point.y <= distance && point.y >= -distance) return 'top'
  if (point.x <= distance && point.x >= -distance) return 'left'
  if (point.x >= container.width - distance && point.x <= container.width + distance) return 'right'
  return null
}

export function snapWindowGeometry(zone: WindowSnapZone, container: WindowSize): WindowGeometry {
  const width = Math.max(0, Math.round(container.width))
  const height = Math.max(0, Math.round(container.height))
  const leftWidth = Math.floor(width / 2)

  if (zone === 'left') {
    return { position: { x: 0, y: 0 }, size: { width: leftWidth, height } }
  }
  if (zone === 'right') {
    return { position: { x: leftWidth, y: 0 }, size: { width: width - leftWidth, height } }
  }
  return { position: { x: 0, y: 0 }, size: { width, height } }
}

export function restoreFloatingWindowGeometry(
  floating: WindowGeometry,
  pointer: WindowPosition,
  container: WindowSize,
): WindowGeometry {
  const size = { ...floating.size }
  const proposed = {
    x: pointer.x - size.width / 2,
    y: pointer.y - Math.min(18, size.height / 4),
  }
  return {
    position: constrainPosition(proposed, size, container),
    size,
  }
}
