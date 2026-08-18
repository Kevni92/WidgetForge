import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { WindowManagerHost, createWindowManager } from 'widgetforge'
import { playgroundWidgetRegistry } from '../src/playground-widgets'

describe('playground simulation widgets', () => {
  it('renders colony and market widgets through the public window API', () => {
    const manager = createWindowManager(playgroundWidgetRegistry)
    manager.open({ widgetId: 'planet.summary', instanceId: 'planet-test', parameters: { planetId: 'TEST-01' } })
    manager.open({ widgetId: 'market.ticker', instanceId: 'market-test', parameters: { commodity: 'TEST', rows: 4 } })

    const wrapper = mount(WindowManagerHost, { props: { manager, registry: playgroundWidgetRegistry } })

    expect(wrapper.text()).toContain('Colony Administration')
    expect(wrapper.text()).toContain('TEST-01')
    expect(wrapper.text()).toContain('TEST Market')
    expect(wrapper.findAll('.wf-data-table__row')).toHaveLength(4)
    expect(wrapper.get('[data-navigation="market"]').text()).toContain('Open local market')
    wrapper.unmount()
  })
})
