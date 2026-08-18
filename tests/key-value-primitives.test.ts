import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StatValue from '../src/primitives/StatValue.vue'
import KeyValueFixture from './fixtures/KeyValueFixture.vue'

describe('key/value primitives', () => {
  it('renders accessible grouped labels and values with consumer slots', async () => {
    const wrapper = mount(KeyValueFixture)

    const group = wrapper.get('.wf-key-value-group')
    expect(group.element.tagName).toBe('DL')
    expect(group.attributes('aria-label')).toBe('Facility statistics')
    expect(wrapper.findAll('dt')).toHaveLength(2)
    expect(wrapper.findAll('dd')).toHaveLength(2)
    expect(wrapper.text()).toContain('Efficiency')
    expect(wrapper.text()).toContain('Scheduled')

    await wrapper.get('.wf-info-popover').trigger('mouseenter')
    expect(wrapper.get('[role="dialog"]').text()).toContain('Base output multiplied by staffing')

    expect(wrapper.get('[data-test="maintenance-action"]').element.tagName).toBe('BUTTON')
  })

  it('renders numeric values, units and semantic tones without product-specific markup', () => {
    const wrapper = mount(StatValue, {
      props: { value: 118.5, unit: 'MW', tone: 'warning', label: 'Grid power 118.5 megawatts' },
    })

    expect(wrapper.classes()).toContain('wf-stat-value--warning')
    expect(wrapper.get('.wf-stat-value__value').text()).toBe('118.5')
    expect(wrapper.get('.wf-stat-value__unit').text()).toBe('MW')
    expect(wrapper.attributes('aria-label')).toBe('Grid power 118.5 megawatts')
  })
})
