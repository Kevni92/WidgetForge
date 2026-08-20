import { describe, expect, it } from 'vitest'
import { createHelpDocumentationSnapshot, searchHelpDocumentation, type HelpDocumentationSnapshot } from '../src/core/help-documentation'
import type { CommandDocumentationView, WidgetDocumentationView } from '../src/core/documentation'

const widgets: readonly WidgetDocumentationView[] = [
  {
    kind: 'widget',
    id: 'planet.summary',
    title: 'Colony Overview',
    description: 'Inspect a colony and its current operational state.',
    summary: 'A colony overview.',
    details: 'Use planetId to choose the colony.',
    examples: ['Open ARC-01.'],
    parameters: [
      { name: 'planetId', type: 'string', required: true, description: 'Colony identifier.', example: 'ARC-01' },
      { name: 'compact', type: 'boolean', required: false, default: false, description: 'Use the compact layout.', example: true },
    ],
  },
  {
    kind: 'widget',
    id: 'market.ticker',
    title: 'Commodity Exchange',
    description: 'Compare current commodity prices.',
    examples: [],
    parameters: [{ name: 'rows', type: 'number', required: false, default: 10, description: 'Number of rows.', example: 10 }],
  },
]

const commands: readonly CommandDocumentationView[] = [
  {
    kind: 'command',
    name: 'planet',
    aliases: ['p'],
    widgetId: 'planet.summary',
    description: 'Open a colony overview.',
    examples: ['planet ARC-01'],
    usage: 'planet <planetId>',
    arguments: [{ name: 'planetId', type: 'string', required: true, description: 'Colony identifier.', example: 'ARC-01' }],
  },
  {
    kind: 'command',
    name: 'market',
    aliases: ['mkt'],
    widgetId: 'market.ticker',
    description: 'Open the commodity exchange.',
    category: 'Widgets',
    examples: ['market 10'],
    usage: 'market [rows]',
    arguments: [{ name: 'rows', type: 'number', required: false, default: 10, description: 'Number of rows.', example: 10 }],
  },
]

describe('help documentation model', () => {
  it('sorts references deterministically and associates commands with widgets', () => {
    const snapshot = createHelpDocumentationSnapshot(widgets, commands)

    expect(snapshot.widgets.map((entry) => entry.id)).toEqual(['planet.summary', 'market.ticker'])
    expect(snapshot.commands.map((entry) => entry.name)).toEqual(['market', 'planet'])
    expect(snapshot.widgets[0]?.commands.map((command) => command.name)).toEqual(['planet'])
    expect(snapshot.widgets[1]?.commands.map((command) => command.name)).toEqual(['market'])
    expect(snapshot.entries.map((entry) => entry.key)).toEqual([
      'widget:planet.summary',
      'widget:market.ticker',
      'command:market',
      'command:planet',
    ])
  })

  it.each([
    ['MARKET.TICKER', 'all', ['widget:market.ticker', 'command:market']],
    ['commodity prices', 'widgets', ['widget:market.ticker']],
    ['planetid', 'widgets', ['widget:planet.summary']],
    ['mkt', 'commands', ['command:market']],
    ['arc-01', 'all', ['command:planet', 'widget:planet.summary']],
  ] as const)('searches IDs, descriptions, parameter names and aliases: %s', (query, filter, expected) => {
    const snapshot = createHelpDocumentationSnapshot(widgets, commands)
    expect(searchHelpDocumentation(snapshot, query, filter).map((result) => result.entry.key)).toEqual(expected)
  })

  it('returns a stable empty result for unknown queries and supports all filters', () => {
    const snapshot: HelpDocumentationSnapshot = createHelpDocumentationSnapshot(widgets, commands)
    expect(searchHelpDocumentation(snapshot, 'does-not-exist')).toEqual([])
    expect(searchHelpDocumentation(snapshot, '', 'widgets')).toHaveLength(2)
    expect(searchHelpDocumentation(snapshot, '', 'commands')).toHaveLength(2)
    expect(searchHelpDocumentation(snapshot)).toHaveLength(4)
  })
})
