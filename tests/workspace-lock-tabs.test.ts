import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createDockManager } from '../src/core/dock-manager'
import { createTabPane, createWidgetPane } from '../src/core/pane'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import { createWorkspaceEditController } from '../src/core/workspace-edit'
import WorkspaceHost from '../src/vue/WorkspaceHost.vue'

const Widget = defineComponent({ template: '<span>tab</span>' })

describe('workspace layout lock tab semantics', () => {
  it('keeps normal tab activation available while structural layout is locked', async () => {
    const registry = createWidgetRegistry([
      defineWidget({ id: 'lock.a', title: 'A', component: Widget }),
      defineWidget({ id: 'lock.b', title: 'B', component: Widget }),
    ])
    const windows = createWindowManager(registry)
    const docks = createDockManager(registry)
    const edit = createWorkspaceEditController({ mode: 'locked' })
    windows.openPane({ instanceId: 'tabs', pane: createTabPane({ id: 'tabs-root', activeId: 'a', children: [createWidgetPane({ id: 'a', widgetId: 'lock.a' }), createWidgetPane({ id: 'b', widgetId: 'lock.b' })] }) })
    const wrapper = mount(WorkspaceHost, { props: { windows, docks, registry, edit }, attachTo: document.body })

    await wrapper.get('[data-tab-pane-id="b"]').trigger('click')
    await nextTick()
    const root = windows.get('tabs').rootPane
    expect(root.kind).toBe('tabs')
    expect(root.kind === 'tabs' ? root.activeId : null).toBe('b')
    wrapper.unmount()
  })
})
