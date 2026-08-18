import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import {
  captureWorkspace,
  restoreWorkspace,
  serializeWorkspace,
  WORKSPACE_VERSION,
} from '../src/core/workspace'

const TestWidget = defineComponent({ template: '<div>test</div>' })

function createRegistry() {
  return createWidgetRegistry([
    defineWidget({
      id: 'test.alpha',
      title: 'Alpha',
      component: TestWidget,
      parameters: {
        name: { type: 'string', required: true },
        count: { type: 'number', default: 1 },
      },
      window: { defaultSize: { width: 320, height: 220 } },
    }),
    defineWidget({
      id: 'test.beta',
      title: 'Beta',
      component: TestWidget,
      parameters: { enabled: { type: 'boolean', default: true } },
      window: { singleton: true },
    }),
  ])
}

describe('workspace persistence', () => {
  it('captures and restores window identity, parameters, geometry, mode and focus order', () => {
    const registry = createRegistry()
    const source = createWindowManager(registry)
    source.open({
      widgetId: 'test.alpha',
      instanceId: 'wf-window-1',
      parameters: { name: 'ARC', count: 4 },
      position: { x: 80, y: 90 },
      size: { width: 410, height: 260 },
    })
    source.open({ widgetId: 'test.beta', instanceId: 'beta-main' })
    source.minimize('wf-window-1')
    source.focus('beta-main')

    const snapshot = captureWorkspace(source)
    expect(snapshot.version).toBe(WORKSPACE_VERSION)
    expect(snapshot.windows.map((window) => window.instanceId)).toEqual(['wf-window-1', 'beta-main'])

    const serialized = serializeWorkspace(source)
    expect(serialized).not.toContain('constraints')
    expect(serialized).not.toContain('lifecycle')
    expect(serialized).not.toContain('"title"')

    const target = createWindowManager(registry)
    const result = restoreWorkspace(target, serialized)

    expect(result.valid).toBe(true)
    expect(result.issues).toEqual([])
    expect(target.get('wf-window-1')).toMatchObject({
      widgetId: 'test.alpha',
      parameters: { name: 'ARC', count: 4 },
      mode: 'minimized',
      focused: false,
      geometry: {
        position: { x: 80, y: 90 },
        size: { width: 410, height: 260 },
      },
    })
    expect(target.get('beta-main')).toMatchObject({ mode: 'normal', focused: true })
  })

  it('skips stale or invalid window entries without discarding valid entries', () => {
    const manager = createWindowManager(createRegistry())
    const result = restoreWorkspace(manager, {
      version: WORKSPACE_VERSION,
      windows: [
        {
          instanceId: 'valid-alpha',
          widgetId: 'test.alpha',
          parameters: { name: 'valid', count: 2 },
          geometry: { position: { x: 10, y: 20 }, size: { width: 320, height: 220 } },
          mode: 'normal',
          focused: true,
          zIndex: 0,
        },
        {
          instanceId: 'removed-widget',
          widgetId: 'removed.widget',
          parameters: {},
          geometry: { position: { x: 20, y: 30 }, size: { width: 320, height: 220 } },
          mode: 'normal',
          focused: false,
          zIndex: 1,
        },
        {
          instanceId: 'invalid-parameters',
          widgetId: 'test.alpha',
          parameters: { count: 2 },
          geometry: { position: { x: 30, y: 40 }, size: { width: 320, height: 220 } },
          mode: 'normal',
          focused: false,
          zIndex: 2,
        },
        { broken: true },
      ],
    })

    expect(result.valid).toBe(true)
    expect(manager.list()).toHaveLength(1)
    expect(manager.get('valid-alpha').parameters).toEqual({ name: 'valid', count: 2 })
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'invalid-window',
      'unknown-widget',
      'invalid-parameters',
    ])
  })

  it('rejects invalid documents without mutating the manager', () => {
    const manager = createWindowManager(createRegistry())

    expect(restoreWorkspace(manager, '{broken').valid).toBe(false)
    expect(manager.list()).toEqual([])
    expect(restoreWorkspace(manager, { version: 999, windows: [] }).issues[0]?.code).toBe('unsupported-version')
    expect(manager.list()).toEqual([])
  })

  it('does not collide with restored automatic instance ids', () => {
    const registry = createRegistry()
    const manager = createWindowManager(registry)
    const source = createWindowManager(registry)
    source.open({ widgetId: 'test.alpha', instanceId: 'wf-window-1', parameters: { name: 'restored' } })

    restoreWorkspace(manager, serializeWorkspace(source))
    const opened = manager.open({ widgetId: 'test.alpha', parameters: { name: 'new' } })

    expect(opened.instanceId).toBe('wf-window-2')
  })

  it('requires an empty manager so restore cannot mix runtime workspaces accidentally', () => {
    const manager = createWindowManager(createRegistry())
    manager.open({ widgetId: 'test.alpha', parameters: { name: 'existing' } })

    const result = restoreWorkspace(manager, { version: WORKSPACE_VERSION, windows: [] })

    expect(result.valid).toBe(false)
    expect(result.issues[0]?.code).toBe('manager-not-empty')
    expect(manager.list()).toHaveLength(1)
  })
})
