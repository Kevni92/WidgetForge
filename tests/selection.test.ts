import { describe, expect, it, vi } from 'vitest'
import { createSelectionKey, createSelectionStore, SelectionDefinitionError } from '../src/core/selection'

describe('SelectionStore', () => {
  it('publishes opaque values to multiple observers without inspecting domain shape', () => {
    const store = createSelectionStore()
    const key = createSelectionKey<{ id: string; payload: object }>('entity', 'workspace-a')
    const first = store.state(key)
    const second = store.state(key)
    const payload = { id: 'consumer-42', payload: { any: ['opaque', 7] } }
    const listener = vi.fn()
    store.subscribe(listener)

    store.select(key, payload)
    expect(first.value).toBe(payload)
    expect(second.value).toBe(payload)
    expect(store.get(key)).toBe(payload)
    expect(listener).toHaveBeenCalledWith({ key, value: payload, previous: null })

    store.clear(key)
    expect(first.value).toBeNull()
    expect(second.value).toBeNull()
  })

  it('isolates channels and scopes', () => {
    const store = createSelectionStore()
    const colonyA = createSelectionKey<string>('colony', 'operations')
    const colonyB = createSelectionKey<string>('colony', 'trading')
    const shipA = createSelectionKey<string>('ship', 'operations')

    store.select(colonyA, 'ARC-01')
    store.select(colonyB, 'ARC-02')
    store.select(shipA, 'SHIP-7')

    expect(store.get(colonyA)).toBe('ARC-01')
    expect(store.get(colonyB)).toBe('ARC-02')
    expect(store.get(shipA)).toBe('SHIP-7')
  })

  it('rejects empty channel or scope names', () => {
    expect(() => createSelectionKey('')).toThrowError(SelectionDefinitionError)
    expect(() => createSelectionKey('colony', '   ')).toThrowError(SelectionDefinitionError)
  })
})
