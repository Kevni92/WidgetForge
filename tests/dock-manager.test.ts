import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { calculateWorkspaceDockLayout, createDockManager, DockDefinitionError } from '../src/core/dock-manager'
import { createWidgetPane } from '../src/core/pane'
import { defineWidget } from '../src/core/widget'
import { createWidgetRegistry } from '../src/core/widget-registry'

const Widget=defineComponent({template:'<span />'})
const registry=createWidgetRegistry([defineWidget({id:'test.dock',title:'Dock',component:Widget})])
const pane=(id:string)=>createWidgetPane({id,widgetId:'test.dock',instanceId:`${id}-widget`})

describe('DockManager',()=>{
  it('normalizes dock state and thickness constraints',()=>{
    const manager=createDockManager(registry)
    manager.add({id:'top',position:'top',pane:pane('top-pane'),thickness:80,minThickness:40,maxThickness:120})
    expect(manager.setThickness('top',200).thickness).toBe(120)
    expect(manager.setThickness('top',10).thickness).toBe(40)
    expect(()=>manager.add({id:'bad',position:'left',pane:pane('bad-pane'),thickness:10,minThickness:30,maxThickness:20})).toThrow(DockDefinitionError)
  })

  it('calculates sequential dock rectangles and remaining floating area',()=>{
    const manager=createDockManager(registry)
    manager.add({id:'top',position:'top',pane:pane('top-pane'),thickness:60})
    manager.add({id:'bottom',position:'bottom',pane:pane('bottom-pane'),thickness:40})
    manager.add({id:'left',position:'left',pane:pane('left-pane'),thickness:120})
    manager.add({id:'right',position:'right',pane:pane('right-pane'),thickness:80})
    const layout=calculateWorkspaceDockLayout({width:1000,height:700},manager.list())
    expect(layout.floating).toEqual({x:120,y:60,width:800,height:600})
    expect(layout.docks.top).toEqual({x:0,y:0,width:1000,height:60})
    expect(layout.docks.left).toEqual({x:0,y:60,width:120,height:600})
  })
})
