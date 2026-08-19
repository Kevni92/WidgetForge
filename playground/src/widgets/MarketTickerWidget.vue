<script setup lang="ts">
import { computed } from 'vue'
import { DataTable, useLinkedSelection, useWidgetContext, useWidgetViewState, type DataTableColumn, type DataTableRowId, type DataTableSort } from 'widgetforge'
import { colonySelectionKey } from '../selection-demo'

interface MarketRow {
  symbol: string
  name: string
  bid: number
  ask: number
  volume: number
  change: number
}
type LinkedSelectionState = { followSelection: boolean; pinnedSelection: string | null }
type MarketViewState = { filter: string; sortColumn: string; sortDirection: 'asc' | 'desc'; selected: string | null; selection: LinkedSelectionState }

const context = useWidgetContext<{ commodity?: string; rows?: number }>()
const viewState = useWidgetViewState<MarketViewState>()
const linked = useLinkedSelection<string, MarketViewState>(colonySelectionKey, {
  read: (state) => state.selection,
  write: (state, selection) => ({ ...state, selection }),
})
const sort = computed<DataTableSort>({
  get: () => ({ columnId: viewState.state.value.sortColumn, direction: viewState.state.value.sortDirection }),
  set: (next) => viewState.update((state) => ({ ...state, sortColumn: next.columnId, sortDirection: next.direction })),
})
const selected = computed<DataTableRowId | null>({
  get: () => viewState.state.value.selected,
  set: (next) => viewState.update((state) => ({ ...state, selected: next === null ? null : String(next) })),
})
const filter = computed({
  get: () => viewState.state.value.filter,
  set: (next: string) => viewState.update((state) => ({ ...state, filter: next })),
})

const commodity = computed(() => context.parameters.value.commodity ?? 'ALL')
const rows = computed<readonly MarketRow[]>(() => {
  const count = Math.max(4, Math.min(24, Math.round(context.parameters.value.rows ?? 8)))
  const names = ['Ferrite', 'Titanium', 'Cobalt', 'Silicates', 'Polymer', 'Electronics', 'Fuel Cells', 'Machinery', 'Food', 'Medical']
  return Array.from({ length: count }, (_, index) => {
    const seed = index + commodity.value.length * 3 + (linked.selection.value?.length ?? 0)
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
const filteredRows = computed(() => {
  const query = filter.value.trim().toLowerCase()
  if (!query) return rows.value
  return rows.value.filter((row) => row.symbol.toLowerCase().includes(query) || row.name.toLowerCase().includes(query))
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
  <article class="market-widget" :data-selection="linked.selection ?? undefined" :data-following="String(linked.following)">
    <header class="market-widget__header">
      <div>
        <span class="market-widget__eyebrow">Helios Commodity Exchange</span>
        <strong>{{ commodity }} Market · {{ linked.selection ?? 'No colony' }}</strong>
      </div>
      <div class="market-widget__summary">
        <button v-if="linked.following" type="button" data-market-pin @click="linked.pin()">Pin {{ linked.selection ?? 'selection' }}</button>
        <button v-else type="button" data-market-follow @click="linked.follow()">Follow selection</button>
        <label class="market-widget__filter">Filter <input v-model="filter" aria-label="Market filter" type="search" placeholder="Code or commodity" /></label>
        <span><i class="market-widget__dot" /> LIVE</span>
        <span>{{ filteredRows.length }} contracts</span>
      </div>
    </header>
    <DataTable
      v-model:sort="sort"
      v-model:selected-row-id="selected"
      :rows="filteredRows"
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
.market-widget{height:100%;display:grid;grid-template-rows:auto minmax(0,1fr);gap:var(--wf-space-sm);padding:var(--wf-space-sm);overflow:hidden;background:var(--wf-color-canvas)}.market-widget__header{display:flex;align-items:center;justify-content:space-between;gap:var(--wf-space-md);padding:var(--wf-space-xs) var(--wf-space-sm)}.market-widget__header>div:first-child{display:grid;gap:2px}.market-widget__eyebrow{color:var(--wf-color-text-muted);font-size:var(--wf-font-size-xs);text-transform:uppercase;letter-spacing:.08em}.market-widget__summary{display:flex;align-items:center;gap:var(--wf-space-md);color:var(--wf-color-text-muted);font-size:var(--wf-font-size-xs)}.market-widget__summary span{display:flex;align-items:center;gap:5px}.market-widget__summary button{height:24px;padding:0 6px;border:1px solid var(--wf-color-border);border-radius:var(--wf-radius-sm);background:var(--wf-color-surface);color:var(--wf-color-text);font:inherit;cursor:pointer}.market-widget__filter{display:flex;align-items:center;gap:4px}.market-widget__filter input{width:120px;height:24px;padding:0 6px;border:1px solid var(--wf-color-border);border-radius:var(--wf-radius-sm);background:var(--wf-color-surface);color:var(--wf-color-text);font:inherit}.market-widget__dot{width:6px;height:6px;border-radius:50%;background:var(--wf-color-success);box-shadow:0 0 6px var(--wf-color-success)}.market-widget :deep(.wf-data-table){height:100%;min-height:0}.market-widget :deep(.wf-data-table__scroller){height:100%;border-radius:var(--wf-radius-sm)}
</style>
