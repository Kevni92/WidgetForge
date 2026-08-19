import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App.vue'

const WORKSPACE_STORAGE_KEY = 'widgetforge.playground.fullscreen.v2'
const GROUP_STORAGE_KEY = 'widgetforge.playground.groups.v1'

describe('Fullscreen Playground App', () => {
  beforeEach(() => { window.localStorage.clear(); vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('renders a cohesive fullscreen simulation workspace with docks, panes, groups, roles and chrome variants', async () => {
    const wrapper = mount(App)
    expect(wrapper.get('[data-fullscreen-workspace-demo]').element).toBeTruthy()
    expect(wrapper.findAll('.wf-dock-host')).toHaveLength(2)
    expect(wrapper.get('[data-dock-id="workspace-top"]').attributes('data-dock-position')).toBe('top')
    expect(wrapper.get('[data-dock-id="workspace-bottom"]').attributes('data-dock-position')).toBe('bottom')
    expect(wrapper.get('[data-pane-id="workspace-top-root"]').attributes('data-pane-kind')).toBe('split')
    expect(wrapper.text()).toContain('Orbital Exchange')
    expect(wrapper.get('[data-dock-id="workspace-bottom"] .wf-command-input__field').element).toBeTruthy()

    expect(wrapper.findAll('.wf-window-frame')).toHaveLength(5)
    const telemetry = wrapper.get('[data-window-instance-id="telemetry-power"]')
    expect(telemetry.attributes('data-window-layer')).toBe('always-on-top')
    expect(telemetry.attributes('data-window-role')).toBe('utility')
    const telemetryShell = telemetry.get('.wf-window-shell')
    expect(telemetryShell.attributes('data-window-header')).toBe('hover')
    expect(telemetryShell.attributes('data-window-chrome')).toBe('borderless')
    expect(telemetryShell.attributes('data-window-glass')).toBe('true')
    expect(telemetry.find('.wf-window-shell__titlebar').exists()).toBe(false)
    await telemetryShell.trigger('mouseenter')
    await wrapper.vm.$nextTick()
    expect(telemetry.text()).toContain('LIVE')
    expect(telemetry.text()).toContain('SYNC')
    expect(telemetry.get('[data-window-header-action="refresh"]').attributes('title')).toBe('Refresh telemetry')

    expect(wrapper.get('[data-window-instance-id="colony-main"]').attributes('data-window-group')).toBe('operations-cluster')
    expect(wrapper.get('[data-window-instance-id="alerts-main"]').attributes('data-window-group')).toBe('operations-cluster')
    expect(wrapper.get('[data-window-instance-id="operations-main"] [data-pane-id="operations-root"]').attributes('data-pane-kind')).toBe('split')
    expect(wrapper.get('[data-pane-id="operations-metrics"]').attributes('data-pane-kind')).toBe('tabs')
    expect(wrapper.findAll('[data-pane-id="operations-metrics"] [role="tab"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-window-instance-id="market-main"] .wf-data-table__row')).toHaveLength(14)

    await wrapper.get('[data-demo-nav="modal"]').trigger('click')
    await wrapper.vm.$nextTick()
    const modal = wrapper.get('[data-window-role="modal"]')
    expect(modal.get('.wf-window-shell').attributes('role')).toBe('dialog')
    expect(modal.get('.wf-window-shell').attributes('data-window-chrome')).toBe('borderless')
    expect(wrapper.find('[data-modal-backdrop]').exists()).toBe(true)
    expect(wrapper.get('[data-window-instance-id="colony-main"]').attributes('aria-hidden')).toBe('true')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-window-role="modal"]').exists()).toBe(false)

    const snapshot = JSON.parse(window.localStorage.getItem(WORKSPACE_STORAGE_KEY) ?? '{}') as { windows?: Array<{ instanceId: string; snap?: { zone?: string } | null }>; docks?: unknown[] }
    expect(snapshot.docks).toHaveLength(2)
    expect(snapshot.windows?.find((window) => window.instanceId === 'market-main')?.snap?.zone).toBe('left')
    const groupSnapshot = JSON.parse(window.localStorage.getItem(GROUP_STORAGE_KEY) ?? '{}') as { groups?: Array<{ id: string; members: string[] }> }
    expect(groupSnapshot.groups).toEqual([{ id: 'operations-cluster', members: ['colony-main', 'alerts-main'] }])

    const powerWidgets = wrapper.findAll('[data-resource-id="grid-power"]')
    expect(powerWidgets).toHaveLength(3)
    expect(powerWidgets.every((widget) => widget.text().includes('118.0 MW'))).toBe(true)
    vi.advanceTimersByTime(1_200)
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('[data-resource-id="grid-power"]').every((widget) => widget.text().includes('118.5 MW'))).toBe(true)

    await wrapper.get('select[aria-label="Theme"]').setValue('forge-light')
    expect(wrapper.get('.wf-theme').attributes('style')).toContain('--wf-color-canvas: #e9eef3')
    wrapper.unmount()
  })

  it('restores changed window and dock layout after remounting', async () => {
    const first = mount(App)
    await first.get('[data-window-instance-id="alerts-main"] .wf-window-shell__close').trigger('click')
    await first.get('[data-window-instance-id="colony-main"] .wf-window-shell__minimize').trigger('click')
    first.unmount()
    const second = mount(App)
    expect(second.findAll('.wf-dock-host')).toHaveLength(2)
    expect(second.find('[data-window-instance-id="alerts-main"]').exists()).toBe(false)
    expect(second.get('[data-window-instance-id="colony-main"]').attributes('data-window-mode')).toBe('minimized')
    expect(second.findAll('.wf-window-frame')).toHaveLength(4)
    second.unmount()
  })

  it('reset restores the defined reference layout and reference group', async () => {
    const wrapper = mount(App)
    await wrapper.get('[data-window-instance-id="alerts-main"] .wf-window-shell__close').trigger('click')
    expect(wrapper.findAll('.wf-window-frame')).toHaveLength(4)
    await wrapper.get('[data-demo-action="reset"]').trigger('click')
    await wrapper.vm.$nextTick(); await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.wf-dock-host')).toHaveLength(2)
    expect(wrapper.findAll('.wf-window-frame')).toHaveLength(5)
    expect(wrapper.get('[data-window-instance-id="alerts-main"]').attributes('data-window-group')).toBe('operations-cluster')
    expect(wrapper.get('[data-pane-id="operations-root"]').element).toBeTruthy()
    wrapper.unmount()
  })
})
