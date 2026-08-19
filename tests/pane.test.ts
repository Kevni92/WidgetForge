import { describe, expect, it } from 'vitest'
import {
  InvalidPaneOperationError,
  PaneDefinitionError,
  createSplitPane,
  createWidgetPane,
  findPane,
  movePane,
  removePane,
  replacePane,
  setSplitWeights,
  splitPaneAt,
  validatePaneTree,
} from '../src/core/pane'

const left = createWidgetPane({
  id: 'left',
  widgetId: 'demo.left',
  instanceId: 'left-widget',
  parameters: { value: 1 },
})
const right = createWidgetPane({
  id: 'right',
  widgetId: 'demo.right',
  instanceId: 'right-widget',
  parameters: { compact: true },
})

function tree() {
  return createSplitPane({ id: 'root', axis: 'horizontal', children: [left, right], weights: [2, 1] })
}

describe('pane model', () => {
  it('creates a serializable nested pane tree with stable ids', () => {
    const nested = createSplitPane({
      id: 'outer',
      axis: 'vertical',
      children: [tree(), createWidgetPane({ id: 'bottom', widgetId: 'demo.bottom' })],
    })

    expect(JSON.parse(JSON.stringify(nested))).toEqual(nested)
    expect(findPane(nested, 'right')).toMatchObject({ id: 'right', instanceId: 'right-widget' })
    expect(findPane(nested, 'missing')).toBeUndefined()
  })

  it('rejects duplicate ids and invalid split definitions', () => {
    expect(() => createSplitPane({ id: 'single', axis: 'horizontal', children: [left] })).toThrow(PaneDefinitionError)
    expect(() => createSplitPane({ id: 'dup', axis: 'horizontal', children: [left, { ...right, id: 'left' }] })).toThrow(
      PaneDefinitionError,
    )
    expect(() => createSplitPane({ id: 'bad-weights', axis: 'horizontal', children: [left, right], weights: [1] })).toThrow(
      PaneDefinitionError,
    )
  })

  it('replaces panes without mutating the original tree', () => {
    const original = tree()
    const replacement = createWidgetPane({ id: 'new-right', widgetId: 'demo.new' })
    const next = replacePane(original, 'right', replacement)

    expect(findPane(original, 'right')).toBeDefined()
    expect(findPane(next, 'right')).toBeUndefined()
    expect(findPane(next, 'new-right')).toBeDefined()
  })

  it('removes a pane and collapses a split with one remaining child', () => {
    const result = removePane(tree(), 'right')
    expect(result.root).toEqual(left)
    expect(result.removed.id).toBe('right')
  })

  it('splits a target pane at the requested edge', () => {
    const incoming = createWidgetPane({ id: 'incoming', widgetId: 'demo.incoming' })
    const next = splitPaneAt(tree(), 'right', incoming, 'top', 'right-stack')
    const split = findPane(next, 'right-stack')

    expect(split).toMatchObject({ kind: 'split', axis: 'vertical' })
    if (split?.kind === 'split') expect(split.children.map((child) => child.id)).toEqual(['incoming', 'right'])
  })

  it('moves a pane while preserving the moved subtree identity', () => {
    const lower = createWidgetPane({ id: 'lower', widgetId: 'demo.lower' })
    const original = createSplitPane({
      id: 'outer',
      axis: 'vertical',
      children: [tree(), lower],
    })
    const next = movePane(original, 'right', 'lower', 'left', 'lower-row')

    expect(findPane(next, 'right')).toMatchObject({ id: 'right', instanceId: 'right-widget' })
    expect(findPane(next, 'lower-row')).toMatchObject({ kind: 'split', axis: 'horizontal' })
    expect(findPane(next, 'root')).toBeUndefined()
  })

  it('rejects moving a pane into its own descendant', () => {
    const nested = createSplitPane({
      id: 'outer',
      axis: 'vertical',
      children: [tree(), createWidgetPane({ id: 'bottom', widgetId: 'demo.bottom' })],
    })
    expect(() => movePane(nested, 'root', 'left', 'right', 'illegal')).toThrow(InvalidPaneOperationError)
  })

  it('updates split weights through an immutable tree operation', () => {
    const original = tree()
    const next = setSplitWeights(original, 'root', [1, 3])
    expect(original.weights).toEqual([2, 1])
    expect(next.kind === 'split' ? next.weights : []).toEqual([1, 3])
  })

  it('validates pane settings and finite parameters', () => {
    expect(() => createWidgetPane({ id: 'bad', widgetId: 'demo.bad', settings: { minSize: 20, maxSize: 10 } })).toThrow(
      PaneDefinitionError,
    )
    expect(() => createWidgetPane({ id: 'bad-number', widgetId: 'demo.bad', parameters: { value: Number.NaN } })).toThrow(
      PaneDefinitionError,
    )
    expect(() => validatePaneTree({ ...tree(), weights: [1, 0] })).toThrow(PaneDefinitionError)
  })

  it('rejects duplicate widget instance identities within one pane tree', () => {
    expect(() => createSplitPane({
      id: 'duplicate-instances',
      axis: 'horizontal',
      children: [left, { ...right, instanceId: left.instanceId }],
    })).toThrow(PaneDefinitionError)
  })
})
