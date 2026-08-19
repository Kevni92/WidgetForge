import { describe, expect, it, vi } from 'vitest'
import { calculateWidgetActionOverflow } from '../src/core/widget-action-overflow'
import type { WidgetActionBinding } from '../src/core/widget-actions'

function binding(id: string, options: Partial<WidgetActionBinding['action']> = {}): WidgetActionBinding {
  return { action: { id, label: id, icon: id[0] ?? '?', ...options }, execute: vi.fn() }
}

describe('calculateWidgetActionOverflow', () => {
  it('keeps complete groups together and fills remaining space by priority', () => {
    const critical = binding('critical', { priority: 100, alwaysVisible: true })
    const groupedOne = binding('group-one', { priority: 80, group: 'tracking' })
    const groupedTwo = binding('group-two', { priority: 70, group: 'tracking' })
    const low = binding('low', { priority: 10 })
    const layout = calculateWidgetActionOverflow([low, groupedTwo, critical, groupedOne], {
      availableSize: 90,
      actionSize: (item) => item.action.id === 'critical' ? 30 : item.action.group === 'tracking' ? 20 : 20,
      overflowSize: 20,
      gap: 2,
    })

    expect(layout.visible.map(({ action }) => action.id)).toEqual(['critical', 'low'])
    expect(layout.overflow.map(({ action }) => action.id)).toEqual(['group-one', 'group-two'])
  })

  it('honors overflow-only, visible and disabled state without changing execution bindings', () => {
    const hidden = binding('hidden', { visible: false })
    const overflow = binding('overflow', { overflowOnly: true, disabled: true })
    const visible = binding('visible', { priority: 20 })
    const layout = calculateWidgetActionOverflow([hidden, overflow, visible], { availableSize: 200, actionSize: () => 30, overflowSize: 20 })

    expect(layout.visible).toEqual([visible])
    expect(layout.overflow).toEqual([overflow])
    expect(layout.overflow[0]?.action.disabled).toBe(true)
    expect(layout.visible[0]?.execute).toBe(visible.execute)
  })

  it('keeps equal priorities stable and applies a count cap when no size is known', () => {
    const first = binding('first', { priority: 10 })
    const second = binding('second', { priority: 10 })
    const third = binding('third', { priority: 10 })
    const layout = calculateWidgetActionOverflow([first, second, third], { maxVisible: 2 })

    expect(layout.visible.map(({ action }) => action.id)).toEqual(['first', 'second'])
    expect(layout.overflow.map(({ action }) => action.id)).toEqual(['third'])
  })
})
