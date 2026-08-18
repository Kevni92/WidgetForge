export type SimpleTableAlign = 'start' | 'center' | 'end'

type SimpleTableColumnBase<TRow> = {
  id: string
  header: string
  align?: SimpleTableAlign
  format?: (value: unknown, row: TRow) => string | number
}

export type SimpleTableColumn<TRow> = SimpleTableColumnBase<TRow> & (
  | { field: keyof TRow; value?: never }
  | { field?: never; value: (row: TRow) => unknown }
)
