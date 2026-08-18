<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, toRaw } from 'vue'
import { calculateWorkspaceDockLayout, type DockManager, type DockState } from '../core/dock-manager'
import type { WidgetRegistry } from '../core/widget-registry'
import type { WindowSize } from '../core/window-geometry'
import type { WindowManager } from '../core/window-manager'
import DockHost from './DockHost.vue'
import { observeElementSize } from './observe-element-size'
import WindowManagerHost from './WindowManagerHost.vue'

interface Props { windows:WindowManager; docks:DockManager; registry:WidgetRegistry }
const props=defineProps<Props>()
const windowManager=toRaw(props.windows);const dockManager=toRaw(props.docks);const registry=toRaw(props.registry)
const root=ref<HTMLElement|null>(null);const size=shallowRef<WindowSize>({width:0,height:0});const docks=shallowRef<readonly DockState[]>(dockManager.list())
let disposeSize:(()=>void)|null=null
const unsubscribe=dockManager.subscribe((change)=>{docks.value=change.docks})
const layout=computed(()=>calculateWorkspaceDockLayout(size.value,docks.value))
function rectStyle(rect:{x:number;y:number;width:number;height:number}):Record<string,string>{return{left:`${rect.x}px`,top:`${rect.y}px`,width:`${rect.width}px`,height:`${rect.height}px`}}
onMounted(()=>{if(root.value)disposeSize=observeElementSize(root.value,(next)=>{size.value=next})})
onBeforeUnmount(()=>{disposeSize?.();disposeSize=null;unsubscribe()})
</script>

<template>
  <div ref="root" class="wf-workspace-host">
    <div class="wf-workspace-host__floating" :style="rectStyle(layout.floating)" data-workspace-floating>
      <WindowManagerHost :manager="windowManager" :registry="registry" />
    </div>
    <DockHost v-for="dock in docks" :key="dock.id" :dock="dock" :rect="layout.docks[dock.id] ?? { x:0,y:0,width:0,height:0 }" :manager="dockManager" :registry="registry" />
  </div>
</template>

<style scoped>
.wf-workspace-host{position:relative;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;background:var(--wf-color-canvas)}
.wf-workspace-host__floating{position:absolute;min-width:0;min-height:0;overflow:hidden}
</style>
