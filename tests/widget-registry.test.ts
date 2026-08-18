import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import { defineWidget } from '../src/core/widget'
import {
  createWidgetRegistry,
  DuplicateWidgetIdError,
  UnknownWidgetError,
  WidgetParameterValidationError,
} from '../src/core/widget-registry'

const component = defineComponent(() => () => h('div', 'widget'))
const planetWidget = defineWidget({
  id: 'planet.summary',
  title: 'Planet Summary',
  component,
  parameters: {
    planetId: { type: 'string', required: true },
    compact: { type: 'boolean', default: false },
  },
})
const marketWidget = defineWidget({
  id: 'market.ticker',
  title: 'Market Ticker',
  component,
  parameters: { rows: { type: 'number', default: 8 } },
})

describe('WidgetRegistry', () => {
  it('registers, lists, resolves and unregisters multiple widgets', () => {
    const registry = createWidgetRegistry([planetWidget, marketWidget])

    expect(registry.list().map((widget) => widget.id)).toEqual(['planet.summary', 'market.ticker'])
    expect(registry.resolve('market.ticker').parameters).toEqual({ rows: 8 })
    expect(registry.unregister('planet.summary')).toBe(true)
    expect(registry.has('planet.summary')).toBe(false)
    expect(registry.has('market.ticker')).toBe(true)
  })

  it('rejects duplicate and unknown widget ids with defined errors', () => {
    const registry = createWidgetRegistry([planetWidget])

    expect(() => registry.register(planetWidget)).toThrow(DuplicateWidgetIdError)
    expect(() => registry.get('missing.widget')).toThrow(UnknownWidgetError)
  })

  it('distinguishes valid and invalid parameters and applies defaults', () => {
    const registry = createWidgetRegistry([planetWidget])

    const valid = registry.validate('planet.summary', { planetId: 'PL-4711' })
    expect(valid).toEqual({
      valid: true,
      parameters: { planetId: 'PL-4711', compact: false },
    })

    const invalid = registry.validate('planet.summary', {
      planetId: 4711,
      compact: 'yes',
      extra: true,
    })
    expect(invalid.valid).toBe(false)
    if (!invalid.valid) {
      expect(invalid.issues.map((issue) => issue.code)).toEqual(['unknown', 'type', 'type'])
    }
  })

  it('reports missing required parameters and rejects invalid resolution', () => {
    const registry = createWidgetRegistry([planetWidget])
    const result = registry.validate('planet.summary')

    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues[0]?.code).toBe('missing')

    expect(() => registry.resolve('planet.summary')).toThrow(WidgetParameterValidationError)
  })

  it('rejects non-finite number parameters', () => {
    const registry = createWidgetRegistry([marketWidget])
    const result = registry.validate('market.ticker', { rows: Number.NaN })

    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues[0]?.code).toBe('type')
  })
})
