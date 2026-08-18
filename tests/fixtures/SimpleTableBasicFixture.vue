<script setup lang="ts">
import SimpleTable from '../../src/primitives/SimpleTable.vue'
import type { SimpleTableColumn } from '../../src/primitives/simple-table'

interface Row {
  name: string
  quantity: number
}

const rows: Row[] = [{ name: 'Ore', quantity: 12 }]
const columns: SimpleTableColumn<Row>[] = [
  { id: 'name', header: 'Name', field: 'name' },
  { id: 'quantity', header: 'Quantity', field: 'quantity', align: 'end' },
]
</script>

<template>
  <SimpleTable :columns="columns" :rows="rows" caption="Inventory" />
</template>
