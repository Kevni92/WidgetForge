import { createCommandRegistry, HELP_WIDGET_ID } from 'widgetforge'

export const playgroundCommands = createCommandRegistry([
  { name: 'help', widgetId: HELP_WIDGET_ID, description: 'Open the generic widget and command reference.', category: 'Workspace', examples: ['help'] },
  { name: 'planet', aliases: ['p'], widgetId: 'planet.summary', description: 'Open a colony overview.', category: 'Widgets', examples: ['planet ARC-01 true'], arguments: [{ name: 'planetId', type: 'string', required: true, description: 'Colony identifier.', example: 'ARC-01' }, { name: 'compact', type: 'boolean', default: false, description: 'Use the compact layout.', example: true }] },
  { name: 'market', aliases: ['mkt'], widgetId: 'market.ticker', description: 'Open the commodity exchange.', category: 'Widgets', examples: ['market 8'], parameters: { commodity: 'METALS' }, arguments: [{ name: 'rows', type: 'number', default: 8, description: 'Number of rows to show.', example: 8 }] },
  { name: 'production', aliases: ['prod'], widgetId: 'economy.production', description: 'Open the production overview.', category: 'Widgets', examples: ['production'] },
  { name: 'inventory', aliases: ['inv'], widgetId: 'economy.inventory', description: 'Open the inventory overview.', category: 'Widgets', examples: ['inventory'] },
  { name: 'orders', aliases: ['ord'], widgetId: 'economy.orders', description: 'Open the logistics orders.', category: 'Widgets', examples: ['orders'] },
  { name: 'alerts', widgetId: 'demo.alerts', description: 'Open the operations alert feed.', category: 'Widgets', examples: ['alerts'] },
])
