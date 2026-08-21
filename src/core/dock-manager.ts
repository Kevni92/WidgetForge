import { clonePaneTree, validatePaneTree, type PaneNode, type PaneParameters } from './pane'
import { assertPaneCapabilities } from './widget-capabilities'
import type { WidgetRegistry } from './widget-registry'
import type { WindowGeometry, WindowSize, WindowSizeConstraints } from './window-geometry'
import { cloneWindowOptions, type WindowOptions } from './window-options'
import { createLayoutSurfaceStyle, type LayoutSurfaceStyle } from './layout-surface-style'

export type DockId = string
export type DockPosition = 'top' | 'bottom' | 'left' | 'right'
export type DockChangeKind = 'add' | 'remove' | 'pane' | 'thickness' | 'style'

export interface DockRestoreWindow {
  readonly instanceId: string
  readonly title: string
  readonly geometry: WindowGeometry
  readonly constraints: WindowSizeConstraints
  readonly options: WindowOptions
}

export interface DockState {
  readonly id: DockId
  readonly position: DockPosition
  readonly rootPane: PaneNode
  readonly thickness: number
  readonly minThickness: number
  readonly maxThickness: number | null
  readonly resizable: boolean
  readonly surfaceStyle?: LayoutSurfaceStyle
  readonly restoreWindow?: DockRestoreWindow
}

export interface AddDockRequest {
  id: DockId
  position: DockPosition
  pane: PaneNode
  thickness: number
  minThickness?: number
  maxThickness?: number
  resizable?: boolean
  surfaceStyle?: LayoutSurfaceStyle
  restoreWindow?: DockRestoreWindow
}

export interface DockChange { readonly kind: DockChangeKind; readonly dockId: DockId; readonly docks: readonly DockState[] }
export interface DockRect { readonly x:number; readonly y:number; readonly width:number; readonly height:number }
export interface WorkspaceDockLayout { readonly floating:DockRect; readonly docks:Readonly<Record<DockId,DockRect>> }
export type DockListener = (change:DockChange)=>void

export class DuplicateDockError extends Error { constructor(public readonly dockId:DockId){super(`dock "${dockId}" already exists`);this.name='DuplicateDockError'} }
export class UnknownDockError extends Error { constructor(public readonly dockId:DockId){super(`unknown dock "${dockId}"`);this.name='UnknownDockError'} }
export class DockDefinitionError extends Error { constructor(message:string){super(message);this.name='DockDefinitionError'} }

function paneParameters(parameters:Readonly<Record<string,unknown>>):PaneParameters{
  const result:Record<string,string|number|boolean>={}
  for(const[key,value]of Object.entries(parameters))if(typeof value==='string'||typeof value==='boolean'||(typeof value==='number'&&Number.isFinite(value)))result[key]=value
  return result
}
function normalizePane(registry:WidgetRegistry,pane:PaneNode):PaneNode{
  validatePaneTree(pane)
  if(pane.kind==='widget'){
    const resolved=registry.resolve(pane.widgetId,pane.parameters)
    return{...clonePaneTree(pane),parameters:paneParameters(resolved.parameters)}
  }
  return{...clonePaneTree(pane),children:pane.children.map((child)=>normalizePane(registry,child))}
}
function normalizeDockPane(registry:WidgetRegistry,pane:PaneNode):PaneNode{assertPaneCapabilities(registry,pane,{dockHost:true});return normalizePane(registry,pane)}
function normalizeThickness(value:number,min:number,max:number|null):number{
  if(!Number.isFinite(value)||value<0)throw new DockDefinitionError('dock thickness must be a finite non-negative number')
  return Math.max(min,max===null?value:Math.min(max,value))
}
function cloneDock(dock:DockState):DockState{return{...dock,rootPane:clonePaneTree(dock.rootPane),...(dock.surfaceStyle?{surfaceStyle:createLayoutSurfaceStyle(dock.surfaceStyle)}:{}),...(dock.restoreWindow?{restoreWindow:{...dock.restoreWindow,geometry:{position:{...dock.restoreWindow.geometry.position},size:{...dock.restoreWindow.geometry.size}},constraints:{minSize:{...dock.restoreWindow.constraints.minSize},maxSize:dock.restoreWindow.constraints.maxSize?{...dock.restoreWindow.constraints.maxSize}:null},options:cloneWindowOptions(dock.restoreWindow.options)}}: {})}}

export class DockManager{
  private docks:DockState[]=[]
  private readonly listeners=new Set<DockListener>()
  constructor(private readonly registry:WidgetRegistry){}
  list():readonly DockState[]{return this.docks.map(cloneDock)}
  get(id:DockId):DockState{const dock=this.docks.find((item)=>item.id===id);if(!dock)throw new UnknownDockError(id);return cloneDock(dock)}
  add(request:AddDockRequest):DockState{
    if(!request.id.trim())throw new DockDefinitionError('dock id must not be empty')
    if(this.docks.some((dock)=>dock.id===request.id))throw new DuplicateDockError(request.id)
    const min=request.minThickness??0;const max=request.maxThickness??null
    if(!Number.isFinite(min)||min<0||max!==null&&(!Number.isFinite(max)||max<min))throw new DockDefinitionError('invalid dock thickness constraints')
    let surfaceStyle: LayoutSurfaceStyle | undefined
    try { surfaceStyle = request.surfaceStyle ? createLayoutSurfaceStyle(request.surfaceStyle) : undefined } catch (error) { throw new DockDefinitionError(error instanceof Error ? error.message : 'invalid dock surface style') }
    const dock:DockState={id:request.id,position:request.position,rootPane:normalizeDockPane(this.registry,request.pane),thickness:normalizeThickness(request.thickness,min,max),minThickness:min,maxThickness:max,resizable:request.resizable??true,...(surfaceStyle?{surfaceStyle}:{}),...(request.restoreWindow?{restoreWindow:{...request.restoreWindow,geometry:{position:{...request.restoreWindow.geometry.position},size:{...request.restoreWindow.geometry.size}},constraints:{minSize:{...request.restoreWindow.constraints.minSize},maxSize:request.restoreWindow.constraints.maxSize?{...request.restoreWindow.constraints.maxSize}:null},options:cloneWindowOptions(request.restoreWindow.options)}}: {})}
    this.docks=[...this.docks,dock];this.emit('add',dock.id);return cloneDock(dock)
  }
  remove(id:DockId):void{if(!this.docks.some((dock)=>dock.id===id))throw new UnknownDockError(id);this.docks=this.docks.filter((dock)=>dock.id!==id);this.emit('remove',id)}
  setRootPane(id:DockId,pane:PaneNode):DockState{const current=this.get(id);const updated:{readonly [K in keyof DockState]:DockState[K]}={...current,rootPane:normalizeDockPane(this.registry,pane)};this.docks=this.docks.map((dock)=>dock.id===id?updated:dock);this.emit('pane',id);return cloneDock(updated)}
  setThickness(id:DockId,thickness:number):DockState{const current=this.get(id);const next=normalizeThickness(thickness,current.minThickness,current.maxThickness);if(next===current.thickness)return current;const updated={...current,thickness:next};this.docks=this.docks.map((dock)=>dock.id===id?updated:dock);this.emit('thickness',id);return cloneDock(updated)}
  setSurfaceStyle(id:DockId,surfaceStyle:LayoutSurfaceStyle|undefined):DockState{const current=this.get(id);let normalized:LayoutSurfaceStyle|undefined;try{normalized=surfaceStyle?createLayoutSurfaceStyle(surfaceStyle):undefined}catch(error){throw new DockDefinitionError(error instanceof Error?error.message:'invalid dock surface style')}const updated={...current,...(normalized?{surfaceStyle:normalized}:{})};if(!normalized)delete (updated as {surfaceStyle?:LayoutSurfaceStyle}).surfaceStyle;this.docks=this.docks.map((dock)=>dock.id===id?updated:dock);this.emit('style',id);return cloneDock(updated)}
  subscribe(listener:DockListener):()=>void{this.listeners.add(listener);return()=>this.listeners.delete(listener)}
  private emit(kind:DockChangeKind,dockId:DockId):void{const change={kind,dockId,docks:this.list()};for(const listener of [...this.listeners])listener(change)}
}

export function createDockManager(registry:WidgetRegistry):DockManager{return new DockManager(registry)}

export function calculateWorkspaceDockLayout(container:WindowSize,docks:readonly DockState[]):WorkspaceDockLayout{
  let left=0;let top=0;let right=Math.max(0,container.width);let bottom=Math.max(0,container.height)
  const rects:Record<string,DockRect>={}
  for(const dock of docks){
    if(dock.position==='top'){const height=Math.min(dock.thickness,Math.max(0,bottom-top));rects[dock.id]={x:left,y:top,width:Math.max(0,right-left),height};top+=height}
    else if(dock.position==='bottom'){const height=Math.min(dock.thickness,Math.max(0,bottom-top));bottom-=height;rects[dock.id]={x:left,y:bottom,width:Math.max(0,right-left),height}}
    else if(dock.position==='left'){const width=Math.min(dock.thickness,Math.max(0,right-left));rects[dock.id]={x:left,y:top,width,height:Math.max(0,bottom-top)};left+=width}
    else{const width=Math.min(dock.thickness,Math.max(0,right-left));right-=width;rects[dock.id]={x:right,y:top,width,height:Math.max(0,bottom-top)}}
  }
  return{floating:{x:left,y:top,width:Math.max(0,right-left),height:Math.max(0,bottom-top)},docks:rects}
}
