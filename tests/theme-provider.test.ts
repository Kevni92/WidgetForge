import { defineComponent, h, onMounted } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ThemeProvider from '../src/vue/ThemeProvider.vue'
import { useTheme } from '../src/vue/theme-context'
import { defaultTheme } from '../src/vue/theme'
import { forgeDarkTheme, forgeLightTheme } from '../src/presets/forge'

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

  it('switches complete presets reactively without remounting consumer content', async () => {
    let mountCount = 0
    const PresetProbe = defineComponent({
      setup() {
        onMounted(() => { mountCount += 1 })
        const theme = useTheme()
        return () => h('span', { class: 'preset-probe' }, theme.value.color.canvas)
      },
    })

    const wrapper = mount(ThemeProvider, {
      props: { theme: forgeDarkTheme },
      slots: { default: PresetProbe },
    })

    expect(wrapper.get('.preset-probe').text()).toBe(forgeDarkTheme.color.canvas)
    expect(mountCount).toBe(1)

    await wrapper.setProps({ theme: forgeLightTheme })

    expect(wrapper.get('.preset-probe').text()).toBe(forgeLightTheme.color.canvas)
    expect(wrapper.get('.wf-theme').attributes('style')).toContain(`--wf-color-canvas: ${forgeLightTheme.color.canvas}`)
    expect(mountCount).toBe(1)
  })

  it('exposes role and backdrop tokens to custom themes without component overrides', () => {
    const wrapper = mount(ThemeProvider, {
      props: { theme: {
        color: {
          surfaceWindow: 'window-surface',
          surfaceFloating: 'floating-surface',
          surfaceOverlay: 'overlay-surface',
          surfaceModal: 'modal-surface',
          borderModal: 'modal-border',
          backdrop: 'modal-backdrop',
        },
        shadow: { lg: 'modal-shadow' },
      } },
    })

    const style = wrapper.get('.wf-theme').attributes('style')
    expect(style).toContain('--wf-color-surface-window: window-surface')
    expect(style).toContain('--wf-color-surface-floating: floating-surface')
    expect(style).toContain('--wf-color-surface-overlay: overlay-surface')
    expect(style).toContain('--wf-color-surface-modal: modal-surface')
    expect(style).toContain(`--wf-color-text-placeholder: ${defaultTheme.color.textPlaceholder}`)
    expect(style).toContain('--wf-color-border-modal: modal-border')
    expect(style).toContain('--wf-color-backdrop: modal-backdrop')
    expect(style).toContain('--wf-shadow-lg: modal-shadow')
  })
})
