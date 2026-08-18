# Workspace Persistence

Der Workspace speichert ausschließlich fensterbezogenen UI-Zustand. Er ist bewusst von fachlichen Spiel- und Live-Daten getrennt.

## Persistierter Zustand

- Widget-ID und Instanz-ID
- bereits validierte Widget-Parameter
- Position und Größe
- Fensterstatus `normal` oder `minimized`
- Z-/Fokusreihenfolge

Nicht persistiert werden Runtime-Lifecycle-Objekte, Manifest-Constraints, Komponenteninstanzen, Provider-/Transportzustand oder fachliche Daten. Beim Restore werden aktuelle Manifest-Metadaten und Constraints erneut verwendet.

## API

- `captureWorkspace(manager)` erzeugt das versionierte, serialisierbare Modell.
- `serializeWorkspace(manager)` erzeugt JSON.
- `restoreWorkspace(manager, input)` akzeptiert das Modell oder JSON und stellt es in einem leeren `WindowManager` wieder her.

Restore ist pro Fenster fehlertolerant: entfernte Widgets, ungültige Parameter oder beschädigte Einträge werden übersprungen und als `WorkspaceRestoreIssue` zurückgegeben. Ein ungültiges Dokument oder eine nicht unterstützte Workspace-Version wird nicht teilweise geladen.

## Playground

Der Playground speichert den Workspace best-effort in `localStorage`. Beim nächsten Reload werden gültige Fenster wiederhergestellt. Stale Einträge werden beim Restore verworfen und der bereinigte Workspace anschließend erneut gespeichert.
