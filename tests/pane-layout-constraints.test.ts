import { describe, expect, it } from 'vitest'
import { createSplitPane, createWidgetPane } from '../src/core/pane'
import { calculatePaneSplitLayout, resizePaneSplitWeights } from '../src/core/pane-layout'

function pane(id: string, settings: Parameters<typeof createWidgetPane>[0]['settings'] = {}) {
  return createWidgetPane({ id, widgetId: `test.${id}`, settings })
}

describe('advanced pane constraints', () => {
  it('resolves fixed, content and flex children deterministically', () => {
    const split = createSplitPane({
      id: 'root', axis: 'horizontal', weights: [1, 1, 2], children: [
        pane('fixed', { sizeMode: 'fixed', size: 120, minSize: 100, maxSize: 140 }),
        pane('content', { sizeMode: 'content', minSize: 40, maxSize: 100 }),
        pane('flex', { minSize: 80, maxSize: 400 }),
      ],
    })
    const result = calculatePaneSplitLayout(split, 500, { content: 70 })
    expect(result.overflow).toBe(0)
    expect(result.items.map((item) => [item.paneId, item.size])).toEqual([
      ['fixed', 120], ['content', 70], ['flex', 310],
    ])
  })

  it('preserves minimums and reports overflow when the container is too small', () => {
    const split = createSplitPane({
      id: 'root', axis: 'horizontal', children: [
        pane('a', { minSize: 100 }), pane('b', { minSize: 80 }),
      ],
    })
    const result = calculatePaneSplitLayout(split, 120)
    expect(result.items.map((item) => item.size)).toEqual([100, 80])
    expect(result.overflow).toBe(60)
  })

  it('shrinks content and fixed panes toward their minimums before violating constraints', () => {
    const split = createSplitPane({
      id: 'root', axis: 'horizontal', children: [
        pane('fixed', { sizeMode: 'fixed', size: 160, minSize: 100 }),
        pane('content', { sizeMode: 'content', minSize: 50 }),
        pane('flex', { minSize: 60 }),
      ],
    })
    const result = calculatePaneSplitLayout(split, 250, { content: 100 })
    expect(result.items.map((item) => item.size)).toEqual([140, 50, 60])
    expect(result.overflow).toBe(0)
  })

  it('honours explicit collapse and prevents resizing locked or non-flex neighbours', () => {
    const split = createSplitPane({
      id: 'root', axis: 'horizontal', weights: [1, 1, 1], children: [
        pane('collapsed', { collapsible: true, collapsed: true, minSize: 100 }),
        pane('locked', { locked: true }),
        pane('flex'),
      ],
    })
    expect(calculatePaneSplitLayout(split, 300).items[0]).toMatchObject({ size: 0, collapsed: true })
    expect(resizePaneSplitWeights(split, 1, 40, 300)).toEqual([1, 1, 1])
  })
})
