import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { WidgetHost } from 'widgetforge'
import { playgroundWidgetRegistry } from '../src/playground-widgets'

describe('playground dummy widgets', () => {
  it('renders both contract example components through the public WidgetHost API', () => {
    const planet = mount(WidgetHost, {
      props: {
        registry: playgroundWidgetRegistry,
        widgetId: 'planet.summary',
        instanceId: 'planet-test',
        parameters: { planetId: 'TEST-01' },
      },
    })
    const market = mount(WidgetHost, {
      props: {
        registry: playgroundWidgetRegistry,
        widgetId: 'market.ticker',
        instanceId: 'market-test',
        parameters: { commodity: 'TEST', rows: 3 },
      },
    })

    expect(planet.text()).toContain('Planet Summary')
    expect(planet.text()).toContain('TEST-01')
    expect(market.text()).toContain('Market Ticker')
    expect(market.text()).toContain('TEST')
  })
})
