import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../src/App.vue'

describe('playground developer mode', () => {
  beforeEach(() => window.localStorage.clear())

  it('keeps DevTools opt-in and exposes diagnostics only after explicit developer activation', async () => {
    const wrapper = mount(App)
    const toggle = wrapper.get('[data-demo-action="devtools"]')
    expect(toggle.attributes('aria-pressed')).toBe('false')
    expect(wrapper.find('[data-widgetforge-devtools]').exists()).toBe(false)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', ctrlKey: true, shiftKey: true, bubbles: true }))
    await nextTick()
    expect(wrapper.find('[data-widgetforge-devtools]').exists()).toBe(false)

    await toggle.trigger('click')
    expect(toggle.attributes('aria-pressed')).toBe('true')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', ctrlKey: true, shiftKey: true, bubbles: true }))
    await nextTick()

    const panel = wrapper.get('[data-widgetforge-devtools]')
    expect(panel.text()).toContain('WidgetForge DevTools')
    expect(panel.text()).toContain('market-main')
    expect(panel.text()).toContain('workspace-top')
    expect(panel.text()).toContain('data consumers')

    await toggle.trigger('click')
    expect(wrapper.find('[data-widgetforge-devtools]').exists()).toBe(false)
    expect(wrapper.find('[data-devtools-visual-overlay]').exists()).toBe(false)
    wrapper.unmount()
  })
})
