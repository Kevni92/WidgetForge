import { describe, expect, it } from 'vitest'
import {
  filterDataTableRows,
  nextDataTableSort,
  processDataTableRows,
  sortDataTableRows,
  visibleDataTableColumns,
  type DataTableColumn,
} from '../src/primitives/data-table'

interface Row {
  id: string
  name: string
  stock: number
  sector: string
}

const rows: Row[] = [
  { id: 'a', name: 'Alpha', stock: 40, sector: 'Core' },
  { id: 'b', name: 'Beta', stock: 10, sector: 'Rim' },
  { id: 'c', name: 'Gamma', stock: 40, sector: 'Core' },
]

const columns: DataTableColumn<Row>[] = [
  { id: 'name', header: 'Name', value: (row) => row.name, sortable: true },
  { id: 'stock', header: 'Stock', value: (row) => row.stock, sortable: true },
  { id: 'sector', header: 'Sector', value: (row) => row.sector },
  { id: 'hidden', header: 'Hidden', value: (row) => row.id, hidden: true },
]

describe('data table model', () => {
  it('filters over visible filterable columns without mutating input rows', () => {
    const filtered = filterDataTableRows(rows, columns, 'core')

    expect(filtered.map((row) => row.id)).toEqual(['a', 'c'])
    expect(rows.map((row) => row.id)).toEqual(['a', 'b', 'c'])
    expect(visibleDataTableColumns(columns).map((column) => column.id)).toEqual(['name', 'stock', 'sector'])
  })

  it('sorts stably and supports descending order', () => {
    expect(sortDataTableRows(rows, columns, { columnId: 'stock', direction: 'asc' }).map((row) => row.id))
      .toEqual(['b', 'a', 'c'])
    expect(sortDataTableRows(rows, columns, { columnId: 'stock', direction: 'desc' }).map((row) => row.id))
      .toEqual(['a', 'c', 'b'])
  })

  it('composes filtering and sorting deterministically', () => {
    const processed = processDataTableRows(rows, columns, 'core', { columnId: 'name', direction: 'desc' })
    expect(processed.map((row) => row.id)).toEqual(['c', 'a'])
  })

  it('cycles a controlled sort between ascending and descending', () => {
    const first = nextDataTableSort(null, 'stock')
    expect(first).toEqual({ columnId: 'stock', direction: 'asc' })
    expect(nextDataTableSort(first, 'stock')).toEqual({ columnId: 'stock', direction: 'desc' })
    expect(nextDataTableSort({ columnId: 'name', direction: 'desc' }, 'stock'))
      .toEqual({ columnId: 'stock', direction: 'asc' })
  })
})
