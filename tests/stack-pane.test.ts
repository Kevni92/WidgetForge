import { describe, expect, it } from 'vitest'
import { InvalidPaneOperationError, PaneDefinitionError, createSplitPane, createStackPane, createWidgetPane, findPane, removePane, setPaneCollapsed } from '../src/core/pane'

const widget = (id: string) => createWidgetPane({ id, widgetId: `test.${id}` })

describe('StackPane', () => {
  it('is recursive, serializable and preserves layer order', () => {
    const stack = createStackPane({
      id: 'layers',
      children: [widget('base'), createSplitPane({ id: 'overlay', axis: 'vertical', children: [widget('top'), widget('bottom')] })],
    })
    expect(JSON.parse(JSON.stringify(stack))).toEqual(stack)
    expect(stack.children.map((child) => child.id)).toEqual(['base', 'overlay'])
    expect(findPane(stack, 'bottom')).toMatchObject({ kind: 'widget' })
  })

  it('rejects empty stacks and invalid fixed or collapsed settings', () => {
    expect(() => createStackPane({ id: 'empty', children: [] })).toThrow(PaneDefinitionError)
    expect(() => createWidgetPane({ id: 'fixed', widgetId: 'test.fixed', settings: { sizeMode: 'fixed' } })).toThrow(PaneDefinitionError)
    expect(() => createWidgetPane({ id: 'collapsed', widgetId: 'test.collapsed', settings: { collapsed: true } })).toThrow(PaneDefinitionError)
  })

  it('collapses only collapsible unlocked panes', () => {
    const root = createSplitPane({ id: 'root', axis: 'horizontal', children: [
      createWidgetPane({ id: 'left', widgetId: 'test.left', settings: { collapsible: true } }),
      widget('right'),
    ] })
    const collapsed = setPaneCollapsed(root, 'left', true)
    expect(findPane(collapsed, 'left')?.settings?.collapsed).toBe(true)
    expect(() => setPaneCollapsed(root, 'right', true)).toThrow(InvalidPaneOperationError)
  })

  it('protects locked panes from structural layout operations', () => {
    const root = createSplitPane({ id: 'root', axis: 'horizontal', children: [
      createWidgetPane({ id: 'locked', widgetId: 'test.locked', settings: { locked: true } }),
      widget('free'),
    ] })
    expect(() => removePane(root, 'locked')).toThrow(InvalidPaneOperationError)
  })
})
