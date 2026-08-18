import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import App from '../src/App.vue'

describe('Playground App', () => {
  it('switches the public WidgetForge theme', async () => {
    const wrapper = mount(App)
    expect(wrapper.get('h1').text()).toBe('Playground')
    expect(wrapper.get('.wf-theme').attributes('style')).toContain('--wf-color-canvas: #11161d')

    await wrapper.get('select').setValue('paper')
    expect(wrapper.get('.wf-theme').attributes('style')).toContain('--wf-color-canvas: #efe9dc')
  })
})
