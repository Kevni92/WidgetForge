import { describe, expect, it } from 'vitest'
import {
  constrainGeometry,
  moveWindow,
  normalizeWindowGeometry,
  resizeWindow,
  type ResizeHandle,
  type WindowGeometry,
  type WindowSizeConstraints,
} from '../src/core/window-geometry'

const start: WindowGeometry = {
  position: { x: 100, y: 100 },
  size: { width: 300, height: 200 },
}
const container = { width: 800, height: 600 }
const constraints: WindowSizeConstraints = {
  minSize: { width: 100, height: 80 },
  maxSize: { width: 500, height: 400 },
}

describe('window geometry', () => {
  it('moves windows while keeping a reachable part inside the container', () => {
    expect(moveWindow(start, { x: 1000, y: 1000 }, container).position).toEqual({ x: 736, y: 568 })
    expect(moveWindow(start, { x: -1000, y: -1000 }, container).position).toEqual({ x: -236, y: 0 })
  })

  it('resizes correctly from all four edges and four corners', () => {
    const cases: Array<[ResizeHandle, WindowGeometry]> = [
      ['top', { position: { x: 100, y: 130 }, size: { width: 300, height: 170 } }],
      ['bottom', { position: { x: 100, y: 100 }, size: { width: 300, height: 230 } }],
      ['left', { position: { x: 140, y: 100 }, size: { width: 260, height: 200 } }],
      ['right', { position: { x: 100, y: 100 }, size: { width: 340, height: 200 } }],
      ['top-left', { position: { x: 140, y: 130 }, size: { width: 260, height: 170 } }],
      ['top-right', { position: { x: 100, y: 130 }, size: { width: 340, height: 170 } }],
      ['bottom-left', { position: { x: 140, y: 100 }, size: { width: 260, height: 230 } }],
      ['bottom-right', { position: { x: 100, y: 100 }, size: { width: 340, height: 230 } }],
    ]

    for (const [handle, expected] of cases) {
      expect(resizeWindow(start, handle, { x: 40, y: 30 }, constraints, container)).toEqual(expected)
    }
  })

  it('enforces manifest min/max constraints without moving the opposite resize edge', () => {
    expect(resizeWindow(start, 'right', { x: -1000, y: 0 }, constraints, container).size.width).toBe(100)
    expect(resizeWindow(start, 'bottom', { x: 0, y: 1000 }, constraints, container).size.height).toBe(400)

    const leftMax = resizeWindow(start, 'left', { x: -1000, y: 0 }, constraints, container)
    expect(leftMax.size.width).toBe(500)
    expect(leftMax.position.x + leftMax.size.width).toBe(400)
  })

  it('handles a container smaller than the window without making the window unreachable', () => {
    const constrained = constrainGeometry(start, constraints, { width: 50, height: 20 })
    expect(constrained.position.x).toBeLessThanOrEqual(0)
    expect(constrained.position.x + constrained.size.width).toBeGreaterThanOrEqual(50)
    expect(constrained.position.y).toBe(0)
  })

  it('re-constrains an existing window after its container becomes smaller', () => {
    const geometry: WindowGeometry = {
      position: { x: 700, y: 500 },
      size: { width: 300, height: 200 },
    }

    expect(constrainGeometry(geometry, constraints, { width: 400, height: 300 }).position).toEqual({
      x: 336,
      y: 268,
    })
  })

  it('recovers invalid persisted values deterministically while keeping the minimum visible region reachable', () => {
    const normalized = normalizeWindowGeometry(
      { position: { x: Number.NaN, y: Number.POSITIVE_INFINITY }, size: { width: 10, height: 10 } },
      { minSize: { width: 320, height: 240 }, maxSize: null },
      { width: 200, height: 100 },
    )

    expect(normalized.size).toEqual({ width: 320, height: 240 })
    expect(normalized.position).toEqual({ x: 0, y: 0 })
    expect(normalized.position.x + normalized.size.width).toBeGreaterThanOrEqual(200)
    expect(normalized.position.y + normalized.size.height).toBeGreaterThanOrEqual(100)
  })
})
