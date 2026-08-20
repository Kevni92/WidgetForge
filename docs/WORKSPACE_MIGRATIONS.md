# Workspace-Migrationen

Persistierte Workspace-Dokumente werden ausschließlich über die zentrale `WorkspaceMigrationRegistry` auf das aktuelle `WORKSPACE_VERSION` gebracht. `restoreWorkspace()` behandelt ältere Versionen nicht mehr separat: Es parst zuerst das Dokument, führt alle registrierten Migrationen aus und validiert anschließend ausschließlich das aktuelle Format.

## Verbindlicher Workflow bei einer neuen Workspace-Version

1. `WORKSPACE_VERSION` genau um eins erhöhen.
2. Eine pure Migration `vN -> vN+1` implementieren und in `createDefaultWorkspaceMigrationRegistry()` registrieren.
3. Ein reales Fixture des vorherigen Formats unter `tests/fixtures/` ergänzen bzw. beibehalten.
4. Unit-Tests für den einzelnen Schritt und eine mehrstufige Migration bis zur aktuellen Version ergänzen.
5. Restore-Tests aus alten Fixtures bis in echte `WindowManager`-/`DockManager`-Instanzen ausführen.
6. Änderungen des Formats und notwendige Default-Werte dokumentieren.

Versionssprünge wie `vN -> vN+2` sind nicht zulässig. Die Registry akzeptiert ausschließlich benachbarte Schritte und führt sie deterministisch in aufsteigender Reihenfolge aus. Fehlt ein Schritt, schlägt die Migration mit `missing-path` fehl. Ein Dokument mit einer höheren als der unterstützten Version wird mit `future-version` abgelehnt und niemals stillschweigend interpretiert.

## Anforderungen an Migrationen

Migrationen sind pure Funktionen auf JSON-serialisierbaren Objekten. Sie dürfen insbesondere keine Vue-Komponenten, DOM-Objekte, Registry-, DataClient-, WindowManager- oder DockManager-Referenzen verwenden. Eingaben werden vor jedem Schritt serialisierbar geklont; das Originaldokument bleibt unverändert. Auch das Ergebnis jedes Schritts muss serialisierbar sein und exakt die erwartete Folgeversion tragen.

Unbekannte, serialisierbare Erweiterungsfelder sollen standardmäßig erhalten bleiben, sofern ihre Entfernung nicht ausdrücklich Teil einer Formatänderung ist. Domain-/Game-Daten gehören weiterhin nicht in das Workspace-Format; falls ältere Dokumente zusätzliche Felder enthalten, verändert die Migration diese nicht unbeabsichtigt.

## Bestehende Migrationen

### v1 → v2

Das ursprüngliche v1-Format enthielt nur Widget-ID, Parameter, Geometrie, Modus, Fokus und Z-Reihenfolge eines Fensters. Die Migration erzeugt daraus den v2-Window-/Pane-Aufbau. Weil Migrationen keine Widget Registry verwenden dürfen, werden fehlende UI-Metadaten deterministisch aus serialisierbaren Defaults erzeugt: Der Fenstertitel wird aus der gespeicherten Widget-ID abgeleitet, Constraints verwenden die damaligen Plattform-Minimalwerte und Window-Optionen die neutralen Standardwerte.

### v2 → v3

v3 ergänzt die mit #85 eingeführten Pane-Fähigkeiten, bleibt für bestehende v2-Pane-Dokumente strukturell kompatibel und normalisiert einen fehlenden Dock-Bereich auf `docks: []`. `layoutLocked` und `layoutSpec` sind in v3 optionale, rückwärtskompatible Window-Felder. Eine fehlende Eigenschaft wird beim Parsen als `false` beziehungsweise als fehlender responsiver Vertrag interpretiert; dafür ist keine zusätzliche Versionsmigration erforderlich. Responsive Verträge werden erst gegen die aktuelle Floating-Größe aufgelöst.

## Fehlercodes

`WorkspaceMigrationError` unterscheidet unter anderem `invalid-document`, `invalid-version`, `invalid-step`, `duplicate-step`, `future-version`, `missing-path`, `migration-failed` und `non-serializable-result`. `restoreWorkspace()` übersetzt Future-Versionen in `unsupported-version`, strukturell ungültige Eingaben in `invalid-workspace` und fehlerhafte bzw. unvollständige Migrationspfade in `migration-failed`.
