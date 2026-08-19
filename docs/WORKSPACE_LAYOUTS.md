# Workspace Layout Presets

WidgetForge unterstützt mehrere benannte Layout-Konfigurationen innerhalb desselben Workspace. Ein Layout-Preset enthält ausschließlich serialisierbaren Workspace-/UI-State und keine externen Game-/Domain-Daten.

## Modell

`WorkspaceLayoutPreset` enthält:

- einen eindeutigen Namen,
- eine Preset-Schema-Version,
- einen vollständigen `WorkspaceSnapshot` mit Windows, Docks, Pane-Bäumen, Tabs, Window-Optionen, Geometrie, Snap-/Maximized-/Minimized-State und Pane-Constraints.

Das Preset referenziert keine DataClients, Provider, Domain-Stores oder Transportzustände. Domain-Daten bleiben deshalb beim Layoutwechsel unverändert außerhalb des Layout-Systems.

## WorkspaceLayoutManager

`createWorkspaceLayoutManager()` erhält explizit `WidgetRegistry`, `WindowManager` und optional `DockManager` sowie ein optionales Persistenzbackend.

Die öffentliche API umfasst insbesondere:

- `saveLayout(name)`
- `loadLayout(name)`
- `listLayouts()`
- `deleteLayout(name)`
- `renameLayout(name, nextName)`
- `duplicateLayout(name, copyName)`
- `setDefaultLayout(name)` / `loadDefaultLayout()`

Namen werden getrimmt und dürfen nicht leer sein. Speichern auf einen vorhandenen Namen erzeugt standardmäßig `name-conflict`; bewusstes Überschreiben ist mit `overwrite: true` möglich. Unbekannte Namen liefern `not-found`.

## Deterministischer Layoutwechsel

Beim Laden wird der aktuelle Workspace gegen das Preset abgeglichen:

1. Fenster, die im Ziel nicht existieren, werden geschlossen.
2. Kompatible Fenster mit derselben Instanz-ID werden in-place auf Pane-Baum, Optionen, Geometrie und Mode gebracht. Ihre Window-/Widget-Lifecycle-Instanz bleibt erhalten.
3. Nur strukturell inkompatible Fenster werden geschlossen und aus dem Preset neu geöffnet.
4. Fokus-/Z-Reihenfolge wird anschließend deterministisch hergestellt.
5. Kompatible Docks werden ebenfalls in-place aktualisiert; inkompatible Docks oder eine geänderte Dock-Reihenfolge werden strukturell neu aufgebaut.

Damit verursacht eine reine Layoutänderung keinen unnötigen Widget-Remount. Ein Remount bleibt dort erlaubt und notwendig, wo sich die gehostete Struktur tatsächlich ändert.

## Persistenz

Persistenz ist Consumer-Verantwortung. Der Core kennt nur:

`WorkspaceLayoutStorage.read()` und `WorkspaceLayoutStorage.write(snapshot)`.

WidgetForge liefert zusätzlich `createLocalStorageWorkspaceLayoutStorage(storage, key)` als kleinen optionalen Browser-Adapter. Die `Storage`-Instanz wird bewusst injiziert; der Core greift nie selbst auf `window.localStorage` zu.

## Versionierung und Migration

Aktuell gelten:

- `WORKSPACE_LAYOUT_PRESET_VERSION = 1`
- `WORKSPACE_LAYOUT_COLLECTION_VERSION = 1`
- Workspace-Snapshots werden beim Einlesen über die bestehende Workspace-Restore-Pipeline auf das aktuelle Workspace-Schema normalisiert.

Für bestehende Daten werden auch legacy Collections ohne Collection-Version, rohe Preset-Arrays sowie Presets ohne Preset-Version akzeptiert. Workspace-Snapshots der bereits unterstützten älteren Workspace-Versionen werden über `restoreWorkspace()` migriert.

Unbekannte zukünftige Collection-/Preset-/Workspace-Versionen liefern einen definierten `unsupported-version`-Fehler. Ungültige Presets liefern `invalid-preset` bzw. `restore-failed`; Persistenzfehler werden als `storage-failed` gekapselt.

## Playground

Der Playground verwendet den LocalStorage-Adapter und demonstriert drei benannte Presets:

- `Default`
- `Trading`
- `Operations`

Sie verwenden dieselben öffentlichen APIs wie ein externer Consumer.
