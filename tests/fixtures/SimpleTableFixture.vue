<script setup lang="ts">
import InfoPopover from '../../src/primitives/InfoPopover.vue'
import SimpleTable from '../../src/primitives/SimpleTable.vue'
import type { SimpleTableColumn } from '../../src/primitives/simple-table'

interface CargoRow {
  material: string
  amount: number
  price: number
}

const rows: CargoRow[] = [
  { material: 'Steel', amount: 120, price: 42.5 },
  { material: 'Water', amount: 480, price: 3.2 },
]

const columns: SimpleTableColumn<CargoRow>[] = [
  { id: 'material', header: 'Material', field: 'material' },
  { id: 'amount', header: 'Amount', field: 'amount', align: 'end', format: (value) => `${value} t` },
  { id: 'price', header: 'Price', field: 'price', align: 'end' },
]
</script>

<template>
  <SimpleTable
    :rows="rows"
    :columns="columns"
    caption="Cargo manifest"
    compact
  >
    <template #cell-material="{ value }">
      <InfoPopover :label="`Material ${value}`">
        <template #trigger>{{ value }}</template>
        Commodity details for {{ value }}.
      </InfoPopover>
    </template>
  </SimpleTable>
</template>
