# WidgetForge DevTools

WidgetForge DevTools is an opt-in diagnostics surface for development and tests. It is never mounted or enabled automatically by the framework.

## Read-only diagnostics

`captureWidgetForgeDevToolsSnapshot(windows, docks?, dataClient?)` builds a detached snapshot from public manager APIs. It contains:

- workspace serialization snapshot;
- windows with instance ID, focus, z-order, layer, role, mode and geometry;
- docks with position, thickness and root pane ID;
- flattened pane trees with owner, parent/path, widget ID and widget instance ID;
- optional `DataClient` diagnostics.

The snapshot exposes data only; it contains no manager references or mutation functions.

`DataClient.diagnostics()` reports resource keys, loading/ready/error status, consumer counts, subscription/cache state and pending eviction. Domain values are intentionally omitted. `subscribeDiagnostics()` is a read-only notification hook for tools.

## Overlay

```vue
<DevToolsOverlay
  :enabled="developerMode"
  :windows="windows"
  :docks="docks"
  :data-client="dataClient"
/>
```

The default shortcut is `Ctrl+Shift+D`; `shortcut` is configurable. The shortcut only exists while `enabled` is true. Disabling the component closes the panel, removes visual marks and unregisters global listeners/subscriptions.

The panel inspects windows, docks, pane trees, DataClient resources and optional live Workspace JSON. The JSON can be copied to the clipboard.

## Visual workspace diagnostics

While open, the overlay reads the public DOM data attributes emitted by WidgetForge renderers:

- `[data-pane-id]` for pane ID/kind, measured bounds and focus;
- `[data-window-instance-id]` for instance ID, z-index and layer;
- `[data-docking-active-zone]` for the currently rendered docking/drop target.

It draws independent fixed-position diagnostic outlines. It does not modify workspace, pane, window, dock or data state. A `target` element can scope DOM inspection to a particular workspace root.

The visual overlay provides three modes:

- **All bounds** keeps the complete overview;
- **Selected node** isolates the node selected in the panel;
- **Hovered node** temporarily highlights the node below the pointer.

Window, dock, pane and widget-host bounds can be filtered independently. Selecting an entry in the Windows, Docks, Pane tree or Widget hosts section synchronizes the panel selection with the corresponding visual mark. Labels use deterministic offsets and place compact-node labels outside the marked rectangle when necessary so nested layouts remain readable.

Visual marks use `pointer-events: none` by default. The **Inspect bounds** control explicitly enables pointer selection on the marks; normal workspace pointer interaction remains untouched otherwise. Inspecting and selecting are local to the DevTools component and do not update workspace history, persistence or runtime state.

## Production behavior

DevTools is a normal exported component, not part of `WorkspaceHost` or another runtime host. Consumers decide whether to import/mount it and whether `enabled` can ever become true. When disabled it renders nothing and does not install its shortcut or runtime observers.

The Playground exposes this explicitly as **Developer Mode** and then uses `Ctrl+Shift+D` to show/hide the diagnostics panel.
