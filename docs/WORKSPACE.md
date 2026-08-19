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
- `restoreWorkspace(manager, input)` akzeptiert das Modell oder JSON und stellt es in einem leeren `WindowManager` wieder her. Mit `{ atomic: true }` wird bei jedem Restore-Problem der gesamte Restore verworfen und der Manager leer gelassen; das ist der vorgesehene Pfad für Persistenz, History und Recovery.

Restore ist pro Fenster fehlertolerant: entfernte Widgets, ungültige Parameter oder beschädigte Einträge werden übersprungen und als `WorkspaceRestoreIssue` zurückgegeben. Ein ungültiges Dokument oder eine nicht unterstützte Workspace-Version wird nicht teilweise geladen.

`captureWorkspace()` und `serializeWorkspace()` validieren zusätzlich den vollständigen Workspace über alle Fenster und Docks. Pane-IDs, Widget-Instanz-IDs, Fokus-/Z-Reihenfolge, Geometrien und Dock-Constraints dürfen keine widersprüchlichen Zustände enthalten. `commitWorkspacePaneMutations()` validiert den vollständigen Zielzustand vor dem Commit und stellt bei einem Fehler den vorherigen Snapshot wieder her.

## Playground

Der Playground speichert den Workspace best-effort in `localStorage`. Beim nächsten Reload wird der atomare Restore verwendet. Bei einem ungültigen Snapshot greift der Playground auf das Default-Layout zurück; der beschädigte Zustand wird nicht aktiviert.
