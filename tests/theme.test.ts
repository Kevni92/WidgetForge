import { describe, expect, it } from 'vitest'
import { createTheme, defaultTheme, themeToCssVariables } from '../src/vue/theme'

describe('theme', () => {
  it('merges semantic token overrides without losing defaults', () => {
    const theme = createTheme({ color: { accent: '#ff00aa' }, space: { md: '20px' } })
    expect(theme.color.accent).toBe('#ff00aa')
    expect(theme.space.md).toBe('20px')
    expect(theme.color.text).toBe(defaultTheme.color.text)
  })

  it('serializes tokens to stable CSS variables', () => {
    const variables = themeToCssVariables(createTheme())
    expect(variables['--wf-color-surface-raised']).toBe(defaultTheme.color.surfaceRaised)
    expect(variables['--wf-layer-tooltip']).toBe(String(defaultTheme.layer.tooltip))
  })
})
