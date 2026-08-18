import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import App from '../src/App.vue'

describe('Playground App', () => {
  it('demonstrates open, focus, minimize, restore, singleton reuse and close through the public WindowManager flow', async () => {
    const wrapper = mount(App)
    const select = wrapper.get('select')

    expect(wrapper.findAll('.wf-window-shell')).toHaveLength(3)
    expect(wrapper.get('[data-window-instance-id="market-metals"] .wf-window-shell').attributes('data-focused')).toBe('true')

    await wrapper.get('[data-window-instance-id="planet-alpha"] .wf-window-shell').trigger('pointerdown')
    expect(wrapper.get('[data-window-instance-id="planet-alpha"] .wf-window-shell').attributes('data-focused')).toBe('true')

    await wrapper.get('[data-window-instance-id="planet-alpha"] .wf-window-shell__minimize').trigger('click')
    expect(wrapper.get('[data-window-instance-id="planet-alpha"]').attributes('data-window-mode')).toBe('minimized')

    await wrapper.get('[data-window-instance-id="planet-alpha"] .wf-window-shell__minimize').trigger('click')
    expect(wrapper.get('[data-window-instance-id="planet-alpha"]').attributes('data-window-mode')).toBe('normal')

    await wrapper.get('[data-action="open-market"]').trigger('click')
    expect(wrapper.findAll('[data-window-instance-id="market-metals"]')).toHaveLength(1)
    expect(wrapper.findAll('.wf-window-shell')).toHaveLength(3)

    await wrapper.get('[data-window-instance-id="planet-beta"] .wf-window-shell__close').trigger('click')
    expect(wrapper.find('[data-window-instance-id="planet-beta"]').exists()).toBe(false)

    await wrapper.get('[data-action="open-planet"]').trigger('click')
    expect(wrapper.findAll('.wf-window-shell')).toHaveLength(3)
    expect(wrapper.text()).toContain('ARC-03')

    await select.setValue('forge-dark')
    expect(wrapper.get('.wf-theme').attributes('style')).toContain('--wf-color-canvas: #070b12')
  })
})
