import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { moveWindowGroup } from '../src/core/window-geometry'
import { createWindowGroupManager, WindowGroupDefinitionError } from '../src/core/window-groups'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'

const Widget = defineComponent({ template: '<span>group</span>' })
function setup() {
  const registry = createWidgetRegistry([defineWidget({ id: 'group.widget', title: 'Group', component: Widget })])
  const windows = createWindowManager(registry)
  windows.open({ widgetId: 'group.widget', instanceId: 'a', position: { x: 40, y: 50 }, size: { width: 200, height: 140 } })
  windows.open({ widgetId: 'group.widget', instanceId: 'b', position: { x: 300, y: 180 }, size: { width: 220, height: 160 }, options: { layer: 'always-on-top' } })
  return { windows, groups: createWindowGroupManager(windows) }
}

describe('window group geometry', () => {
  it('clamps one shared delta so relative geometry is preserved', () => {
    const starts = [
      { id: 'a', geometry: { position: { x: 40, y: 50 }, size: { width: 200, height: 140 } } },
      { id: 'b', geometry: { position: { x: 300, y: 180 }, size: { width: 220, height: 160 } } },
    ]
    const moved = moveWindowGroup(starts, { x: 1000, y: 1000 }, { width: 600, height: 400 })
    expect(moved[1]!.geometry.position.x - moved[0]!.geometry.position.x).toBe(260)
    expect(moved[1]!.geometry.position.y - moved[0]!.geometry.position.y).toBe(130)
  })
})

describe('WindowGroupManager', () => {
  it('groups, moves, removes and preserves window layers', () => {
    const { windows, groups } = setup()
    groups.assign('ops', ['a', 'b'])
    const snapshot = groups.captureMove('a')
    groups.moveCaptured(snapshot, { x: 50, y: 30 }, { width: 1000, height: 700 })
    expect(windows.get('a').geometry.position).toEqual({ x: 90, y: 80 })
    expect(windows.get('b').geometry.position).toEqual({ x: 350, y: 210 })
    expect(windows.get('b').options.layer).toBe('always-on-top')
    groups.remove('a')
    expect(groups.get('ops')?.members).toEqual(['b'])
    expect(windows.list().map((window) => window.instanceId)).toEqual(['a', 'b'])
    groups.dispose()
  })

  it('minimizes/restores a group and detaches members that stop being floating', () => {
    const { windows, groups } = setup()
    groups.assign('ops', ['a', 'b'])
    groups.minimizeGroup('ops')
    expect(windows.get('a').mode).toBe('minimized')
    expect(windows.get('b').mode).toBe('minimized')
    groups.restoreGroup('ops')
    expect(windows.get('a').mode).toBe('normal')
    expect(windows.get('b').mode).toBe('normal')
    windows.snapWindow('a', 'left', { width: 800, height: 600 })
    expect(groups.groupOf('a')).toBeNull()
    expect(groups.get('ops')?.members).toEqual(['b'])
    groups.dispose()
  })

  it('serializes and restores stable group membership', () => {
    const first = setup(); first.groups.assign('ops', ['a', 'b'])
    const serialized = JSON.parse(JSON.stringify(first.groups.snapshot()))
    first.groups.dispose()
    const second = setup(); second.groups.restore(serialized)
    expect(second.groups.list()).toEqual([{ id: 'ops', members: ['a', 'b'] }])
    second.groups.dispose()
  })

  it('rejects snapped windows because groups are floating-window state', () => {
    const { windows, groups } = setup()
    windows.snapWindow('a', 'left', { width: 800, height: 600 })
    expect(() => groups.assign('ops', ['a', 'b'])).toThrow(WindowGroupDefinitionError)
    groups.dispose()
  })
})
