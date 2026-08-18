import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import App from '../src/App.vue'

describe('Playground App', () => {
  it('demonstrates window state, singleton reuse and internal widget navigation', async () => {
    const wrapper = mount(App)
    const select = wrapper.get('select')

    expect(wrapper.findAll('.wf-window-shell')).toHaveLength(3)

    await wrapper.get('[data-window-instance-id="planet-alpha"] .wf-window-shell__minimize').trigger('click')
    expect(wrapper.get('.wf-window-frame[data-window-instance-id="planet-alpha"]').attributes('data-window-mode')).toBe('minimized')
    await wrapper.get('[data-window-instance-id="planet-alpha"] .wf-window-shell__minimize').trigger('click')

    await wrapper.get('[data-window-instance-id="market-metals"] .wf-window-shell__close').trigger('click')
    expect(wrapper.find('.wf-window-frame[data-window-instance-id="market-metals"]').exists()).toBe(false)

    await wrapper.get('[data-window-instance-id="planet-alpha"] [data-navigation="market"]').trigger('click')
    const marketWindows = wrapper.findAll('.wf-window-frame').filter((frame) => frame.text().includes('Market Ticker'))
    expect(marketWindows).toHaveLength(1)
    expect(wrapper.text()).toContain('METALS')

    await wrapper.get('[data-action="open-market"]').trigger('click')
    const singletonMarkets = wrapper.findAll('.wf-window-frame').filter((frame) => frame.text().includes('Market Ticker'))
    expect(singletonMarkets).toHaveLength(1)

    await select.setValue('forge-dark')
    expect(wrapper.get('.wf-theme').attributes('style')).toContain('--wf-color-canvas: #070b12')
  })
})
