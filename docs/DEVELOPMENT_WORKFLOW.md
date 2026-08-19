# Entwicklungs-Workflow

## Grundprinzip

WidgetForge wird **Issue für Issue** umgesetzt. Ein Issue soll einen fachlich klar abgegrenzten, testbaren Schritt liefern. Keine großen Sammel-PRs und kein Scope-Creep.

## Ablauf pro Issue

1. Issue lesen und Abhängigkeiten prüfen.
2. Bestehende Architektur und öffentliche API beachten.
3. Nur den beschriebenen Scope implementieren.
4. Komponenten klein und klar verantwortlich halten.
5. Tests zusammen mit der Implementierung schreiben.
6. Playground aktualisieren, wenn das Feature visuell oder interaktiv demonstrierbar ist.
7. Dokumentation aktualisieren, wenn sich öffentliche API oder Architektur ändert.
8. Lint, Typecheck, Tests und Build müssen erfolgreich sein.
9. Erst danach gilt das Issue als abgeschlossen.

## Definition of Done

Ein Issue ist fertig, wenn:

- Akzeptanzkriterien erfüllt sind,
- relevante Tests vorhanden sind und laufen,
- keine bestehenden Tests gebrochen sind,
- Typecheck und Build erfolgreich sind,
- öffentliche API dokumentiert ist,
- der Playground das Feature zeigt, sofern sinnvoll,
- keine unnötigen Abhängigkeiten oder Domänenkopplungen eingeführt wurden.

`npm run lint` prüft Source-, Test- und Konfigurationsdateien. Verschachtelte generierte Ausgaben wie `**/dist/**`, `**/coverage/**` und `**/node_modules/**` gehören nicht zum Lint-Scope. Ein Build darf das Ergebnis des anschließenden Lint-Laufs nicht verändern.

## Tests

**Jede neue Komponente muss Tests erhalten.** Neue Core-Logik, Composables, Parser und Provider ebenfalls.

Tests sollen Verhalten prüfen und nicht nur Implementierungsdetails spiegeln. Kritische Interaktionen, Lifecycle, Randfälle und Fehlerzustände gehören ausdrücklich dazu.

## GitHub Pages

Der Playground wird statisch gebaut und über GitHub Pages veröffentlicht. Er benötigt keinen Server.

Die Pages-Version ist die fortlaufende visuelle Referenz des Frameworks. Neue UI-Funktionen sollen dort demonstriert werden, sobald sie implementiert sind.

## Änderungen am Konzept

Wenn ein Issue eine grundlegende Architekturentscheidung verändert, werden `docs/CONCEPT.md` und/oder `docs/ARCHITECTURE.md` im selben Arbeitsschritt aktualisiert. Das Repository ist die maßgebliche Projektquelle; Entscheidungen sollen nicht nur in Chat-Verläufen existieren.
