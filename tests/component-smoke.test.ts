import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SmokeComponent from './fixtures/SmokeComponent.vue'

describe('Vue component test setup', () => {
  it('mounts and renders a Vue single-file component', () => {
    const wrapper = mount(SmokeComponent, {
      props: {
        label: 'WidgetForge',
      },
    })

    expect(wrapper.get('[data-testid="label"]').text()).toBe('WidgetForge')
  })
})
