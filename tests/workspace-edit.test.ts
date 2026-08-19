import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { createPaneEditContextMenuItems, createWorkspaceEditController, removePaneForEdit, retargetWidgetPane } from '../src/core/workspace-edit'
import { createSplitPane, createWidgetPane, findPane } from '../src/core/pane'

const selection = { owner: { kind: 'window' as const, id: 'window-a' }, paneId: 'left' }

describe('workspace edit controller', () => {
  it('separates explicit edit, temporary ctrl edit and locked mode', () => {
    const edit = createWorkspaceEditController()
    expect(edit.state).toMatchObject({ mode: 'normal', editActive: false, locked: false })
    edit.setTemporaryEdit(true)
    expect(edit.state.editActive).toBe(true)
    edit.selectPane(selection)
    expect(edit.state.selection).toEqual(selection)
    edit.setTemporaryEdit(false)
    expect(edit.state.selection).toBeNull()
    edit.setMode('edit')
    edit.selectPane(selection)
    expect(edit.state.selection).toEqual(selection)
    edit.setMode('locked')
    expect(edit.state).toMatchObject({ mode: 'locked', editActive: false, locked: true, selection: null })
    edit.setTemporaryEdit(true)
    expect(edit.state.editActive).toBe(false)
  })

  it('serializes and restores workspace and pane lock state', () => {
    const edit = createWorkspaceEditController({ mode: 'edit' })
    edit.selectPane(selection)
    edit.setPaneLocked(selection, true)
    const snapshot = JSON.parse(JSON.stringify(edit.snapshot()))
    const restored = createWorkspaceEditController()
    restored.restore(snapshot)
    expect(restored.state.mode).toBe('edit')
    expect(restored.state.selection).toEqual(selection)
    expect(restored.isPaneLocked(selection)).toBe(true)
    restored.setPaneLocked(selection, false)
    expect(restored.isPaneLocked(selection)).toBe(false)
  })
})

describe('generic pane edit actions', () => {
  const root = createSplitPane({ id: 'root', axis: 'horizontal', children: [
    createWidgetPane({ id: 'left', widgetId: 'demo.a', instanceId: 'stable' }),
    createWidgetPane({ id: 'right', widgetId: 'demo.b' }),
  ] })

  it('offers only valid context actions and supports locking presentation', () => {
    expect(createPaneEditContextMenuItems(root, 'left', false).map((item) => item.id)).toEqual(['split', 'move', 'retarget', 'lock', 'delete'])
    expect(createPaneEditContextMenuItems(root, 'left', true).map((item) => item.id)).toEqual(['unlock'])
    expect(createPaneEditContextMenuItems(root, 'root', false).map((item) => item.id)).toEqual(['split', 'lock'])
  })

  it('retargets widgets without changing pane or widget instance identity and removes nested panes', () => {
    const retargeted = retargetWidgetPane(root, 'left', 'demo.c', { compact: true })
    const pane = findPane(retargeted, 'left')
    expect(pane?.kind).toBe('widget')
    expect(pane?.kind === 'widget' ? { widgetId: pane.widgetId, instanceId: pane.instanceId, parameters: pane.parameters } : null).toEqual({ widgetId: 'demo.c', instanceId: 'stable', parameters: { compact: true } })
    const removed = removePaneForEdit(root, 'left')
    expect(removed?.id).toBe('right')
  })
})
