<script setup lang="ts" generic="TRow">
import type { SimpleTableColumn } from './simple-table'

const props = withDefaults(defineProps<{
  rows: readonly TRow[]
  columns: readonly SimpleTableColumn<TRow>[]
  caption?: string
  ariaLabel?: string
  compact?: boolean
}>(), {
  caption: '',
  compact: false,
})

function rawValue(column: SimpleTableColumn<TRow>, row: TRow): unknown {
  return 'value' in column && column.value ? column.value(row) : row[column.field]
}

function displayValue(column: SimpleTableColumn<TRow>, row: TRow): string | number {
  const value = rawValue(column, row)
  if (column.format) return column.format(value, row)
  if (value === null || value === undefined) return ''
  return typeof value === 'string' || typeof value === 'number' ? value : String(value)
}
</script>

<template>
  <div class="wf-simple-table__scroller">
    <table
      class="wf-simple-table"
      :class="{ 'wf-simple-table--compact': props.compact }"
      :aria-label="props.ariaLabel"
    >
      <caption v-if="props.caption" class="wf-simple-table__caption">
        {{ props.caption }}
      </caption>
      <thead>
        <tr>
          <th
            v-for="column in props.columns"
            :key="column.id"
            scope="col"
            class="wf-simple-table__header"
            :class="`wf-simple-table__cell--${column.align ?? 'start'}`"
          >
            {{ column.header }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, rowIndex) in props.rows" :key="rowIndex" class="wf-simple-table__row">
          <td
            v-for="column in props.columns"
            :key="column.id"
            class="wf-simple-table__cell"
            :class="`wf-simple-table__cell--${column.align ?? 'start'}`"
          >
            <slot
              :name="`cell-${column.id}`"
              :row="row"
              :column="column"
              :value="rawValue(column, row)"
              :row-index="rowIndex"
            >
              {{ displayValue(column, row) }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.wf-simple-table__scroller {
  max-width: 100%;
  overflow: auto;
  border: 1px solid var(--wf-color-border);
  border-radius: var(--wf-radius-md);
}

.wf-simple-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--wf-color-surface);
  color: var(--wf-color-text);
  font-size: var(--wf-font-size-sm);
}

.wf-simple-table__caption {
  padding: var(--wf-space-sm) var(--wf-space-md);
  color: var(--wf-color-text-muted);
  font-weight: var(--wf-font-weight-medium);
  text-align: start;
  caption-side: top;
}

.wf-simple-table__header,
.wf-simple-table__cell {
  padding: var(--wf-space-sm) var(--wf-space-md);
  border-bottom: 1px solid var(--wf-color-border);
  vertical-align: middle;
}

.wf-simple-table--compact .wf-simple-table__header,
.wf-simple-table--compact .wf-simple-table__cell {
  padding: var(--wf-space-xs) var(--wf-space-sm);
}

.wf-simple-table__header {
  background: var(--wf-color-surface-raised);
  color: var(--wf-color-text-muted);
  font-size: var(--wf-font-size-xs);
  font-weight: var(--wf-font-weight-bold);
}

.wf-simple-table__row:last-child .wf-simple-table__cell {
  border-bottom: 0;
}

.wf-simple-table__row:hover {
  background: var(--wf-color-hover);
}

.wf-simple-table__cell--start {
  text-align: start;
}

.wf-simple-table__cell--center {
  text-align: center;
}

.wf-simple-table__cell--end {
  text-align: end;
  font-variant-numeric: tabular-nums;
}
</style>
