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

## Production behavior

DevTools is a normal exported component, not part of `WorkspaceHost` or another runtime host. Consumers decide whether to import/mount it and whether `enabled` can ever become true. When disabled it renders nothing and does not install its shortcut or runtime observers.

The Playground exposes this explicitly as **Developer Mode** and then uses `Ctrl+Shift+D` to show/hide the diagnostics panel.
