import { describe, expect, it } from 'vitest'
import { forgeDarkTheme, forgeLightTheme } from '../src/presets/forge'
import { defaultTheme, themeToCssVariables, type WidgetForgeTheme } from '../src/vue/theme'

function expectSameShape(theme: WidgetForgeTheme) {
  for (const group of Object.keys(defaultTheme) as Array<keyof WidgetForgeTheme>) {
    expect(Object.keys(theme[group]).sort()).toEqual(Object.keys(defaultTheme[group]).sort())
  }
}

describe('Forge preset', () => {
  it('provides complete Dark and Light themes with the generic theme shape', () => {
    expectSameShape(forgeDarkTheme)
    expectSameShape(forgeLightTheme)
  })

  it('keeps geometry identical between Dark and Light', () => {
    expect(forgeLightTheme.font).toEqual(forgeDarkTheme.font)
    expect(forgeLightTheme.space).toEqual(forgeDarkTheme.space)
    expect(forgeLightTheme.radius).toEqual(forgeDarkTheme.radius)
    expect(forgeLightTheme.size).toEqual(forgeDarkTheme.size)
    expect(forgeLightTheme.layer).toEqual(forgeDarkTheme.layer)
  })

  it('serializes preset and interaction tokens to CSS variables', () => {
    const darkVariables = themeToCssVariables(forgeDarkTheme)
    const lightVariables = themeToCssVariables(forgeLightTheme)

    expect(darkVariables['--wf-color-accent']).toBe(forgeDarkTheme.color.accent)
    expect(darkVariables['--wf-color-success']).toBe(forgeDarkTheme.color.success)
    expect(darkVariables['--wf-color-selected']).toBe(forgeDarkTheme.color.selected)
    expect(lightVariables['--wf-color-focus']).toBe(forgeLightTheme.color.focus)
    expect(lightVariables['--wf-color-hover']).toBe(forgeLightTheme.color.hover)
  })

  it('provides distinct role surfaces, borders, shadows and backdrops for both modes', () => {
    expect(forgeDarkTheme.color.surfaceWindow).not.toBe(forgeDarkTheme.color.surfaceFloating)
    expect(forgeDarkTheme.color.surfaceFloating).not.toBe(forgeDarkTheme.color.surfaceOverlay)
    expect(forgeDarkTheme.color.surfaceOverlay).not.toBe(forgeDarkTheme.color.surfaceModal)
    expect(forgeLightTheme.color.surfaceWindow).not.toBe(forgeLightTheme.color.surfaceOverlay)
    expect(forgeLightTheme.color.surfaceFloating).not.toBe(forgeLightTheme.color.surfaceModal)
    expect(forgeDarkTheme.color.borderModal).not.toBe(forgeLightTheme.color.borderModal)
    expect(forgeDarkTheme.shadow.lg).not.toBe(forgeLightTheme.shadow.lg)
    expect(forgeDarkTheme.color.backdrop).not.toBe(forgeLightTheme.color.backdrop)
  })
})
