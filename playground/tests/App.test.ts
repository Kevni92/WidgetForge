import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App.vue'

describe('Playground App', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('demonstrates panes, window state, commands and synchronized serverless live data', async () => {
    const wrapper = mount(App)
    const select = wrapper.get('select')

    expect(wrapper.get('[data-pane-id="pane-demo-root"]').attributes('data-pane-kind')).toBe('split')
    expect(wrapper.findAll('.pane-playground-area [data-widget-instance-id]')).toHaveLength(3)
    expect(wrapper.text()).toContain('PANE-01')
    expect(wrapper.text()).toContain('ENERGY')

    expect(wrapper.findAll('.wf-window-shell')).toHaveLength(6)
    const powerWidgets = wrapper.findAll('[data-resource-id="grid-power"]')
    expect(powerWidgets).toHaveLength(3)
    expect(powerWidgets.map((widget) => widget.text())).toEqual([
      expect.stringContaining('118.0 MW'),
      expect.stringContaining('118.0 MW'),
      expect.stringContaining('118.0 MW'),
    ])

    vi.advanceTimersByTime(1_200)
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('[data-resource-id="grid-power"]').map((widget) => widget.text())).toEqual([
      expect.stringContaining('118.5 MW'),
      expect.stringContaining('118.5 MW'),
      expect.stringContaining('118.5 MW'),
    ])

    await wrapper.get('[data-window-instance-id="planet-alpha"] .wf-window-shell__minimize').trigger('click')
    expect(wrapper.get('.wf-window-frame[data-window-instance-id="planet-alpha"]').attributes('data-window-mode')).toBe('minimized')
    await wrapper.get('[data-window-instance-id="planet-alpha"] .wf-window-shell__minimize').trigger('click')

    await wrapper.get('[data-window-instance-id="market-metals"] .wf-window-shell__close').trigger('click')
    expect(wrapper.find('.wf-window-frame[data-window-instance-id="market-metals"]').exists()).toBe(false)

    await wrapper.get('[data-window-instance-id="planet-alpha"] [data-navigation="market"]').trigger('click')
    const marketWindows = wrapper.findAll('.wf-window-frame').filter((frame) => frame.text().includes('Market Ticker'))
    expect(marketWindows).toHaveLength(1)
    expect(wrapper.text()).toContain('METALS')

    const commandInput = wrapper.get('.wf-command-input__field')
    await commandInput.setValue('planet ARC-CMD true')
    await wrapper.get('.wf-command-input').trigger('submit')
    expect(wrapper.text()).toContain('ARC-CMD')
    expect(wrapper.get('.wf-command-input__feedback').text()).toContain('Opened planet.summary')

    const currentMarket = wrapper.findAll('.wf-window-frame').find((frame) => frame.text().includes('Market Ticker'))
    expect(currentMarket).toBeDefined()
    await currentMarket?.get('.wf-window-shell__close').trigger('click')

    await commandInput.setValue('mkt 8')
    await wrapper.get('.wf-command-input').trigger('submit')
    const commandMarkets = wrapper.findAll('.wf-window-frame').filter((frame) => frame.text().includes('Market Ticker'))
    expect(commandMarkets).toHaveLength(1)
    expect(wrapper.text()).toContain('METALS')

    await select.setValue('forge-dark')
    expect(wrapper.get('.wf-theme').attributes('style')).toContain('--wf-color-canvas: #070b12')
    wrapper.unmount()
  })

  it('restores the saved window workspace after remounting the playground', async () => {
    const first = mount(App)
    await first.get('[data-window-instance-id="planet-alpha"] .wf-window-shell__minimize').trigger('click')
    await first.get('[data-window-instance-id="market-metals"] .wf-window-shell__close').trigger('click')
    first.unmount()

    const second = mount(App)

    expect(second.findAll('.wf-window-frame')).toHaveLength(5)
    expect(second.get('.wf-window-frame[data-window-instance-id="planet-alpha"]').attributes('data-window-mode')).toBe('minimized')
    expect(second.find('.wf-window-frame[data-window-instance-id="market-metals"]').exists()).toBe(false)
    expect(second.text()).toContain('ARC-02')
    expect(second.findAll('[data-resource-id="grid-power"]')).toHaveLength(3)
    second.unmount()
  })
})
