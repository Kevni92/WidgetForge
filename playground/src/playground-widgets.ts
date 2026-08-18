import { createWidgetRegistry, defineWidget } from 'widgetforge'
import AlertsWidget from './widgets/AlertsWidget.vue'
import LiveMetricWidget from './widgets/LiveMetricWidget.vue'
import MarketTickerWidget from './widgets/MarketTickerWidget.vue'
import PlanetSummaryWidget from './widgets/PlanetSummaryWidget.vue'
import WorkspaceCommandBarWidget from './widgets/WorkspaceCommandBarWidget.vue'
import WorkspaceTopbarWidget from './widgets/WorkspaceTopbarWidget.vue'

export const planetSummaryWidget = defineWidget({
  id: 'planet.summary',
  title: 'Colony Overview',
  component: PlanetSummaryWidget,
  parameters: {
    planetId: { type: 'string', required: true },
    compact: { type: 'boolean', default: false },
  },
  window: {
    defaultSize: { width: 430, height: 330 },
    minSize: { width: 320, height: 210 },
    maxSize: { width: 900, height: 700 },
  },
})

export const marketTickerWidget = defineWidget({
  id: 'market.ticker',
  title: 'Commodity Exchange',
  component: MarketTickerWidget,
  parameters: {
    commodity: { type: 'string' },
    rows: { type: 'number', default: 10 },
  },
  window: {
    defaultSize: { width: 620, height: 430 },
    minSize: { width: 420, height: 260 },
    singleton: true,
  },
})

export const liveMetricWidget = defineWidget({
  id: 'demo.live-metric',
  title: 'Live Telemetry',
  component: LiveMetricWidget,
  parameters: { resourceId: { type: 'string', required: true } },
  window: {
    defaultSize: { width: 260, height: 170 },
    minSize: { width: 220, height: 140 },
    maxSize: { width: 460, height: 320 },
    options: { layer: 'always-on-top', opacity: 0.94, header: 'focused' },
  },
})

export const alertsWidget = defineWidget({
  id: 'demo.alerts',
  title: 'Operations Alerts',
  component: AlertsWidget,
  window: {
    defaultSize: { width: 430, height: 310 },
    minSize: { width: 330, height: 220 },
    singleton: true,
  },
})

export const workspaceTopbarWidget = defineWidget({
  id: 'demo.workspace-topbar',
  title: 'Workspace Navigation',
  component: WorkspaceTopbarWidget,
})

export const workspaceCommandBarWidget = defineWidget({
  id: 'demo.workspace-commandbar',
  title: 'Command Console',
  component: WorkspaceCommandBarWidget,
})

export const playgroundWidgets = [
  planetSummaryWidget,
  marketTickerWidget,
  liveMetricWidget,
  alertsWidget,
  workspaceTopbarWidget,
  workspaceCommandBarWidget,
]
export const playgroundWidgetRegistry = createWidgetRegistry(playgroundWidgets)
