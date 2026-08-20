import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import { detectWindowSnapZone, maximizeWindowGeometry, restoreFloatingWindowGeometry, snapWindowGeometry } from '../src/core/window-snap'

const Widget = defineComponent({ template: '<span />' })
const registry = createWidgetRegistry([defineWidget({ id: 'test.snap', title: 'Snap', component: Widget })])

describe('window snap geometry', () => {
  it('detects half and quarter edge targets deterministically', () => {
    const size = { width: 1000, height: 700 }
    expect(detectWindowSnapZone({ x: 10, y: 300 }, size)).toBe('left')
    expect(detectWindowSnapZone({ x: 990, y: 300 }, size)).toBe('right')
    expect(detectWindowSnapZone({ x: 10, y: 5 }, size)).toBe('top-left')
    expect(detectWindowSnapZone({ x: 990, y: 695 }, size)).toBe('bottom-right')
    expect(detectWindowSnapZone({ x: 400, y: 5 }, size)).toBe('top')
    expect(detectWindowSnapZone({ x: 400, y: 695 }, size)).toBe('bottom')
    expect(detectWindowSnapZone({ x: 400, y: 300 }, size)).toBeNull()
  })

  it('builds halves, quarters, thirds and maximize geometries for odd sizes', () => {
    const size = { width: 1001, height: 701 }
    expect(snapWindowGeometry('left', size)).toEqual({ position: { x: 0, y: 0 }, size: { width: 500, height: 701 } })
    expect(snapWindowGeometry('right', size)).toEqual({ position: { x: 500, y: 0 }, size: { width: 501, height: 701 } })
    expect(snapWindowGeometry('top', size)).toEqual({ position: { x: 0, y: 0 }, size: { width: 1001, height: 350 } })
    expect(snapWindowGeometry('bottom', size)).toEqual({ position: { x: 0, y: 350 }, size: { width: 1001, height: 351 } })
    expect(snapWindowGeometry('top-left', size)).toEqual({ position: { x: 0, y: 0 }, size: { width: 500, height: 350 } })
    expect(snapWindowGeometry('bottom-right', size)).toEqual({ position: { x: 500, y: 350 }, size: { width: 501, height: 351 } })
    expect(snapWindowGeometry('left-third', size)).toEqual({ position: { x: 0, y: 0 }, size: { width: 333, height: 701 } })
    expect(snapWindowGeometry('right-two-thirds', size)).toEqual({ position: { x: 333, y: 0 }, size: { width: 668, height: 701 } })
    expect(snapWindowGeometry('left-two-thirds', size)).toEqual({ position: { x: 0, y: 0 }, size: { width: 668, height: 701 } })
    expect(snapWindowGeometry('right-third', size)).toEqual({ position: { x: 668, y: 0 }, size: { width: 333, height: 701 } })
    expect(maximizeWindowGeometry(size)).toEqual({ position: { x: 0, y: 0 }, size })
  })

  it('restores floating geometry near the pointer while respecting reachability bounds', () => {
    const geometry = restoreFloatingWindowGeometry({ position: { x: 40, y: 50 }, size: { width: 400, height: 260 } }, { x: 600, y: 20 }, { width: 800, height: 500 })
    expect(geometry.size).toEqual({ width: 400, height: 260 }); expect(geometry.position).toEqual({ x: 400, y: 2 })
  })
})

describe('WindowManager snap and maximize state', () => {
  it('preserves the original floating geometry across snap and maximize transitions', () => {
    const manager = createWindowManager(registry)
    manager.open({ widgetId: 'test.snap', instanceId: 'snap', position: { x: 120, y: 90 }, size: { width: 420, height: 280 } })
    manager.snapWindow('snap', 'left-third', { width: 1000, height: 700 })
    manager.snapWindow('snap', 'right-two-thirds', { width: 1000, height: 700 })
    expect(manager.get('snap').snap?.floatingGeometry).toEqual({ position: { x: 120, y: 90 }, size: { width: 420, height: 280 } })

    manager.maximizeWindow('snap', { width: 1000, height: 700 })
    expect(manager.get('snap')).toMatchObject({ mode: 'maximized', snap: null, restoreGeometry: { position: { x: 120, y: 90 }, size: { width: 420, height: 280 } }, geometry: { position: { x: 0, y: 0 }, size: { width: 1000, height: 700 } } })
    manager.snapWindow('snap', 'bottom-right', { width: 1000, height: 700 })
    expect(manager.get('snap').snap?.floatingGeometry).toEqual({ position: { x: 120, y: 90 }, size: { width: 420, height: 280 } })
    manager.maximizeWindow('snap', { width: 1000, height: 700 })
    manager.restore('snap')
    expect(manager.get('snap')).toMatchObject({ mode: 'normal', snap: null, restoreGeometry: null, geometry: { position: { x: 120, y: 90 }, size: { width: 420, height: 280 } } })
  })

  it('recomputes snapped and maximized geometry when the available workspace changes', () => {
    const manager = createWindowManager(registry)
    manager.open({ widgetId: 'test.snap', instanceId: 'snap' })
    manager.snapWindow('snap', 'left', { width: 1000, height: 700 }); manager.constrainToContainer('snap', { width: 800, height: 600 })
    expect(manager.get('snap').geometry).toEqual({ position: { x: 0, y: 0 }, size: { width: 400, height: 600 } })
    manager.maximizeWindow('snap', { width: 800, height: 600 }); manager.constrainToContainer('snap', { width: 620, height: 480 })
    expect(manager.get('snap').geometry).toEqual({ position: { x: 0, y: 0 }, size: { width: 620, height: 480 } })
  })

  it('materializes a manual geometry change after snap and does not reapply the old zone', () => {
    const manager = createWindowManager(registry)
    manager.open({ widgetId: 'test.snap', instanceId: 'snap', position: { x: 120, y: 90 }, size: { width: 420, height: 280 } })
    manager.snapWindow('snap', 'left', { width: 1000, height: 700 })
    expect(manager.get('snap').geometry).toEqual({ position: { x: 0, y: 0 }, size: { width: 500, height: 700 } })

    manager.setGeometry('snap', { position: { x: 0, y: 0 }, size: { width: 320, height: 500 } }, 'user')
    expect(manager.get('snap')).toMatchObject({ snap: null, geometry: { position: { x: 0, y: 0 }, size: { width: 320, height: 500 } } })

    manager.constrainToContainer('snap', { width: 1400, height: 900 }, 'api')
    expect(manager.get('snap').geometry).toEqual({ position: { x: 0, y: 0 }, size: { width: 320, height: 500 } })
  })

  it('can snap again after a manual resize and follows the new zone on resize', () => {
    const manager = createWindowManager(registry)
    manager.open({ widgetId: 'test.snap', instanceId: 'snap' })
    manager.snapWindow('snap', 'left', { width: 1000, height: 700 })
    manager.setGeometry('snap', { position: { x: 0, y: 0 }, size: { width: 320, height: 500 } }, 'user')
    manager.snapWindow('snap', 'right', { width: 1000, height: 700 })

    expect(manager.get('snap').snap?.zone).toBe('right')
    manager.constrainToContainer('snap', { width: 800, height: 600 }, 'api')
    expect(manager.get('snap').geometry).toEqual({ position: { x: 400, y: 0 }, size: { width: 400, height: 600 } })
  })

  it('locks the free geometry after snap followed by a manual resize', () => {
    const manager = createWindowManager(registry)
    manager.open({ widgetId: 'test.snap', instanceId: 'snap' })
    manager.snapWindow('snap', 'left', { width: 1000, height: 700 })
    manager.setGeometry('snap', { position: { x: 20, y: 30 }, size: { width: 320, height: 500 } }, 'user')

    const locked = manager.lockWindow('snap', 'user')
    expect(locked).toMatchObject({ layoutLocked: true, snap: null, geometry: { position: { x: 20, y: 30 }, size: { width: 320, height: 500 } } })
    expect(locked.layoutSpec).toBeUndefined()
  })
})
