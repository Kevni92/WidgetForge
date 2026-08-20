import { describe, expect, it } from 'vitest'
import { createAbsoluteWindowLayoutSpec, createWindowLayoutSpecFromSnap, resolveWindowLayoutSpecs, validateWindowLayoutReferences, WindowLayoutValidationError, type ResponsiveLayoutWindow } from '../src/core/window-layout'
import type { WindowGeometry } from '../src/core/window-geometry'

function windowState(instanceId: string, geometry: WindowGeometry, layoutSpec?: ResponsiveLayoutWindow['layoutSpec']): ResponsiveLayoutWindow {
  return { instanceId, geometry, constraints: { minSize: { width: 20, height: 20 }, maxSize: null }, ...(layoutSpec !== undefined ? { layoutSpec } : {}) }
}

describe('responsive window layout resolver', () => {
  it('resolves workspace edge constraints in pixels and percentages', () => {
    const result = resolveWindowLayoutSpecs([
      windowState('sidebar', { position: { x: 0, y: 0 }, size: { width: 100, height: 100 } }, {
        horizontal: { start: { target: { kind: 'workspace', edge: 'left' }, offset: { value: 12, unit: 'px' } }, size: { value: 25, unit: 'percent' } },
        vertical: { start: { target: { kind: 'workspace', edge: 'top' } }, end: { target: { kind: 'workspace', edge: 'bottom' } } },
      }),
    ], { width: 800, height: 600 })

    expect(result.get('sidebar')).toEqual({ position: { x: 12, y: 0 }, size: { width: 200, height: 600 } })
  })

  it('supports signed offsets and end anchored windows', () => {
    const result = resolveWindowLayoutSpecs([
      windowState('footer', { position: { x: 0, y: 0 }, size: { width: 100, height: 100 } }, {
        horizontal: { start: { target: { kind: 'workspace', edge: 'left' } }, end: { target: { kind: 'workspace', edge: 'right' }, offset: { value: -16, unit: 'px' } } },
        vertical: { end: { target: { kind: 'workspace', edge: 'bottom' }, offset: { value: -10, unit: 'px' } }, size: { value: 20, unit: 'percent' } },
      }),
    ], { width: 500, height: 400 })

    expect(result.get('footer')).toEqual({ position: { x: 0, y: 310 }, size: { width: 484, height: 80 } })
  })

  it('supports explicit auto fill between two anchors', () => {
    const result = resolveWindowLayoutSpecs([windowState('fill', { position: { x: 0, y: 0 }, size: { width: 20, height: 20 } }, {
      horizontal: { start: { target: { kind: 'workspace', edge: 'left' } }, end: { target: { kind: 'workspace', edge: 'right' } }, size: 'auto' },
      vertical: { start: { target: { kind: 'workspace', edge: 'top' } }, end: { target: { kind: 'workspace', edge: 'bottom' } } },
    })], { width: 500, height: 400 })
    expect(result.get('fill')).toEqual({ position: { x: 0, y: 0 }, size: { width: 500, height: 400 } })
  })

  it('resolves multi-step window dependencies independent of input order', () => {
    const base = windowState('base', { position: { x: 10, y: 20 }, size: { width: 200, height: 100 } })
    const child = windowState('child', { position: { x: 0, y: 0 }, size: { width: 50, height: 50 } }, {
      horizontal: { start: { target: { kind: 'window', instanceId: 'base', edge: 'right' }, offset: { value: 8, unit: 'px' } }, size: { value: 50, unit: 'px' } },
      vertical: { start: { target: { kind: 'window', instanceId: 'base', edge: 'top' } }, size: { value: 100, unit: 'percent' } },
    })
    const grandChild = windowState('grand-child', { position: { x: 0, y: 0 }, size: { width: 20, height: 20 } }, {
      horizontal: { end: { target: { kind: 'window', instanceId: 'child', edge: 'right' } }, size: { value: 10, unit: 'px' } },
      vertical: { start: { target: { kind: 'window', instanceId: 'child', edge: 'bottom' } }, size: { value: 10, unit: 'px' } },
    })

    const result = resolveWindowLayoutSpecs([grandChild, child, base], { width: 800, height: 600 })
    expect(result.get('child')).toEqual({ position: { x: 218, y: 20 }, size: { width: 50, height: 600 } })
    expect(result.get('grand-child')).toEqual({ position: { x: 248, y: 620 }, size: { width: 20, height: 20 } })
    expect([...result.keys()]).toEqual(['base', 'child', 'grand-child'])
  })

  it('rejects self references, unknown references and cycles deterministically', () => {
    const spec = (target: string) => ({
      horizontal: { start: { target: { kind: 'window' as const, instanceId: target, edge: 'left' as const } }, size: { value: 20, unit: 'px' as const } },
      vertical: { start: { target: { kind: 'workspace' as const, edge: 'top' as const } }, size: { value: 20, unit: 'px' as const } },
    })

    expect(() => resolveWindowLayoutSpecs([windowState('self', { position: { x: 0, y: 0 }, size: { width: 30, height: 30 } }, spec('self'))], { width: 100, height: 100 }))
      .toThrowError(new WindowLayoutValidationError('self-reference', 'window "self" cannot reference itself', 'self'))
    expect(() => resolveWindowLayoutSpecs([windowState('missing', { position: { x: 0, y: 0 }, size: { width: 30, height: 30 } }, spec('unknown'))], { width: 100, height: 100 }))
      .toThrowError(/unknown window "unknown"/)

    const a = windowState('a', { position: { x: 0, y: 0 }, size: { width: 30, height: 30 } }, spec('b'))
    const b = windowState('b', { position: { x: 0, y: 0 }, size: { width: 30, height: 30 } }, spec('a'))
    expect(() => resolveWindowLayoutSpecs([b, a], { width: 100, height: 100 })).toThrowError(/dependency cycle/)
    expect(() => validateWindowLayoutReferences([{ instanceId: 'a', layoutSpec: a.layoutSpec ?? null }, { instanceId: 'b', layoutSpec: b.layoutSpec ?? null }])).toThrowError(/dependency cycle/)
  })

  it('clamps min and max sizes while keeping the start anchor deterministic', () => {
    const result = resolveWindowLayoutSpecs([{
      ...windowState('constrained', { position: { x: 0, y: 0 }, size: { width: 50, height: 50 } }, {
        horizontal: { start: { target: { kind: 'workspace', edge: 'left' } }, end: { target: { kind: 'workspace', edge: 'right' } } },
        vertical: { start: { target: { kind: 'workspace', edge: 'top' } }, size: { value: 10, unit: 'px' } },
      }),
      constraints: { minSize: { width: 900, height: 40 }, maxSize: { width: 950, height: 80 } },
    }], { width: 800, height: 100 })
    expect(result.get('constrained')).toEqual({ position: { x: 0, y: 0 }, size: { width: 900, height: 40 } })
  })

  it('creates an absolute spec and maps every snap zone semantically', () => {
    const absolute = createAbsoluteWindowLayoutSpec({ position: { x: 12, y: 18 }, size: { width: 240, height: 120 } })
    expect(resolveWindowLayoutSpecs([windowState('absolute', { position: { x: 0, y: 0 }, size: { width: 1, height: 1 } }, absolute)], { width: 800, height: 600 }).get('absolute'))
      .toEqual({ position: { x: 12, y: 18 }, size: { width: 240, height: 120 } })

    expect(createWindowLayoutSpecFromSnap('left')).toMatchObject({ horizontal: { size: { value: 50, unit: 'percent' } } })
    expect(createWindowLayoutSpecFromSnap('bottom-right')).toMatchObject({
      horizontal: { size: { value: 50, unit: 'percent' } },
      vertical: { size: { value: 50, unit: 'percent' } },
    })
    expect(createWindowLayoutSpecFromSnap('right-two-thirds')).toMatchObject({ horizontal: { size: { unit: 'percent' } } })
  })
})
