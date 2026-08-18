import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import EmptyState from '../src/primitives/EmptyState.vue'
import ErrorState from '../src/primitives/ErrorState.vue'
import LoadingState from '../src/primitives/LoadingState.vue'

describe('data state primitives', () => {
  it('renders an accessible loading status without owning data logic', () => {
    const wrapper = mount(LoadingState, {
      props: { message: 'Loading market data', compact: true },
    })

    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.classes()).toContain('wf-state--compact')
    expect(wrapper.text()).toContain('Loading market data')
    expect(wrapper.get('.wf-loading-state__indicator').attributes('aria-hidden')).toBe('true')
  })

  it('supports configurable empty content and consumer actions', () => {
    const wrapper = mount(EmptyState, {
      props: { title: 'No contracts', message: 'Adjust the current filters.' },
      slots: {
        icon: '<span>∅</span>',
        actions: '<button type="button" data-test="clear">Clear filters</button>',
      },
    })

    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.text()).toContain('No contracts')
    expect(wrapper.text()).toContain('Adjust the current filters.')
    expect(wrapper.get('[data-test="clear"]').element.tagName).toBe('BUTTON')
  })

  it('emits retry without performing fetching itself', async () => {
    const wrapper = mount(ErrorState, {
      props: {
        title: 'Market unavailable',
        message: 'The latest snapshot could not be loaded.',
        retryable: true,
        retryLabel: 'Try again',
      },
    })

    expect(wrapper.attributes('role')).toBe('alert')
    expect(wrapper.text()).toContain('Market unavailable')
    await wrapper.get('.wf-error-state__retry').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
