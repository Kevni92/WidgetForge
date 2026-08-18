import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { WindowManagerHost, createWindowManager } from 'widgetforge'
import { playgroundWidgetRegistry } from '../src/playground-widgets'

describe('playground dummy widgets', () => {
  it('renders both contract example components through the public window API', () => {
    const manager = createWindowManager(playgroundWidgetRegistry)
    manager.open({
      widgetId: 'planet.summary',
      instanceId: 'planet-test',
      parameters: { planetId: 'TEST-01' },
    })
    manager.open({
      widgetId: 'market.ticker',
      instanceId: 'market-test',
      parameters: { commodity: 'TEST', rows: 3 },
    })

    const wrapper = mount(WindowManagerHost, { props: { manager, registry: playgroundWidgetRegistry } })

    expect(wrapper.text()).toContain('Planet Summary')
    expect(wrapper.text()).toContain('TEST-01')
    expect(wrapper.text()).toContain('Market Ticker')
    expect(wrapper.text()).toContain('TEST')
    wrapper.unmount()
  })
})
