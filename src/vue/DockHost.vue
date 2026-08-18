<script setup lang="ts">
import { onBeforeUnmount, toRaw } from 'vue'
import type { DockManager, DockRect, DockState } from '../core/dock-manager'
import type { PaneNode } from '../core/pane'
import type { WidgetRegistry } from '../core/widget-registry'
import PaneHost from './PaneHost.vue'

interface Props { dock:DockState; rect:DockRect; manager:DockManager; registry:WidgetRegistry }
const props=defineProps<Props>()
const manager=toRaw(props.manager)
let disposeResize:(()=>void)|null=null

function style():Record<string,string>{return{left:`${props.rect.x}px`,top:`${props.rect.y}px`,width:`${props.rect.width}px`,height:`${props.rect.height}px`}}
function updatePane(pane:PaneNode):void{manager.setRootPane(props.dock.id,pane)}
function finishResize():void{disposeResize?.()}
function startResize(event:PointerEvent):void{
  if(!props.dock.resizable||event.button!==0)return
  const target=event.currentTarget;if(!(target instanceof HTMLElement))return
  event.preventDefault();finishResize()
  const pointerId=typeof event.pointerId==='number'?event.pointerId:undefined
  const start=props.dock.position==='top'||props.dock.position==='bottom'?event.clientY:event.clientX
  const startThickness=props.dock.thickness
  if(pointerId!==undefined&&typeof target.setPointerCapture==='function'){try{target.setPointerCapture(pointerId)}catch{/* optional */}}
  const matches=(next:PointerEvent):boolean=>pointerId===undefined||typeof next.pointerId!=='number'||next.pointerId===pointerId
  const move=(next:PointerEvent):void=>{if(!matches(next))return;const coordinate=props.dock.position==='top'||props.dock.position==='bottom'?next.clientY:next.clientX;const direction=props.dock.position==='bottom'||props.dock.position==='right'?-1:1;manager.setThickness(props.dock.id,startThickness+(coordinate-start)*direction)}
  const cleanup=():void=>{globalThis.window.removeEventListener('pointermove',move);globalThis.window.removeEventListener('pointerup',end);globalThis.window.removeEventListener('pointercancel',end);if(pointerId!==undefined&&typeof target.releasePointerCapture==='function'){try{target.releasePointerCapture(pointerId)}catch{/* optional */}}if(disposeResize===cleanup)disposeResize=null}
  const end=(next:PointerEvent):void=>{if(matches(next))cleanup()}
  disposeResize=cleanup;globalThis.window.addEventListener('pointermove',move);globalThis.window.addEventListener('pointerup',end);globalThis.window.addEventListener('pointercancel',end)
}
onBeforeUnmount(finishResize)
</script>

<template>
  <section class="wf-dock-host" :class="`wf-dock-host--${dock.position}`" :data-dock-id="dock.id" :data-dock-position="dock.position" :style="style()">
    <PaneHost :pane="dock.rootPane" :registry="registry" @update:pane="updatePane" />
    <div v-if="dock.resizable" class="wf-dock-host__resize" :data-dock-resize="dock.position" aria-hidden="true" @pointerdown="startResize" />
  </section>
</template>

<style scoped>
.wf-dock-host{position:absolute;min-width:0;min-height:0;overflow:hidden;background:var(--wf-color-surface);z-index:calc(var(--wf-layer-window) - 1)}
.wf-dock-host__resize{position:absolute;z-index:3;touch-action:none}
.wf-dock-host--top .wf-dock-host__resize{right:0;bottom:-3px;left:0;height:6px;cursor:ns-resize}
.wf-dock-host--bottom .wf-dock-host__resize{top:-3px;right:0;left:0;height:6px;cursor:ns-resize}
.wf-dock-host--left .wf-dock-host__resize{top:0;right:-3px;bottom:0;width:6px;cursor:ew-resize}
.wf-dock-host--right .wf-dock-host__resize{top:0;bottom:0;left:-3px;width:6px;cursor:ew-resize}
</style>
