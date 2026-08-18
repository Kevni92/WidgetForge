<script setup lang="ts">
import { ref } from 'vue'
import {
  DataTable,
  InfoPopover,
  KeyValueGroup,
  KeyValueRow,
  SimpleTable,
  StatValue,
  type DataTableColumn,
  type DataTableRowId,
  type DataTableSort,
  type SimpleTableColumn,
} from 'widgetforge'

interface CargoRow {
  material: string
  amount: number
  price: number
}

interface MarketRow {
  id: string
  commodity: string
  sector: string
  stock: number
  price: number
  demand: number
}

const cargoRows: CargoRow[] = [
  { material: 'Steel', amount: 120, price: 42.5 },
  { material: 'Water', amount: 480, price: 3.2 },
  { material: 'Electronics', amount: 36, price: 186.4 },
]

const cargoColumns: SimpleTableColumn<CargoRow>[] = [
  { id: 'material', header: 'Material', field: 'material' },
  { id: 'amount', header: 'Amount', field: 'amount', align: 'end', format: (value) => `${value} t` },
  { id: 'price', header: 'Price', field: 'price', align: 'end', format: (value) => `${value} cr` },
]

const commodities = ['Steel', 'Water', 'Electronics', 'Food', 'Fuel', 'Medicine']
const sectors = ['Core', 'Frontier', 'Rim', 'Industrial']
const marketRows: MarketRow[] = Array.from({ length: 120 }, (_, index) => ({
  id: `market-${index + 1}`,
  commodity: `${commodities[index % commodities.length]} ${String(index + 1).padStart(3, '0')}`,
  sector: sectors[index % sectors.length] ?? 'Core',
  stock: 25 + ((index * 47) % 950),
  price: Number((2.5 + ((index * 19) % 260) * 0.85).toFixed(2)),
  demand: 10 + ((index * 31) % 90),
}))

const marketColumns: DataTableColumn<MarketRow>[] = [
  { id: 'commodity', header: 'Commodity', value: (row) => row.commodity, sortable: true },
  { id: 'sector', header: 'Sector', value: (row) => row.sector, sortable: true },
  { id: 'stock', header: 'Stock', value: (row) => row.stock, sortable: true, align: 'end' },
  { id: 'price', header: 'Price', value: (row) => row.price, sortable: true, align: 'end', format: (value) => `${value} cr` },
  { id: 'demand', header: 'Demand', value: (row) => row.demand, sortable: true, align: 'end', format: (value) => `${value}%` },
]

const marketSort = ref<DataTableSort | null>({ columnId: 'stock', direction: 'desc' })
const marketFilter = ref('')
const selectedMarketRow = ref<DataTableRowId | null>(null)
</script>

<template>
  <section class="demo-section primitive-showcase">
    <h2>UI Primitives</h2>

    <KeyValueGroup compact :columns="2" label="Production statistics">
      <KeyValueRow>
        <template #label>
          <InfoPopover data-demo="efficiency-info" label="Production efficiency">
            <template #trigger>Production efficiency</template>
            <div class="primitive-showcase__popover-content">
              <strong>Production efficiency</strong>
              <p>Base output × workforce × maintenance.</p>
              <InfoPopover data-demo="workforce-info" label="Workforce" placement="right">
                <template #trigger>Workforce</template>
                <div class="primitive-showcase__popover-content">
                  <span>Current staffing factor: 0.92</span>
                  <InfoPopover data-demo="capacity-info" label="Capacity" placement="right">
                    <template #trigger>Capacity</template>
                    <span>Maximum staffed production slots for this facility.</span>
                  </InfoPopover>
                </div>
              </InfoPopover>
            </div>
          </InfoPopover>
        </template>
        <template #value>
          <StatValue :value="84" unit="%" tone="success" label="Production efficiency 84 percent" />
        </template>
      </KeyValueRow>

      <KeyValueRow label="Grid load">
        <template #value>
          <StatValue :value="118.5" unit="MW" tone="warning" label="Grid load 118.5 megawatts" />
        </template>
      </KeyValueRow>

      <KeyValueRow label="Warehouse stock">
        <template #value>
          <StatValue :value="640" unit="t" />
        </template>
      </KeyValueRow>

      <KeyValueRow label="Maintenance">
        <template #value>
          <span class="primitive-showcase__status">Scheduled</span>
        </template>
      </KeyValueRow>
    </KeyValueGroup>

    <SimpleTable
      class="primitive-showcase__table"
      :rows="cargoRows"
      :columns="cargoColumns"
      caption="Compact cargo manifest"
      compact
    >
      <template #cell-material="{ value }">
        <InfoPopover :label="`Commodity ${value}`">
          <template #trigger>{{ value }}</template>
          <span>Consumer-provided commodity information for {{ value }}.</span>
        </InfoPopover>
      </template>
    </SimpleTable>

    <DataTable
      v-model:sort="marketSort"
      v-model:filter-query="marketFilter"
      v-model:selected-row-id="selectedMarketRow"
      class="primitive-showcase__data-table"
      :rows="marketRows"
      :columns="marketColumns"
      :row-id="(row) => row.id"
      caption="Regional market data (120 rows)"
      compact
      selectable
    >
      <template #cell-commodity="{ row, value }">
        <InfoPopover :label="`Market ${value}`">
          <template #trigger>{{ value }}</template>
          <span>{{ row.sector }} market entry. Consumer-provided details can include navigation or more glossary terms.</span>
        </InfoPopover>
      </template>
    </DataTable>
  </section>
</template>

<style scoped>
.primitive-showcase__popover-content {
  display: grid;
  gap: var(--wf-space-sm);
}

.primitive-showcase__popover-content p {
  margin: 0;
  color: var(--wf-color-text-muted);
}

.primitive-showcase__status {
  color: var(--wf-color-info);
  font-size: var(--wf-font-size-sm);
  font-weight: var(--wf-font-weight-medium);
}

.primitive-showcase__table,
.primitive-showcase__data-table {
  margin-top: var(--wf-space-lg);
}

.primitive-showcase__data-table :deep(.wf-data-table__scroller) {
  max-height: 420px;
}
</style>
