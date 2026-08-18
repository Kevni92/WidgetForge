import { defineComponent, h } from 'vue'
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  WidgetDefinitionError,
  defineWidget,
  type InferWidgetParameters,
  type WidgetManifest,
  type WidgetParameterSchema,
} from '../src/core/widget'

const component = defineComponent(() => () => h('div', 'widget'))

const parameters = {
  entityId: { type: 'string', required: true },
  zoom: { type: 'number' },
  compact: { type: 'boolean', default: false },
} as const satisfies WidgetParameterSchema

describe('widget contract', () => {
  it('preserves a small typed manifest and infers parameter values', () => {
    type Parameters = InferWidgetParameters<typeof parameters>
    expectTypeOf<Parameters>().toMatchTypeOf<{ entityId: string; zoom?: number; compact?: boolean }>()

    const manifest = defineWidget({
      id: 'planet.summary',
      title: 'Planet Summary',
      component,
      parameters,
      window: {
        defaultSize: { width: 420, height: 320 },
        minSize: { width: 280, height: 180 },
        maxSize: { width: 900, height: 700 },
      },
    })

    expect(manifest.id).toBe('planet.summary')
    expect(manifest.parameters?.entityId.required).toBe(true)
  })

  it('rejects invalid identifiers and parameter defaults early', () => {
    expect(() => defineWidget({ id: 'Planet Summary', title: 'Planet', component })).toThrow(WidgetDefinitionError)

    const invalid = {
      id: 'planet.invalid',
      title: 'Invalid',
      component,
      parameters: { count: { type: 'number', default: 'many' } },
    } as unknown as WidgetManifest

    expect(() => defineWidget(invalid)).toThrow('default value for parameter "count" must be a number')
  })

  it('rejects contradictory window size metadata', () => {
    expect(() =>
      defineWidget({
        id: 'planet.sized',
        title: 'Sized',
        component,
        window: {
          defaultSize: { width: 200, height: 200 },
          minSize: { width: 300, height: 180 },
        },
      }),
    ).toThrow('window.defaultSize must not be smaller than window.minSize')
  })
})
