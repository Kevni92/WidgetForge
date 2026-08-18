import { clonePaneTree, validatePaneTree, type PaneNode, type PaneSettings } from './pane'
import type { WidgetId } from './widget'
import { DuplicateWindowInstanceError, type WindowManager, type WindowMode, type WindowState } from './window-manager'
import type { WindowGeometry, WindowSizeConstraints } from './window-geometry'
import { createWindowOptions, type WindowOptions } from './window-options'
import { UnknownWidgetError, WidgetParameterValidationError } from './widget-registry'

export const WORKSPACE_VERSION = 2 as const
export type WorkspaceParameterValue = string | number | boolean
export type WorkspaceParameters = Readonly<Record<string, WorkspaceParameterValue>>

export interface WorkspaceWindowSnapshot {
  readonly instanceId: string
  readonly title: string
  readonly rootPane: PaneNode
  readonly geometry: WindowGeometry
  readonly constraints: WindowSizeConstraints
  readonly options: WindowOptions
  readonly mode: WindowMode
  readonly focused: boolean
  readonly zIndex: number
}
export interface WorkspaceSnapshot { readonly version: typeof WORKSPACE_VERSION; readonly windows: readonly WorkspaceWindowSnapshot[] }
interface LegacyWorkspaceWindowSnapshot { readonly instanceId:string; readonly widgetId:WidgetId; readonly parameters:WorkspaceParameters; readonly geometry:WindowGeometry; readonly mode:WindowMode; readonly focused:boolean; readonly zIndex:number }

export type WorkspaceRestoreIssueCode = 'invalid-workspace'|'unsupported-version'|'manager-not-empty'|'invalid-window'|'duplicate-instance'|'unknown-widget'|'invalid-parameters'|'singleton-conflict'|'open-failed'
export interface WorkspaceRestoreIssue { readonly code:WorkspaceRestoreIssueCode; readonly message:string; readonly index?:number; readonly instanceId?:string; readonly widgetId?:WidgetId }
export interface WorkspaceRestoreResult { readonly valid:boolean; readonly restored:readonly WindowState[]; readonly issues:readonly WorkspaceRestoreIssue[] }
export class WorkspaceSerializationError extends Error { constructor(message:string){super(message);this.name='WorkspaceSerializationError'} }

function isRecord(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value)}
function isFiniteNumber(value:unknown):value is number{return typeof value==='number'&&Number.isFinite(value)}
function cloneGeometry(geometry:WindowGeometry):WindowGeometry{return{position:{...geometry.position},size:{...geometry.size}}}
function cloneConstraints(constraints:WindowSizeConstraints):WindowSizeConstraints{return{minSize:{...constraints.minSize},maxSize:constraints.maxSize?{...constraints.maxSize}:null}}

export function captureWorkspace(manager:WindowManager):WorkspaceSnapshot{
  const windows=manager.list().slice().sort((a,b)=>a.zIndex-b.zIndex).map((window)=>({
    instanceId:window.instanceId,title:window.title,rootPane:clonePaneTree(window.rootPane),geometry:cloneGeometry(window.geometry),constraints:cloneConstraints(window.constraints),options:{...window.options},mode:window.mode,focused:window.focused,zIndex:window.zIndex,
  }))
  return{version:WORKSPACE_VERSION,windows}
}
export function serializeWorkspace(manager:WindowManager):string{return JSON.stringify(captureWorkspace(manager))}
function invalidRoot(code:WorkspaceRestoreIssueCode,message:string):WorkspaceRestoreResult{return{valid:false,restored:[],issues:[{code,message}]}}
function parseInput(input:unknown):unknown{if(typeof input!=='string')return input;try{return JSON.parse(input) as unknown}catch{return undefined}}

function readParameters(value:unknown):Record<string,WorkspaceParameterValue>|null{
  if(!isRecord(value))return null;const result:Record<string,WorkspaceParameterValue>={}
  for(const[key,candidate]of Object.entries(value)){if(typeof candidate!=='string'&&typeof candidate!=='number'&&typeof candidate!=='boolean')return null;if(typeof candidate==='number'&&!Number.isFinite(candidate))return null;result[key]=candidate}
  return result
}
function readGeometry(value:unknown):WindowGeometry|null{
  if(!isRecord(value)||!isRecord(value.position)||!isRecord(value.size))return null
  const{x,y}=value.position;const{width,height}=value.size
  if(!isFiniteNumber(x)||!isFiniteNumber(y)||!isFiniteNumber(width)||!isFiniteNumber(height)||width<=0||height<=0)return null
  return{position:{x,y},size:{width,height}}
}
function readSize(value:unknown):{width:number;height:number}|null{if(!isRecord(value)||!isFiniteNumber(value.width)||!isFiniteNumber(value.height)||value.width<=0||value.height<=0)return null;return{width:value.width,height:value.height}}
function readConstraints(value:unknown):WindowSizeConstraints|null{
  if(!isRecord(value))return null;const minSize=readSize(value.minSize);const maxSize=value.maxSize===null?null:readSize(value.maxSize)
  if(!minSize||(value.maxSize!==null&&!maxSize)||(maxSize&&(minSize.width>maxSize.width||minSize.height>maxSize.height)))return null
  return{minSize,maxSize}
}
function readWindowOptions(value:unknown):WindowOptions|null{
  if(value===undefined)return createWindowOptions()
  if(!isRecord(value))return null
  try{return createWindowOptions(value)}catch{return null}
}
function readPaneSettings(value:unknown):PaneSettings|undefined|null{
  if(value===undefined)return undefined;if(!isRecord(value))return null
  const settings:{resizable?:boolean;minSize?:number;maxSize?:number;grow?:number;background?:'transparent'|'canvas'|'surface'|'surface-raised';backgroundColor?:string;overflow?:'auto'|'hidden'|'visible'}={}
  if(value.resizable!==undefined){if(typeof value.resizable!=='boolean')return null;settings.resizable=value.resizable}
  for(const key of ['minSize','maxSize','grow'] as const){const candidate=value[key];if(candidate===undefined)continue;if(!isFiniteNumber(candidate)||candidate<0)return null;settings[key]=candidate}
  if(settings.minSize!==undefined&&settings.maxSize!==undefined&&settings.minSize>settings.maxSize)return null
  if(value.background!==undefined){if(!['transparent','canvas','surface','surface-raised'].includes(String(value.background)))return null;settings.background=value.background as NonNullable<PaneSettings['background']>}
  if(value.backgroundColor!==undefined){if(typeof value.backgroundColor!=='string'||!value.backgroundColor.trim())return null;settings.backgroundColor=value.backgroundColor}
  if(value.overflow!==undefined){if(!['auto','hidden','visible'].includes(String(value.overflow)))return null;settings.overflow=value.overflow as NonNullable<PaneSettings['overflow']>}
  return settings
}
function readPane(value:unknown):PaneNode|null{
  if(!isRecord(value)||typeof value.id!=='string'||!value.id.trim())return null;const settings=readPaneSettings(value.settings);if(settings===null)return null
  if(value.kind==='widget'){
    if(typeof value.widgetId!=='string'||!value.widgetId.trim()||typeof value.instanceId!=='string'||!value.instanceId.trim())return null
    const parameters=readParameters(value.parameters);if(!parameters)return null
    return{kind:'widget',id:value.id,widgetId:value.widgetId,instanceId:value.instanceId,parameters,...(settings?{settings}:{})}
  }
  if(value.kind!=='split'||(value.axis!=='horizontal'&&value.axis!=='vertical')||!Array.isArray(value.children)||!Array.isArray(value.weights))return null
  const children=value.children.map(readPane);if(children.some((child)=>child===null)||!value.weights.every((weight)=>isFiniteNumber(weight)&&weight>0))return null
  const pane:PaneNode={kind:'split',id:value.id,axis:value.axis,children:children as PaneNode[],weights:value.weights as number[],...(settings?{settings}:{})}
  try{validatePaneTree(pane);return pane}catch{return null}
}
function readWindowV2(value:unknown):WorkspaceWindowSnapshot|null{
  if(!isRecord(value)||typeof value.instanceId!=='string'||!value.instanceId.trim()||typeof value.title!=='string'||!value.title.trim())return null
  if(value.mode!=='normal'&&value.mode!=='minimized'||typeof value.focused!=='boolean'||!Number.isInteger(value.zIndex)||(value.zIndex as number)<0)return null
  const rootPane=readPane(value.rootPane);const geometry=readGeometry(value.geometry);const constraints=readConstraints(value.constraints);const options=readWindowOptions(value.options)
  if(!rootPane||!geometry||!constraints||!options)return null
  return{instanceId:value.instanceId,title:value.title,rootPane,geometry,constraints,options,mode:value.mode,focused:value.focused,zIndex:value.zIndex as number}
}
function readWindowV1(value:unknown):LegacyWorkspaceWindowSnapshot|null{
  if(!isRecord(value)||typeof value.instanceId!=='string'||!value.instanceId.trim()||typeof value.widgetId!=='string'||!value.widgetId.trim())return null
  if(value.mode!=='normal'&&value.mode!=='minimized'||typeof value.focused!=='boolean'||!Number.isInteger(value.zIndex)||(value.zIndex as number)<0)return null
  const parameters=readParameters(value.parameters);const geometry=readGeometry(value.geometry);if(!parameters||!geometry)return null
  return{instanceId:value.instanceId,widgetId:value.widgetId,parameters,geometry,mode:value.mode,focused:value.focused,zIndex:value.zIndex as number}
}

interface RestoreCandidate{readonly index:number;readonly instanceId:string;readonly focused:boolean;readonly mode:WindowMode;readonly zIndex:number;readonly widgetId?:WidgetId|undefined;open(manager:WindowManager):WindowState}
function restoreIssue(code:WorkspaceRestoreIssueCode,message:string,candidate:RestoreCandidate|null,index:number):WorkspaceRestoreIssue{return{code,message,index,...(candidate?{instanceId:candidate.instanceId,...(candidate.widgetId?{widgetId:candidate.widgetId}:{})}:{})}}

export function restoreWorkspace(manager:WindowManager,input:unknown):WorkspaceRestoreResult{
  if(manager.list().length>0)return invalidRoot('manager-not-empty','workspace restore requires an empty WindowManager')
  const parsed=parseInput(input);if(!isRecord(parsed))return invalidRoot('invalid-workspace','workspace must be a valid object or JSON document')
  if(parsed.version!==1&&parsed.version!==WORKSPACE_VERSION)return invalidRoot('unsupported-version',`unsupported workspace version "${String(parsed.version)}"`)
  if(!Array.isArray(parsed.windows))return invalidRoot('invalid-workspace','workspace windows must be an array')
  const issues:WorkspaceRestoreIssue[]=[];const candidates:RestoreCandidate[]=[]
  parsed.windows.forEach((value,index)=>{
    if(parsed.version===1){const legacy=readWindowV1(value);if(!legacy){issues.push(restoreIssue('invalid-window','invalid workspace window entry',null,index));return}
      candidates.push({index,instanceId:legacy.instanceId,widgetId:legacy.widgetId,focused:legacy.focused,mode:legacy.mode,zIndex:legacy.zIndex,open:(target)=>target.open({widgetId:legacy.widgetId,instanceId:legacy.instanceId,parameters:legacy.parameters,position:legacy.geometry.position,size:legacy.geometry.size})});return}
    const entry=readWindowV2(value);if(!entry){issues.push(restoreIssue('invalid-window','invalid workspace window entry',null,index));return}
    candidates.push({index,instanceId:entry.instanceId,widgetId:entry.rootPane.kind==='widget'?entry.rootPane.widgetId:undefined,focused:entry.focused,mode:entry.mode,zIndex:entry.zIndex,
      open:(target)=>target.openPane({pane:entry.rootPane,instanceId:entry.instanceId,title:entry.title,position:entry.geometry.position,size:entry.geometry.size,minSize:entry.constraints.minSize,...(entry.constraints.maxSize?{maxSize:entry.constraints.maxSize}:{}),options:entry.options})})
  })
  candidates.sort((a,b)=>a.zIndex-b.zIndex||a.index-b.index);const seen=new Set<string>();const openedIds=new Set<string>()
  for(const candidate of candidates){if(seen.has(candidate.instanceId)){issues.push(restoreIssue('duplicate-instance','duplicate workspace instance id',candidate,candidate.index));continue}seen.add(candidate.instanceId)
    try{const opened=candidate.open(manager);if(opened.instanceId!==candidate.instanceId){issues.push(restoreIssue('singleton-conflict','singleton widget was already restored',candidate,candidate.index));continue}openedIds.add(candidate.instanceId)}catch(error){
      if(error instanceof UnknownWidgetError)issues.push(restoreIssue('unknown-widget',error.message,candidate,candidate.index));else if(error instanceof WidgetParameterValidationError)issues.push(restoreIssue('invalid-parameters',error.message,candidate,candidate.index));else if(error instanceof DuplicateWindowInstanceError)issues.push(restoreIssue('duplicate-instance',error.message,candidate,candidate.index));else issues.push(restoreIssue('open-failed',error instanceof Error?error.message:'window restore failed',candidate,candidate.index))}
  }
  for(const candidate of candidates){if(openedIds.has(candidate.instanceId)&&candidate.mode==='minimized')manager.minimize(candidate.instanceId)}
  const focused=candidates.find((candidate)=>openedIds.has(candidate.instanceId)&&candidate.focused&&candidate.mode==='normal');if(focused)manager.focus(focused.instanceId)
  return{valid:true,restored:manager.list(),issues}
}
