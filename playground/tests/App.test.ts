import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import App from '../src/App.vue'

describe('Playground App', () => {
  it('renders the WidgetForge playground shell', () => {
    const wrapper = mount(App)

    expect(wrapper.get('h1').text()).toBe('Playground')
    expect(wrapper.text()).toContain('Die Framework-Basis ist geladen.')
  })
})
