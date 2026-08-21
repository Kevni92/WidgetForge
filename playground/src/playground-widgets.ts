import { createWidgetRegistry, defineWidget, HELP_WIDGET_ID, HelpWidget } from 'widgetforge'
import AlertsWidget from './widgets/AlertsWidget.vue'
import InventoryWidget from './widgets/InventoryWidget.vue'
import LiveMetricWidget from './widgets/LiveMetricWidget.vue'
import MarketTickerWidget from './widgets/MarketTickerWidget.vue'
import OrdersWidget from './widgets/OrdersWidget.vue'
import PlanetSummaryWidget from './widgets/PlanetSummaryWidget.vue'
import ProductionWidget from './widgets/ProductionWidget.vue'
import WorkspaceCommandBarWidget from './widgets/WorkspaceCommandBarWidget.vue'
import WorkspaceTopbarWidget from './widgets/WorkspaceTopbarWidget.vue'
import LayoutAcceptanceWidget from './widgets/LayoutAcceptanceWidget.vue'

type DemoLinkedSelection = { followSelection: boolean; pinnedSelection: string | null }
function isLinkedSelection(value: unknown): value is DemoLinkedSelection {
  if (typeof value !== 'object' || value === null) return false
  const linked = value as { followSelection?: unknown; pinnedSelection?: unknown }
  return typeof linked.followSelection === 'boolean' && (linked.pinnedSelection === null || typeof linked.pinnedSelection === 'string')
}
const linkedViewState={version:1,defaultState:{selection:{followSelection:true,pinnedSelection:null}},validate:(value:unknown):value is {selection:DemoLinkedSelection}=>typeof value==='object'&&value!==null&&isLinkedSelection((value as {selection?:unknown}).selection)} as const

export const planetSummaryWidget = defineWidget({
  id: 'planet.summary', title: 'Colony Overview', description: 'Inspect a colony and its current operational state.', component: PlanetSummaryWidget,
  parameters: { planetId: { type: 'string', required: true, description: 'Stable identifier of the colony to inspect.', example: 'ARC-01' }, compact: { type: 'boolean', default: false, description: 'Use the compact colony layout.', example: true } },
  capabilities: { multipleInstances: true, dockable: true, tabCompatible: true, preferredAspectRatio: 1.3, minimumUsefulSize: { width: 300, height: 190 }, supportsCompactMode: true },
  window: { defaultSize: { width: 430, height: 330 }, minSize: { width: 320, height: 210 }, maxSize: { width: 900, height: 700 } },
})

export const marketTickerWidget = defineWidget({
  id: 'market.ticker', title: 'Commodity Exchange', description: 'Compare current commodity prices and trading volume.', component: MarketTickerWidget,
  documentation: { summary: 'A compact view of the commodity exchange.', details: 'Leave commodity empty to show the complete market.', examples: ['Open METALS with 10 rows.'] },
  parameters: { commodity: { type: 'string', description: 'Optional commodity symbol used to filter the market.', example: 'METALS' }, rows: { type: 'number', default: 10, description: 'Maximum number of market rows to display.', example: 10 } },
  capabilities: { multipleInstances: false, dockable: true, tabCompatible: true, preferredAspectRatio: 1.45, minimumUsefulSize: { width: 420, height: 260 }, supportsCompactMode: false },
  viewState: {
    version: 1,
    defaultState: { filter: '', sortColumn: 'volume', sortDirection: 'desc', selected: null, selection: { followSelection: true, pinnedSelection: null } },
    validate: (value): value is { filter: string; sortColumn: string; sortDirection: 'asc' | 'desc'; selected: string | null; selection: DemoLinkedSelection } => {
      if (typeof value !== 'object' || value === null) return false
      const state = value as { filter?: unknown; sortColumn?: unknown; sortDirection?: unknown; selected?: unknown; selection?: unknown }
      return typeof state.filter === 'string' && typeof state.sortColumn === 'string' && (state.sortDirection === 'asc' || state.sortDirection === 'desc') && (state.selected === null || typeof state.selected === 'string') && isLinkedSelection(state.selection)
    },
  },
  window: { defaultSize: { width: 620, height: 430 }, minSize: { width: 420, height: 260 } },
})

export const productionWidget=defineWidget({id:'economy.production',title:'Production',description:'Monitor active production lines and output.',component:ProductionWidget,capabilities:{multipleInstances:true,dockable:true,tabCompatible:true,minimumUsefulSize:{width:330,height:220},supportsCompactMode:true},viewState:linkedViewState,window:{defaultSize:{width:440,height:300},minSize:{width:330,height:220}}})
export const inventoryWidget=defineWidget({id:'economy.inventory',title:'Inventory',description:'Review stored materials, quantities and selection state.',component:InventoryWidget,capabilities:{multipleInstances:true,dockable:true,tabCompatible:true,minimumUsefulSize:{width:390,height:240},supportsCompactMode:false},viewState:{version:1,defaultState:{filter:'',sortColumn:'quantity',sortDirection:'desc',selection:{followSelection:true,pinnedSelection:null}},validate:(value):value is {filter:string;sortColumn:string;sortDirection:'asc'|'desc';selection:DemoLinkedSelection}=>{if(typeof value!=='object'||value===null)return false;const state=value as {filter?:unknown;sortColumn?:unknown;sortDirection?:unknown;selection?:unknown};return typeof state.filter==='string'&&typeof state.sortColumn==='string'&&(state.sortDirection==='asc'||state.sortDirection==='desc')&&isLinkedSelection(state.selection)}},window:{defaultSize:{width:500,height:320},minSize:{width:390,height:240}}})
export const ordersWidget=defineWidget({id:'economy.orders',title:'Orders',description:'Track pending and completed logistics orders.',component:OrdersWidget,capabilities:{multipleInstances:true,dockable:true,tabCompatible:true,minimumUsefulSize:{width:390,height:230},supportsCompactMode:false},viewState:linkedViewState,window:{defaultSize:{width:500,height:300},minSize:{width:390,height:230}}})

export const liveMetricWidget = defineWidget({
  id: 'demo.live-metric', title: 'Live Telemetry', description: 'Display a continuously updated operational metric.', component: LiveMetricWidget,
  parameters: { resourceId: { type: 'string', required: true, description: 'Identifier of the metric resource.', example: 'grid-power' } },
  capabilities: { multipleInstances: true, dockable: true, tabCompatible: true, preferredAspectRatio: 1.55, minimumUsefulSize: { width: 180, height: 110 }, supportsCompactMode: true },
  viewState: linkedViewState,
  actions: [{ id: 'open-colony', label: 'Open colony', icon: '↗', group: 'navigation', priority: 20, target: { kind: 'navigation', intent: { widgetId: 'planet.summary', parameters: { planetId: 'ARC-01', compact: true } } } }],
  window: { defaultSize: { width: 260, height: 170 }, minSize: { width: 220, height: 140 }, maxSize: { width: 460, height: 320 }, options: { role: 'utility', layer: 'always-on-top', opacity: 0.94, header: 'hover', chrome: 'borderless', glass: true, icon: '◇', badge: 'LIVE', status: 'SYNC' } },
})

export const alertsWidget = defineWidget({ id: 'demo.alerts', title: 'Operations Alerts', description: 'Surface actionable alerts from the operations feed.', component: AlertsWidget, capabilities: { multipleInstances: false, dockable: false, tabCompatible: false, preferredAspectRatio: 1.4, minimumUsefulSize: { width: 330, height: 220 }, supportsCompactMode: false }, window: { defaultSize: { width: 430, height: 310 }, minSize: { width: 330, height: 220 } } })
export const overlayCommandWidget = defineWidget({ id: 'demo.overlay-command', title: 'Quick Command Overlay', description: 'Provide a compact command surface above the workspace.', component: WorkspaceCommandBarWidget, capabilities: { multipleInstances: false, dockable: false, tabCompatible: false, supportsCompactMode: false }, window: { defaultSize: { width: 420, height: 190 }, minSize: { width: 320, height: 150 }, options: { role: 'overlay' } } })
export const modalReviewWidget = defineWidget({ id: 'demo.modal-review', title: 'Critical Operations Review', description: 'Review critical operational decisions in a modal window.', component: AlertsWidget, capabilities: { multipleInstances: false, dockable: false, tabCompatible: false, supportsCompactMode: false }, window: { defaultSize: { width: 520, height: 360 }, minSize: { width: 380, height: 260 }, options: { role: 'modal', chrome: 'borderless', resizable: false } } })
export const workspaceTopbarWidget = defineWidget({ id: 'demo.workspace-topbar', title: 'Workspace Navigation', description: 'Navigate the demo workspace and its common views.', component: WorkspaceTopbarWidget, capabilities: { multipleInstances: false, dockable: true, tabCompatible: false, supportsCompactMode: true } })
export const workspaceCommandBarWidget = defineWidget({ id: 'demo.workspace-commandbar', title: 'Command Console', description: 'Demonstrate command-driven workspace navigation.', component: WorkspaceCommandBarWidget, capabilities: { multipleInstances: false, dockable: true, tabCompatible: false, supportsCompactMode: true } })
export const layoutAcceptanceWidget = defineWidget({ id: 'demo.layout-acceptance', title: 'Layout Acceptance Surface', description: 'A named surface used by the playground layout editor acceptance flow.', component: LayoutAcceptanceWidget, parameters: { region: { type: 'string', required: true, description: 'Acceptance surface region.', example: 'center' }, description: { type: 'string', required: true, description: 'Short description shown in the surface.', example: 'Canvas window' } }, capabilities: { multipleInstances: true, dockable: false, tabCompatible: false, supportsCompactMode: false }, window: { defaultSize: { width: 320, height: 390 }, minSize: { width: 140, height: 220 } } })
export const helpWidget = defineWidget({ id: HELP_WIDGET_ID, title: 'Help & Reference', description: 'Browse the widgets and commands available in this workspace.', component: HelpWidget, capabilities: { multipleInstances: true, dockable: true, tabCompatible: true, supportsCompactMode: true }, window: { defaultSize: { width: 760, height: 560 }, minSize: { width: 320, height: 240 } } })

export const playgroundWidgets = [planetSummaryWidget,marketTickerWidget,productionWidget,inventoryWidget,ordersWidget,liveMetricWidget,alertsWidget,overlayCommandWidget,modalReviewWidget,workspaceTopbarWidget,workspaceCommandBarWidget,layoutAcceptanceWidget,helpWidget]
export const playgroundWidgetRegistry = createWidgetRegistry(playgroundWidgets)
