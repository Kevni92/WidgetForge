import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import NotificationShowcase from '../src/NotificationShowcase.vue'
import type { WidgetNavigator } from 'widgetforge'

describe('NotificationShowcase', () => {
  it('demonstrates transient and persistent notifications including widget navigation', async () => {
    const navigate = vi.fn(() => ({ widgetId: 'market.ticker', instanceId: 'market-demo' }))
    const navigator: WidgetNavigator = { navigate }
    const wrapper = mount(NotificationShowcase, { props: { navigator } })

    await wrapper.get('[data-notification-demo="info"]').trigger('click')
    await wrapper.get('[data-notification-demo="success"]').trigger('click')
    expect(wrapper.findAll('.wf-notification-toast')).toHaveLength(2)

    await wrapper.get('[data-notification-demo="persistent"]').trigger('click')
    expect(wrapper.findAll('.wf-notification-center__item')).toHaveLength(1)
    expect(wrapper.text()).toContain('Market threshold reached')

    await wrapper.get('.wf-notification-center__action').trigger('click')
    expect(navigate).toHaveBeenCalledWith({
      widgetId: 'market.ticker',
      parameters: { commodity: 'STEEL', rows: 5 },
    })
  })
})
