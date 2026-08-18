# Commands

WidgetForge-Commands sind eine dünne textuelle Eingabeschicht vor der normalen Widget-Navigation. Der Command-Core enthält keine Spieldomäne und öffnet selbst keine Fenster.

## Definition

Ein Command definiert:

- einen kanonischen Namen,
- optionale Aliases,
- eine Ziel-Widget-ID,
- optionale statische Parameter,
- eine geordnete Liste typisierter Argumente.

Unterstützte Argumenttypen sind `string`, `number` und `boolean`. Argumente werden positional geparst. Pflichtargumente müssen vor optionalen Argumenten stehen. Optionale Argumente können Defaultwerte besitzen.

## Parser

Die Eingabe wird in Command-Name und Argumente zerlegt. Leerzeichen trennen Argumente; einfache und doppelte Anführungszeichen sowie Backslash-Escaping erlauben Werte mit Leerzeichen.

Der Parser liefert ausschließlich einen `NavigationIntent`. Die eigentliche Öffnung erfolgt anschließend über den `WidgetNavigator`, damit Parameterprüfung, Singleton-Verhalten, Lifecycle, Fokus und Z-Reihenfolge weiterhin nur an einer Stelle implementiert bleiben.

## Fehler

Parserfehler sind als `CommandParseError` mit strukturiertem Code verfügbar:

- `empty-input`
- `unknown-command`
- `unterminated-quote`
- `missing-argument`
- `too-many-arguments`
- `invalid-argument`

Ungültige oder kollidierende Command-Definitionen werden bereits beim Registrieren mit `CommandDefinitionError` abgewiesen.

## Architekturgrenze

Konkrete Commands wie `planet`, `market` oder andere Spielbegriffe gehören ausschließlich in die Consumer-Anwendung beziehungsweise in den Playground. WidgetForge stellt nur Registry, Parser und Typkonvertierung bereit.
