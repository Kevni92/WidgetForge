import { mount } from '@vue/test-utils'
import { defineComponent, h, markRaw } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { DataClientProvider, SelectionProvider, createDataClient, createMockDataProvider, createSelectionStore, type WidgetNavigator } from 'widgetforge'
import { registerEconomyResources } from '../src/economic-domain'
import { colonySelectionKey } from '../src/selection-demo'
import InteractionShowcase from '../src/InteractionShowcase.vue'

describe('InteractionShowcase', () => {
  it('demonstrates context actions, widget navigation and confirmation', async () => {
    const navigate = vi.fn(() => ({ widgetId: 'market.ticker', instanceId: 'market-demo' }))
    const navigator: WidgetNavigator = { navigate }
    const provider = markRaw(createMockDataProvider())
    registerEconomyResources(provider)
    const client = markRaw(createDataClient(provider))
    const selection = markRaw(createSelectionStore())
    selection.select(colonySelectionKey, 'ARC-01')
    const Root = defineComponent({ setup: () => () => h(DataClientProvider, { client }, () => h(SelectionProvider, { store: selection }, () => h(InteractionShowcase, { navigator }))) })
    const wrapper = mount(Root)

    await wrapper.get('.interaction-showcase__target').trigger('contextmenu', { clientX: 30, clientY: 40 })
    expect(wrapper.findAll('[role="menuitem"]')).toHaveLength(4)
    await wrapper.findAll('[role="menuitem"]')[1]?.trigger('click')
    expect(wrapper.text()).toContain('Last menu action: pin')

    await wrapper.get('.interaction-showcase__target').trigger('contextmenu', { clientX: 30, clientY: 40 })
    await wrapper.findAll('[role="menuitem"]')[0]?.trigger('click')
    expect(navigate).toHaveBeenCalledWith({ widgetId: 'market.ticker', parameters: { commodity: 'STEEL', rows: 5 } })

    await wrapper.get('[data-confirm-demo]').trigger('click')
    expect(wrapper.get('[role="dialog"]').text()).toContain('Delete local layout marker?')
    await wrapper.get('.wf-confirmation-dialog__confirm').trigger('click')
    expect(wrapper.text()).toContain('Last decision: confirmed')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
