import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import {
  detectWindowSnapZone,
  restoreFloatingWindowGeometry,
  snapWindowGeometry,
} from '../src/core/window-snap'

const Widget = defineComponent({ template: '<span />' })
const registry = createWidgetRegistry([defineWidget({ id: 'test.snap', title: 'Snap', component: Widget })])

describe('window snap geometry', () => {
  it('detects only the configured workspace edges with top priority', () => {
    const size = { width: 1000, height: 700 }
    expect(detectWindowSnapZone({ x: 10, y: 300 }, size)).toBe('left')
    expect(detectWindowSnapZone({ x: 990, y: 300 }, size)).toBe('right')
    expect(detectWindowSnapZone({ x: 10, y: 5 }, size)).toBe('top')
    expect(detectWindowSnapZone({ x: 400, y: 300 }, size)).toBeNull()
  })

  it('builds deterministic half and maximized geometries for odd widths', () => {
    expect(snapWindowGeometry('left', { width: 1001, height: 701 })).toEqual({
      position: { x: 0, y: 0 }, size: { width: 500, height: 701 },
    })
    expect(snapWindowGeometry('right', { width: 1001, height: 701 })).toEqual({
      position: { x: 500, y: 0 }, size: { width: 501, height: 701 },
    })
    expect(snapWindowGeometry('top', { width: 1001, height: 701 })).toEqual({
      position: { x: 0, y: 0 }, size: { width: 1001, height: 701 },
    })
  })

  it('restores floating geometry near the pointer while respecting reachability bounds', () => {
    const geometry = restoreFloatingWindowGeometry(
      { position: { x: 40, y: 50 }, size: { width: 400, height: 260 } },
      { x: 600, y: 20 },
      { width: 800, height: 500 },
    )
    expect(geometry.size).toEqual({ width: 400, height: 260 })
    expect(geometry.position.x).toBe(400)
    expect(geometry.position.y).toBe(2)
  })
})

describe('WindowManager snap state', () => {
  it('preserves the original floating geometry across zone changes and restores it', () => {
    const manager = createWindowManager(registry)
    manager.open({
      widgetId: 'test.snap',
      instanceId: 'snap',
      position: { x: 120, y: 90 },
      size: { width: 420, height: 280 },
    })

    manager.snapWindow('snap', 'left', { width: 1000, height: 700 })
    expect(manager.get('snap')).toMatchObject({
      snap: { zone: 'left', floatingGeometry: { position: { x: 120, y: 90 }, size: { width: 420, height: 280 } } },
      geometry: { position: { x: 0, y: 0 }, size: { width: 500, height: 700 } },
    })

    manager.snapWindow('snap', 'right', { width: 1000, height: 700 })
    expect(manager.get('snap').snap?.floatingGeometry.position).toEqual({ x: 120, y: 90 })

    manager.unsnapWindow('snap')
    expect(manager.get('snap').snap).toBeNull()
    expect(manager.get('snap').geometry).toEqual({ position: { x: 120, y: 90 }, size: { width: 420, height: 280 } })
  })

  it('recomputes snapped geometry when the available workspace changes', () => {
    const manager = createWindowManager(registry)
    manager.open({ widgetId: 'test.snap', instanceId: 'snap' })
    manager.snapWindow('snap', 'left', { width: 1000, height: 700 })
    manager.constrainToContainer('snap', { width: 800, height: 600 })

    expect(manager.get('snap').geometry).toEqual({ position: { x: 0, y: 0 }, size: { width: 400, height: 600 } })
  })
})
