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
