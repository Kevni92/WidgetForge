<script setup lang="ts">
import { computed } from 'vue'
import { DataTable, EmptyState, ErrorState, LoadingState, useData, useLinkedSelection, type DataTableColumn } from 'widgetforge'
import { economyKey, type Order } from '../economic-domain'
import { useDemoControls } from '../demo-controls'
import { colonySelectionKey } from '../selection-demo'
type ViewState={selection:{followSelection:boolean;pinnedSelection:string|null}}
const state=useData(economyKey),linked=useLinkedSelection<string,ViewState>(colonySelectionKey,{read:(value)=>value.selection,write:(value,selection)=>({...value,selection})}),controls=useDemoControls()
const location=computed(()=>state.value.status==='ready'&&linked.selection.value?state.value.data.locations[linked.selection.value as keyof typeof state.value.data.locations]:null)
const rows=computed(()=>location.value?.orders??[])
const columns:readonly DataTableColumn<Order>[]=[{id:'side',header:'Side',value:(row)=>row.side},{id:'commodity',header:'Commodity',value:(row)=>row.commodity},{id:'quantity',header:'Qty',align:'end',value:(row)=>row.quantity},{id:'price',header:'Limit',align:'end',value:(row)=>row.price,format:(value)=>Number(value).toFixed(2)},{id:'status',header:'Status',value:(row)=>row.status}]
function submitDemoOrder():void{const name=location.value?.name??'current location';controls.notify?.('Order staged',`A deterministic demo order was staged for ${name}.`,'success')}
</script>
<template><article class="orders-widget" :data-selection="linked.selection.value??undefined"><header><div><span>Order management</span><strong>{{location?.name??'No location'}}</strong></div><button type="button" data-demo-order @click="submitDemoOrder">Stage order</button></header><LoadingState v-if="state.status==='loading'" label="Loading orders"/><ErrorState v-else-if="state.status==='error'" title="Order feed unavailable" :message="state.error.message"/><EmptyState v-else-if="rows.length===0" title="No active orders"/><DataTable v-else :rows="rows" :columns="columns" :row-id="(row:Order)=>row.id" aria-label="Active orders" compact/></article></template>
<style scoped>.orders-widget{height:100%;display:grid;grid-template-rows:auto minmax(0,1fr);gap:var(--wf-space-sm);padding:var(--wf-space-md);overflow:hidden;background:var(--wf-color-canvas)}header{display:flex;align-items:center;justify-content:space-between;gap:var(--wf-space-md)}header>div{display:grid;gap:2px}header span{color:var(--wf-color-text-muted);font-size:var(--wf-font-size-xs);text-transform:uppercase;letter-spacing:.07em}button{height:28px;padding:0 var(--wf-space-sm);border:1px solid var(--wf-color-border);border-radius:var(--wf-radius-sm);background:var(--wf-color-surface);color:var(--wf-color-text);cursor:pointer}</style>
