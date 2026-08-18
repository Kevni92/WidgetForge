import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import InfoPopover from '../src/primitives/InfoPopover.vue'
import NestedInfoPopover from './fixtures/NestedInfoPopover.vue'

describe('InfoPopover', () => {
  it('opens on hover and focus and exposes accessible popover state', async () => {
    const wrapper = mount(InfoPopover, {
      props: { label: 'Details' },
      slots: { default: '<div data-test="details">Structured details</div>' },
    })

    const root = wrapper.get('.wf-info-popover')
    const trigger = wrapper.get('.wf-info-popover__trigger')

    expect(trigger.attributes('aria-expanded')).toBe('false')
    await root.trigger('mouseenter')
    expect(wrapper.get('[role="dialog"]').text()).toContain('Structured details')
    expect(trigger.attributes('aria-expanded')).toBe('true')

    await root.trigger('mouseleave')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)

    await trigger.trigger('focus')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
  })

  it('keeps parent popovers stable while nested levels open and escape closes only the inner level', async () => {
    const wrapper = mount(NestedInfoPopover)
    const outer = wrapper.get('[data-test="outer"]')

    await outer.trigger('mouseenter')
    expect(wrapper.findAll('[role="dialog"]')).toHaveLength(1)

    await wrapper.get('[data-test="inner"] .wf-info-popover__trigger').trigger('click')
    expect(wrapper.findAll('[role="dialog"]')).toHaveLength(2)

    await wrapper.get('[data-test="deep"] .wf-info-popover__trigger').trigger('click')
    expect(wrapper.findAll('[role="dialog"]')).toHaveLength(3)
    expect(wrapper.text()).toContain('Maximum staffed production slots')

    await wrapper.get('[data-test="deep"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.findAll('[role="dialog"]')).toHaveLength(2)
    expect(wrapper.find('[data-test="outer-content"]').exists()).toBe(true)

    await wrapper.get('[data-test="inner"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.findAll('[role="dialog"]')).toHaveLength(1)
  })
})
