# AGENTS.md

Diese Datei enthält verbindliche Arbeitsregeln für Menschen und KI-Agenten, die an WidgetForge arbeiten.

## Projektziel

WidgetForge ist eine wiederverwendbare Vue-3-/TypeScript-Library für fensterbasierte Widget-UIs in komplexen Browser- und Simulationsspielen.

Vor Implementierungen zuerst lesen:

- `docs/CONCEPT.md`
- `docs/ARCHITECTURE.md`
- `docs/DEVELOPMENT_WORKFLOW.md`
- das aktuell zu bearbeitende GitHub Issue

## Verbindliche Regeln

### Issue-getrieben arbeiten

- Immer genau ein klar abgegrenztes Issue bearbeiten.
- Kein Scope-Creep und keine vorsorglichen Features außerhalb des Issues.
- Abhängige Issues nicht nebenbei vorziehen.
- Wenn eine Architekturänderung nötig wird, Dokumentation im selben Arbeitsschritt anpassen.

### Kleine Komponenten

- Jede Komponente hat eine klar benennbare Verantwortung.
- Komponenten werden nach Verantwortung und Verhalten geschnitten, nicht nach willkürlichen Zeilengrenzen.
- Keine monolithischen Komponenten, die Window-Management, Datenbeschaffung und fachliche Darstellung gleichzeitig übernehmen.
- Wiederverwendbare Logik gehört in kleine Services/Composables/Core-Module, wenn dadurch Verantwortung sauberer wird.

### Tests sind Pflicht

- **Jede neue Vue-Komponente bekommt Tests.**
- Neue Core-Logik, Composables, Parser, Stores und Provider bekommen ebenfalls Tests.
- Tests müssen relevantes Verhalten, Randfälle und Fehlerzustände abdecken.
- Ein Feature ohne passende Tests ist nicht fertig.
- Bestehende Tests dürfen nicht entfernt oder abgeschwächt werden, nur um eine Änderung grün zu bekommen.

### Architekturgrenzen

- Framework-Code enthält keine konkrete Spiellogik.
- Keine fest eingebauten Domänenobjekte wie Planet, Schiff oder Ware im Framework-Core.
- Widgets kommunizieren nicht direkt miteinander.
- Widget-Navigation läuft über Framework-Schnittstellen.
- Widgets öffnen/verwalten Fenster nicht über interne Implementierungsdetails des Window Managers.
- Widgets verwalten keine WebSockets selbst.
- Externe Daten werden über die abstrakte Data API konsumiert.
- UI-/Workspace-State und fachliche Daten bleiben getrennt.

### Styling

- Keine produktbezogenen Farben, Fonts, Abstände oder ähnlichen Werte hart in generische Komponenten schreiben.
- Visuelle Entscheidungen werden über semantische Design Tokens abgebildet.
- Komponenten müssen auch mit stark abweichenden Themes funktionieren.

### Öffentliche API

- Öffentliche APIs klein und typisiert halten.
- Keine internen Implementierungsdetails exportieren, wenn sie für Consumer nicht benötigt werden.
- Breaking Changes bewusst behandeln und dokumentieren.

### Playground

- Der Playground nutzt ausschließlich die öffentliche WidgetForge-API.
- Keine Demo-Sonderwege, die ein echtes Consumer-Projekt nicht ebenfalls verwenden könnte.
- Sichtbare/interaktive Features werden im Playground demonstriert.
- Der Playground muss statisch baubar und für GitHub Pages geeignet bleiben.

## Prüfung vor Abschluss

Vor Abschluss eines Issues müssen mindestens erfolgreich sein:

1. Tests
2. Typecheck
3. Lint
4. Build
5. Playground-Build

Zusätzlich prüfen:

- Akzeptanzkriterien des Issues erfüllt?
- Neue Komponenten getestet?
- Architekturgrenzen eingehalten?
- Dokumentation bei API-/Architekturänderungen aktualisiert?
- Playground bei sichtbaren Features ergänzt?

## Nicht tun

- Keine frei verankerten Button-/Bubble-/Anchor-Shortcut-Systeme implementieren.
- Kein Backend oder Game-Server in dieses Repository einbauen.
- Kein konkretes Spielprotokoll im Framework fest verdrahten.
- Keine Businesslogik in generische UI-Komponenten verschieben.
- Keine große externe UI-Library einführen, die das Kernverhalten von WidgetForge übernimmt, ohne dass dies ausdrücklich als Architekturentscheidung beschlossen wurde.
