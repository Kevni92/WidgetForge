<script setup lang="ts" generic="TRow">
import { computed } from 'vue'
import {
  nextDataTableSort,
  processDataTableRows,
  visibleDataTableColumns,
  type DataTableColumn,
  type DataTableRowId,
  type DataTableSort,
} from './data-table'

const props = withDefaults(defineProps<{
  rows: readonly TRow[]
  columns: readonly DataTableColumn<TRow>[]
  rowId: (row: TRow) => DataTableRowId
  sort?: DataTableSort | null
  filterQuery?: string
  selectedRowId?: DataTableRowId | null
  caption?: string
  ariaLabel?: string
  compact?: boolean
  filterable?: boolean
  selectable?: boolean
}>(), {
  sort: null,
  filterQuery: '',
  selectedRowId: null,
  caption: '',
  compact: false,
  filterable: true,
  selectable: false,
})

const emit = defineEmits<{
  'update:sort': [sort: DataTableSort]
  'update:filterQuery': [query: string]
  'update:selectedRowId': [rowId: DataTableRowId]
}>()

const visibleColumns = computed(() => visibleDataTableColumns(props.columns))
const displayedRows = computed(() => processDataTableRows(props.rows, props.columns, props.filterQuery, props.sort))

function displayValue(column: DataTableColumn<TRow>, row: TRow): string | number {
  const value = column.value(row)
  if (column.format) return column.format(value, row)
  if (value === null || value === undefined) return ''
  return typeof value === 'string' || typeof value === 'number' ? value : String(value)
}

function requestSort(column: DataTableColumn<TRow>): void {
  if (column.sortable === false) return
  emit('update:sort', nextDataTableSort(props.sort, column.id))
}

function updateFilter(event: Event): void {
  const input = event.target
  if (input instanceof HTMLInputElement) emit('update:filterQuery', input.value)
}

function selectRow(row: TRow): void {
  if (!props.selectable) return
  emit('update:selectedRowId', props.rowId(row))
}

function handleRowKeydown(event: KeyboardEvent, row: TRow): void {
  if (!props.selectable || (event.key !== 'Enter' && event.key !== ' ')) return
  event.preventDefault()
  selectRow(row)
}

function ariaSort(column: DataTableColumn<TRow>): 'ascending' | 'descending' | 'none' | undefined {
  if (column.sortable === false) return undefined
  if (props.sort?.columnId !== column.id) return 'none'
  return props.sort.direction === 'asc' ? 'ascending' : 'descending'
}
</script>

<template>
  <div class="wf-data-table">
    <div v-if="props.filterable" class="wf-data-table__toolbar">
      <label class="wf-data-table__filter-label">
        <span>Filter</span>
        <input
          class="wf-data-table__filter"
          type="search"
          :value="props.filterQuery"
          @input="updateFilter"
        >
      </label>
      <span class="wf-data-table__count" aria-live="polite">
        {{ displayedRows.length }} / {{ props.rows.length }} rows
      </span>
    </div>

    <div class="wf-data-table__scroller">
      <table
        class="wf-data-table__table"
        :class="{ 'wf-data-table__table--compact': props.compact }"
        :aria-label="props.ariaLabel"
      >
        <caption v-if="props.caption" class="wf-data-table__caption">
          {{ props.caption }}
        </caption>
        <thead>
          <tr>
            <th
              v-for="column in visibleColumns"
              :key="column.id"
              scope="col"
              class="wf-data-table__header"
              :class="`wf-data-table__cell--${column.align ?? 'start'}`"
              :aria-sort="ariaSort(column)"
            >
              <button
                v-if="column.sortable !== false"
                type="button"
                class="wf-data-table__sort"
                @click="requestSort(column)"
              >
                <span>{{ column.header }}</span>
                <span v-if="props.sort?.columnId === column.id" aria-hidden="true">
                  {{ props.sort.direction === 'asc' ? '▲' : '▼' }}
                </span>
              </button>
              <span v-else>{{ column.header }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in displayedRows"
            :key="rowId(row)"
            class="wf-data-table__row"
            :class="{ 'wf-data-table__row--selected': props.selectedRowId === rowId(row) }"
            :tabindex="props.selectable ? 0 : undefined"
            :aria-selected="props.selectable ? props.selectedRowId === rowId(row) : undefined"
            @click="selectRow(row)"
            @keydown="handleRowKeydown($event, row)"
          >
            <td
              v-for="column in visibleColumns"
              :key="column.id"
              class="wf-data-table__cell"
              :class="`wf-data-table__cell--${column.align ?? 'start'}`"
            >
              <slot
                :name="`cell-${column.id}`"
                :row="row"
                :column="column"
                :value="column.value(row)"
                :row-id="rowId(row)"
              >
                {{ displayValue(column, row) }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.wf-data-table {
  display: grid;
  gap: var(--wf-space-sm);
  min-width: 0;
}

.wf-data-table__toolbar {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--wf-space-md);
}

.wf-data-table__filter-label {
  display: grid;
  gap: var(--wf-space-xs);
  color: var(--wf-color-text-muted);
  font-size: var(--wf-font-size-xs);
  font-weight: var(--wf-font-weight-medium);
}

.wf-data-table__filter {
  min-height: var(--wf-size-control-height);
  min-width: min(280px, 60vw);
  padding: 0 var(--wf-space-sm);
  border: 1px solid var(--wf-color-border);
  border-radius: var(--wf-radius-sm);
  background: var(--wf-color-surface);
  color: var(--wf-color-text);
  font: inherit;
}

.wf-data-table__filter::placeholder { color: var(--wf-color-text-placeholder); opacity: 1; }

.wf-data-table__filter:focus-visible,
.wf-data-table__sort:focus-visible,
.wf-data-table__row:focus-visible {
  outline: 2px solid var(--wf-color-focus);
  outline-offset: 2px;
}

.wf-data-table__count {
  color: var(--wf-color-text-muted);
  font-size: var(--wf-font-size-xs);
}

.wf-data-table__scroller {
  max-width: 100%;
  overflow: auto;
  border: 1px solid var(--wf-color-border);
  border-radius: var(--wf-radius-md);
}

.wf-data-table__table {
  width: 100%;
  border-collapse: collapse;
  background: var(--wf-color-surface);
  color: var(--wf-color-text);
  font-size: var(--wf-font-size-sm);
}

.wf-data-table__caption {
  padding: var(--wf-space-sm) var(--wf-space-md);
  color: var(--wf-color-text-muted);
  font-weight: var(--wf-font-weight-medium);
  text-align: start;
  caption-side: top;
}

.wf-data-table__header,
.wf-data-table__cell {
  height: var(--wf-size-table-row-height);
  padding: 0 var(--wf-space-md);
  border-bottom: 1px solid var(--wf-color-border);
  vertical-align: middle;
}

.wf-data-table__table--compact .wf-data-table__header,
.wf-data-table__table--compact .wf-data-table__cell {
  height: var(--wf-size-table-row-height-compact);
  padding: 0 var(--wf-space-sm);
}

.wf-data-table__header {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--wf-color-surface-raised);
  color: var(--wf-color-text-muted);
  font-size: var(--wf-font-size-xs);
  font-weight: var(--wf-font-weight-bold);
}

.wf-data-table__sort {
  display: inline-flex;
  align-items: center;
  justify-content: inherit;
  gap: var(--wf-space-xs);
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: inherit;
  cursor: pointer;
}

.wf-data-table__row:hover,
.wf-data-table__row:focus-visible {
  background: var(--wf-color-hover);
}

.wf-data-table__row--selected {
  background: var(--wf-color-selected);
}

.wf-data-table__row:last-child .wf-data-table__cell {
  border-bottom: 0;
}

.wf-data-table__cell--start {
  text-align: start;
}

.wf-data-table__cell--center {
  text-align: center;
}

.wf-data-table__cell--end {
  text-align: end;
  font-variant-numeric: tabular-nums;
}
</style>
