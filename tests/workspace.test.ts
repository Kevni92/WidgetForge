import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { createSplitPane, createWidgetPane } from '../src/core/pane'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import { captureWorkspace, restoreWorkspace, serializeWorkspace, WORKSPACE_VERSION } from '../src/core/workspace'

const TestWidget = defineComponent({ template: '<div>test</div>' })
function createRegistry() { return createWidgetRegistry([
  defineWidget({ id: 'test.alpha', title: 'Alpha', component: TestWidget, parameters: { name: { type: 'string', required: true }, count: { type: 'number', default: 1 } }, window: { defaultSize: { width: 320, height: 220 } } }),
  defineWidget({ id: 'test.beta', title: 'Beta', component: TestWidget, parameters: { enabled: { type: 'boolean', default: true } }, window: { singleton: true } }),
]) }

describe('workspace persistence', () => {
  it('captures and restores pane trees, geometry, constraints, mode and focus order', () => {
    const registry=createRegistry(),source=createWindowManager(registry)
    source.openPane({instanceId:'operations',title:'Operations',pane:createSplitPane({id:'operations-root',axis:'horizontal',weights:[2,1],children:[createWidgetPane({id:'alpha-pane',widgetId:'test.alpha',instanceId:'alpha-leaf',parameters:{name:'ARC',count:4}}),createWidgetPane({id:'beta-pane',widgetId:'test.beta',instanceId:'beta-leaf'})]}),position:{x:80,y:90},size:{width:510,height:300},minSize:{width:300,height:180}})
    source.open({widgetId:'test.beta',instanceId:'beta-main'});source.minimize('operations');source.focus('beta-main')
    const snapshot=captureWorkspace(source);expect(snapshot.version).toBe(2);expect(snapshot.windows.map((window)=>window.instanceId)).toEqual(['operations','beta-main']);expect(snapshot.windows[0]?.rootPane).toMatchObject({kind:'split',id:'operations-root',weights:[2,1]})
    const serialized=serializeWorkspace(source);expect(serialized).toContain('"constraints"');expect(serialized).toContain('"rootPane"');expect(serialized).not.toContain('lifecycle')
    const target=createWindowManager(registry),result=restoreWorkspace(target,serialized);expect(result.valid).toBe(true);expect(result.issues).toEqual([]);expect(target.get('operations')).toMatchObject({title:'Operations',mode:'minimized',focused:false,geometry:{position:{x:80,y:90},size:{width:510,height:300}},constraints:{minSize:{width:300,height:180}}});expect(target.get('operations').rootPane).toEqual(snapshot.windows[0]?.rootPane);expect(target.get('beta-main')).toMatchObject({mode:'normal',focused:true})
  })

  it('persists maximized state with its original floating restore geometry', () => {
    const registry=createRegistry(),source=createWindowManager(registry)
    source.open({widgetId:'test.alpha',instanceId:'max',parameters:{name:'max'},position:{x:90,y:70},size:{width:420,height:280}})
    source.maximizeWindow('max',{width:900,height:640})
    const serialized=serializeWorkspace(source),target=createWindowManager(registry),result=restoreWorkspace(target,serialized)
    expect(result.valid).toBe(true);expect(result.issues).toEqual([])
    expect(target.get('max')).toMatchObject({mode:'maximized',geometry:{position:{x:0,y:0},size:{width:900,height:640}},restoreGeometry:{position:{x:90,y:70},size:{width:420,height:280}}})
    target.restore('max');expect(target.get('max').geometry).toEqual({position:{x:90,y:70},size:{width:420,height:280}})
  })

  it('migrates legacy workspace v1 widget entries into root panes', () => {
    const manager=createWindowManager(createRegistry());const result=restoreWorkspace(manager,{version:1,windows:[{instanceId:'legacy-alpha',widgetId:'test.alpha',parameters:{name:'legacy',count:2},geometry:{position:{x:10,y:20},size:{width:320,height:220}},mode:'normal',focused:true,zIndex:0}]})
    expect(result.valid).toBe(true);expect(result.issues).toEqual([]);expect(manager.get('legacy-alpha').rootPane).toMatchObject({kind:'widget',widgetId:'test.alpha',instanceId:'legacy-alpha',parameters:{name:'legacy',count:2}})
  })

  it('skips stale or invalid v2 entries without discarding valid entries', () => {
    const source=createWindowManager(createRegistry());source.open({widgetId:'test.alpha',instanceId:'valid-alpha',parameters:{name:'valid',count:2}});const valid=captureWorkspace(source).windows[0];expect(valid).toBeDefined()
    const manager=createWindowManager(createRegistry());const result=restoreWorkspace(manager,{version:WORKSPACE_VERSION,windows:[valid,valid?{...valid,instanceId:'removed-widget',rootPane:{...valid.rootPane,widgetId:'removed.widget'}}:null,valid?{...valid,instanceId:'invalid-parameters',rootPane:{...valid.rootPane,parameters:{count:2}}}:null,{broken:true}]})
    expect(result.valid).toBe(true);expect(manager.list()).toHaveLength(1);expect(manager.get('valid-alpha').rootPane).toMatchObject({parameters:{name:'valid',count:2}});expect(result.issues.map((issue)=>issue.code)).toEqual(['invalid-window','unknown-widget','invalid-parameters'])
  })

  it('rejects invalid documents without mutating the manager', () => { const manager=createWindowManager(createRegistry());expect(restoreWorkspace(manager,'{broken').valid).toBe(false);expect(manager.list()).toEqual([]);expect(restoreWorkspace(manager,{version:999,windows:[]}).issues[0]?.code).toBe('unsupported-version');expect(manager.list()).toEqual([]) })
  it('does not collide with restored automatic instance ids', () => { const registry=createRegistry(),manager=createWindowManager(registry),source=createWindowManager(registry);source.open({widgetId:'test.alpha',instanceId:'wf-window-1',parameters:{name:'restored'}});restoreWorkspace(manager,serializeWorkspace(source));expect(manager.open({widgetId:'test.alpha',parameters:{name:'new'}}).instanceId).toBe('wf-window-2') })
  it('requires an empty manager so restore cannot mix runtime workspaces accidentally', () => { const manager=createWindowManager(createRegistry());manager.open({widgetId:'test.alpha',parameters:{name:'existing'}});const result=restoreWorkspace(manager,{version:WORKSPACE_VERSION,windows:[]});expect(result.valid).toBe(false);expect(result.issues[0]?.code).toBe('manager-not-empty');expect(manager.list()).toHaveLength(1) })
})
