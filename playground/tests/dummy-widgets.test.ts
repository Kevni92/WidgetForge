import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MarketTickerWidget from '../src/widgets/MarketTickerWidget.vue'
import PlanetSummaryWidget from '../src/widgets/PlanetSummaryWidget.vue'

describe('playground dummy widgets', () => {
  it('renders both contract example components', () => {
    expect(mount(PlanetSummaryWidget).text()).toContain('Planet Summary')
    expect(mount(MarketTickerWidget).text()).toContain('Market Ticker')
  })
})
