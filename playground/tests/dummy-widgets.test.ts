import { mount } from '@vue/test-utils'
import { defineComponent, h, markRaw } from 'vue'
import { describe, expect, it } from 'vitest'
import { DataClientProvider, SelectionProvider, WindowManagerHost, createDataClient, createMockDataProvider, createSelectionStore, createWindowManager } from 'widgetforge'
import { registerEconomyResources } from '../src/economic-domain'
import { playgroundWidgetRegistry } from '../src/playground-widgets'
import { colonySelectionKey } from '../src/selection-demo'

describe('playground simulation widgets', () => {
  it('renders colony and market widgets through the public window API', () => {
    const manager = markRaw(createWindowManager(playgroundWidgetRegistry))
    manager.open({ widgetId: 'planet.summary', instanceId: 'planet-test', parameters: { planetId: 'TEST-01' } })
    manager.open({ widgetId: 'market.ticker', instanceId: 'market-test', parameters: { commodity: 'TEST', rows: 4 } })
    const provider = markRaw(createMockDataProvider())
    registerEconomyResources(provider)
    const client = markRaw(createDataClient(provider))
    const selection = markRaw(createSelectionStore())
    selection.select(colonySelectionKey, 'ARC-01')
    const Root = defineComponent({ setup: () => () => h(DataClientProvider, { client }, () => h(SelectionProvider, { store: selection }, () => h(WindowManagerHost, { manager, registry: playgroundWidgetRegistry }))) })
    const wrapper = mount(Root)

    expect(wrapper.text()).toContain('Colony Administration')
    expect(wrapper.text()).toContain('TEST-01')
    expect(wrapper.text()).toContain('TEST Market')
    expect(wrapper.findAll('.wf-data-table__row')).toHaveLength(4)
    expect(wrapper.get('[data-navigation="market"]').text()).toContain('Open local market')
    wrapper.unmount()
  })
})
