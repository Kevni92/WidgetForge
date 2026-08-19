import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'

const EmptyWidget = defineComponent({ template: '<div />' })

describe('WindowManager geometry', () => {
  it('derives initial size constraints from widget metadata and keeps geometry serializable', () => {
    const registry = createWidgetRegistry([
      defineWidget({
        id: 'test.geometry',
        title: 'Geometry',
        component: EmptyWidget,
        window: {
          defaultSize: { width: 320, height: 220 },
          minSize: { width: 200, height: 140 },
          maxSize: { width: 500, height: 360 },
        },
      }),
    ])
    const manager = createWindowManager(registry)
    const opened = manager.open({ widgetId: 'test.geometry', position: { x: 700, y: 500 } })

    expect(opened.geometry).toEqual({
      position: { x: 700, y: 500 },
      size: { width: 320, height: 220 },
    })
    expect(opened.constraints).toEqual({
      minSize: { width: 200, height: 140 },
      maxSize: { width: 500, height: 360 },
    })
    expect(() => JSON.stringify(manager.snapshot())).not.toThrow()
  })

  it('clamps direct geometry changes and repositions windows when the container shrinks', () => {
    const registry = createWidgetRegistry([
      defineWidget({
        id: 'test.geometry',
        title: 'Geometry',
        component: EmptyWidget,
        window: {
          defaultSize: { width: 300, height: 200 },
          minSize: { width: 200, height: 120 },
          maxSize: { width: 500, height: 400 },
        },
      }),
    ])
    const manager = createWindowManager(registry)
    const opened = manager.open({ widgetId: 'test.geometry', position: { x: 700, y: 500 } })

    manager.setGeometry(opened.instanceId, {
      position: { x: 700, y: 500 },
      size: { width: 50, height: 900 },
    })
    expect(manager.get(opened.instanceId).geometry.size).toEqual({ width: 200, height: 400 })

    manager.constrainToContainer(opened.instanceId, { width: 400, height: 300 })
    expect(manager.get(opened.instanceId).geometry.position).toEqual({ x: 336, y: 268 })
  })

  it('recomputes maximize and snap geometry from the current container', () => {
    const registry = createWidgetRegistry([
      defineWidget({
        id: 'test.geometry',
        title: 'Geometry',
        component: EmptyWidget,
        window: { defaultSize: { width: 300, height: 200 }, minSize: { width: 200, height: 120 } },
      }),
    ])
    const manager = createWindowManager(registry)
    manager.open({ widgetId: 'test.geometry', instanceId: 'max', position: { x: 900, y: 700 } })

    manager.maximizeWindow('max', { width: 1200, height: 800 })
    manager.constrainToContainer('max', { width: 600, height: 400 })
    expect(manager.get('max').geometry).toEqual({ position: { x: 0, y: 0 }, size: { width: 600, height: 400 } })
    expect(manager.get('max').restoreGeometry?.position).toEqual({ x: 536, y: 368 })

    manager.restore('max')
    manager.snapWindow('max', 'right', { width: 1200, height: 800 })
    manager.constrainToContainer('max', { width: 600, height: 400 })
    expect(manager.get('max').geometry).toEqual({ position: { x: 300, y: 0 }, size: { width: 300, height: 400 } })
    expect(manager.get('max').snap?.floatingGeometry.position).toEqual({ x: 536, y: 368 })
  })
})
