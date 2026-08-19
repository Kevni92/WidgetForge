import { describe, expect, it } from 'vitest'
import { createWindowOptions, windowRoleRank, WindowOptionsError } from '../src/core/window-options'

describe('window roles', () => {
  it('defines deterministic semantic stacking ranks without exposing z-index policy', () => {
    expect(['normal','utility','overlay','modal'].map((role) => windowRoleRank(role as 'normal'|'utility'|'overlay'|'modal'))).toEqual([0,1,2,3])
  })

  it('applies role-specific chrome defaults while keeping explicit options overridable', () => {
    expect(createWindowOptions({ role: 'modal' })).toMatchObject({ role: 'modal', minimizable: false, maximizable: false, header: 'always' })
    expect(createWindowOptions({ role: 'overlay' })).toMatchObject({ role: 'overlay', minimizable: false, maximizable: false, header: 'hidden' })
    expect(createWindowOptions({ role: 'utility' })).toMatchObject({ role: 'utility', layer: 'normal' })
    expect(createWindowOptions({ role: 'modal', minimizable: true })).toMatchObject({ role: 'modal', minimizable: true })
    expect(() => createWindowOptions({ role: 'invalid' as 'normal' })).toThrow(WindowOptionsError)
  })
})
