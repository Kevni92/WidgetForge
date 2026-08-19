# Playground Reference Application

The WidgetForge playground is a serverless reference application, not a component gallery. Its domain model lives exclusively under `playground/` and consumes only the public `widgetforge` / `widgetforge/style.css` API.

## Economy flow

The reference scenario models three locations (`ARC-01`, `ARC-02`, `ARC-03`) and the workflow:

`Location -> Production -> Inventory -> Market -> Orders`

`playground/src/economic-domain.ts` owns the deterministic demo data. The library does not know these domain types.

Production, Inventory, Market and Orders all acquire the same `demo.economy/network` Data API resource. The shared `DataClient` therefore supplies one cached/subscribed resource to multiple widgets. Each widget derives the currently selected location from the Global Selection Context rather than communicating with another widget.

## Interaction model

- The topbar publishes the active location through the `operations/colony` selection channel.
- Production, Inventory, Market and Orders follow that selection; linked widgets can use persistent follow/pin state via Widget View State.
- Inventory persists filter/sort UI state independently from Workspace persistence.
- The default workspace combines a snapped Market window with a split economy window and Inventory/Orders tabs.
- Commands and the global Command Palette can open Production, Inventory, Market and Orders.
- The topbar also exposes a utility/always-on-top telemetry window, a chrome-less Quick Command overlay and a modal review dialog so the semantic surface/elevation states can be inspected in both Forge themes.
- Staging an order emits a WidgetForge notification.
- `Fail feed` calls `MockDataProvider.fail()` for the shared economy resource. Every active consumer transitions to the public error state. `Reconnect` calls `recover()` and restores the live snapshot without remounting widgets.
- Developer Mode exposes the WidgetForge DevTools overlay against the same Workspace and DataClient.
- Named layouts, virtual desktops, window groups, edit/lock mode, snap, docking and persisted workspace/view state remain part of the same reference application.

## Determinism and tests

The economy snapshot has fixed seed data and a deterministic `advanceEconomy(snapshot, tick)` function. No backend, clock-based random values or network requests are required.

Playground tests cover:

- deterministic domain updates,
- one location selection updating Production, Inventory and Market together,
- shared-feed failure and recovery,
- split/tab composition,
- Inventory View State interaction,
- order notifications,
- existing workspace reload/layout persistence and production build gates.
