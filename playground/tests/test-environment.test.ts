import { describe, expect, it } from 'vitest'

describe('playground test environment', () => {
  it('provides an origin-backed localStorage', () => {
    expect(window.localStorage).toBeDefined()
    window.localStorage.setItem('playground-test-key', 'value')
    expect(window.localStorage.getItem('playground-test-key')).toBe('value')
  })

  it('starts each test with an isolated localStorage', () => {
    expect(window.localStorage.getItem('playground-test-key')).toBeNull()
  })
})
