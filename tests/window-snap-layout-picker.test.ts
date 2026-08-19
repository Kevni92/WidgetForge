import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import WindowSnapLayoutPicker from '../src/vue/WindowSnapLayoutPicker.vue'

describe('WindowSnapLayoutPicker', () => {
  it('renders maximize plus every snap layout and emits pointer selection', async () => {
    const wrapper = mount(WindowSnapLayoutPicker, { attachTo: document.body })
    expect(wrapper.findAll('[data-window-layout]')).toHaveLength(13)
    await wrapper.get('[data-window-layout="bottom-right"]').trigger('click')
    expect(wrapper.emitted('select')?.[0]).toEqual(['bottom-right'])
    wrapper.unmount()
  })

  it('supports keyboard navigation and Escape cleanup', async () => {
    const wrapper = mount(WindowSnapLayoutPicker, { attachTo: document.body })
    const first = wrapper.get('[data-window-layout="maximize"]')
    ;(first.element as HTMLElement).focus()
    await first.trigger('keydown', { key: 'ArrowRight' })
    await Promise.resolve()
    expect(document.activeElement?.getAttribute('data-window-layout')).toBe('left')
    await wrapper.get('[data-window-layout="left"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })
})
