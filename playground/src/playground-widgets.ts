import { createWidgetRegistry, defineWidget } from 'widgetforge'
import MarketTickerWidget from './widgets/MarketTickerWidget.vue'
import PlanetSummaryWidget from './widgets/PlanetSummaryWidget.vue'

export const planetSummaryWidget = defineWidget({
  id: 'planet.summary',
  title: 'Planet Summary',
  component: PlanetSummaryWidget,
  parameters: {
    planetId: { type: 'string', required: true },
    compact: { type: 'boolean', default: false },
  },
  window: {
    defaultSize: { width: 420, height: 300 },
    minSize: { width: 300, height: 180 },
    maxSize: { width: 900, height: 700 },
  },
})

export const marketTickerWidget = defineWidget({
  id: 'market.ticker',
  title: 'Market Ticker',
  component: MarketTickerWidget,
  parameters: {
    commodity: { type: 'string' },
    rows: { type: 'number', default: 8 },
  },
  window: {
    defaultSize: { width: 520, height: 360 },
    minSize: { width: 340, height: 220 },
    singleton: true,
  },
})

export const playgroundWidgets = [planetSummaryWidget, marketTickerWidget]
export const playgroundWidgetRegistry = createWidgetRegistry(playgroundWidgets)
