import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import InteractionShowcase from '../src/InteractionShowcase.vue'
import type { WidgetNavigator } from 'widgetforge'

describe('InteractionShowcase', () => {
  it('demonstrates context actions, widget navigation and confirmation', async () => {
    const navigate = vi.fn(() => ({ widgetId: 'market.ticker', instanceId: 'market-demo' }))
    const navigator: WidgetNavigator = { navigate }
    const wrapper = mount(InteractionShowcase, { props: { navigator } })

    await wrapper.get('.interaction-showcase__target').trigger('contextmenu', { clientX: 30, clientY: 40 })
    expect(wrapper.findAll('[role="menuitem"]')).toHaveLength(4)
    await wrapper.findAll('[role="menuitem"]')[1]?.trigger('click')
    expect(wrapper.text()).toContain('Last menu action: pin')

    await wrapper.get('.interaction-showcase__target').trigger('contextmenu', { clientX: 30, clientY: 40 })
    await wrapper.findAll('[role="menuitem"]')[0]?.trigger('click')
    expect(navigate).toHaveBeenCalledWith({
      widgetId: 'market.ticker',
      parameters: { commodity: 'STEEL', rows: 5 },
    })

    await wrapper.get('[data-confirm-demo]').trigger('click')
    expect(wrapper.get('[role="dialog"]').text()).toContain('Delete local layout marker?')
    await wrapper.get('.wf-confirmation-dialog__confirm').trigger('click')
    expect(wrapper.text()).toContain('Last decision: confirmed')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })
})
