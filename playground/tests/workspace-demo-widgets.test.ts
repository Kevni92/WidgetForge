import { defineComponent, h, type Component } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { provideWidgetNavigation, type NavigationIntent, type WidgetNavigator } from 'widgetforge'
import { provideDemoControls, type DemoControls } from '../src/demo-controls'
import AlertsWidget from '../src/widgets/AlertsWidget.vue'
import WorkspaceCommandBarWidget from '../src/widgets/WorkspaceCommandBarWidget.vue'
import WorkspaceTopbarWidget from '../src/widgets/WorkspaceTopbarWidget.vue'

function navigatorSpy(): { navigator: WidgetNavigator; navigate: ReturnType<typeof vi.fn<(intent: NavigationIntent) => { widgetId: string; instanceId: string }>> } {
  const navigate = vi.fn((intent: NavigationIntent) => ({ widgetId: intent.widgetId, instanceId: `opened-${intent.widgetId}` }))
  return { navigator: { navigate }, navigate }
}
function mountWithProviders(component: Component, navigator: WidgetNavigator, controls?: DemoControls) {
  const Wrapper = defineComponent({ setup() { provideWidgetNavigation(navigator); if (controls) provideDemoControls(controls); return () => h(component) } })
  return mount(Wrapper)
}

describe('fullscreen workspace demo widgets', () => {
  it('topbar navigates, switches theme/layout and exposes history/edit/lock/reset controls', async () => {
    const { navigator, navigate } = navigatorSpy()
    const setTheme = vi.fn(); const resetWorkspace = vi.fn(); const undo = vi.fn(); const redo = vi.fn(); const setWorkspaceMode = vi.fn(); const loadLayout = vi.fn()
    const controls: DemoControls = { theme: () => 'forge-dark', setTheme, resetWorkspace, canUndo: () => true, canRedo: () => true, undo, redo, workspaceMode: () => 'normal', setWorkspaceMode, layoutNames: () => ['Default', 'Trading', 'Operations'], activeLayout: () => 'Default', loadLayout }
    const wrapper = mountWithProviders(WorkspaceTopbarWidget, navigator, controls)
    await wrapper.get('[data-widget-action="market"]').trigger('click')
    expect(navigate).toHaveBeenCalledWith({ widgetId: 'market.ticker', parameters: { commodity: 'METALS', rows: 10 } })
    await wrapper.get('[data-widget-action="modal"]').trigger('click')
    expect(navigate).toHaveBeenCalledWith({ widgetId: 'demo.modal-review' })
    await wrapper.get('[data-widget-action="overlay"]').trigger('click')
    expect(navigate).toHaveBeenCalledWith({ widgetId: 'demo.overlay-command' })
    await wrapper.get('[data-widget-action="edit"]').trigger('click'); expect(setWorkspaceMode).toHaveBeenCalledWith('edit')
    await wrapper.get('[data-widget-action="lock"]').trigger('click'); expect(setWorkspaceMode).toHaveBeenCalledWith('locked')
    await wrapper.get('[data-widget-action="undo"]').trigger('click'); expect(undo).toHaveBeenCalledOnce()
    await wrapper.get('[data-widget-action="redo"]').trigger('click'); expect(redo).toHaveBeenCalledOnce()
    await wrapper.get('select[aria-label="Workspace layout"]').setValue('Trading'); expect(loadLayout).toHaveBeenCalledWith('Trading')
    await wrapper.get('select[aria-label="Theme"]').setValue('forge-light'); expect(setTheme).toHaveBeenCalledWith('forge-light')
    await wrapper.get('[data-widget-action="reset"]').trigger('click'); expect(resetWorkspace).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('command bar executes registered workspace commands through navigation', async () => {
    const { navigator, navigate } = navigatorSpy(); const wrapper = mountWithProviders(WorkspaceCommandBarWidget, navigator); const field = wrapper.get('.wf-command-input__field')
    await field.setValue('alerts'); await wrapper.get('.wf-command-input').trigger('submit')
    expect(navigate).toHaveBeenCalledWith({ widgetId: 'demo.alerts', parameters: {} }); wrapper.unmount()
  })

  it('alerts widget renders persistent operational notifications and navigates from actions', async () => {
    const { navigator, navigate } = navigatorSpy(); const wrapper = mountWithProviders(AlertsWidget, navigator)
    expect(wrapper.findAll('.wf-notification-center__item')).toHaveLength(3)
    const action = wrapper.findAll('button').find((button) => button.text() === 'Open market'); expect(action).toBeDefined(); await action?.trigger('click')
    expect(navigate).toHaveBeenCalledWith({ widgetId: 'market.ticker', parameters: { commodity: 'METALS', rows: 10 } }); wrapper.unmount()
  })
})
