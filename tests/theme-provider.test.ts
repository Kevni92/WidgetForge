import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ThemeProvider from '../src/vue/ThemeProvider.vue'
import { useTheme } from '../src/vue/theme-context'

const Probe = defineComponent({
  setup() {
    const theme = useTheme()
    return () => h('span', { class: 'probe' }, theme.value.color.accent)
  },
})

describe('ThemeProvider', () => {
  it('provides the resolved theme and exposes CSS variables', async () => {
    const wrapper = mount(ThemeProvider, {
      props: { theme: { color: { accent: '#ff00aa' } } },
      slots: { default: Probe },
    })

    expect(wrapper.get('.probe').text()).toBe('#ff00aa')
    expect(wrapper.get('.wf-theme').attributes('style')).toContain('--wf-color-accent: #ff00aa')

    await wrapper.setProps({ theme: { color: { accent: '#00ffaa' } } })
    expect(wrapper.get('.probe').text()).toBe('#00ffaa')
  })
})
