import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { forgeLightTheme } from 'widgetforge'
import App from '../src/App.vue'

const WORKSPACE_STORAGE_KEY = 'widgetforge.playground.fullscreen.v3'
const GROUP_STORAGE_KEY = 'widgetforge.playground.groups.v1'
const LAYOUT_STORAGE_KEY = 'widgetforge.playground.layouts.v1'

describe('Fullscreen Playground App', () => {
  beforeEach(() => { window.localStorage.clear(); vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('demonstrates the public empty-window launcher flow with an error and a real command', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    const beforeWidgets = wrapper.findAll('.production-widget').length
    await wrapper.get('[data-workspace-new-window]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-command-launcher] input').element).toBeTruthy()
    expect(wrapper.find('[data-command-launcher] h2').exists()).toBe(false)
    expect(wrapper.find('[data-command-launcher] .wf-command-launcher__intro').exists()).toBe(false)
    expect(wrapper.get('[data-command-launcher] button[type="submit"]').text()).toBe('Open')
    expect(wrapper.find('[data-window-layout="maximize"]').exists()).toBe(false)
    expect(wrapper.find('[data-window-snap-layout-picker]').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('[data-command-launcher] input').element)

    const input = wrapper.get('[data-command-launcher] input')
    await input.setValue('does-not-exist')
    await wrapper.get('[data-command-launcher] form').trigger('submit')
    expect(wrapper.get('[data-command-input-feedback]').text()).toContain('unknown command')

    await input.setValue('production')
    await wrapper.get('[data-command-launcher] form').trigger('submit')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-command-launcher]').exists()).toBe(false)
    expect(wrapper.findAll('.production-widget').length).toBe(beforeWidgets + 1)
    wrapper.unmount()
  })

  it('opens the generic Help widget through the public command launcher', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    await wrapper.get('[data-workspace-new-window]').trigger('click')
    await wrapper.vm.$nextTick()
    const input = wrapper.get('[data-command-launcher] input')
    await input.setValue('help')
    await wrapper.get('[data-command-launcher] form').trigger('submit')
    await wrapper.vm.$nextTick()

    const help = wrapper.get('[data-help-widget]')
    expect(help.find('[data-help-entry="widget:market.ticker"]').exists()).toBe(true)
    expect(help.find('[data-help-entry="command:market"]').exists()).toBe(true)
    await help.get('[aria-label="Search widgets and commands"]').setValue('market')
    await help.get('[data-help-entry="widget:market.ticker"]').trigger('click')
    expect(help.get('[data-help-detail]').text()).toContain('rows')
    expect(help.get('[data-help-detail]').text()).toContain('number')
    wrapper.unmount()
  })

  it('keeps New window in the global tabbar and routes it to the active workspace', async () => {
    const wrapper = mount(App)
    const action = wrapper.get('[data-workspace-new-window]')
    expect(wrapper.find('.wf-workspace-host [data-workspace-new-window]').exists()).toBe(false)
    expect(wrapper.get('[data-workspace-tab-actions]').element.contains(action.element)).toBe(true)

    await wrapper.get('[data-workspace-tab="trading"]').trigger('click')
    await wrapper.vm.$nextTick()
    await action.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-active-workspace="trading"] [data-command-launcher]').exists()).toBe(true)
    expect(wrapper.find('[data-active-workspace="command"] [data-command-launcher]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('renders a cohesive fullscreen simulation workspace with docks, panes, groups, roles and chrome variants', async () => {
    const wrapper = mount(App)
    expect(wrapper.get('[data-fullscreen-workspace-demo]').element).toBeTruthy()
    expect(wrapper.findAll('.wf-dock-host')).toHaveLength(2)
    expect(wrapper.get('[data-dock-id="workspace-top"]').attributes('data-dock-position')).toBe('top')
    expect(wrapper.get('[data-dock-id="workspace-bottom"]').attributes('data-dock-position')).toBe('bottom')
    expect(wrapper.get('[data-pane-id="workspace-top-root"]').attributes('data-pane-kind')).toBe('split')
    expect(wrapper.text()).toContain('Orbital Exchange')
    expect(wrapper.get('[data-dock-id="workspace-bottom"] .wf-command-input__field').element).toBeTruthy()

    expect(wrapper.findAll('.wf-window-frame')).toHaveLength(6)
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
    expect(telemetry.get('[data-widget-action="refresh"]').attributes('title')).toBe('Refresh (Ctrl+R)')

    expect(wrapper.get('[data-window-instance-id="colony-main"]').attributes('data-window-group')).toBe('operations-cluster')
    expect(wrapper.get('[data-window-instance-id="alerts-main"]').attributes('data-window-group')).toBe('operations-cluster')
    expect(wrapper.get('[data-window-instance-id="operations-main"] [data-pane-id="operations-root"]').attributes('data-pane-kind')).toBe('split')
    expect(wrapper.get('[data-pane-id="operations-stack"]').attributes('data-pane-kind')).toBe('stack')
    expect(wrapper.get('[data-pane-id="operations-metrics"]').attributes('data-pane-kind')).toBe('tabs')
    expect(wrapper.findAll('[data-pane-id="operations-metrics"] [role="tab"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-window-instance-id="market-main"] .wf-data-table__row')).toHaveLength(14)
    const lockedOperations = wrapper.get('[data-window-instance-id="operations-main"]')
    expect(lockedOperations.attributes('data-window-layout-locked')).toBe('true')
    expect(lockedOperations.find('.wf-window-shell__titlebar').exists()).toBe(false)

    const layoutSelect = wrapper.get('select[aria-label="Workspace layout"]')
    expect((layoutSelect.element as HTMLSelectElement).value).toBe('Default')
    expect(layoutSelect.findAll('option').map((option) => option.text())).toEqual(['Custom', 'Default', 'Trading', 'Operations'])
    const layoutCollection = JSON.parse(window.localStorage.getItem(LAYOUT_STORAGE_KEY) ?? '{}') as { defaultLayout?: string; layouts?: Array<{ name: string }> }
    expect(layoutCollection.defaultLayout).toBe('Default')
    expect(layoutCollection.layouts?.map((layout) => layout.name)).toEqual(['Default', 'Trading', 'Operations'])

    await wrapper.get('[data-demo-nav="overlay"]').trigger('click')
    await wrapper.vm.$nextTick()
    const overlay = wrapper.get('[data-window-role="overlay"]')
    expect(overlay.get('.wf-window-shell').attributes('data-window-chrome')).toBe('borderless')

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
    expect(wrapper.get('.wf-theme').attributes('style')).toContain(`--wf-color-canvas: ${forgeLightTheme.color.canvas}`)
    wrapper.unmount()
  })

  it('unlocks a locked window through the generic edit-mode context menu', async () => {
    const wrapper = mount(App)
    await wrapper.get('[data-demo-action="edit"]').trigger('click')
    await wrapper.vm.$nextTick()

    const lockedOperations = wrapper.get('[data-window-instance-id="operations-main"]')
    await lockedOperations.get('[data-pane-id="operations-root"]').trigger('contextmenu', { clientX: 120, clientY: 120 })
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.wf-context-menu__item')).toHaveLength(2)
    expect(wrapper.findAll('.wf-context-menu__item').map((item) => item.text())).toEqual(['Unlock window', 'Layout…'])

    await wrapper.get('.wf-context-menu__item').trigger('click')
    await wrapper.vm.$nextTick()
    expect(lockedOperations.attributes('data-window-layout-locked')).toBeUndefined()
    expect(lockedOperations.find('.wf-window-shell__titlebar').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows the responsive inspector and directional canvas picker in edit mode', async () => {
    const originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(target: Element): void {
        if (!target.classList.contains('wf-workspace-host')) return
        this.callback([{ target, contentRect: { width: 800, height: 600 } } as ResizeObserverEntry], this as unknown as ResizeObserver)
      }
      disconnect(): void {}
      unobserve(): void {}
    } as unknown as typeof ResizeObserver
    const wrapper = mount(App, { attachTo: document.body })
    try {
      await wrapper.get('[data-demo-action="edit"]').trigger('click')
      await wrapper.vm.$nextTick()
      await wrapper.get('[data-window-instance-id="market-main"] .wf-pane-host[data-pane-id]').trigger('pointerdown')
      await wrapper.vm.$nextTick()

      const inspector = wrapper.get('[data-workspace-selection-actions]')
      expect(inspector.get('[data-selected-window-id]').text()).toBe('market-main')
      expect(inspector.get('[data-window-layout-status]').text()).toContain('Snapped')
      await inspector.get('[data-window-selection-layout]').trigger('click')
      await wrapper.vm.$nextTick()
      await wrapper.get('[role="dialog"] input[type="radio"][value="responsive"]').setValue(true)
      expect(wrapper.get('[data-layout-horizontal-mode="start-size"]')).toBeTruthy()
      expect(wrapper.get('[data-layout-vertical-mode="stretch"]')).toBeTruthy()
      const widthBeforeUnitChange = (wrapper.get('[data-layout-width]').element as HTMLInputElement).value
      await wrapper.get('[aria-label="Width unit"]').setValue('percent')
      await wrapper.get('[aria-label="Width unit"]').setValue('px')
      expect((wrapper.get('[data-layout-width]').element as HTMLInputElement).value).toBe(widthBeforeUnitChange)
      await wrapper.get('[data-layout-width]').setValue('25')
      await wrapper.vm.$nextTick()
      expect(wrapper.get('[data-layout-preview]').text()).toContain('Preview:')
      expect(wrapper.find('[data-layout-preview-overlay]').exists()).toBe(true)
      await wrapper.get('[data-layout-horizontal-mode="stretch"]').trigger('change')
      expect(wrapper.get('[data-layout-calculated-width]').text()).toContain('calculated')
      await wrapper.get('[data-layout-horizontal-mode="start-size"]').trigger('change')
      expect(wrapper.get('[data-layout-left-target]')).toBeTruthy()
      await wrapper.get('[data-layout-pick="horizontal:left"]').trigger('click')
      expect(wrapper.get('[data-layout-picker-state]').text()).toContain('click a highlighted window')
      await wrapper.get('[data-window-instance-id="operations-main"]').trigger('pointerdown')
      await wrapper.vm.$nextTick()
      expect((wrapper.get('[data-layout-left-target]').element as HTMLSelectElement).value).toBe('window:operations-main:right')
    } finally {
      wrapper.unmount()
      globalThis.ResizeObserver = originalResizeObserver
    }
  })

  it('projects dock and nested pane selection into the Object and Styles inspector tabs', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    await wrapper.get('[data-demo-action="edit"]').trigger('click')
    await wrapper.vm.$nextTick()

    await wrapper.get('[data-dock-id="workspace-top"]').trigger('pointerdown')
    await wrapper.vm.$nextTick()
    const inspector = wrapper.get('[data-workspace-selection-actions]')
    expect(inspector.get('[data-layout-inspector-selection-kind]').text()).toContain('DOCK · workspace-top')
    await inspector.get('[data-layout-inspector-tab="styles"]').trigger('click')
    expect(inspector.find('[data-layout-inspector-styles]').exists()).toBe(true)

    await wrapper.get('[data-pane-id="operations-stack"]').trigger('pointerdown')
    await wrapper.vm.$nextTick()
    expect(inspector.get('[data-layout-inspector-selection-kind]').text()).toContain('PANE · operations-stack')
    await inspector.get('[data-layout-inspector-tab="object"]').trigger('click')
    expect(inspector.find('[data-layout-inspector-pane-object]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('switches Default, Trading and Operations presets without resetting shared domain data', async () => {
    const wrapper = mount(App)
    vi.advanceTimersByTime(1_200)
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('[data-resource-id="grid-power"]').every((widget) => widget.text().includes('118.5 MW'))).toBe(true)

    await wrapper.get('select[aria-label="Workspace layout"]').setValue('Trading')
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.wf-window-frame')).toHaveLength(3)
    expect(wrapper.find('[data-window-instance-id="market-main"]').exists()).toBe(true)
    expect(wrapper.find('[data-window-instance-id="telemetry-power"]').exists()).toBe(true)
    expect(wrapper.find('[data-window-instance-id="colony-main"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-resource-id="grid-power"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-resource-id="grid-power"]').every((widget) => widget.text().includes('118.5 MW'))).toBe(true)

    await wrapper.get('select[aria-label="Workspace layout"]').setValue('Operations')
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.wf-window-frame')).toHaveLength(5)
    expect(wrapper.find('[data-window-instance-id="market-main"]').exists()).toBe(false)
    expect(wrapper.find('[data-window-instance-id="operations-main"]').exists()).toBe(true)

    await wrapper.get('select[aria-label="Workspace layout"]').setValue('Default')
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.wf-window-frame')).toHaveLength(6)
    expect((wrapper.get('select[aria-label="Workspace layout"]').element as HTMLSelectElement).value).toBe('Default')
    wrapper.unmount()
  })

  it('traps focus in the topbar modal and restores the opening control', async () => {
    const wrapper = mount(App, { attachTo: document.body })
    const trigger = wrapper.get('[data-demo-nav="modal"]')
    ;(trigger.element as HTMLElement).focus()
    await trigger.trigger('click')
    await wrapper.vm.$nextTick(); await wrapper.vm.$nextTick()

    const dialog = wrapper.get('[data-window-role="modal"] .wf-window-shell')
    expect(dialog.attributes('role')).toBe('dialog')
    expect(dialog.attributes('aria-modal')).toBe('true')
    expect(dialog.element.contains(document.activeElement)).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
    expect(dialog.element.contains(document.activeElement)).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }))
    expect(dialog.element.contains(document.activeElement)).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await wrapper.vm.$nextTick(); await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-window-role="modal"]').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger.element)
    wrapper.unmount()
  })

  it('routes global widget navigation to the active virtual workspace', async () => {
    const wrapper = mount(App)

    await wrapper.get('[data-workspace-tab="trading"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-active-workspace="trading"]').exists()).toBe(true)
    await wrapper.get('[data-demo-nav="modal"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-window-role="modal"]').exists()).toBe(true)

    await wrapper.get('[data-workspace-tab="command"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-active-workspace="command"]').exists()).toBe(true)
    expect(wrapper.find('[data-window-role="modal"]').exists()).toBe(false)

    await wrapper.get('[data-workspace-tab="operations"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.get('[data-demo-nav="modal"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-window-role="modal"]').exists()).toBe(true)

    await wrapper.get('[data-workspace-tab="command"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-window-role="modal"]').exists()).toBe(false)
    await wrapper.get('[data-demo-nav="modal"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-window-role="modal"]').exists()).toBe(true)
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
    expect(second.findAll('.wf-window-frame')).toHaveLength(5)
    second.unmount()
  })

  it('reset restores the defined Default preset and reference group', async () => {
    const wrapper = mount(App)
    await wrapper.get('[data-window-instance-id="alerts-main"] .wf-window-shell__close').trigger('click')
    expect(wrapper.findAll('.wf-window-frame')).toHaveLength(5)
    await wrapper.get('[data-demo-action="reset"]').trigger('click')
    await wrapper.vm.$nextTick(); await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.wf-dock-host')).toHaveLength(2)
    expect(wrapper.findAll('.wf-window-frame')).toHaveLength(6)
    expect(wrapper.get('[data-window-instance-id="alerts-main"]').attributes('data-window-group')).toBe('operations-cluster')
    expect(wrapper.get('[data-pane-id="operations-root"]').element).toBeTruthy()
    expect((wrapper.get('select[aria-label="Workspace layout"]').element as HTMLSelectElement).value).toBe('Default')
    wrapper.unmount()
  })
})
