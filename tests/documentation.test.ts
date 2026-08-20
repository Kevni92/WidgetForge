import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import { createCommandDocumentationView, createWidgetDocumentationView } from '../src/core/documentation'
import type { CommandArgumentDefinition } from '../src/core/commands'
import { createCommandRegistry } from '../src/core/commands'
import type { WidgetParameterDefinition } from '../src/core/widget'
import { defineWidget, WidgetDefinitionError } from '../src/core/widget'
import { CommandDefinitionError } from '../src/core/commands'
import { createWidgetRegistry } from '../src/core/widget-registry'

const component = defineComponent(() => () => h('div', 'widget'))

describe('documentation metadata', () => {
  it('keeps widget metadata typed and exposes a complete normalized view', () => {
    const parameter: WidgetParameterDefinition = { type: 'number', required: true, description: 'Rows to display.', example: 12 }
    const widget = defineWidget({
      id: 'market.ticker',
      title: 'Market Ticker',
      description: 'Shows current market data.',
      documentation: {
        summary: 'A compact market overview.',
        details: 'Use the commodity parameter to focus the view.',
        examples: ['Open the market for metals.'],
      },
      component,
      parameters: {
        commodity: { type: 'string', description: 'Commodity symbol.', example: 'METALS' },
        rows: parameter,
      },
    })

    expect(createWidgetDocumentationView(widget)).toEqual({
      kind: 'widget',
      id: 'market.ticker',
      title: 'Market Ticker',
      description: 'Shows current market data.',
      summary: 'A compact market overview.',
      details: 'Use the commodity parameter to focus the view.',
      examples: ['Open the market for metals.'],
      parameters: [
        { name: 'commodity', type: 'string', required: false, description: 'Commodity symbol.', example: 'METALS' },
        { name: 'rows', type: 'number', required: true, description: 'Rows to display.', example: 12 },
      ],
    })
  })

  it('keeps old widgets valid when documentation is omitted', () => {
    const registry = createWidgetRegistry([defineWidget({ id: 'test.legacy', title: 'Legacy', component })])

    expect(registry.listDocumentation()).toEqual([{
      kind: 'widget',
      id: 'test.legacy',
      title: 'Legacy',
      examples: [],
      parameters: [],
    }])
  })

  it('enumerates widget documentation deterministically and protects registry state', () => {
    const registry = createWidgetRegistry([
      defineWidget({ id: 'test.first', title: 'First', component, description: 'First widget.' }),
      defineWidget({ id: 'test.second', title: 'Second', component, parameters: { enabled: { type: 'boolean', default: true } } }),
    ])

    const listed = registry.list()
    listed[0]!.title = 'Changed outside the registry'
    listed[1]!.parameters!.enabled!.default = false

    expect(registry.list().map((manifest) => manifest.id)).toEqual(['test.first', 'test.second'])
    expect(registry.get('test.first').title).toBe('First')
    expect(registry.get('test.second').parameters?.enabled?.default).toBe(true)
    expect(registry.listDocumentation().map((documentation) => documentation.id)).toEqual(['test.first', 'test.second'])
  })

  it('documents commands, typed arguments, aliases and derived usage', () => {
    const commands = createCommandRegistry([
      {
        name: 'market',
        aliases: ['mkt'],
        widgetId: 'market.ticker',
        description: 'Open the market widget.',
        category: 'Navigation',
        examples: ['market 12'],
        arguments: [
          { name: 'commodity', type: 'string', required: true, description: 'Commodity symbol.', example: 'METALS' },
          { name: 'rows', type: 'number', default: 8, description: 'Number of rows.', example: 12 },
        ],
      },
    ])

    const commandDocumentation = createCommandDocumentationView(commands.get('mkt')!)
    expect(commandDocumentation).toEqual({
      kind: 'command',
      name: 'market',
      aliases: ['mkt'],
      widgetId: 'market.ticker',
      description: 'Open the market widget.',
      category: 'Navigation',
      examples: ['market 12'],
      usage: 'market <commodity> [rows]',
      arguments: [
        { name: 'commodity', type: 'string', required: true, description: 'Commodity symbol.', example: 'METALS' },
        { name: 'rows', type: 'number', required: false, default: 8, description: 'Number of rows.', example: 12 },
      ],
    })
    expect(commands.getDocumentation('mkt')).toEqual(commandDocumentation)
    expect(commands.listDocumentation().map((documentation) => documentation.name)).toEqual(['market'])

    const listed = commands.list()
    const listedArgument = listed[0]!.arguments![0] as { description?: string }
    listedArgument.description = 'Changed outside the registry'
    expect(commands.get('market')?.arguments?.[0]?.description).toBe('Commodity symbol.')
  })

  it('enforces compile-time example types for widget parameters and command arguments', () => {
    const validWidgetParameter: WidgetParameterDefinition = { type: 'boolean', example: true }
    const validCommandArgument: CommandArgumentDefinition = { name: 'rows', type: 'number', example: 4 }
    expect(validWidgetParameter.example).toBe(true)
    expect(validCommandArgument.example).toBe(4)

    // @ts-expect-error number parameters cannot use string examples
    const invalidWidgetParameter: WidgetParameterDefinition = { type: 'number', example: 'four' }
    // @ts-expect-error boolean arguments cannot use number examples
    const invalidCommandArgument: CommandArgumentDefinition = { name: 'compact', type: 'boolean', example: 1 }
    expect(invalidWidgetParameter).toBeDefined()
    expect(invalidCommandArgument).toBeDefined()
  })

  it('rejects runtime example values that do not match their canonical type', () => {
    expect(() => defineWidget({
      id: 'test.invalid-example',
      title: 'Invalid Example',
      component,
      parameters: { rows: { type: 'number', example: 'many' as unknown as number } },
    })).toThrow(WidgetDefinitionError)

    expect(() => createCommandRegistry([{
      name: 'invalid-example',
      widgetId: 'test.invalid-example',
      arguments: [{ name: 'rows', type: 'number', example: 'many' as unknown as number }],
    }])).toThrow(CommandDefinitionError)
  })
})
