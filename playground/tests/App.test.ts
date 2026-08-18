import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import App from '../src/App.vue'

describe('Playground App', () => {
  it('renders isolated WidgetHost instances and keeps theme switching public', async () => {
    const wrapper = mount(App)
    const select = wrapper.get('select')

    expect(wrapper.text()).toContain('Planet Summary')
    expect(wrapper.text()).toContain('Market Ticker')
    expect(wrapper.text()).toContain('ARC-01')
    expect(wrapper.text()).toContain('ARC-02')
    expect(wrapper.text()).toContain('planet-alpha')
    expect(wrapper.text()).toContain('planet-beta')
    expect(wrapper.text()).toContain('market-metals')
    expect(wrapper.findAll('.wf-widget-host')).toHaveLength(3)

    await select.setValue('forge-dark')
    expect(wrapper.get('.wf-theme').attributes('style')).toContain('--wf-color-canvas: #070b12')

    await select.setValue('forge-light')
    expect(wrapper.get('.wf-theme').attributes('style')).toContain('--wf-color-canvas: #e9eef3')
  })
})
