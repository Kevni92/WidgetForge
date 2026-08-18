import { describe, expect, it } from 'vitest'
import {
  CommandDefinitionError,
  CommandParseError,
  createCommandRegistry,
} from '../src/core/commands'

function createRegistry() {
  return createCommandRegistry([
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
      arguments: [
        { name: 'rows', type: 'number', default: 5 },
      ],
    },
  ])
}

describe('CommandRegistry', () => {
  it('registers commands and resolves aliases without mutating definitions', () => {
    const registry = createRegistry()

    expect(registry.get('planet')?.name).toBe('planet')
    expect(registry.get('P')?.name).toBe('planet')
    expect(registry.list()).toHaveLength(2)
  })

  it('parses typed arguments, defaults and quoted strings into navigation intents', () => {
    const registry = createRegistry()

    expect(registry.parse('planet "ARC Prime" yes')).toEqual({
      widgetId: 'planet.summary',
      parameters: { planetId: 'ARC Prime', compact: true },
    })
    expect(registry.parse('mkt 12')).toEqual({
      widgetId: 'market.ticker',
      parameters: { commodity: 'METALS', rows: 12 },
    })
    expect(registry.parse('planet ARC-01')).toEqual({
      widgetId: 'planet.summary',
      parameters: { planetId: 'ARC-01', compact: false },
    })
  })

  it('supports escaped whitespace and single quotes', () => {
    const registry = createRegistry()

    expect(registry.parse("planet 'New Terra' false").parameters).toMatchObject({ planetId: 'New Terra' })
    expect(registry.parse('planet New\\ Terra on').parameters).toMatchObject({ planetId: 'New Terra', compact: true })
  })

  it.each([
    ['', 'empty-input'],
    ['does-not-exist', 'unknown-command'],
    ['planet', 'missing-argument'],
    ['planet ARC-01 maybe', 'invalid-argument'],
    ['market not-a-number', 'invalid-argument'],
    ['market 4 extra', 'too-many-arguments'],
    ['planet "ARC-01', 'unterminated-quote'],
  ])('returns structured errors for %j', (input, expectedCode) => {
    const registry = createRegistry()

    try {
      registry.parse(input)
      throw new Error('expected parsing to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(CommandParseError)
      expect((error as CommandParseError).code).toBe(expectedCode)
    }
  })

  it('rejects duplicate canonical names and aliases', () => {
    const registry = createRegistry()

    expect(() => registry.register({ name: 'planet', widgetId: 'other' })).toThrow(CommandDefinitionError)
    expect(() => registry.register({ name: 'other', aliases: ['p'], widgetId: 'other' })).toThrow(CommandDefinitionError)
    expect(() => registry.register({ name: 'other', aliases: ['other'], widgetId: 'other' })).toThrow(CommandDefinitionError)
    expect(() => registry.register({ name: 'other', aliases: ['x', 'X'], widgetId: 'other' })).toThrow(CommandDefinitionError)
  })

  it('rejects invalid schemas before they reach the parser', () => {
    expect(() => createCommandRegistry([
      {
        name: 'bad',
        widgetId: 'test.widget',
        arguments: [
          { name: 'optional', type: 'string' },
          { name: 'required', type: 'string', required: true },
        ],
      },
    ])).toThrow(CommandDefinitionError)

    expect(() => createCommandRegistry([
      {
        name: 'bad-default',
        widgetId: 'test.widget',
        arguments: [{ name: 'rows', type: 'number', default: 'five' as unknown as number }],
      },
    ])).toThrow(CommandDefinitionError)
  })
})
