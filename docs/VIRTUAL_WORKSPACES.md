# Virtuelle Workspaces

`WorkspaceCollectionManager` verwaltet mehrere voneinander unabhängige Workspace-Runtimes. Jede Runtime besitzt einen eigenen `WindowManager` und `DockManager`; damit bleiben Window-IDs, Fokus, Z-Reihenfolge, Pane-Bäume und Dock-State strikt pro Workspace isoliert.

## Öffentliche API

- `createWorkspaceCollection({ registry, storage? })`
- `createWorkspace({ id, name, workspace?, activate? })`
- `renameWorkspace(id, name)`
- `duplicateWorkspace(sourceId, { id, name?, activate? })`
- `deleteWorkspace(id)`
- `activateWorkspace(id)`
- `list()`, `get(id)`, `getActive()` und `getActiveWorkspaceId()`
- `snapshot()` und `subscribe(listener)`

Ein Collection-Snapshot enthält ausschließlich UI-/Workspace-State: Workspace-ID und Name, aktive Workspace-ID sowie den jeweiligen serialisierbaren `WorkspaceSnapshot`. Domain-/Game-Daten und ein geteilter `DataClient` sind ausdrücklich nicht Bestandteil der Persistenz.

Für Browser-Consumer steht `createLocalStorageWorkspaceCollectionStorage(storage, key?)` als optionaler Adapter bereit. Andere Persistenzbackends implementieren lediglich `WorkspaceCollectionStorage.read()` und `write(snapshot)`.

## Lifecycle- und Data-Policy

`WorkspaceCollectionHost` rendert bewusst **nur den aktiven Workspace**. Beim Wechsel wird der vorherige Workspace aus der Vue-Render-Schicht ausgehängt. Die zugehörigen Window-/Dock-Manager und Widget-Lifecycle-Controller bleiben im Collection-State erhalten; beim Zurückwechseln werden dieselben Widget-Instanz-IDs erneut gemountet.

Dadurch gilt für inaktive Workspaces verbindlich:

- sie sind nicht sichtbar und nicht interaktiv,
- Widget-Komponenten sind nicht gemountet,
- `useData()` gibt seine Handles beim Unmount frei,
- Data-Subscriptions ohne weitere aktive Consumer werden dadurch suspendiert,
- beim Reaktivieren werden benötigte Subscriptions erneut aufgebaut,
- Registry und `DataClient` können zwischen allen Workspaces geteilt werden, ohne selbst Teil des Workspace-State zu werden.

Diese Policy verhindert versteckte UI-Arbeit und Datenabonnements in inaktiven virtuellen Desktops. Persistenter komponenteninterner Widget-View-State ist davon getrennt und gehört zur dafür vorgesehenen Widget-View-State-API.

## Fehlerverhalten

Leere IDs/Namen, doppelte IDs, unbekannte Workspaces, Löschen des letzten Workspace, ungültige Snapshots, zukünftige Collection-Versionen und Storage-Fehler liefern `WorkspaceCollectionError` mit stabilem Fehlercode.
