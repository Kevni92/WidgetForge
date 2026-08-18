import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import App from '../src/App.vue'

describe('Playground App', () => {
  it('switches between Neutral, Forge Dark and Forge Light through the public API', async () => {
    const wrapper = mount(App)
    const select = wrapper.get('select')

    expect(wrapper.findAll('option')).toHaveLength(3)
    expect(wrapper.get('.wf-theme').attributes('style')).toContain('--wf-color-canvas: #11161d')

    await select.setValue('forge-dark')
    expect(wrapper.get('.wf-theme').attributes('style')).toContain('--wf-color-canvas: #070b12')
    expect(wrapper.get('.wf-theme').attributes('style')).toContain('--wf-color-success: #40d98a')

    await select.setValue('forge-light')
    expect(wrapper.get('.wf-theme').attributes('style')).toContain('--wf-color-canvas: #e9eef3')
    expect(wrapper.get('.wf-theme').attributes('style')).toContain('--wf-color-accent: #2aa7df')
  })
})
