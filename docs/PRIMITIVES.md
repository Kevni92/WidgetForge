# UI Primitives

WidgetForge primitives are domain-neutral building blocks. They use semantic `--wf-*` theme tokens and do not own game data, navigation targets or window state.

## InfoPopover

`InfoPopover` is an interactive explanatory popover for values, labels and glossary-like terms.

- opens through hover, keyboard focus or click
- content is provided through slots and may contain structured markup
- nested `InfoPopover` instances remain inside the parent interaction tree
- `Escape` closes only the innermost active popover because the key event is consumed at that level
- focus moving inside the current popover does not close it
- placement is explicitly selectable with `top`, `right`, `bottom` or `left`

Because the content may itself be interactive, the panel uses dialog semantics rather than a passive tooltip role. Concrete glossary terms and explanations belong to the consuming product, not the framework.

## Key/value and statistics

`KeyValueGroup` groups compact simulation-style label/value pairs and provides one- or two-column layouts. The compact variant only changes density; at narrow viewport widths the group falls back to one column.

`KeyValueRow` separates label and value into independent slots. Consumers can therefore place an `InfoPopover`, navigation control or any custom renderer on either side without coupling the primitive to those services.

`StatValue` renders a number or string with an optional unit and semantic tone (`neutral`, `success`, `warning`, `danger`, `info`). It uses tabular numbers and accepts an accessible label for abbreviated values.

The row markup uses `dt`/`dd` and is intended to be composed inside `KeyValueGroup`'s `dl` element.

## SimpleTable

`SimpleTable` is the lightweight table for small and medium, already-prepared data sets.

- columns are typed against the row type
- a column can point directly at a row `field` or calculate a value with `value(row)`
- optional `format(value, row)` covers simple textual formatting
- `cell-<columnId>` scoped slots allow arbitrary consumer content such as navigation controls or `InfoPopover`
- native `table`, `th scope="col"`, `tbody` and optional `caption` semantics are retained
- the compact variant only changes density

Sorting, filtering, row selection and other data-grid behavior intentionally do not belong to `SimpleTable`; those capabilities are provided by the separate `DataTable` primitive.

## DataTable

`DataTable` is the controlled table primitive for larger, interactive simulation data sets.

- every row receives a stable consumer-defined ID through `rowId(row)`; array indexes are never used as row identity
- columns declare value extraction, formatting, sorting/filtering capability, visibility and optional custom compare/filter logic
- `sort`, `filterQuery` and `selectedRowId` are controlled values with matching `update:*` events
- sorting and filtering are implemented as pure exported functions and never mutate the input rows
- equal sort values preserve original row order
- headers expose native sort buttons and `aria-sort`
- selectable rows support pointer plus Enter/Space keyboard interaction
- `cell-<columnId>` slots remain available for consumer navigation, `InfoPopover` or other domain renderers
- hidden columns do not participate in display or default filtering
- the table uses a sticky header and computed transformations so rows are processed once per relevant reactive change

The component intentionally does not include a transport, pagination protocol or server-query model. Consumers can perform server-side filtering/sorting by supplying already processed rows and controlling the same public state. Virtualization is not part of the current primitive; it should only be introduced when measured dataset sizes require it.
