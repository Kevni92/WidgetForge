import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDockManager } from '../src/core/dock-manager'
import { createSplitPane, createWidgetPane } from '../src/core/pane'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'
import { createWindowManager } from '../src/core/window-manager'
import DockHost from '../src/vue/DockHost.vue'
import WorkspaceHost from '../src/vue/WorkspaceHost.vue'

const TestWidget=defineComponent({template:'<span class="workspace-widget">widget</span>'})
function setup(){const registry=createWidgetRegistry([defineWidget({id:'test.workspace',title:'Workspace',component:TestWidget})]);return{registry,windows:createWindowManager(registry),docks:createDockManager(registry)}}
const pane=(id:string)=>createWidgetPane({id,widgetId:'test.workspace',instanceId:`${id}-widget`})

afterEach(()=>vi.restoreAllMocks())

describe('WorkspaceHost',()=>{
  it('renders top/bottom docks and positions the floating window area between them',async()=>{
    vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue({x:0,y:0,top:0,left:0,right:1000,bottom:700,width:1000,height:700,toJSON:()=>({})})
    const {registry,windows,docks}=setup()
    docks.add({id:'top',position:'top',pane:createSplitPane({id:'top-root',axis:'horizontal',children:[pane('top-left'),pane('top-right')]}),thickness:60})
    docks.add({id:'bottom',position:'bottom',pane:pane('bottom-pane'),thickness:40})
    windows.open({widgetId:'test.workspace',instanceId:'floating'})
    const wrapper=mount(WorkspaceHost,{props:{registry,windows,docks},attachTo:document.body})
    await nextTick()
    expect(wrapper.findAll('[data-dock-id]')).toHaveLength(2)
    expect(wrapper.findAll('[data-dock-id="top"] .workspace-widget')).toHaveLength(2)
    expect(wrapper.get('[data-workspace-floating]').attributes('style')).toContain('top: 60px')
    expect(wrapper.get('[data-workspace-floating]').attributes('style')).toContain('height: 600px')
    expect(wrapper.find('[data-window-instance-id="floating"]').exists()).toBe(true)
    wrapper.unmount()
  })
})

describe('DockHost',()=>{
  it('renders the dock surface style without changing its structural layout state', () => {
    const { registry, docks } = setup()
    docks.add({ id: 'styled', position: 'top', pane: pane('styled-dock-pane'), thickness: 80, surfaceStyle: { background: { mode: 'custom', color: '#161b22' }, border: { bottom: { enabled: true, width: 2 } }, padding: { bottom: 6 }, opacity: 0.9 } })
    const wrapper = mount(DockHost, { props: { dock: docks.get('styled'), rect: { x: 0, y: 0, width: 900, height: 80 }, manager: docks, registry } })
    expect(wrapper.get('[data-dock-id="styled"]').attributes('style')).toContain('--wf-surface-border-bottom-width: 2px')
    expect(wrapper.get('[data-dock-id="styled"]').attributes('style')).toContain('--wf-surface-opacity: 0.9')
    wrapper.unmount()
  })

  it('resizes a dock through its inner-edge handle',async()=>{
    const {registry,docks}=setup();docks.add({id:'left',position:'left',pane:pane('left-pane'),thickness:120,minThickness:80,maxThickness:220})
    const wrapper=mount(DockHost,{props:{dock:docks.get('left'),rect:{x:0,y:0,width:120,height:500},manager:docks,registry}})
    const handle=wrapper.get('[data-dock-resize="left"]')
    handle.element.dispatchEvent(new MouseEvent('pointerdown',{button:0,clientX:120,bubbles:true,cancelable:true}))
    globalThis.window.dispatchEvent(new MouseEvent('pointermove',{clientX:180,bubbles:true}))
    await nextTick()
    expect(docks.get('left').thickness).toBe(180)
    globalThis.window.dispatchEvent(new MouseEvent('pointerup',{clientX:180,bubbles:true}))
    wrapper.unmount()
  })
})
