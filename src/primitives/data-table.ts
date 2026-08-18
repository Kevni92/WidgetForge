import type { SimpleTableAlign } from './simple-table'

export type DataTableRowId = string | number
export type DataTableSortDirection = 'asc' | 'desc'

export interface DataTableSort {
  readonly columnId: string
  readonly direction: DataTableSortDirection
}

export interface DataTableColumn<TRow> {
  readonly id: string
  readonly header: string
  readonly value: (row: TRow) => unknown
  readonly align?: SimpleTableAlign
  readonly sortable?: boolean
  readonly filterable?: boolean
  readonly hidden?: boolean
  readonly compare?: (left: TRow, right: TRow) => number
  readonly filterText?: (value: unknown, row: TRow) => string
  readonly format?: (value: unknown, row: TRow) => string | number
}

function normalizedText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).toLocaleLowerCase()
}

function compareValues(left: unknown, right: unknown): number {
  if (left === right) return 0
  if (left === null || left === undefined) return -1
  if (right === null || right === undefined) return 1
  if (typeof left === 'number' && typeof right === 'number') return left - right
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' })
}

export function visibleDataTableColumns<TRow>(columns: readonly DataTableColumn<TRow>[]): readonly DataTableColumn<TRow>[] {
  return columns.filter((column) => !column.hidden)
}

export function filterDataTableRows<TRow>(
  rows: readonly TRow[],
  columns: readonly DataTableColumn<TRow>[],
  query: string,
): readonly TRow[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return [...rows]

  const searchableColumns = visibleDataTableColumns(columns).filter((column) => column.filterable !== false)
  if (searchableColumns.length === 0) return []

  return rows.filter((row) => searchableColumns.some((column) => {
    const value = column.value(row)
    const text = column.filterText ? column.filterText(value, row) : normalizedText(value)
    return text.toLocaleLowerCase().includes(normalizedQuery)
  }))
}

export function sortDataTableRows<TRow>(
  rows: readonly TRow[],
  columns: readonly DataTableColumn<TRow>[],
  sort: DataTableSort | null,
): readonly TRow[] {
  if (!sort) return [...rows]
  const column = columns.find((candidate) => candidate.id === sort.columnId && candidate.sortable !== false)
  if (!column) return [...rows]

  const direction = sort.direction === 'asc' ? 1 : -1
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const compared = column.compare
        ? column.compare(left.row, right.row)
        : compareValues(column.value(left.row), column.value(right.row))
      return compared === 0 ? left.index - right.index : compared * direction
    })
    .map(({ row }) => row)
}

export function processDataTableRows<TRow>(
  rows: readonly TRow[],
  columns: readonly DataTableColumn<TRow>[],
  query: string,
  sort: DataTableSort | null,
): readonly TRow[] {
  return sortDataTableRows(filterDataTableRows(rows, columns, query), columns, sort)
}

export function nextDataTableSort(current: DataTableSort | null, columnId: string): DataTableSort {
  if (current?.columnId !== columnId) return { columnId, direction: 'asc' }
  return { columnId, direction: current.direction === 'asc' ? 'desc' : 'asc' }
}
