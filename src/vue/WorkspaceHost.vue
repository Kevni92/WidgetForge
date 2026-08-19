<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, toRaw } from 'vue'
import { calculateWorkspaceDockLayout, type DockManager, type DockState } from '../core/dock-manager'
import { containsPane, findPane, type PaneNode } from '../core/pane'
import type { WidgetRegistry } from '../core/widget-registry'
import type { WindowSize } from '../core/window-geometry'
import type { WindowManager } from '../core/window-manager'
import type { WorkspaceHistory } from '../core/workspace-history'
import { detectWorkspaceDropZone, movePaneToTarget, relocatePaneBetweenTrees, type WorkspaceDropRect, type WorkspaceDropZone } from '../core/workspace-docking'
import DockHost from './DockHost.vue'
import DockingOverlay from './DockingOverlay.vue'
import { observeElementSize } from './observe-element-size'
import { handleWorkspaceHistoryShortcut } from './workspace-history-shortcuts'
import WindowManagerHost from './WindowManagerHost.vue'

interface Props { windows: WindowManager; docks: DockManager; registry: WidgetRegistry; history?: WorkspaceHistory | undefined; historyShortcuts?: boolean | undefined }
type Owner = { readonly kind: 'window' | 'dock'; readonly id: string }
interface PaneDragSession { readonly sourceOwner: Owner; readonly sourcePaneId: string; readonly sourceElement: HTMLElement; readonly pointerId: number | undefined }
interface PaneDropTarget { readonly owner: Owner; readonly paneId: string; readonly zone: WorkspaceDropZone; readonly rect: WorkspaceDropRect }

const props = defineProps<Props>()
const windowManager = toRaw(props.windows)
const dockManager = toRaw(props.docks)
const registry = toRaw(props.registry)
const history = props.history ? toRaw(props.history) : undefined
const root = ref<HTMLElement | null>(null)
const size = shallowRef<WindowSize>({ width: 0, height: 0 })
const dockStates = shallowRef<readonly DockState[]>(dockManager.list())
const controlPressed = ref(false)
const paneDragActive = ref(false)
const paneDropPreview = shallowRef<PaneDropTarget | null>(null)
let disposeSize: (() => void) | null = null
let disposePaneDrag: (() => void) | null = null
let historyPointerActive = false
let dropSequence = 0
const unsubscribe = dockManager.subscribe((change) => { dockStates.value = change.docks })
const layout = computed(() => calculateWorkspaceDockLayout(size.value, dockStates.value))
const editMode = computed(() => controlPressed.value || paneDragActive.value)

function rectStyle(rect: { x: number; y: number; width: number; height: number }): Record<string, string> { return { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` } }
function ownerFromElement(element: Element): Owner | null { const windowElement = element.closest<HTMLElement>('[data-window-instance-id]'); if (windowElement?.dataset.windowInstanceId) return { kind:'window', id:windowElement.dataset.windowInstanceId }; const dockElement=element.closest<HTMLElement>('[data-dock-id]'); return dockElement?.dataset.dockId?{kind:'dock',id:dockElement.dataset.dockId}:null }
function ownerRoot(owner: Owner): PaneNode { return owner.kind==='window'?windowManager.get(owner.id).rootPane:dockManager.get(owner.id).rootPane }
function setOwnerRoot(owner: Owner,pane:PaneNode):void{if(owner.kind==='window')windowManager.setRootPane(owner.id,pane,'user');else dockManager.setRootPane(owner.id,pane)}
function sameOwner(a:Owner,b:Owner):boolean{return a.kind===b.kind&&a.id===b.id}
function containsPoint(rect:DOMRect,x:number,y:number):boolean{return rect.width>0&&rect.height>0&&x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom}
function findDropTarget(session:PaneDragSession,x:number,y:number):PaneDropTarget|null{
  const workspace=root.value;if(!workspace)return null;const source= findPane(ownerRoot(session.sourceOwner),session.sourcePaneId);if(!source)return null
  const candidates=[...workspace.querySelectorAll<HTMLElement>('.wf-pane-host[data-pane-id]')].filter((el)=>!session.sourceElement.contains(el)&&containsPoint(el.getBoundingClientRect(),x,y)).sort((a,b)=>{const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();return ar.width*ar.height-br.width*br.height})
  for(const candidate of candidates){const cr=candidate.getBoundingClientRect();const zone=detectWorkspaceDropZone({x,y},{x:cr.left,y:cr.top,width:cr.width,height:cr.height});if(!zone)continue;const element=zone==='center'?(candidate.closest<HTMLElement>('.wf-pane-host[data-pane-kind="tabs"]')??candidate):candidate;const paneId=element.dataset.paneId;const owner=ownerFromElement(element);if(!paneId||!owner)continue;if(sameOwner(owner,session.sourceOwner)&&(paneId===session.sourcePaneId||containsPane(source,paneId)))continue;const r=element.getBoundingClientRect();return{owner,paneId,zone:detectWorkspaceDropZone({x,y},{x:r.left,y:r.top,width:r.width,height:r.height})??zone,rect:{x:r.left,y:r.top,width:r.width,height:r.height}}}
  return null
}
function localTargetRect(target:PaneDropTarget):WorkspaceDropRect{const workspace=root.value;if(!workspace)return target.rect;const r=workspace.getBoundingClientRect();return{x:target.rect.x-r.left,y:target.rect.y-r.top,width:target.rect.width,height:target.rect.height}}
function commitPaneDrop(session:PaneDragSession,target:PaneDropTarget):void{dropSequence+=1;const id=`workspace-drop-${dropSequence}`;if(sameOwner(session.sourceOwner,target.owner)){setOwnerRoot(session.sourceOwner,movePaneToTarget(ownerRoot(session.sourceOwner),session.sourcePaneId,target.paneId,target.zone,id));return}if(session.sourceOwner.kind==='dock'&&ownerRoot(session.sourceOwner).id===session.sourcePaneId)return;const result=relocatePaneBetweenTrees(ownerRoot(session.sourceOwner),session.sourcePaneId,ownerRoot(target.owner),target.paneId,target.zone,id);setOwnerRoot(target.owner,result.targetRoot);if(result.sourceRoot)setOwnerRoot(session.sourceOwner,result.sourceRoot);else if(session.sourceOwner.kind==='window')windowManager.close(session.sourceOwner.id,'user')}
function finishPaneDrag():void{disposePaneDrag?.()}
function startPaneDrag(event:PointerEvent):void{if(!event.ctrlKey||event.button!==0)return;const target=event.target;if(!(target instanceof HTMLElement)||target.closest('[data-pane-divider-index], [data-window-resize-handle], [data-dock-resize]'))return;const tab=target.closest<HTMLElement>('[data-tab-pane-id]');const pane=target.closest<HTMLElement>('.wf-pane-host[data-pane-id]');if(!pane?.dataset.paneId)return;const owner=ownerFromElement(pane);if(!owner)return;const sourcePaneId=tab?.dataset.tabPaneId??pane.dataset.paneId;const sourceRoot=ownerRoot(owner);if(!sourcePaneId||!findPane(sourceRoot,sourcePaneId)||(owner.kind==='dock'&&sourceRoot.id===sourcePaneId))return;event.preventDefault();event.stopPropagation();finishPaneDrag();paneDragActive.value=true;const session:PaneDragSession={sourceOwner:owner,sourcePaneId,sourceElement:tab??pane,pointerId:typeof event.pointerId==='number'?event.pointerId:undefined};const matches=(next:PointerEvent)=>session.pointerId===undefined||typeof next.pointerId!=='number'||next.pointerId===session.pointerId;const move=(next:PointerEvent)=>{if(matches(next))paneDropPreview.value=findDropTarget(session,next.clientX,next.clientY)};const cleanup=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);paneDropPreview.value=null;paneDragActive.value=false;if(disposePaneDrag===cleanup)disposePaneDrag=null};const end=(next:PointerEvent)=>{if(!matches(next))return;const drop=paneDropPreview.value;if(next.type==='pointerup'&&drop)commitPaneDrop(session,drop);cleanup()};disposePaneDrag=cleanup;window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end)}
function isLayoutPointer(event:PointerEvent):boolean{if(event.button!==0||!history)return false;const target=event.target;if(!(target instanceof HTMLElement))return false;return Boolean(target.closest('[data-window-drag-handle], [data-window-resize-handle], [data-dock-resize], [data-pane-divider-index]')||(event.ctrlKey&&target.closest('.wf-pane-host[data-pane-id]')))}
function handlePointerDown(event:PointerEvent):void{if(isLayoutPointer(event)){history?.beginTransaction();historyPointerActive=true}startPaneDrag(event)}
function finishHistoryPointer():void{if(!historyPointerActive)return;historyPointerActive=false;queueMicrotask(()=>history?.commitTransaction())}
function onWorkspaceKeyDown(event:KeyboardEvent):void{if(history)handleWorkspaceHistoryShortcut(history,event,props.historyShortcuts!==false)}
function onGlobalKeyDown(event:KeyboardEvent):void{if(event.key==='Escape'){finishPaneDrag();paneDropPreview.value=null;return}if(event.key==='Control')controlPressed.value=true}
function onKeyUp(event:KeyboardEvent):void{if(event.key==='Control')controlPressed.value=false}
function onBlur():void{controlPressed.value=false;finishPaneDrag();finishHistoryPointer()}

onMounted(()=>{if(root.value){disposeSize=observeElementSize(root.value,(next)=>{size.value=next});root.value.addEventListener('keydown',onWorkspaceKeyDown)}window.addEventListener('keydown',onGlobalKeyDown);window.addEventListener('keyup',onKeyUp);window.addEventListener('blur',onBlur);window.addEventListener('pointerup',finishHistoryPointer);window.addEventListener('pointercancel',finishHistoryPointer)})
onBeforeUnmount(()=>{finishPaneDrag();finishHistoryPointer();disposeSize?.();disposeSize=null;unsubscribe();root.value?.removeEventListener('keydown',onWorkspaceKeyDown);window.removeEventListener('keydown',onGlobalKeyDown);window.removeEventListener('keyup',onKeyUp);window.removeEventListener('blur',onBlur);window.removeEventListener('pointerup',finishHistoryPointer);window.removeEventListener('pointercancel',finishHistoryPointer)})
</script>

<template><div ref="root" class="wf-workspace-host" :class="{ 'wf-workspace-host--edit': editMode }" :data-workspace-edit-mode="editMode" @pointerdown.capture="handlePointerDown"><div class="wf-workspace-host__floating" :style="rectStyle(layout.floating)" data-workspace-floating><WindowManagerHost :manager="windowManager" :registry="registry" /></div><DockHost v-for="dock in dockStates" :key="dock.id" :dock="dock" :rect="layout.docks[dock.id] ?? { x:0,y:0,width:0,height:0 }" :manager="dockManager" :registry="registry" /><DockingOverlay v-if="paneDropPreview" :target-rect="localTargetRect(paneDropPreview)" :active-zone="paneDropPreview.zone" :source-id="paneDropPreview.owner.id" :target-id="paneDropPreview.paneId" /></div></template>
<style scoped>.wf-workspace-host{position:relative;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;background:var(--wf-color-canvas)}.wf-workspace-host__floating{position:absolute;min-width:0;min-height:0;overflow:hidden}.wf-workspace-host--edit :deep(.wf-pane-host){outline:1px dashed var(--wf-color-border);outline-offset:-1px}.wf-workspace-host--edit :deep(.wf-pane-host:hover){outline-color:var(--wf-color-focus)}</style>
