<script setup lang="ts">
import { computed, ref } from 'vue'
import { DataTable, useWidgetContext, type DataTableColumn, type DataTableRowId, type DataTableSort } from 'widgetforge'

interface MarketRow {
  symbol: string
  name: string
  bid: number
  ask: number
  volume: number
  change: number
}

const context = useWidgetContext<{ commodity?: string; rows?: number }>()
const sort = ref<DataTableSort>({ columnId: 'volume', direction: 'desc' })
const selected = ref<DataTableRowId | null>(null)

const commodity = computed(() => context.parameters.value.commodity ?? 'ALL')
const rows = computed<readonly MarketRow[]>(() => {
  const count = Math.max(4, Math.min(24, Math.round(context.parameters.value.rows ?? 8)))
  const names = ['Ferrite', 'Titanium', 'Cobalt', 'Silicates', 'Polymer', 'Electronics', 'Fuel Cells', 'Machinery', 'Food', 'Medical']
  return Array.from({ length: count }, (_, index) => {
    const seed = index + commodity.value.length * 3
    const bid = 82 + seed * 3.71 + (seed % 4) * 1.17
    return {
      symbol: `${commodity.value.slice(0, 2).toUpperCase()}-${String(index + 1).padStart(2, '0')}`,
      name: names[index % names.length] ?? `Commodity ${index + 1}`,
      bid,
      ask: bid + 0.8 + (index % 3) * 0.42,
      volume: 9200 - index * 287 + (seed % 5) * 640,
      change: ((seed % 9) - 4) * 0.37,
    }
  })
})

const columns: readonly DataTableColumn<MarketRow>[] = [
  { id: 'symbol', header: 'Code', value: (row) => row.symbol },
  { id: 'name', header: 'Commodity', value: (row) => row.name },
  { id: 'bid', header: 'Bid', align: 'end', value: (row) => row.bid, format: (value) => Number(value).toFixed(2) },
  { id: 'ask', header: 'Ask', align: 'end', value: (row) => row.ask, format: (value) => Number(value).toFixed(2) },
  { id: 'change', header: 'Δ%', align: 'end', value: (row) => row.change, format: (value) => `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(2)}%` },
  { id: 'volume', header: '24h Vol.', align: 'end', value: (row) => row.volume, format: (value) => Number(value).toLocaleString('en-US') },
]
</script>

<template>
  <article class="market-widget">
    <header class="market-widget__header">
      <div>
        <span class="market-widget__eyebrow">Helios Commodity Exchange</span>
        <strong>{{ commodity }} Market</strong>
      </div>
      <div class="market-widget__summary">
        <span><i class="market-widget__dot" /> LIVE</span>
        <span>{{ rows.length }} contracts</span>
      </div>
    </header>
    <DataTable
      v-model:sort="sort"
      v-model:selected-row-id="selected"
      :rows="rows"
      :columns="columns"
      :row-id="(row: MarketRow) => row.symbol"
      aria-label="Commodity market quotes"
      compact
      selectable
      :filterable="false"
    />
  </article>
</template>

<style scoped>
.market-widget{height:100%;display:grid;grid-template-rows:auto minmax(0,1fr);gap:var(--wf-space-sm);padding:var(--wf-space-sm);overflow:hidden;background:var(--wf-color-canvas)}.market-widget__header{display:flex;align-items:center;justify-content:space-between;gap:var(--wf-space-md);padding:var(--wf-space-xs) var(--wf-space-sm)}.market-widget__header>div:first-child{display:grid;gap:2px}.market-widget__eyebrow{color:var(--wf-color-text-muted);font-size:var(--wf-font-size-xs);text-transform:uppercase;letter-spacing:.08em}.market-widget__summary{display:flex;gap:var(--wf-space-md);color:var(--wf-color-text-muted);font-size:var(--wf-font-size-xs)}.market-widget__summary span{display:flex;align-items:center;gap:5px}.market-widget__dot{width:6px;height:6px;border-radius:50%;background:var(--wf-color-success);box-shadow:0 0 6px var(--wf-color-success)}.market-widget :deep(.wf-data-table){height:100%;min-height:0}.market-widget :deep(.wf-data-table__scroller){height:100%;border-radius:var(--wf-radius-sm)}
</style>
