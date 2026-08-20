import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createDockManager } from '../src/core/dock-manager'
import { createSplitPane, createTabPane, createWidgetPane, findPane } from '../src/core/pane'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import { captureWorkspace } from '../src/core/workspace'
import { createWorkspaceHistory } from '../src/core/workspace-history'
import { createWorkspaceEditController } from '../src/core/workspace-edit'
import WorkspaceHost from '../src/vue/WorkspaceHost.vue'

const Widget = defineComponent({ template: '<span>widget</span>' })
function setup() {
  const registry = createWidgetRegistry([defineWidget({ id: 'dock.a', title: 'A', component: Widget }), defineWidget({ id: 'dock.b', title: 'B', component: Widget })])
  return { registry, windows: createWindowManager(registry), docks: createDockManager(registry) }
}
function rect(left: number, top: number, width: number, height: number): DOMRect { return { x:left,y:top,left,top,width,height,right:left+width,bottom:top+height,toJSON:()=>({}) } as DOMRect }
function stubRect(element: Element, value: DOMRect): void { Object.defineProperty(element, 'getBoundingClientRect', { configurable:true, value:()=>value }) }
function pointer(target: EventTarget, type: string, x: number, y: number, ctrlKey = false): void { target.dispatchEvent(new MouseEvent(type, { button:0,clientX:x,clientY:y,ctrlKey,bubbles:true,cancelable:true })) }

describe('workspace docking interactions', () => {
  it('docks a dragged window into another window through the shared overlay and removes the source shell', async () => {
    const { registry, windows, docks } = setup()
    windows.open({ widgetId:'dock.a',instanceId:'source',position:{x:20,y:20},size:{width:280,height:200} })
    windows.open({ widgetId:'dock.b',instanceId:'target',position:{x:420,y:80},size:{width:300,height:240} })
    const sourcePaneId=windows.get('source').rootPane.id;const targetPaneId=windows.get('target').rootPane.id
    const wrapper=mount(WorkspaceHost,{props:{windows,docks,registry},attachTo:document.body})
    const host=wrapper.get('.wf-window-manager-host').element;const sourceFrame=wrapper.get('[data-window-instance-id="source"]').element;const targetFrame=wrapper.get('[data-window-instance-id="target"]').element;const targetPane=wrapper.get(`[data-window-instance-id="target"] [data-pane-id="${targetPaneId}"]`).element
    stubRect(host,rect(0,0,800,600));stubRect(sourceFrame,rect(20,20,280,200));stubRect(targetFrame,rect(420,80,300,240));stubRect(targetPane,rect(420,114,300,206))
    pointer(wrapper.get('[data-window-instance-id="source"] [data-window-drag-handle]').element,'pointerdown',120,35);pointer(globalThis.window,'pointermove',430,180);await nextTick()
    const overlay=wrapper.get('[data-docking-source="source"]')
    expect(overlay.attributes('data-docking-active-zone')).toBe('left')
    expect(overlay.findAll('[data-docking-zone]')).toHaveLength(5)
    pointer(globalThis.window,'pointerup',430,180);await nextTick()
    expect(windows.list().map((window)=>window.instanceId)).toEqual(['target']);expect(wrapper.find('[data-window-instance-id="source"]').exists()).toBe(false);expect(findPane(windows.get('target').rootPane,sourcePaneId)).toBeDefined();wrapper.unmount()
  })

  it('moves a pane with ctrl drag between windows while preserving its widget instance id', async () => {
    const { registry, windows, docks }=setup();const movable=createWidgetPane({id:'movable-pane',widgetId:'dock.a',instanceId:'stable-widget'});const stay=createWidgetPane({id:'stay-pane',widgetId:'dock.b',instanceId:'stay-widget'})
    windows.openPane({instanceId:'source',pane:createSplitPane({id:'source-root',axis:'horizontal',children:[movable,stay]}),position:{x:20,y:20},size:{width:320,height:220}});windows.open({widgetId:'dock.b',instanceId:'target',position:{x:420,y:80},size:{width:300,height:240}})
    const targetPaneId=windows.get('target').rootPane.id;const intermediateSnapshots=[] as ReturnType<typeof captureWorkspace>[];const unsubscribe=windows.subscribe(()=>{intermediateSnapshots.push(captureWorkspace(windows,docks))});const wrapper=mount(WorkspaceHost,{props:{windows,docks,registry},attachTo:document.body});globalThis.window.dispatchEvent(new KeyboardEvent('keydown',{key:'Control'}));await nextTick();const workspace=wrapper.get('.wf-workspace-host').element;const sourcePane=wrapper.get('[data-pane-id="movable-pane"]').element;const targetPane=wrapper.get(`[data-window-instance-id="target"] [data-pane-id="${targetPaneId}"]`).element
    stubRect(workspace,rect(0,0,900,650));stubRect(sourcePane,rect(40,70,140,150));stubRect(targetPane,rect(420,114,300,206))
    pointer(sourcePane,'pointerdown',80,120,true);pointer(globalThis.window,'pointermove',710,180,true);await nextTick()
    expect(wrapper.get(`[data-docking-target="${targetPaneId}"]`).attributes('data-docking-active-zone')).toBe('right')
    pointer(globalThis.window,'pointerup',710,180,true);globalThis.window.dispatchEvent(new KeyboardEvent('keyup',{key:'Control'}));await nextTick()
    expect(findPane(windows.get('source').rootPane,'movable-pane')).toBeUndefined();const moved=findPane(windows.get('target').rootPane,'movable-pane');expect(moved?.kind).toBe('widget');expect(moved?.kind==='widget'?moved.instanceId:null).toBe('stable-widget');expect(intermediateSnapshots.length).toBeGreaterThanOrEqual(2);unsubscribe();wrapper.unmount()
  })

  it('cleans the pane docking overlay when Escape aborts an edit drag', async () => {
    const { registry, windows, docks }=setup();windows.openPane({instanceId:'source',pane:createSplitPane({id:'source-root',axis:'horizontal',children:[createWidgetPane({id:'move',widgetId:'dock.a'}),createWidgetPane({id:'stay',widgetId:'dock.b'})]})});windows.open({widgetId:'dock.b',instanceId:'target'})
    const targetPaneId=windows.get('target').rootPane.id;const wrapper=mount(WorkspaceHost,{props:{windows,docks,registry},attachTo:document.body});globalThis.window.dispatchEvent(new KeyboardEvent('keydown',{key:'Control'}));await nextTick();const workspace=wrapper.get('.wf-workspace-host').element;const sourcePane=wrapper.get('[data-pane-id="move"]').element;const targetPane=wrapper.get(`[data-window-instance-id="target"] [data-pane-id="${targetPaneId}"]`).element
    stubRect(workspace,rect(0,0,900,650));stubRect(sourcePane,rect(40,70,140,150));stubRect(targetPane,rect(420,114,300,206))
    pointer(sourcePane,'pointerdown',80,120,true);pointer(globalThis.window,'pointermove',500,180,true);await nextTick();expect(wrapper.find('.wf-docking-overlay').exists()).toBe(true)
    globalThis.window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));globalThis.window.dispatchEvent(new KeyboardEvent('keyup',{key:'Control',bubbles:true}));await nextTick()
    expect(wrapper.find('.wf-docking-overlay').exists()).toBe(false);expect(wrapper.get('.wf-workspace-host').attributes('data-workspace-edit-mode')).toBe('false');wrapper.unmount()
  })

  it('gives a split separator exclusive resize ownership and cancels it without history', async () => {
    const { registry, windows, docks }=setup();windows.openPane({instanceId:'resizable',pane:createSplitPane({id:'root',axis:'horizontal',children:[createWidgetPane({id:'left',widgetId:'dock.a'}),createWidgetPane({id:'right',widgetId:'dock.b'})]})})
    const history=createWorkspaceHistory(windows,docks),wrapper=mount(WorkspaceHost,{props:{windows,docks,registry,history},attachTo:document.body});const root=wrapper.get('[data-pane-id="root"]');stubRect(root.element,rect(0,0,400,200));const divider=wrapper.get('[data-pane-divider-index="0"]').element
    pointer(divider,'pointerdown',200,80);pointer(globalThis.window,'pointermove',300,80);await nextTick()
    const resized=windows.get('resizable').rootPane;expect(wrapper.find('.wf-docking-overlay').exists()).toBe(false);expect(resized.kind==='split'&&resized.weights[0]).toBeGreaterThan(1)
    pointer(globalThis.window,'pointercancel',300,80);await nextTick();await Promise.resolve()
    const restored=windows.get('resizable').rootPane;expect(restored.kind==='split'&&restored.weights).toEqual([1,1]);expect(history.state.undoDepth).toBe(0);wrapper.unmount();history.dispose()
  })

  it('starts pane docking from the full pane surface in temporary edit mode', async () => {
    const { registry, windows, docks }=setup();windows.openPane({instanceId:'source',pane:createSplitPane({id:'source-root',axis:'horizontal',children:[createWidgetPane({id:'move',widgetId:'dock.a'}),createWidgetPane({id:'stay',widgetId:'dock.b'})]})});windows.open({widgetId:'dock.b',instanceId:'target'})
    const targetPaneId=windows.get('target').rootPane.id,wrapper=mount(WorkspaceHost,{props:{windows,docks,registry},attachTo:document.body}),workspace=wrapper.get('.wf-workspace-host').element,sourcePane=wrapper.get('[data-pane-id="move"]').element,targetPane=wrapper.get(`[data-window-instance-id="target"] [data-pane-id="${targetPaneId}"]`).element
    stubRect(workspace,rect(0,0,900,650));stubRect(sourcePane,rect(40,70,140,150));stubRect(targetPane,rect(420,114,300,206));pointer(sourcePane,'pointerdown',80,120,true);pointer(globalThis.window,'pointermove',710,180,true);await nextTick()
    expect(wrapper.find('.wf-docking-overlay').exists()).toBe(true);pointer(globalThis.window,'pointerup',710,180,true);await nextTick();expect(findPane(windows.get('source').rootPane,'move')).toBeUndefined();expect(findPane(windows.get('target').rootPane,'move')).toBeDefined();wrapper.unmount()
  })

  it('reorders tabs in normal mode without exposing pane handles or docking overlays', async () => {
    const { registry, windows, docks } = setup()
    windows.openPane({ instanceId: 'tabs', pane: createTabPane({ id: 'tabs-root', activeId: 'second', children: [
      createWidgetPane({ id: 'first', widgetId: 'dock.a', instanceId: 'first-instance' }),
      createWidgetPane({ id: 'second', widgetId: 'dock.b', instanceId: 'second-instance' }),
      createWidgetPane({ id: 'third', widgetId: 'dock.a', instanceId: 'third-instance' }),
    ] }) })
    const history = createWorkspaceHistory(windows, docks)
    const wrapper = mount(WorkspaceHost, { props: { windows, docks, registry, history }, attachTo: document.body })
    const tabbar = wrapper.get('[data-tab-container-id="tabs-root"]').element
    const tabs = wrapper.findAll('[data-tab-pane-id]')
    stubRect(tabbar, rect(0, 0, 300, 32))
    tabs.forEach((tab, index) => stubRect(tab.element, rect(index * 100, 0, 100, 32)))
    expect(wrapper.findAll('.wf-pane-host > .wf-pane-host__drag-handle')).toHaveLength(0)
    expect(wrapper.findAll('[data-tab-drag-handle]')).toHaveLength(3)
    expect(wrapper.get('[data-tab-drag-handle]').attributes('aria-label')).toBe('Reorder tab A')

    pointer(wrapper.get('[data-tab-drag-handle]').element, 'pointerdown', 10, 12)
    pointer(globalThis.window, 'pointermove', 280, 12)
    await nextTick()
    expect(wrapper.find('[data-tab-reorder-preview]').exists()).toBe(true)
    expect(wrapper.find('.wf-docking-overlay').exists()).toBe(false)
    pointer(globalThis.window, 'pointerup', 280, 12)
    await nextTick()

    const root = windows.get('tabs').rootPane
    expect(root.kind === 'tabs' ? root.children.map((child) => child.id) : []).toEqual(['second', 'third', 'first'])
    expect(root.kind === 'tabs' ? root.activeId : null).toBe('second')
    expect(history.state.undoDepth).toBe(1)
    wrapper.unmount(); history.dispose()
  })

  it('does not commit a reorder when the tab grip does not cross the drag threshold', async () => {
    const { registry, windows, docks } = setup()
    windows.openPane({ instanceId: 'tabs', pane: createTabPane({ id: 'tabs-root', children: [
      createWidgetPane({ id: 'first', widgetId: 'dock.a' }),
      createWidgetPane({ id: 'second', widgetId: 'dock.b' }),
    ] }) })
    const history = createWorkspaceHistory(windows, docks)
    const wrapper = mount(WorkspaceHost, { props: { windows, docks, registry, history }, attachTo: document.body })
    const handle = wrapper.get('[data-tab-drag-handle]').element
    pointer(handle, 'pointerdown', 10, 12)
    pointer(globalThis.window, 'pointerup', 11, 12)
    await nextTick()
    const root = windows.get('tabs').rootPane
    expect(root.kind === 'tabs' ? root.children.map((child) => child.id) : []).toEqual(['first', 'second'])
    expect(history.state.undoDepth).toBe(0)
    expect(wrapper.find('[data-tab-reorder-preview]').exists()).toBe(false)
    wrapper.unmount(); history.dispose()
  })

  it('uses the tab grip for structural pane docking in edit mode', async () => {
    const { registry, windows, docks } = setup()
    const edit = createWorkspaceEditController({ mode: 'edit' })
    windows.openPane({ instanceId: 'source', pane: createTabPane({ id: 'source-tabs', children: [
      createWidgetPane({ id: 'first', widgetId: 'dock.a', instanceId: 'first-instance' }),
      createWidgetPane({ id: 'second', widgetId: 'dock.b', instanceId: 'second-instance' }),
    ] }) })
    windows.open({ instanceId: 'target', widgetId: 'dock.a' })
    const wrapper = mount(WorkspaceHost, { props: { windows, docks, registry, edit }, attachTo: document.body })
    const workspace = wrapper.get('.wf-workspace-host').element
    const sourceHandle = wrapper.get('[data-tab-pane-id="first"]').element
    const targetPaneId = windows.get('target').rootPane.id
    const targetPane = wrapper.get(`[data-window-instance-id="target"] [data-pane-id="${targetPaneId}"]`).element
    stubRect(workspace, rect(0, 0, 900, 650)); stubRect(sourceHandle, rect(40, 70, 100, 30)); stubRect(targetPane, rect(420, 114, 300, 206))
    expect(wrapper.find('[data-tab-pane-id="first"] [data-tab-drag-handle]').exists()).toBe(false)
    pointer(sourceHandle, 'pointerdown', 80, 84)
    pointer(globalThis.window, 'pointermove', 710, 180)
    await nextTick()
    expect(wrapper.find('.wf-docking-overlay').exists()).toBe(true)
    pointer(globalThis.window, 'pointerup', 710, 180)
    await nextTick()
    expect(findPane(windows.get('source').rootPane, 'first')).toBeUndefined()
    expect(findPane(windows.get('target').rootPane, 'first')).toBeDefined()
    expect(windows.get('source').rootPane).toMatchObject({ id: 'second' })
    wrapper.unmount()
  })

  it('detaches a tab to a new floating window when dropped on free workspace space', async () => {
    const { registry, windows, docks } = setup()
    windows.openPane({ instanceId: 'source', pane: createTabPane({ id: 'source-tabs', children: [
      createWidgetPane({ id: 'first', widgetId: 'dock.a', instanceId: 'first-instance' }),
      createWidgetPane({ id: 'second', widgetId: 'dock.b', instanceId: 'second-instance' }),
    ] }) })
    const edit = createWorkspaceEditController({ mode: 'edit' })
    const history = createWorkspaceHistory(windows, docks)
    const wrapper = mount(WorkspaceHost, { props: { windows, docks, registry, edit, history }, attachTo: document.body })
    const workspace = wrapper.get('.wf-workspace-host').element
    const sourceTab = wrapper.get('[data-tab-pane-id="first"]').element
    stubRect(workspace, rect(0, 0, 900, 650))
    stubRect(sourceTab, rect(40, 70, 100, 30))

    pointer(sourceTab, 'pointerdown', 80, 84)
    pointer(globalThis.window, 'pointermove', 760, 480)
    await nextTick()
    expect(wrapper.find('[data-pane-detach-preview]').exists()).toBe(true)
    expect(wrapper.find('.wf-docking-overlay').exists()).toBe(false)

    pointer(globalThis.window, 'pointerup', 760, 480)
    await nextTick()
    await Promise.resolve()

    const detached = windows.list().find((window) => window.instanceId.startsWith('workspace-detached-'))
    expect(detached).toBeDefined()
    expect(detached?.rootPane).toMatchObject({ id: 'first', instanceId: 'first-instance' })
    expect(windows.get('source').rootPane).toMatchObject({ id: 'second' })
    expect(findPane(windows.get('source').rootPane, 'first')).toBeUndefined()
    expect(history.state.undoDepth).toBe(1)
    wrapper.unmount(); history.dispose()
  })

  it('anchors through the generic window action and records one reversible history entry', async () => {
    const { registry, windows, docks } = setup()
    windows.openPane({ instanceId: 'anchorable', pane: createWidgetPane({ id: 'anchor-pane', widgetId: 'dock.a', instanceId: 'anchor-widget' }), title: 'Anchorable', size: { width: 360, height: 220 } })
    const history = createWorkspaceHistory(windows, docks)
    const wrapper = mount(WorkspaceHost, { props: { windows, docks, registry, history }, attachTo: document.body })

    await wrapper.get('[data-window-instance-id="anchorable"] .wf-window-shell__dock').trigger('click')
    await wrapper.get('[data-window-dock-position="right"]').trigger('click')
    await nextTick()

    expect(windows.list()).toEqual([])
    expect(docks.list()).toHaveLength(1)
    expect(docks.get('anchorable-dock').rootPane).toMatchObject({ id: 'anchor-pane', instanceId: 'anchor-widget' })
    expect(history.state.undoDepth).toBe(1)

    expect(history.undo()).toBe(true)
    await nextTick()
    expect(windows.get('anchorable').rootPane).toMatchObject({ id: 'anchor-pane', instanceId: 'anchor-widget' })
    expect(docks.list()).toEqual([])
    expect(history.redo()).toBe(true)
    await nextTick()
    expect(windows.list()).toEqual([])
    expect(docks.get('anchorable-dock').rootPane).toMatchObject({ id: 'anchor-pane', instanceId: 'anchor-widget' })

    wrapper.unmount(); history.dispose()
  })

  it('offers dock detach only in edit mode and keeps a locked workspace unchanged', async () => {
    const { registry, windows, docks } = setup()
    windows.openPane({ instanceId: 'dock-source', pane: createWidgetPane({ id: 'dock-root', widgetId: 'dock.a', instanceId: 'dock-widget' }), title: 'Dock source' })
    const history = createWorkspaceHistory(windows, docks)
    const edit = createWorkspaceEditController({ mode: 'edit' })
    const wrapper = mount(WorkspaceHost, { props: { windows, docks, registry, history, edit }, attachTo: document.body })
    const windowShell = wrapper.get('[data-window-instance-id="dock-source"] .wf-window-shell')
    expect(windowShell.find('.wf-window-shell__dock').exists()).toBe(true)
    await windowShell.find('.wf-window-shell__dock').trigger('click')
    await wrapper.get('[data-window-dock-position="top"]').trigger('click')
    await nextTick()

    expect(docks.get('dock-source-dock').rootPane).toMatchObject({ id: 'dock-root' })
    await wrapper.get('[data-dock-id="dock-source-dock"] [data-pane-id="dock-root"]').trigger('contextmenu', { clientX: 20, clientY: 20 })
    const detachItem = wrapper.findAll('[role="menuitem"]').find((item) => item.text() === 'Detach dock to window')
    expect(detachItem).toBeDefined()
    await detachItem?.trigger('click')
    await nextTick()
    expect(windows.get('dock-source').rootPane).toMatchObject({ id: 'dock-root', instanceId: 'dock-widget' })
    expect(docks.list()).toEqual([])

    edit.setMode('locked')
    await nextTick()
    expect(wrapper.find('.wf-window-shell__dock').exists()).toBe(false)
    wrapper.unmount(); history.dispose()
  })
})
