<script setup lang="ts">
import { computed } from 'vue'
import { EmptyState, ErrorState, LoadingState, SimpleTable, useData, useLinkedSelection, useWidgetContext, type SimpleTableColumn } from 'widgetforge'
import { economyKey, type ProductionLine } from '../economic-domain'
import { colonySelectionKey } from '../selection-demo'
type ViewState={selection:{followSelection:boolean;pinnedSelection:string|null}}
const context=useWidgetContext(),state=useData(economyKey),linked=useLinkedSelection<string,ViewState>(colonySelectionKey,{read:(value)=>value.selection,write:(value,selection)=>({...value,selection})})
const location=computed(()=>state.value.status==='ready'&&linked.selection.value?state.value.data.locations[linked.selection.value as keyof typeof state.value.data.locations]:null)
const rows=computed(()=>location.value?.production??[])
const columns:readonly SimpleTableColumn<ProductionLine>[]=[{id:'product',header:'Output',value:(row)=>row.product},{id:'rate',header:'Rate / cycle',align:'end',value:(row)=>row.rate,format:(value)=>Number(value).toFixed(1)},{id:'efficiency',header:'Efficiency',align:'end',value:(row)=>row.efficiency,format:(value)=>`${Math.round(Number(value)*100)}%`}]
context.actions.register({id:'pin-production',label:'Pin location',icon:'◆',group:'tracking'},()=>linked.pin())
context.actions.register({id:'follow-production',label:'Follow location',icon:'◎',group:'tracking'},()=>linked.follow())
</script>
<template><article class="economy-widget production-widget" :data-selection="linked.selection.value??undefined" :data-following="String(linked.following.value)"><header><div><span>Production network</span><strong>{{location?.name??'No location'}}</strong></div><small v-if="state.status==='ready'">Cycle {{state.data.cycle}}</small></header><LoadingState v-if="state.status==='loading'" label="Loading production"/><ErrorState v-else-if="state.status==='error'" title="Production feed unavailable" :message="state.error.message"/><EmptyState v-else-if="rows.length===0" title="No production lines"/><SimpleTable v-else :rows="rows" :columns="columns" aria-label="Production lines"/></article></template>
<style scoped>.economy-widget{height:100%;display:grid;grid-template-rows:auto minmax(0,1fr);gap:var(--wf-space-sm);padding:var(--wf-space-md);overflow:auto;background:var(--wf-color-canvas)}header{display:flex;align-items:center;justify-content:space-between;gap:var(--wf-space-md)}header>div{display:grid;gap:2px}header span,header small{color:var(--wf-color-text-muted);font-size:var(--wf-font-size-xs);text-transform:uppercase;letter-spacing:.07em}</style>
