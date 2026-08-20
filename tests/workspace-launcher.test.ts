import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { createCommandRegistry } from '../src/core/commands'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWorkspaceHistory } from '../src/core/workspace-history'
import { createWorkspaceCollection } from '../src/core/workspace-collection'
import WorkspaceHost from '../src/vue/WorkspaceHost.vue'
import WorkspaceTabs from '../src/vue/WorkspaceTabs.vue'

const Widget = defineComponent({ template: '<div data-launcher-widget>Widget content</div>' })

describe('Workspace launcher flow', () => {
  let host: HTMLDivElement | null = null

  afterEach(() => {
    host?.remove()
    host = null
  })

  it('opens a focused launcher from the workspace action, handles errors and replaces it in place', async () => {
    const registry = createWidgetRegistry([defineWidget({ id: 'launcher.widget', title: 'Launcher Widget', component: Widget })])
    const commands = createCommandRegistry([{ name: 'widget', widgetId: 'launcher.widget' }])
    const workspaces = createWorkspaceCollection({ registry })
    const workspace = workspaces.createWorkspace({ id: 'workspace', name: 'Workspace', activate: true })
    const windows = workspace.windows
    const docks = workspace.docks
    const history = createWorkspaceHistory(windows, docks)
    host = document.createElement('div')
    document.body.append(host)
    const Root = defineComponent({
      setup() {
        function openNewWindow(): void { history.beginTransaction(); try { windows.openEmptyWindow({}, 'user'); history.commitTransaction() } catch { history.cancelTransaction() } }
        return () => h('div', [
          h(WorkspaceTabs, { manager: workspaces }, { actions: () => h('button', { 'data-workspace-new-window': true, onClick: openNewWindow }, 'New window') }),
          h(WorkspaceHost, { windows, docks, registry, commands, history }),
        ])
      },
    })
    const wrapper = mount(Root, { attachTo: host })

    await wrapper.get('[data-workspace-new-window]').trigger('click')
    await wrapper.vm.$nextTick()
    const windowBefore = windows.get('wf-window-1')
    expect(wrapper.get('[data-command-launcher]')).toBeTruthy()
    expect(wrapper.find('[data-command-launcher] h2').exists()).toBe(false)
    expect(wrapper.find('[data-command-launcher] .wf-command-launcher__intro').exists()).toBe(false)
    expect(wrapper.get('[data-command-launcher] button[type="submit"]').text()).toBe('Open')
    expect(wrapper.find('[data-window-layout="maximize"]').exists()).toBe(false)
    expect(wrapper.find('[data-window-snap-layout-picker]').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('[data-command-launcher] input').element)
    expect(history.state.undoDepth).toBe(1)

    const input = wrapper.get('[data-command-launcher] input')
    await input.setValue('unknown')
    await wrapper.get('[data-command-launcher] form').trigger('submit')
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-command-input-feedback]').text()).toContain('unknown command')
    expect(document.activeElement).toBe(input.element)
    expect(history.state.undoDepth).toBe(1)

    await input.setValue('widget')
    await wrapper.get('[data-command-launcher] form').trigger('submit')
    await wrapper.vm.$nextTick()
    expect(windows.get('wf-window-1').rootPane).toMatchObject({ widgetId: 'launcher.widget', instanceId: 'wf-window-1.widget' })
    expect(windows.get('wf-window-1').geometry).toEqual(windowBefore.geometry)
    expect(windows.get('wf-window-1').zIndex).toBe(windowBefore.zIndex)
    expect(windows.get('wf-window-1').title).toBe('Launcher Widget')
    expect(wrapper.find('[data-launcher-widget]').exists()).toBe(true)
    expect(history.state.undoDepth).toBe(2)

    history.undo()
    await wrapper.vm.$nextTick()
    const restoredRoot = windows.get('wf-window-1').rootPane
    expect(restoredRoot.kind === 'widget' ? restoredRoot.widgetId : null).toBe('@widgetforge/command-launcher')
    expect(wrapper.find('[data-command-launcher]').exists()).toBe(true)
    history.redo()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-launcher-widget]').exists()).toBe(true)
    wrapper.unmount()
    history.dispose()
  })
})
