<script setup lang="ts">
import { computed, markRaw, ref } from 'vue'
import { CommandPalette, WidgetActionToolbar, createCommandPaletteProvider, createCommandPaletteRegistry, createCommandRegistryPaletteProvider, useSelection, useWidgetNavigation } from 'widgetforge'
import type { WidgetAction, WidgetActionBinding } from 'widgetforge'
import { useDemoControls, type DemoThemeName } from '../demo-controls'
import { playgroundCommands } from '../playground-commands'
import { colonyOptions, colonySelectionKey } from '../selection-demo'

const navigation=useWidgetNavigation(),controls=useDemoControls(),colony=useSelection(colonySelectionKey),selectedColony=colony.value
if(selectedColony.value===null)colony.select('ARC-01')
const theme=computed(()=>controls.theme()),canUndo=computed(()=>controls.canUndo?.()??false),canRedo=computed(()=>controls.canRedo?.()??false),workspaceMode=computed(()=>controls.workspaceMode?.()??'normal'),layoutNames=computed(()=>controls.layoutNames?.()??[]),activeLayout=computed(()=>controls.activeLayout?.()??''),developerMode=computed(()=>controls.developerMode?.()??false),feedOnline=computed(()=>controls.feedOnline?.()??true)
function openMarket():void{navigation.navigate({widgetId:'market.ticker',parameters:{commodity:'METALS',rows:10}})}function openColony():void{navigation.navigate({widgetId:'planet.summary',parameters:{planetId:selectedColony.value??'ARC-01',compact:false}})}function openProduction():void{navigation.navigate({widgetId:'economy.production'})}function openInventory():void{navigation.navigate({widgetId:'economy.inventory'})}function openOrders():void{navigation.navigate({widgetId:'economy.orders'})}function openAlerts():void{navigation.navigate({widgetId:'demo.alerts'})}function openOverlay():void{navigation.navigate({widgetId:'demo.overlay-command'})}function openModal():void{navigation.navigate({widgetId:'demo.modal-review'})}
function changeTheme(event:Event):void{const select=event.target;if(select instanceof HTMLSelectElement)controls.setTheme(select.value as DemoThemeName)}
function changeLayout(event:Event):void{const select=event.target;if(select instanceof HTMLSelectElement&&select.value)controls.loadLayout?.(select.value)}
function changeColony(event:Event):void{const select=event.target;if(select instanceof HTMLSelectElement)colony.select(select.value)}
function toggleEdit():void{controls.setWorkspaceMode?.(workspaceMode.value==='edit'?'normal':'edit')}function toggleLock():void{controls.setWorkspaceMode?.(workspaceMode.value==='locked'?'normal':'locked')}function toggleDevTools():void{controls.setDeveloperMode?.(!developerMode.value)}function toggleFeed():void{if(feedOnline.value)controls.simulateFeedFailure?.();else controls.recoverFeed?.()}
const palette=ref<{open:()=>Promise<void>}|null>(null)
const paletteRegistry=markRaw(createCommandPaletteRegistry([
  createCommandRegistryPaletteProvider(playgroundCommands,navigation,'demo-commands'),
  createCommandPaletteProvider('workspace-actions',()=>[
    {id:'workspace:reset',label:'Reset workspace',category:'Workspace',keywords:['default','layout'],execute:()=>{void controls.resetWorkspace()}},
    {id:'workspace:undo',label:'Undo layout change',category:'Workspace',keywords:['history'],shortcut:'Ctrl+Z',disabled:!canUndo.value,execute:()=>controls.undo?.()},
    {id:'workspace:redo',label:'Redo layout change',category:'Workspace',keywords:['history'],shortcut:'Ctrl+Y',disabled:!canRedo.value,execute:()=>controls.redo?.()},
    {id:'workspace:edit',label:workspaceMode.value==='edit'?'Leave layout edit mode':'Enter layout edit mode',category:'Workspace',keywords:['pane','layout'],execute:toggleEdit},
    {id:'workspace:lock',label:workspaceMode.value==='locked'?'Unlock workspace':'Lock workspace',category:'Workspace',keywords:['pane','layout'],execute:toggleLock},
    {id:'data:feed',label:feedOnline.value?'Simulate economy feed failure':'Reconnect economy feed',category:'Data',keywords:['network','reconnect','error'],execute:toggleFeed},
    {id:'developer:devtools',label:developerMode.value?'Disable Developer Mode':'Enable Developer Mode',category:'Developer',keywords:['debug','devtools','diagnostics'],shortcut:'Ctrl+Shift+D',execute:toggleDevTools},
    ...layoutNames.value.map((name)=>({id:`layout:${name}`,label:`Load ${name} layout`,category:'Layouts',keywords:['workspace','preset',name],execute:()=>controls.loadLayout?.(name)})),
  ]),
  createCommandPaletteProvider('widget-shortcuts',()=>[
    {id:'widget:market',label:'Open Commodity Exchange',category:'Economy',keywords:['market','ticker'],execute:openMarket},
    {id:'widget:production',label:'Open Production',category:'Economy',keywords:['production','factory'],execute:openProduction},
    {id:'widget:inventory',label:'Open Inventory',category:'Economy',keywords:['inventory','stock'],execute:openInventory},
    {id:'widget:orders',label:'Open Orders',category:'Economy',keywords:['orders','trade'],execute:openOrders},
    {id:'widget:colony',label:'Open Colony Overview',category:'Widgets',keywords:['planet',selectedColony.value??'ARC-01'],execute:openColony},
    {id:'widget:alerts',label:'Open Operations Alerts',category:'Widgets',keywords:['alerts'],execute:openAlerts},
    {id:'widget:overlay',label:'Open Quick Command Overlay',category:'Widgets',keywords:['overlay','quick','command'],execute:openOverlay},
    {id:'widget:modal',label:'Open Critical Operations Review',category:'Widgets',keywords:['modal','review'],execute:openModal},
  ]),
]))

type ActionOptions = Pick<WidgetAction,'priority'|'group'|'alwaysVisible'|'overflowOnly'|'disabled'|'visible'|'shortcut'|'tone'|'pressed'>
function actionBinding(id:string,label:string,icon:string,execute:()=>void,options:ActionOptions={}):WidgetActionBinding{return{action:{id,label,icon,...options},execute}}
const navigationActions=computed<readonly WidgetActionBinding[]>(()=>[
  actionBinding('production','Production','▣',openProduction,{priority:100,alwaysVisible:true}),
  actionBinding('inventory','Inventory','▤',openInventory,{priority:90}),
  actionBinding('market','Market','◈',openMarket,{priority:110,alwaysVisible:true,tone:'accent'}),
  actionBinding('orders','Orders','⇄',openOrders,{priority:80}),
  actionBinding('alerts','Alerts','!',openAlerts,{priority:70}),
  actionBinding('overlay','Overlay','▱',openOverlay,{priority:65}),
  actionBinding('modal','Modal','◇',openModal,{priority:60}),
  actionBinding('palette','Palette','⌕',()=>{void palette.value?.open()},{priority:50,shortcut:'Ctrl+K'}),
])
const utilityActions=computed<readonly WidgetActionBinding[]>(()=>[
  actionBinding('feed',feedOnline.value?'Fail feed':'Reconnect',feedOnline.value?'◉':'!',toggleFeed,{priority:100,tone:feedOnline.value?'neutral':'danger'}),
  actionBinding('devtools',developerMode.value?'Disable DevTools':'DevTools','⌘',toggleDevTools,{priority:80,pressed:developerMode.value}),
  actionBinding('undo','Undo','↶',()=>controls.undo?.(),{priority:70,group:'history',shortcut:'Ctrl+Z',disabled:!canUndo.value}),
  actionBinding('redo','Redo','↷',()=>controls.redo?.(),{priority:70,group:'history',shortcut:'Ctrl+Y',disabled:!canRedo.value}),
  actionBinding('edit',workspaceMode.value==='edit'?'Editing':'Edit','✎',toggleEdit,{priority:60,pressed:workspaceMode.value==='edit'}),
  actionBinding('lock',workspaceMode.value==='locked'?'Unlock':'Lock','⌑',toggleLock,{priority:50,pressed:workspaceMode.value==='locked'}),
  actionBinding('reset','Reset layout','↺',()=>{void controls.resetWorkspace()},{priority:20}),
])
</script>

<template>
  <nav class="workspace-topbar" aria-label="Simulation navigation">
    <div class="workspace-topbar__brand"><span class="workspace-topbar__mark">WF</span><div><strong>Orbital Exchange</strong><span>Sector Helios · Economy Network</span></div></div>
    <div class="workspace-topbar__nav"><WidgetActionToolbar :bindings="navigationActions" :max-visible="100" data-action-attribute="data-demo-nav" aria-label="Primary navigation"/><CommandPalette ref="palette" :registry="paletteRegistry"/></div>
    <div class="workspace-topbar__tools">
      <select :value="selectedColony" aria-label="Colony selection" @change="changeColony"><option v-for="id in colonyOptions" :key="id" :value="id">{{id}}</option></select>
      <select v-if="layoutNames.length" :value="activeLayout" aria-label="Workspace layout" @change="changeLayout"><option value="" disabled>Custom</option><option v-for="name in layoutNames" :key="name" :value="name">{{name}}</option></select>
      <span class="workspace-topbar__online" :data-online="String(feedOnline)"><i/> {{feedOnline?'Network online':'Feed offline'}}</span>
      <select :value="theme" aria-label="Theme" @change="changeTheme"><option value="forge-dark">Dark</option><option value="forge-light">Light</option></select>
      <WidgetActionToolbar :bindings="utilityActions" :max-visible="100" data-action-attribute="data-demo-action" aria-label="Workspace utilities"/>
    </div>
  </nav>
</template>

<style scoped>
.workspace-topbar{height:100%;display:flex;min-width:0;align-items:center;gap:var(--wf-space-md);padding:0 var(--wf-space-md);background:var(--wf-color-surface);color:var(--wf-color-text);font-size:var(--wf-font-size-sm);overflow:hidden}.workspace-topbar__brand{display:flex;flex:0 1 auto;align-items:center;gap:var(--wf-space-sm);min-width:185px}.workspace-topbar__mark{display:grid;flex:0 0 auto;place-items:center;width:30px;height:30px;border:1px solid var(--wf-color-accent);border-radius:var(--wf-radius-sm);color:var(--wf-color-accent);font-weight:var(--wf-font-weight-bold);letter-spacing:.06em}.workspace-topbar__brand div{display:grid;line-height:1.15}.workspace-topbar__brand span:last-child{margin-top:2px;color:var(--wf-color-text-muted);font-size:var(--wf-font-size-xs)}.workspace-topbar__nav{display:flex;min-width:0;flex:1 1 auto;align-items:center;height:100%;gap:2px}.workspace-topbar__nav :deep(.wf-widget-action-toolbar){width:100%;height:100%}.workspace-topbar__tools{display:flex;min-width:0;max-width:55%;flex:0 1 auto;align-items:center;justify-content:flex-end;gap:var(--wf-space-xs);white-space:nowrap}.workspace-topbar__tools :deep(.wf-widget-action-toolbar){min-width:0;flex:1 1 auto}.workspace-topbar__tools :deep(.wf-widget-action-toolbar__action){height:30px;color:var(--wf-color-text)}.workspace-topbar__tools :deep(.wf-widget-action-toolbar__action--pressed){background:var(--wf-color-selected);border-color:var(--wf-color-focus)}.workspace-topbar__online{display:flex;flex:0 1 auto;align-items:center;gap:6px;color:var(--wf-color-text-muted);font-size:var(--wf-font-size-xs)}.workspace-topbar__online i{width:7px;height:7px;border-radius:50%;background:var(--wf-color-success);box-shadow:0 0 8px var(--wf-color-success)}.workspace-topbar__online[data-online="false"] i{background:var(--wf-color-danger);box-shadow:0 0 8px var(--wf-color-danger)}.workspace-topbar select{min-width:0;max-width:105px;height:30px;padding:0 var(--wf-space-xs);border:1px solid var(--wf-color-border);border-radius:var(--wf-radius-sm);background:var(--wf-color-surface-raised);color:var(--wf-color-text);font:inherit}.workspace-topbar select:focus-visible{outline:2px solid var(--wf-color-focus);outline-offset:1px}@media(max-width:1180px){.workspace-topbar__brand{min-width:auto}.workspace-topbar__brand span:last-child{display:none}.workspace-topbar{gap:var(--wf-space-xs)}.workspace-topbar__tools{max-width:60%}}
</style>
