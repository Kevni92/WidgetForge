export interface WindowPosition {
  x: number
  y: number
}

export interface WindowSize {
  width: number
  height: number
}

export interface WindowGeometry {
  position: WindowPosition
  size: WindowSize
}

export interface WindowSizeConstraints {
  minSize: WindowSize
  maxSize: WindowSize | null
}

export type ResizeHandle =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'

export const DEFAULT_WINDOW_SIZE: WindowSize = { width: 420, height: 300 }
export const DEFAULT_MIN_WINDOW_SIZE: WindowSize = { width: 160, height: 96 }
export const DEFAULT_MIN_VISIBLE: WindowSize = { width: 64, height: 32 }

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

export function constrainSize(size: WindowSize, constraints: WindowSizeConstraints): WindowSize {
  const maxWidth = constraints.maxSize?.width ?? Number.POSITIVE_INFINITY
  const maxHeight = constraints.maxSize?.height ?? Number.POSITIVE_INFINITY
  return {
    width: clamp(finite(size.width, constraints.minSize.width), constraints.minSize.width, maxWidth),
    height: clamp(finite(size.height, constraints.minSize.height), constraints.minSize.height, maxHeight),
  }
}

export function constrainPosition(
  position: WindowPosition,
  size: WindowSize,
  container: WindowSize,
  minimumVisible: WindowSize = DEFAULT_MIN_VISIBLE,
): WindowPosition {
  if (container.width <= 0 || container.height <= 0) return { ...position }

  const visibleWidth = Math.min(minimumVisible.width, size.width, container.width)
  const visibleHeight = Math.min(minimumVisible.height, size.height, container.height)
  const minX = visibleWidth - size.width
  const maxX = container.width - visibleWidth
  const minY = 0
  const maxY = container.height - visibleHeight

  return {
    x: clamp(finite(position.x, 0), minX, maxX),
    y: clamp(finite(position.y, 0), minY, maxY),
  }
}

export function constrainGeometry(
  geometry: WindowGeometry,
  constraints: WindowSizeConstraints,
  container: WindowSize,
  minimumVisible: WindowSize = DEFAULT_MIN_VISIBLE,
): WindowGeometry {
  const size = constrainSize(geometry.size, constraints)
  return {
    size,
    position: constrainPosition(geometry.position, size, container, minimumVisible),
  }
}

export function moveWindow(
  start: WindowGeometry,
  delta: WindowPosition,
  container: WindowSize,
  minimumVisible: WindowSize = DEFAULT_MIN_VISIBLE,
): WindowGeometry {
  return {
    size: { ...start.size },
    position: constrainPosition(
      { x: start.position.x + delta.x, y: start.position.y + delta.y },
      start.size,
      container,
      minimumVisible,
    ),
  }
}

export function resizeWindow(
  start: WindowGeometry,
  handle: ResizeHandle,
  delta: WindowPosition,
  constraints: WindowSizeConstraints,
  container: WindowSize,
  minimumVisible: WindowSize = DEFAULT_MIN_VISIBLE,
): WindowGeometry {
  const resizeLeft = handle.includes('left')
  const resizeRight = handle.includes('right')
  const resizeTop = handle.includes('top')
  const resizeBottom = handle.includes('bottom')

  let width = start.size.width
  let height = start.size.height

  if (resizeLeft) width -= delta.x
  if (resizeRight) width += delta.x
  if (resizeTop) height -= delta.y
  if (resizeBottom) height += delta.y

  const size = constrainSize({ width, height }, constraints)
  const right = start.position.x + start.size.width
  const bottom = start.position.y + start.size.height

  const position = {
    x: resizeLeft ? right - size.width : start.position.x,
    y: resizeTop ? bottom - size.height : start.position.y,
  }

  return {
    size,
    position: constrainPosition(position, size, container, minimumVisible),
  }
}

export function sameGeometry(left: WindowGeometry, right: WindowGeometry): boolean {
  return left.position.x === right.position.x
    && left.position.y === right.position.y
    && left.size.width === right.size.width
    && left.size.height === right.size.height
}
