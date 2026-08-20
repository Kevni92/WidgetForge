<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, toRaw } from 'vue'
import { createWidgetNavigator } from '../core/navigation'
import type { CommandRegistry } from '../core/commands'
import type { WidgetRegistry } from '../core/widget-registry'
import type { DockPosition } from '../core/dock-manager'
import type { WindowGeometry, WindowPosition, WindowSize } from '../core/window-geometry'
import { getWindowGroupManager, type WindowGroupManager, type WindowGroupState } from '../core/window-groups'
import type { WindowManager, WindowState } from '../core/window-manager'
import { detectWindowSnapZone, snapWindowGeometry, type WindowSnapZone } from '../core/window-snap'
import { detectWorkspaceDropZone, dockWindowIntoWindow, type WorkspaceDropRect } from '../core/workspace-docking'
import { isCommandLauncherPane } from '../core/pane'
import DockingOverlay from './DockingOverlay.vue'
import { canReceiveFocus, focusModal, trapFocus } from './modal-focus'
import { observeElementSize } from './observe-element-size'
import { provideWidgetNavigation } from './widget-navigation'
import { provideWidgetDocumentationForHost } from './documentation-context'
import WindowFrame, { type WindowDropTarget } from './WindowFrame.vue'

interface WindowManagerHostProps { manager:WindowManager;registry:WidgetRegistry;commands?:CommandRegistry|undefined;launcherPlaceholder?:string|undefined;launcherSubmitLabel?:string|undefined;layoutLocked?:boolean;editMode?:boolean;paneDragEnabled?:(windowId:string,paneId:string)=>boolean;anchorWindow?:(instanceId:string,position:DockPosition)=>void;groups?:WindowGroupManager }
interface SnapPreviewState { readonly instanceId:string;readonly zone:WindowSnapZone;readonly geometry:WindowGeometry }
interface WindowDockPreviewState { readonly sourceInstanceId:string;readonly target:WindowDropTarget;readonly targetRect:WorkspaceDropRect }
const props=defineProps<WindowManagerHostProps>()
const manager=toRaw(props.manager),registry=toRaw(props.registry),groups=props.groups?toRaw(props.groups):getWindowGroupManager(manager)
const navigator=createWidgetNavigator(registry,manager);provideWidgetNavigation(navigator)
provideWidgetDocumentationForHost(registry, props.commands)
const hostElement=ref<HTMLElement|null>(null),containerSize=shallowRef<WindowSize>({width:0,height:0}),windows=shallowRef<readonly WindowState[]>(manager.list()),groupStates=shallowRef<readonly WindowGroupState[]>(groups?.list()??[]),snapPreview=shallowRef<SnapPreviewState|null>(null),windowDockPreview=shallowRef<WindowDockPreviewState|null>(null)
let disposeSizeObserver:(()=>void)|null=null,windowDockSequence=0,modalFocusQueued=false
let pendingModalRestore:HTMLElement|null=null
const modalRestoreTargets=new Map<string,HTMLElement|null>(),modalLastFocus=new Map<string,HTMLElement>()
function paneDragEnabledForWindow(windowId:string,paneId:string):boolean{return props.paneDragEnabled?.(windowId,paneId)??true}
function topModal(source:readonly WindowState[]=windows.value):WindowState|null{return[...source].filter((window)=>window.options.role==='modal'&&window.mode!=='minimized').sort((a,b)=>a.zIndex-b.zIndex).at(-1)??null}
function modalElement(instanceId:string):HTMLElement|null{return[...hostElement.value?.querySelectorAll<HTMLElement>('.wf-window-frame[data-window-instance-id]')??[]].find((element)=>element.dataset.windowInstanceId===instanceId)?.querySelector<HTMLElement>('.wf-window-shell[role="dialog"]')??null}
function rememberModalTrigger(instanceId:string):void{modalRestoreTargets.set(instanceId,document.activeElement instanceof HTMLElement?document.activeElement:null)}
function focusModalTarget(modal:WindowState,restoreTarget:HTMLElement|null=null):void{
  const element=modalElement(modal.instanceId)
  if(!element)return
  const last=modalLastFocus.get(modal.instanceId)
  const target=restoreTarget&&element.contains(restoreTarget)&&canReceiveFocus(restoreTarget)?restoreTarget:last&&element.contains(last)&&canReceiveFocus(last)?last:null
  if(target){target.focus();return}
  focusModal(element)
}
function restoreFocus(target:HTMLElement|null):void{if(target&&canReceiveFocus(target)){target.focus();return}hostElement.value?.focus()}
function scheduleModalFocus(restoreTarget:HTMLElement|null=null):void{
  if(restoreTarget)pendingModalRestore=restoreTarget
  if(modalFocusQueued)return
  modalFocusQueued=true
  void nextTick(()=>{
    modalFocusQueued=false
    const pendingRestore=pendingModalRestore
    pendingModalRestore=null
    const modal=topModal()
    if(modal){focusModalTarget(modal,pendingRestore);return}
    if(pendingRestore)restoreFocus(pendingRestore)
  })
}
function interactionBlocked(instanceId:string):boolean{const modal=topModal();return modal!==null&&modal.instanceId!==instanceId}
function ensureModalFocus():void{const modal=topModal();if(modal&&!modal.focused)manager.focus(modal.instanceId,'api')}
function onFocusIn(event:FocusEvent):void{
  const modal=topModal(),target=event.target instanceof HTMLElement?event.target:null
  if(!modal||!target)return
  const element=modalElement(modal.instanceId)
  if(element?.contains(target)){modalLastFocus.set(modal.instanceId,target);return}
  event.stopPropagation();scheduleModalFocus()
}
function onGlobalKeyDown(event:KeyboardEvent):void{
  const modal=topModal()
  if(!modal)return
  if(event.key==='Escape'){windowDockPreview.value=null;snapPreview.value=null;event.preventDefault();if(modal.options.closable)manager.close(modal.instanceId,'user');else manager.focus(modal.instanceId,'user');return}
  if(event.key==='Tab'){
    const element=modalElement(modal.instanceId)
    if(!element)return
    event.preventDefault();event.stopPropagation();trapFocus(element,event.shiftKey)
  }
}
const unsubscribe=manager.subscribe((change)=>{
  const previousWindows=windows.value,previousTop=topModal(previousWindows),previous=previousWindows.find((window)=>window.instanceId===change.instanceId)
  let restoreTarget:HTMLElement|null=null
  if((change.kind==='open'||(change.kind==='restore'&&previous?.mode==='minimized'))&&change.windows.some((window)=>window.instanceId===change.instanceId&&window.options.role==='modal'))rememberModalTrigger(change.instanceId)
  if(change.kind==='close'){
    if(previousTop?.instanceId===change.instanceId&&!topModal(change.windows))restoreTarget=modalRestoreTargets.get(change.instanceId)??null
    modalRestoreTargets.delete(change.instanceId);modalLastFocus.delete(change.instanceId)
    if(snapPreview.value?.instanceId===change.instanceId)snapPreview.value=null
    if(windowDockPreview.value?.sourceInstanceId===change.instanceId||windowDockPreview.value?.target.targetInstanceId===change.instanceId)windowDockPreview.value=null
  }
  windows.value=change.windows
  if((change.kind==='open'||change.kind==='restore')&&containerSize.value.width>0&&containerSize.value.height>0)manager.constrainToContainer(change.instanceId,containerSize.value)
  ensureModalFocus();scheduleModalFocus(restoreTarget)
})
const unsubscribeGroups=groups?.subscribe((change)=>{groupStates.value=change.groups})??(()=>{})
function groupId(instanceId:string):string|null{return groupStates.value.find((group)=>group.members.includes(instanceId))?.id??null}
function localPoint(clientX:number,clientY:number):WindowPosition|null{const host=hostElement.value;if(!host)return null;const rect=host.getBoundingClientRect();return{x:clientX-rect.left,y:clientY-rect.top}}
function resolveSnapZone(clientX:number,clientY:number):WindowSnapZone|null{if(props.layoutLocked)return null;const point=localPoint(clientX,clientY);return point?detectWindowSnapZone(point,containerSize.value):null}
function previewSnap(instanceId:string,zone:WindowSnapZone|null):void{if(props.layoutLocked||interactionBlocked(instanceId)){snapPreview.value=null;return}if(!zone){if(snapPreview.value?.instanceId===instanceId)snapPreview.value=null;return}snapPreview.value={instanceId,zone,geometry:snapWindowGeometry(zone,containerSize.value)}}
function commitSnap(instanceId:string,zone:WindowSnapZone):void{if(props.layoutLocked||interactionBlocked(instanceId))return;snapPreview.value=null;manager.snapWindow(instanceId,zone,containerSize.value,'user')}
function windowDockable(window:WindowState):boolean{return !props.layoutLocked&&window.mode==='normal'&&(window.options.role==='normal'||window.options.role==='utility')&&!isCommandLauncherPane(window.rootPane)}
function handleAnchorWindow(instanceId:string,position:DockPosition):void{if(!windowDockable(manager.get(instanceId)))return;props.anchorWindow?.(instanceId,position)}
function unsnapForPointer(instanceId:string,clientX:number,clientY:number):WindowState{const point=localPoint(clientX,clientY);return point?manager.unsnapWindow(instanceId,point,containerSize.value,'user'):manager.unsnapWindow(instanceId,undefined,undefined,'user')}
function containsClientPoint(rect:DOMRect,x:number,y:number):boolean{return x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom&&rect.width>0&&rect.height>0}
function targetWindowElement(sourceInstanceId:string,x:number,y:number):HTMLElement|null{const host=hostElement.value;if(!host||props.layoutLocked||interactionBlocked(sourceInstanceId))return null;return[...host.querySelectorAll<HTMLElement>('.wf-window-frame[data-window-instance-id]')].filter((element)=>element.dataset.windowInstanceId!==sourceInstanceId&&element.dataset.windowMode==='normal'&&element.getAttribute('aria-hidden')!=='true').filter((element)=>containsClientPoint(element.getBoundingClientRect(),x,y)).sort((a,b)=>Number(b.dataset.windowZIndex??0)-Number(a.dataset.windowZIndex??0))[0]??null}
function targetPaneElement(windowElement:HTMLElement,x:number,y:number):HTMLElement|null{return[...windowElement.querySelectorAll<HTMLElement>('.wf-pane-host[data-pane-id]')].filter((element)=>containsClientPoint(element.getBoundingClientRect(),x,y)).sort((a,b)=>{const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();return ar.width*ar.height-br.width*br.height})[0]??null}
function findWindowElement(instanceId:string):HTMLElement|null{const host=hostElement.value;if(!host)return null;return[...host.querySelectorAll<HTMLElement>('.wf-window-frame[data-window-instance-id]')].find((element)=>element.dataset.windowInstanceId===instanceId)??null}
function findPaneElement(windowElement:HTMLElement,paneId:string):HTMLElement|null{return[...windowElement.querySelectorAll<HTMLElement>('.wf-pane-host[data-pane-id]')].find((element)=>element.dataset.paneId===paneId)??null}
function resolveWindowDrop(sourceInstanceId:string,x:number,y:number):WindowDropTarget|null{if(props.layoutLocked||groupId(sourceInstanceId)||interactionBlocked(sourceInstanceId))return null;const source=manager.get(sourceInstanceId);if(source.options.role==='modal'||source.options.role==='overlay')return null;const windowElement=targetWindowElement(sourceInstanceId,x,y);if(!windowElement)return null;const paneElement=targetPaneElement(windowElement,x,y),targetInstanceId=windowElement.dataset.windowInstanceId,targetPaneId=paneElement?.dataset.paneId;if(!paneElement||!targetInstanceId||!targetPaneId)return null;const rect=paneElement.getBoundingClientRect(),zone=detectWorkspaceDropZone({x,y},{x:rect.left,y:rect.top,width:rect.width,height:rect.height});return zone?{targetInstanceId,targetPaneId,zone}:null}
function previewWindowDrop(sourceInstanceId:string,target:WindowDropTarget|null):void{if(props.layoutLocked||interactionBlocked(sourceInstanceId)){windowDockPreview.value=null;return}if(!target){if(windowDockPreview.value?.sourceInstanceId===sourceInstanceId)windowDockPreview.value=null;return}const host=hostElement.value,targetWindow=findWindowElement(target.targetInstanceId),paneElement=targetWindow?findPaneElement(targetWindow,target.targetPaneId):null;if(!host||!paneElement)return;const hostRect=host.getBoundingClientRect(),paneRect=paneElement.getBoundingClientRect();windowDockPreview.value={sourceInstanceId,target,targetRect:{x:paneRect.left-hostRect.left,y:paneRect.top-hostRect.top,width:paneRect.width,height:paneRect.height}}}
function commitWindowDrop(sourceInstanceId:string,target:WindowDropTarget):void{if(props.layoutLocked||groupId(sourceInstanceId)||interactionBlocked(sourceInstanceId))return;windowDockPreview.value=null;windowDockSequence+=1;try{dockWindowIntoWindow(manager,sourceInstanceId,target.targetInstanceId,target.targetPaneId,target.zone,`window-dock-${windowDockSequence}`)}catch{windowDockPreview.value=null}}
function geometryStyle(geometry:WindowGeometry):Record<string,string>{return{left:`${geometry.position.x}px`,top:`${geometry.position.y}px`,width:`${geometry.size.width}px`,height:`${geometry.size.height}px`}}
onMounted(()=>{if(!hostElement.value)return;disposeSizeObserver=observeElementSize(hostElement.value,(size)=>{containerSize.value=size;if(snapPreview.value)snapPreview.value={...snapPreview.value,geometry:snapWindowGeometry(snapPreview.value.zone,size)};for(const window of manager.list())manager.constrainToContainer(window.instanceId,size)});ensureModalFocus();scheduleModalFocus();hostElement.value.addEventListener('focusin',onFocusIn,true);globalThis.document.addEventListener('focusin',onFocusIn,true);globalThis.window.addEventListener('keydown',onGlobalKeyDown)})
onBeforeUnmount(()=>{snapPreview.value=null;windowDockPreview.value=null;disposeSizeObserver?.();disposeSizeObserver=null;unsubscribe();unsubscribeGroups();hostElement.value?.removeEventListener('focusin',onFocusIn,true);globalThis.document.removeEventListener('focusin',onFocusIn,true);globalThis.window.removeEventListener('keydown',onGlobalKeyDown);modalRestoreTargets.clear();modalLastFocus.clear();pendingModalRestore=null})
</script>
<template><div ref="hostElement" class="wf-window-manager-host" tabindex="-1" data-window-focus-fallback :data-layout-locked="layoutLocked||undefined" :data-modal-active="topModal()?.instanceId||undefined"><div v-if="topModal()" class="wf-window-manager-host__modal-backdrop" data-modal-backdrop aria-hidden="true"/><div v-if="snapPreview&&!layoutLocked" class="wf-window-snap-preview" :data-window-snap-preview="snapPreview.instanceId" :data-window-snap-zone="snapPreview.zone" :style="geometryStyle(snapPreview.geometry)" aria-hidden="true"/><DockingOverlay v-if="windowDockPreview&&!layoutLocked" :target-rect="windowDockPreview.targetRect" :active-zone="windowDockPreview.target.zone" :source-id="windowDockPreview.sourceInstanceId" :target-id="windowDockPreview.target.targetInstanceId"/><WindowFrame v-for="window in windows" :key="window.instanceId" :window="window" :manager="manager" :registry="registry" :container-size="containerSize" :command-registry="props.commands" :launcher-navigator="navigator" :launcher-placeholder="props.launcherPlaceholder" :launcher-submit-label="props.launcherSubmitLabel" :lifecycle="manager.getLifecycle(window.instanceId)" :layout-locked="layoutLocked" :edit-mode="editMode" :pane-drag-enabled="(paneId) => paneDragEnabledForWindow(window.instanceId, paneId)" :dockable="windowDockable(window)" :on-anchor-window="handleAnchorWindow" :interaction-blocked="interactionBlocked(window.instanceId)" :groups="groups" :group-id="groupId(window.instanceId)" :resolve-snap-zone="resolveSnapZone" :preview-snap="previewSnap" :commit-snap="commitSnap" :unsnap-for-pointer="unsnapForPointer" :resolve-window-drop="resolveWindowDrop" :preview-window-drop="previewWindowDrop" :commit-window-drop="commitWindowDrop"/></div></template>
<style scoped>.wf-window-manager-host{position:relative;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden}.wf-window-manager-host__modal-backdrop{position:absolute;inset:0;z-index:calc(var(--wf-layer-window) + 2999);background:var(--wf-color-backdrop);pointer-events:auto}.wf-window-snap-preview{position:absolute;z-index:var(--wf-layer-overlay);pointer-events:none;border:1px solid var(--wf-color-focus);border-radius:var(--wf-radius-sm);background:var(--wf-color-selected);box-shadow:inset 0 0 0 1px var(--wf-color-border)}</style>
