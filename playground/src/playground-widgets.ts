import { createWidgetRegistry, defineWidget } from 'widgetforge'
import LiveMetricWidget from './widgets/LiveMetricWidget.vue'
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

export const liveMetricWidget = defineWidget({
  id: 'demo.live-metric',
  title: 'Live Metric',
  component: LiveMetricWidget,
  parameters: {
    resourceId: { type: 'string', required: true },
  },
  window: {
    defaultSize: { width: 260, height: 170 },
    minSize: { width: 220, height: 140 },
    maxSize: { width: 460, height: 320 },
    options: {
      layer: 'always-on-top',
      opacity: 0.94,
      header: 'focused',
    },
  },
})

export const playgroundWidgets = [planetSummaryWidget, marketTickerWidget, liveMetricWidget]
export const playgroundWidgetRegistry = createWidgetRegistry(playgroundWidgets)
