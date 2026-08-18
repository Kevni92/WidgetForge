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
  const Wrapper = defineComponent({
    setup() {
      provideWidgetNavigation(navigator)
      if (controls) provideDemoControls(controls)
      return () => h(component)
    },
  })
  return mount(Wrapper)
}

describe('fullscreen workspace demo widgets', () => {
  it('topbar navigates, switches theme and resets the reference layout', async () => {
    const { navigator, navigate } = navigatorSpy()
    const setTheme = vi.fn()
    const resetWorkspace = vi.fn()
    const controls: DemoControls = { theme: () => 'forge-dark', setTheme, resetWorkspace }
    const wrapper = mountWithProviders(WorkspaceTopbarWidget, navigator, controls)

    await wrapper.get('[data-demo-nav="market"]').trigger('click')
    expect(navigate).toHaveBeenCalledWith({ widgetId: 'market.ticker', parameters: { commodity: 'METALS', rows: 10 } })

    await wrapper.get('select[aria-label="Theme"]').setValue('forge-light')
    expect(setTheme).toHaveBeenCalledWith('forge-light')

    await wrapper.get('[data-demo-action="reset"]').trigger('click')
    expect(resetWorkspace).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('command bar executes registered workspace commands through navigation', async () => {
    const { navigator, navigate } = navigatorSpy()
    const wrapper = mountWithProviders(WorkspaceCommandBarWidget, navigator)
    const field = wrapper.get('.wf-command-input__field')

    await field.setValue('alerts')
    await wrapper.get('.wf-command-input').trigger('submit')

    expect(navigate).toHaveBeenCalledWith({ widgetId: 'demo.alerts', parameters: {} })
    wrapper.unmount()
  })

  it('alerts widget renders persistent operational notifications and navigates from actions', async () => {
    const { navigator, navigate } = navigatorSpy()
    const wrapper = mountWithProviders(AlertsWidget, navigator)

    expect(wrapper.findAll('.wf-notification-center__item')).toHaveLength(3)
    const action = wrapper.findAll('button').find((button) => button.text() === 'Open market')
    expect(action).toBeDefined()
    await action?.trigger('click')
    expect(navigate).toHaveBeenCalledWith({ widgetId: 'market.ticker', parameters: { commodity: 'METALS', rows: 10 } })
    wrapper.unmount()
  })
})
