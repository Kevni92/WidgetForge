import { describe, expect, it } from 'vitest'
import { createReferenceLayout, type ReferenceWindowId } from '../src/reference-layout'

const ids: readonly ReferenceWindowId[] = ['market-main', 'colony-main', 'alerts-main', 'telemetry-power', 'operations-main', 'economy-flow']

describe('playground reference layout', () => {
  it.each([
    { width: 1920, height: 936 },
    { width: 1440, height: 756 },
    { width: 1280, height: 576 },
    { width: 1024, height: 624 },
  ])('keeps every default window recoverable at $width×$height', (viewport) => {
    const layout = createReferenceLayout(viewport)
    for (const id of ids) {
      const geometry = layout[id]
      const visibleWidth = Math.min(64, geometry.size.width, viewport.width)
      const visibleHeight = Math.min(32, geometry.size.height, viewport.height)
      expect(geometry.position.x).toBeGreaterThanOrEqual(visibleWidth - geometry.size.width)
      expect(geometry.position.x).toBeLessThanOrEqual(viewport.width - visibleWidth)
      expect(geometry.position.y).toBeGreaterThanOrEqual(0)
      expect(geometry.position.y).toBeLessThanOrEqual(viewport.height - visibleHeight)
    }
  })

  it('uses the right side of a wide workspace instead of a fixed left cluster', () => {
    const layout = createReferenceLayout({ width: 1920, height: 936 })
    expect(layout['alerts-main'].position.x).toBeGreaterThan(1000)
    expect(layout['telemetry-power'].position.x).toBeGreaterThan(1000)
    expect(layout['economy-flow'].position.x).toBeGreaterThan(500)
  })
})
