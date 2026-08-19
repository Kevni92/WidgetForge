<style scoped>
.wf-pane-host .wf-pane-host__drag-handle { width: var(--wf-size-icon-button-size); height: var(--wf-size-icon-button-size); }
.wf-pane-host .wf-pane-host__drag-glyph { display: inline-grid; width: var(--wf-size-icon-size); height: var(--wf-size-icon-size); place-items: center; font-size: var(--wf-size-icon-size); line-height: 1; }
.wf-pane-host .wf-pane-host__tabbar { min-height: var(--wf-size-tab-height); }
.wf-pane-host .wf-pane-host__tab { min-height: var(--wf-size-tab-height); padding-inline: var(--wf-space-sm); }
.wf-pane-host .wf-pane-host__tab-drag-handle { font-size: var(--wf-size-icon-size); }
</style>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, toRaw } from 'vue'
import { replacePane, setActiveTab, type PaneNode, type SplitPane, type TabPane } from '../core/pane'
import { resizePaneSplitWeights } from '../core/pane-layout'
import type { WidgetActionBinding } from '../core/widget-actions'
import type { WidgetLifecycleController } from '../core/widget-lifecycle'
import type { WidgetRegistry } from '../core/widget-registry'
import { observeElementSize } from './observe-element-size'
import { providePaneContext, type PaneHostType } from './pane-context'
import WidgetActionToolbar from './WidgetActionToolbar.vue'
import WidgetHost from './WidgetHost.vue'

defineOptions({ name: 'PaneHost' })
interface PaneHostProps {
  pane: PaneNode
  registry: WidgetRegistry
  lifecycle?: WidgetLifecycleController | undefined
  layoutLocked?: boolean
  editMode?: boolean
  paneDragEnabled?: (paneId: string) => boolean
  hostType?: PaneHostType
  active?: boolean
  hostVisible?: boolean
  hostFocused?: boolean
  actionChrome?: 'none' | 'pane'
}
const props = withDefaults(defineProps<PaneHostProps>(), {
  layoutLocked: false,
  editMode: false,
  paneDragEnabled: () => true,
  hostType: 'standalone',
  active: true,
  hostVisible: true,
  hostFocused: false,
  actionChrome: 'pane',
})
const emit = defineEmits<{ 'update:pane': [pane: PaneNode]; actionsChange: [bindings: readonly WidgetActionBinding[]] }>()
const registry = toRaw(props.registry)
const rootElement = ref<HTMLElement | null>(null)
const measuredSize = shallowRef({ width: 0, height: 0 })
const widgetActions = shallowRef<readonly WidgetActionBinding[]>([])
let disposeResize: (() => void) | null = null
let disposeSize: (() => void) | null = null

const paneId = computed(() => props.pane.id)
const hostType = computed(() => props.hostType)
const active = computed(() => props.active)
const collapsed = computed(() => Boolean(props.pane.settings?.collapsed))
const visible = computed(() => props.active && props.hostVisible && !collapsed.value)
const focused = computed(() => props.hostFocused && visible.value)
providePaneContext({ paneId, hostType, size: measuredSize, active, visible, focused, collapsed })

const backgroundClass = computed(() => `wf-pane-host--background-${props.pane.settings?.background ?? 'transparent'}`)
const paneStyle = computed<Record<string,string>>(()=>({overflow:props.pane.settings?.overflow??'hidden',...(props.pane.settings?.backgroundColor?{backgroundColor:props.pane.settings.backgroundColor}:{})}))
const visibleWidgetActions = computed(() => widgetActions.value.some((binding) => binding.action.visible !== false))
const actionMaxVisible = computed(() => measuredSize.value.width > 0 && measuredSize.value.width < 220 ? 1 : measuredSize.value.width > 0 && measuredSize.value.width < 340 ? 2 : 3)
const compactActions = computed(() => measuredSize.value.width > 0 && measuredSize.value.width < 300)
function setWidgetActions(bindings:readonly WidgetActionBinding[]):void{widgetActions.value=bindings;emit('actionsChange',bindings)}
function splitDirection(split:SplitPane):string{return split.axis==='horizontal'?'row':'column'}
function childStyle(split:SplitPane,index:number):Record<string,string>{
  const child=split.children[index],weight=split.weights[index]??1
  const style:Record<string,string>={minWidth:'0',minHeight:'0'}
  if(!child)return style
  if(child.settings?.collapsed){style.display='none';return style}
  const mode=child.settings?.sizeMode??'flex',min=child.settings?.minSize,max=child.settings?.maxSize
  if(mode==='fixed'){
    const size=child.settings?.size??0
    style.flexGrow='0';style.flexShrink='0';style.flexBasis=`${size}px`
  }else if(mode==='content'){
    style.flexGrow='0';style.flexShrink='1';style.flexBasis='auto'
    if(split.axis==='horizontal')style.width='max-content';else style.height='max-content'
  }else{
    style.flexGrow=String(weight*(child.settings?.grow??1));style.flexShrink='1';style.flexBasis='0'
  }
  if(split.axis==='horizontal'){if(min!==undefined)style.minWidth=`${min}px`;if(max!==undefined)style.maxWidth=`${max}px`}else{if(min!==undefined)style.minHeight=`${min}px`;if(max!==undefined)style.maxHeight=`${max}px`}
  return style
}
function stackChildStyle(index:number,pane:PaneNode):Record<string,string>{return{zIndex:String(index),...(pane.settings?.collapsed?{display:'none'}:{})}}
function dividerResizable(split:SplitPane,index:number):boolean{
  if(props.layoutLocked||split.settings?.resizable===false||split.settings?.locked)return false
  const first=split.children[index],second=split.children[index+1]
  if(!first||!second)return false
  return first.settings?.resizable!==false&&second.settings?.resizable!==false&&!first.settings?.locked&&!second.settings?.locked&&!first.settings?.collapsed&&!second.settings?.collapsed&&(first.settings?.sizeMode??'flex')==='flex'&&(second.settings?.sizeMode??'flex')==='flex'
}
function updateChild(childId:string,pane:PaneNode):void{emit('update:pane',replacePane(props.pane,childId,pane))}
function tabLabel(child:PaneNode):string{if(child.kind==='widget'){try{return registry.get(child.widgetId).title}catch{return child.id}}return child.id}
function tabDragEnabled(tabPane:TabPane,child:PaneNode):boolean{return !props.layoutLocked&&!tabPane.settings?.locked&&!child.settings?.locked&&props.paneDragEnabled(tabPane.id)&&props.paneDragEnabled(child.id)}
function activateTab(tabPane:TabPane,childId:string):void{emit('update:pane',setActiveTab(props.pane,tabPane.id,childId))}
function onTabKeydown(event:KeyboardEvent,tabPane:TabPane,index:number):void{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();let next=index;if(event.key==='ArrowLeft')next=(index-1+tabPane.children.length)%tabPane.children.length;if(event.key==='ArrowRight')next=(index+1)%tabPane.children.length;if(event.key==='Home')next=0;if(event.key==='End')next=tabPane.children.length-1;const child=tabPane.children[next];if(child)activateTab(tabPane,child.id)}
function finishResize():void{disposeResize?.()}
function startResize(event:PointerEvent,split:SplitPane,dividerIndex:number):void{if(!dividerResizable(split,dividerIndex)||event.button!==0)return;const host=rootElement.value,target=event.currentTarget;if(!host||!(target instanceof HTMLElement))return;event.preventDefault();event.stopPropagation();finishResize();const pointerId=typeof event.pointerId==='number'?event.pointerId:undefined;const startCoordinate=split.axis==='horizontal'?event.clientX:event.clientY;const rect=host.getBoundingClientRect();const availablePx=split.axis==='horizontal'?rect.width:rect.height;const startSplit=split;if(pointerId!==undefined&&typeof target.setPointerCapture==='function'){try{target.setPointerCapture(pointerId)}catch{/* optional */}}const matches=(next:PointerEvent)=>pointerId===undefined||typeof next.pointerId!=='number'||next.pointerId===pointerId;const move=(next:PointerEvent)=>{if(!matches(next))return;const coordinate=startSplit.axis==='horizontal'?next.clientX:next.clientY;emit('update:pane',{...startSplit,weights:resizePaneSplitWeights(startSplit,dividerIndex,coordinate-startCoordinate,availablePx)})};const cleanup=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);target.removeEventListener('lostpointercapture',lost);if(pointerId!==undefined&&typeof target.releasePointerCapture==='function'){try{target.releasePointerCapture(pointerId)}catch{/* optional */}}if(disposeResize===cleanup)disposeResize=null};const end=(next:PointerEvent)=>{if(matches(next))cleanup()};const lost=()=>cleanup();disposeResize=cleanup;target.addEventListener('lostpointercapture',lost);window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end)}
function onGlobalKeyDown(event:KeyboardEvent):void{if(event.key==='Escape')finishResize()}
function onGlobalBlur():void{finishResize()}
onMounted(()=>{const element=rootElement.value;if(element)disposeSize=observeElementSize(element,(size)=>{measuredSize.value=size});window.addEventListener('keydown',onGlobalKeyDown);window.addEventListener('blur',onGlobalBlur)})
onBeforeUnmount(()=>{finishResize();disposeSize?.();disposeSize=null;window.removeEventListener('keydown',onGlobalKeyDown);window.removeEventListener('blur',onGlobalBlur);emit('actionsChange',[])})
</script>
<template><div ref="rootElement" class="wf-pane-host" :class="[backgroundClass,{ 'wf-pane-host--edit':editMode,'wf-pane-host--split':pane.kind==='split','wf-pane-host--tabs':pane.kind==='tabs','wf-pane-host--stack':pane.kind==='stack' }]" :data-pane-id="pane.id" :data-pane-kind="pane.kind" :data-pane-size-mode="pane.settings?.sizeMode??'flex'" :data-pane-collapsed="pane.settings?.collapsed||undefined" :data-pane-locked="pane.settings?.locked||undefined" :data-pane-host-type="hostType" :data-pane-active="active ? 'true' : 'false'" :data-pane-visible="visible ? 'true' : 'false'" :data-pane-focused="focused ? 'true' : 'false'" :data-layout-locked="layoutLocked || undefined" :style="[paneStyle,pane.kind==='split'?{flexDirection:splitDirection(pane)}:{}]"><button v-if="editMode&&!layoutLocked&&!pane.settings?.locked&&paneDragEnabled(pane.id)" type="button" class="wf-pane-host__drag-handle" data-pane-drag-handle :aria-label="`Move pane ${pane.id}`" @click.prevent @pointerdown.prevent><span class="wf-pane-host__drag-glyph" aria-hidden="true">⠿</span></button><template v-if="pane.kind==='widget'"><div class="wf-pane-host__widget-frame"><div v-if="actionChrome==='pane'&&visibleWidgetActions" class="wf-pane-host__actionbar"><WidgetActionToolbar :bindings="widgetActions" :max-visible="actionMaxVisible" :compact="compactActions" :aria-label="`${pane.id} widget actions`"/></div><WidgetHost class="wf-pane-host__widget" :registry="registry" :widget-id="pane.widgetId" :instance-id="pane.instanceId" :parameters="pane.parameters" :lifecycle="lifecycle" @actions-change="setWidgetActions"/></div></template><template v-else-if="pane.kind==='split'"><template v-for="(child,index) in pane.children" :key="child.id"><div class="wf-pane-host__cell" :style="childStyle(pane,index)"><PaneHost :pane="child" :registry="registry" :lifecycle="lifecycle" :layout-locked="layoutLocked" :edit-mode="editMode" :pane-drag-enabled="paneDragEnabled" :host-type="hostType" :active="active" :host-visible="hostVisible" :host-focused="hostFocused" action-chrome="pane" @update:pane="updateChild(child.id,$event)"/></div><div v-if="index<pane.children.length-1" class="wf-pane-host__divider" :class="[`wf-pane-host__divider--${pane.axis}`,{'wf-pane-host__divider--disabled':!dividerResizable(pane,index)}]" :data-pane-divider-index="index" :aria-hidden="!dividerResizable(pane,index)" @pointerdown="startResize($event,pane,index)"/></template></template><template v-else-if="pane.kind==='tabs'"><div class="wf-pane-host__tabbar" role="tablist" :aria-label="`${pane.id} tabs`" :data-tab-container-id="pane.id"><button v-for="(child,index) in pane.children" :key="child.id" class="wf-pane-host__tab" :class="{'wf-pane-host__tab--active':child.id===pane.activeId}" role="tab" :aria-selected="child.id===pane.activeId" :tabindex="child.id===pane.activeId?0:-1" :data-tab-pane-id="child.id" :data-tab-id="child.id" @click="activateTab(pane,child.id)" @keydown="onTabKeydown($event,pane,index)"><span>{{tabLabel(child)}}</span><span class="wf-pane-host__tab-drag-handle" data-tab-drag-handle :data-pane-drag-handle="editMode&&tabDragEnabled(pane,child)?'':undefined" :data-tab-drag-disabled="tabDragEnabled(pane,child)?undefined:'true'" :aria-label="`${editMode?'Move pane':'Reorder tab'} ${tabLabel(child)}`" :aria-disabled="tabDragEnabled(pane,child)?undefined:'true'" @click.stop.prevent><span class="wf-pane-host__drag-glyph" aria-hidden="true">⠿</span></span></button></div><div class="wf-pane-host__tab-content"><div v-for="child in pane.children" v-show="child.id===pane.activeId" :key="child.id" class="wf-pane-host__tab-panel" role="tabpanel" :data-tab-content-id="child.id" :aria-hidden="child.id!==pane.activeId"><PaneHost :pane="child" :registry="registry" :lifecycle="lifecycle" :layout-locked="layoutLocked" :edit-mode="editMode" :pane-drag-enabled="paneDragEnabled" :host-type="hostType" :active="active && child.id===pane.activeId" :host-visible="hostVisible" :host-focused="hostFocused" action-chrome="pane" @update:pane="updateChild(child.id,$event)"/></div></div></template><template v-else><div v-for="(child,index) in pane.children" :key="child.id" class="wf-pane-host__stack-layer" :style="stackChildStyle(index,child)" :data-stack-layer-id="child.id"><PaneHost :pane="child" :registry="registry" :lifecycle="lifecycle" :layout-locked="layoutLocked" :edit-mode="editMode" :pane-drag-enabled="paneDragEnabled" :host-type="hostType" :active="active" :host-visible="hostVisible" :host-focused="hostFocused" action-chrome="pane" @update:pane="updateChild(child.id,$event)"/></div></template></div></template>
<style scoped>.wf-pane-host{position:relative;width:100%;height:100%;min-width:0;min-height:0;color:var(--wf-color-text)}.wf-pane-host--split{display:flex;align-items:stretch}.wf-pane-host--tabs{display:flex;flex-direction:column}.wf-pane-host--stack{position:relative}.wf-pane-host--background-transparent{background:transparent}.wf-pane-host--background-canvas{background:var(--wf-color-canvas)}.wf-pane-host--background-surface{background:var(--wf-color-surface)}.wf-pane-host--background-surface-raised{background:var(--wf-color-surface-raised)}.wf-pane-host__drag-handle{position:absolute;top:var(--wf-space-xs);right:var(--wf-space-xs);z-index:var(--wf-layer-overlay);width:var(--wf-size-control-height);height:var(--wf-size-control-height);padding:0;border:1px solid var(--wf-color-border);border-radius:var(--wf-radius-sm);background:var(--wf-color-surface-raised);color:var(--wf-color-text-muted);font:inherit;line-height:1;opacity:.78;cursor:grab;touch-action:none}.wf-pane-host--edit>.wf-pane-host__drag-handle{opacity:0;pointer-events:none}.wf-pane-host--edit:hover>.wf-pane-host__drag-handle,.wf-pane-host--edit[data-pane-selected="true"]>.wf-pane-host__drag-handle{opacity:.78;pointer-events:auto}.wf-pane-host--edit:has(.wf-pane-host:hover)> .wf-pane-host__drag-handle{opacity:0;pointer-events:none}.wf-pane-host__drag-handle:hover{border-color:var(--wf-color-focus);color:var(--wf-color-text)}.wf-pane-host__widget-frame{display:flex;width:100%;height:100%;min-width:0;min-height:0;flex-direction:column}.wf-pane-host__actionbar{display:flex;flex:0 0 auto;justify-content:flex-end;padding:2px var(--wf-space-xs);border-bottom:1px solid var(--wf-color-border);background:var(--wf-color-surface-raised)}.wf-pane-host__widget,.wf-pane-host__cell{min-width:0;min-height:0}.wf-pane-host__widget{width:100%;height:100%;flex:1 1 auto}.wf-pane-host__cell{position:relative;overflow:hidden}.wf-pane-host__stack-layer{position:absolute;inset:0;min-width:0;min-height:0;overflow:hidden}.wf-pane-host__divider{position:relative;z-index:1;flex:0 0 5px;touch-action:none;background:transparent}.wf-pane-host__divider::after{content:'';position:absolute;background:var(--wf-color-border);opacity:.7}.wf-pane-host__divider--horizontal{cursor:ew-resize}.wf-pane-host__divider--horizontal::after{top:0;bottom:0;left:2px;width:1px}.wf-pane-host__divider--vertical{cursor:ns-resize}.wf-pane-host__divider--vertical::after{top:2px;right:0;left:0;height:1px}.wf-pane-host__divider--disabled{cursor:default;pointer-events:none}.wf-pane-host__tabbar{display:flex;flex:0 0 auto;min-height:var(--wf-size-tab-height);gap:1px;border-bottom:1px solid var(--wf-color-border);background:var(--wf-color-surface)}.wf-pane-host__tab{display:flex;align-items:center;min-width:0;gap:var(--wf-space-xs);padding:0 var(--wf-space-md);border:0;border-right:1px solid var(--wf-color-border);background:transparent;color:var(--wf-color-text-muted);font:inherit;cursor:pointer}.wf-pane-host__tab>span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis}.wf-pane-host__tab:hover{background:var(--wf-color-hover);color:var(--wf-color-text)}.wf-pane-host__tab:focus-visible{outline:1px solid var(--wf-color-focus);outline-offset:-2px}.wf-pane-host__tab--active{background:var(--wf-color-selected);color:var(--wf-color-text)}.wf-pane-host__tab--active .wf-pane-host__tab-drag-handle{color:var(--wf-color-text)}.wf-pane-host__tab-drag-handle{color:var(--wf-color-text-muted);font-size:var(--wf-font-size-xs);cursor:grab;touch-action:none}.wf-pane-host__tab-drag-handle[data-tab-drag-disabled="true"]{cursor:default;opacity:.45}.wf-pane-host__tab-content{position:relative;flex:1 1 auto;min-width:0;min-height:0}.wf-pane-host__tab-panel{position:absolute;inset:0;min-width:0;min-height:0}</style>
