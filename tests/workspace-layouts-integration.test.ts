import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { createDockManager } from '../src/core/dock-manager'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import { createWorkspaceLayoutManager } from '../src/core/workspace-layouts'
import WorkspaceHost from '../src/vue/WorkspaceHost.vue'

let mounts = 0
const Probe = defineComponent({
  setup() { mounts += 1 },
  template: '<div class="layout-probe">layout probe</div>',
})

describe('workspace layout preset integration', () => {
  it('updates a mounted WorkspaceHost without remounting unchanged widget structure', async () => {
    mounts = 0
    const registry = createWidgetRegistry([defineWidget({ id: 'test.layout-probe', title: 'Layout Probe', component: Probe })])
    const windows = createWindowManager(registry)
    const docks = createDockManager(registry)
    windows.open({ widgetId: 'test.layout-probe', instanceId: 'probe', position: { x: 20, y: 30 }, size: { width: 300, height: 200 } })
    const layouts = createWorkspaceLayoutManager({ registry, windows, docks })
    layouts.saveLayout('Default')

    const wrapper = mount(WorkspaceHost, { attachTo: document.body, props: { windows, docks, registry } })
    await nextTick()
    expect(wrapper.findAll('.layout-probe')).toHaveLength(1)
    expect(mounts).toBe(1)

    windows.setGeometry('probe', { position: { x: 240, y: 180 }, size: { width: 420, height: 280 } })
    layouts.saveLayout('Moved')
    layouts.loadLayout('Default')
    await nextTick()

    expect(windows.get('probe').geometry).toEqual({ position: { x: 20, y: 30 }, size: { width: 300, height: 200 } })
    expect(wrapper.findAll('.layout-probe')).toHaveLength(1)
    expect(mounts).toBe(1)
    wrapper.unmount()
  })
})
