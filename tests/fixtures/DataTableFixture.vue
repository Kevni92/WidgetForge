<script setup lang="ts">
import { ref } from 'vue'
import DataTable from '../../src/primitives/DataTable.vue'
import InfoPopover from '../../src/primitives/InfoPopover.vue'
import type { DataTableColumn, DataTableRowId, DataTableSort } from '../../src/primitives/data-table'

interface MarketRow {
  id: string
  commodity: string
  sector: string
  stock: number
  price: number
}

const rows: MarketRow[] = [
  { id: 'steel-core', commodity: 'Steel', sector: 'Core', stock: 120, price: 42.5 },
  { id: 'water-rim', commodity: 'Water', sector: 'Rim', stock: 480, price: 3.2 },
  { id: 'electronics-core', commodity: 'Electronics', sector: 'Core', stock: 36, price: 186.4 },
]

const columns: DataTableColumn<MarketRow>[] = [
  { id: 'commodity', header: 'Commodity', value: (row) => row.commodity, sortable: true },
  { id: 'sector', header: 'Sector', value: (row) => row.sector },
  { id: 'stock', header: 'Stock', value: (row) => row.stock, sortable: true, align: 'end' },
  { id: 'price', header: 'Price', value: (row) => row.price, sortable: true, align: 'end', format: (value) => `${value} cr` },
]

const sort = ref<DataTableSort | null>(null)
const filterQuery = ref('')
const selectedRowId = ref<DataTableRowId | null>(null)
</script>

<template>
  <DataTable
    v-model:sort="sort"
    v-model:filter-query="filterQuery"
    v-model:selected-row-id="selectedRowId"
    :rows="rows"
    :columns="columns"
    :row-id="(row) => row.id"
    caption="Market overview"
    compact
    selectable
  >
    <template #cell-commodity="{ row, value }">
      <InfoPopover :label="`Commodity ${value}`">
        <template #trigger>{{ value }}</template>
        {{ row.commodity }} market details.
      </InfoPopover>
    </template>
  </DataTable>

  <output data-test="sort">{{ sort?.columnId }}:{{ sort?.direction }}</output>
  <output data-test="selection">{{ selectedRowId }}</output>
</template>
