import { describe, expect, it } from 'vitest'
import { createTheme, defaultTheme, themeToCssVariables } from '../src/vue/theme'

describe('theme', () => {
  it('merges semantic token overrides without losing defaults', () => {
    const theme = createTheme({ color: { accent: '#ff00aa' }, space: { md: '20px' } })
    expect(theme.color.accent).toBe('#ff00aa')
    expect(theme.space.md).toBe('20px')
    expect(theme.color.text).toBe(defaultTheme.color.text)
    expect(theme.color.success).toBe(defaultTheme.color.success)
    expect(theme.color.surfaceModal).toBe(defaultTheme.color.surfaceModal)
    expect(theme.shadow.lg).toBe(defaultTheme.shadow.lg)
  })

  it('serializes tokens to stable CSS variables', () => {
    const variables = themeToCssVariables(createTheme())
    expect(variables['--wf-color-surface-raised']).toBe(defaultTheme.color.surfaceRaised)
    expect(variables['--wf-color-surface-window']).toBe(defaultTheme.color.surfaceWindow)
    expect(variables['--wf-color-surface-floating']).toBe(defaultTheme.color.surfaceFloating)
    expect(variables['--wf-color-surface-overlay']).toBe(defaultTheme.color.surfaceOverlay)
    expect(variables['--wf-color-surface-modal']).toBe(defaultTheme.color.surfaceModal)
    expect(variables['--wf-color-text-placeholder']).toBe(defaultTheme.color.textPlaceholder)
    expect(variables['--wf-color-border-modal']).toBe(defaultTheme.color.borderModal)
    expect(variables['--wf-color-backdrop']).toBe(defaultTheme.color.backdrop)
    expect(variables['--wf-shadow-lg']).toBe(defaultTheme.shadow.lg)
    expect(variables['--wf-color-success']).toBe(defaultTheme.color.success)
    expect(variables['--wf-color-warning']).toBe(defaultTheme.color.warning)
    expect(variables['--wf-color-info']).toBe(defaultTheme.color.info)
    expect(variables['--wf-color-focus']).toBe(defaultTheme.color.focus)
    expect(variables['--wf-color-hover']).toBe(defaultTheme.color.hover)
    expect(variables['--wf-color-selected']).toBe(defaultTheme.color.selected)
    expect(variables['--wf-layer-tooltip']).toBe(String(defaultTheme.layer.tooltip))
  })
})
