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
