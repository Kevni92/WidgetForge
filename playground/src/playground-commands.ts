import { createCommandRegistry } from 'widgetforge'

export const playgroundCommands = createCommandRegistry([
  {
    name: 'planet',
    aliases: ['p'],
    widgetId: 'planet.summary',
    arguments: [
      { name: 'planetId', type: 'string', required: true },
      { name: 'compact', type: 'boolean', default: false },
    ],
  },
  {
    name: 'market',
    aliases: ['mkt'],
    widgetId: 'market.ticker',
    parameters: { commodity: 'METALS' },
    arguments: [{ name: 'rows', type: 'number', default: 8 }],
  },
  { name: 'alerts', widgetId: 'demo.alerts' },
])
