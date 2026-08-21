import { describe, expect, it } from 'vitest'
import { forgeDarkTheme, forgeLightTheme } from '../src/presets/forge'
import { defaultTheme, themeToCssVariables, type WidgetForgeTheme } from '../src/vue/theme'

function luminance(value: string): number {
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`expected six-digit hex color, got ${value}`)
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset + 1, offset + 3), 16) / 255)
  return channels
    .map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index]!, 0)
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = luminance(first)
  const secondLuminance = luminance(second)
  return (Math.max(firstLuminance, secondLuminance) + 0.05) / (Math.min(firstLuminance, secondLuminance) + 0.05)
}

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
    expect(lightVariables['--wf-color-text-placeholder']).toBe(forgeLightTheme.color.textPlaceholder)
    expect(lightVariables['--wf-size-icon-size']).toBe(forgeLightTheme.size.iconSize)
    expect(lightVariables['--wf-size-icon-button-size']).toBe(forgeLightTheme.size.iconButtonSize)
    expect(lightVariables['--wf-size-tab-height']).toBe(forgeLightTheme.size.tabHeight)
    expect(darkVariables['--wf-editor-selection-color']).toBe(forgeDarkTheme.editor.selectionColor)
    expect(lightVariables['--wf-editor-panel-background']).toBe(forgeLightTheme.editor.panelBackground)
  })

  it('keeps glyphs visually smaller than their compact interaction surfaces', () => {
    for (const theme of [forgeDarkTheme, forgeLightTheme]) {
      expect(Number.parseFloat(theme.size.iconSize)).toBeLessThan(Number.parseFloat(theme.size.iconButtonSize))
      expect(Number.parseFloat(theme.size.tableRowHeightCompact)).toBeLessThan(Number.parseFloat(theme.size.tableRowHeight))
      expect(Number.parseFloat(theme.size.controlHeightCompact)).toBeLessThan(Number.parseFloat(theme.size.controlHeight))
    }
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

  it('keeps Light text, state and elevation tokens contrast-safe', () => {
    const color = forgeLightTheme.color
    const surfaces = [color.canvas, color.surface, color.surfaceWindow, color.surfaceFloating, color.surfaceOverlay, color.surfaceModal]

    for (const surface of surfaces) {
      expect(contrastRatio(color.text, surface)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(color.textMuted, surface)).toBeGreaterThanOrEqual(4.5)
    }

    expect(contrastRatio(color.textPlaceholder, color.surfaceWindow)).toBeGreaterThanOrEqual(4.5)
    for (const stateColor of [color.accent, color.focus, color.info, color.success, color.warning, color.danger]) {
      expect(contrastRatio(stateColor, color.surfaceWindow)).toBeGreaterThanOrEqual(4.5)
    }

    expect(contrastRatio(color.border, color.surface)).toBeGreaterThanOrEqual(2.5)
    expect(contrastRatio(color.borderStrong, color.surfaceWindow)).toBeGreaterThanOrEqual(3)
    expect(contrastRatio(color.borderFloating, color.surfaceFloating)).toBeGreaterThanOrEqual(3.5)
    expect(contrastRatio(color.borderOverlay, color.surfaceOverlay)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(color.borderModal, color.surfaceModal)).toBeGreaterThanOrEqual(5)
  })
})
