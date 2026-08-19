# Command Palette

WidgetForge provides a generic, keyboard-first command palette that aggregates executable items without coupling the UI component to window, workspace or domain internals.

## Architecture

The feature has two layers:

- `CommandPaletteRegistry` is DOM-independent. It owns providers, validates item identity, aggregates items and performs deterministic search/ranking.
- `CommandPalette` is the Vue renderer. It handles the global shortcut, dialog/focus behavior, keyboard navigation and execution of the selected public item.

The component only calls `CommandPaletteItem.execute()`. It never reaches into `WindowManager`, `DockManager` or consumer state.

## Items and providers

```ts
import {
  createCommandPaletteProvider,
  createCommandPaletteRegistry,
} from 'widgetforge'

const provider = createCommandPaletteProvider('workspace-actions', () => [
  {
    id: 'workspace:reset',
    label: 'Reset workspace',
    category: 'Workspace',
    keywords: ['layout', 'default'],
    execute: resetWorkspace,
  },
])

const palette = createCommandPaletteRegistry([provider])
```

Providers may return different items on every read. This is the intended integration for dynamic workspace state, entity search or other consumer-owned sources. Provider IDs and item IDs must be unique inside one registry.

`CommandPaletteItem` supports:

- `id`
- `label`
- `category`
- optional `keywords`
- optional `shortcut`
- optional `icon`
- optional integer `priority`
- optional `disabled`
- `execute()`

## Built-in adapters

WidgetForge exposes adapters for existing public APIs:

- `createCommandRegistryPaletteProvider(commands, navigator)` exposes registered `CommandRegistry` definitions. Commands that still require user arguments remain discoverable but disabled.
- `createWidgetRegistryPaletteProvider(registry, navigator)` exposes registered widgets. A widget is enabled when its parameter schema can be resolved from defaults alone.
- `createWidgetActionPaletteProvider(bindings)` exposes visible `WidgetActionBinding` instances and delegates execution to their existing binding.

Workspace/layout/global framework actions are intentionally consumer-owned providers. This keeps the palette independent from any particular workspace manager composition.

## Search and ordering

Search is dependency-free and deterministic. Each whitespace-separated query token must match at least one of label, item ID, category or keywords. Exact and prefix matches rank ahead of substring matches; subsequence/fuzzy matches are a fallback. Ties use `priority` descending, then category, label and ID.

An empty query sorts by priority and the same deterministic tie-breakers.

## Vue component

```vue
<CommandPalette :registry="palette" shortcut="Ctrl+K" />
```

The default shortcut is `Ctrl+K`. The component exposes `open()`, `close()` and `toggle()` methods for explicit launch buttons.

Keyboard/accessibility behavior:

- opening focuses the search combobox;
- Arrow Up/Down moves the active result and skips disabled items;
- Enter executes the active result;
- Escape closes the dialog;
- Tab/Shift+Tab remain trapped inside the modal dialog;
- focus is restored to the previously focused element on close;
- dialog, combobox, listbox and option semantics are exposed through ARIA.

## Consumer search providers

Domain-specific entity search belongs outside WidgetForge. A consumer may register a provider whose items search planets, documents, users or any other domain model and execute through that consumer's public navigation/service layer. WidgetForge does not interpret those values.
