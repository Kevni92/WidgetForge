import { describe, expect, it } from 'vitest'
import { cloneLayoutSurfaceStyle, createLayoutSurfaceStyle, resolveLayoutSurfaceStyle, resolveLegacyPaneSurfaceStyle, LayoutSurfaceStyleError, type LayoutSurfaceStyle } from '../src/core/layout-surface-style'

describe('LayoutSurfaceStyle', () => {
  it('normalizes independent borders, padding and presentation values', () => {
    const style: LayoutSurfaceStyle = {
      background: { mode: 'custom', color: '#123456' },
      border: { top: { enabled: true, width: 2, color: '#abcdef' }, right: { enabled: false, width: 8 } },
      borderRadius: 6,
      padding: { left: 12, bottom: 4 },
      opacity: 0.72,
      shadow: 'lg',
    }
    const normalized = createLayoutSurfaceStyle(style)
    expect(normalized).toEqual(style)
    expect(normalized).not.toBe(style)
    expect(normalized.border).not.toBe(style.border)
    expect(resolveLayoutSurfaceStyle(normalized)).toMatchObject({
      background: { mode: 'custom', color: '#123456' },
      border: { top: { enabled: true, width: 2 }, right: { enabled: false, width: 8 }, bottom: { enabled: false, width: 0 } },
      padding: { left: 12, bottom: 4, top: 0 },
      opacity: 0.72,
      shadow: 'lg',
    })
  })

  it('deep-clones styles and rejects invalid serializable values', () => {
    const style = createLayoutSurfaceStyle({ border: { top: { enabled: true, width: 1 } } })
    const clone = cloneLayoutSurfaceStyle(style)
    expect(clone).toEqual(style)
    expect(clone).not.toBe(style)
    expect(() => createLayoutSurfaceStyle({ opacity: 1.1 })).toThrow(LayoutSurfaceStyleError)
    expect(() => createLayoutSurfaceStyle({ borderRadius: -1 })).toThrow(LayoutSurfaceStyleError)
    expect(() => createLayoutSurfaceStyle({ background: { mode: 'custom' } })).toThrow(LayoutSurfaceStyleError)
    expect(() => createLayoutSurfaceStyle({ border: { left: { enabled: true, width: Number.NaN } } })).toThrow(LayoutSurfaceStyleError)
  })

  it('maps legacy pane backgrounds into the common surface model', () => {
    expect(resolveLegacyPaneSurfaceStyle({ background: 'canvas' })).toEqual({ background: { mode: 'custom', color: 'var(--wf-color-canvas)' } })
    expect(resolveLegacyPaneSurfaceStyle({ backgroundColor: '#fff', background: 'surface' })).toEqual({ background: { mode: 'custom', color: '#fff' } })
    expect(resolveLegacyPaneSurfaceStyle({ background: 'transparent' })).toEqual({ background: { mode: 'transparent' } })
  })
})
