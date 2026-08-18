import { describe, expect, it, vi } from 'vitest'
import {
  ContextMenuDefinitionError,
  createContextMenuController,
} from '../src/core/context-menu'

describe('ContextMenuController', () => {
  it('owns menu state and delegates generic selection to the caller', () => {
    const controller = createContextMenuController()
    const onSelect = vi.fn()
    const listener = vi.fn()
    controller.subscribe(listener)

    controller.show({
      x: -10,
      y: 24,
      items: [
        { id: 'disabled', label: 'Disabled', disabled: true },
        { id: 'inspect', label: 'Inspect' },
      ],
      onSelect,
    })

    expect(controller.getSnapshot()).toMatchObject({ open: true, x: 0, y: 24 })
    expect(controller.select('disabled')).toBeNull()
    expect(controller.getSnapshot().open).toBe(true)

    expect(controller.select('inspect')).toMatchObject({ id: 'inspect' })
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'inspect' }))
    expect(controller.getSnapshot().open).toBe(false)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('rejects invalid menu definitions', () => {
    const controller = createContextMenuController()
    expect(() => controller.show({ x: 0, y: 0, items: [] })).toThrow(ContextMenuDefinitionError)
    expect(() => controller.show({
      x: 0,
      y: 0,
      items: [
        { id: 'same', label: 'First' },
        { id: 'same', label: 'Second' },
      ],
    })).toThrow(ContextMenuDefinitionError)
  })
})
