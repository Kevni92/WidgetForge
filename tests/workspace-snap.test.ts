import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import { captureWorkspace, restoreWorkspace, serializeWorkspace } from '../src/core/workspace'

const Widget = defineComponent({ template: '<span />' })
const registry = createWidgetRegistry([defineWidget({ id: 'test.snap-persist', title: 'Snap', component: Widget })])

describe('workspace snap persistence', () => {
  it('preserves snap zone and the pre-snap floating geometry', () => {
    const source = createWindowManager(registry)
    source.open({
      widgetId: 'test.snap-persist',
      instanceId: 'snap',
      position: { x: 140, y: 100 },
      size: { width: 380, height: 260 },
    })
    source.snapWindow('snap', 'right', { width: 900, height: 600 })

    const snapshot = captureWorkspace(source)
    expect(snapshot.windows[0]?.snap).toEqual({
      zone: 'right',
      floatingGeometry: { position: { x: 140, y: 100 }, size: { width: 380, height: 260 } },
    })

    const target = createWindowManager(registry)
    const result = restoreWorkspace(target, serializeWorkspace(source))
    expect(result.valid).toBe(true)
    expect(target.get('snap').snap).toEqual(snapshot.windows[0]?.snap)
    expect(target.get('snap').geometry).toEqual({ position: { x: 450, y: 0 }, size: { width: 450, height: 600 } })

    target.unsnapWindow('snap')
    expect(target.get('snap').geometry).toEqual({ position: { x: 140, y: 100 }, size: { width: 380, height: 260 } })
  })
})
