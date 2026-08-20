# Commands

WidgetForge-Commands sind eine dünne textuelle Eingabeschicht vor der normalen Widget-Navigation. Der Command-Core enthält keine Spieldomäne und öffnet selbst keine Fenster.

## Definition

Ein Command definiert:

- einen kanonischen Namen,
- optionale Aliases,
- eine Ziel-Widget-ID,
- optionale statische Parameter,
- eine geordnete Liste typisierter Argumente.

Für Discovery und Help kann ein Command zusätzlich `description`, `category` und textuelle `examples` tragen. Argumente können mit `description` und einem typkompatiblen `example` ergänzt werden. Die Typ-, Pflicht- und Defaultangaben bleiben direkt am Argument und werden nicht in einem parallelen Dokumentationsschema wiederholt.

Unterstützte Argumenttypen sind `string`, `number` und `boolean`. Argumente werden positional geparst. Pflichtargumente müssen vor optionalen Argumenten stehen. Optionale Argumente können Defaultwerte besitzen.

## Parser

Die Eingabe wird in Command-Name und Argumente zerlegt. Leerzeichen trennen Argumente; einfache und doppelte Anführungszeichen sowie Backslash-Escaping erlauben Werte mit Leerzeichen.

Der Parser liefert ausschließlich einen `NavigationIntent`. Die eigentliche Öffnung erfolgt anschließend über den `WidgetNavigator`, damit Parameterprüfung, Singleton-Verhalten, Lifecycle, Fokus und Z-Reihenfolge weiterhin nur an einer Stelle implementiert bleiben.

## CommandInput

Die Framework-Komponente `CommandInput` verbindet ausschließlich zwei öffentliche Abstraktionen:

1. `CommandRegistry.parse()` erzeugt einen `NavigationIntent`.
2. `WidgetNavigator.navigate()` führt diesen Intent über die normale Widget-Navigation aus.

Die Komponente kennt weder `WindowManager` noch `WidgetRegistry` und enthält keine fachlichen Commands. Consumer übergeben ihre eigene Command Registry und einen Navigator. Erfolgreiche Ausführung leert die Eingabe und zeigt neutrales Feedback; Parser- und Navigationsfehler werden als zugänglicher Fehlerzustand dargestellt und die Eingabe bleibt zur Korrektur erhalten.

Der Fehlerzustand ist direkt mit dem Eingabefeld verknüpft: Das Feld erhält `aria-invalid`, `aria-describedby` und `aria-errormessage`; die Fehlermeldung wird tokenbasiert hervorgehoben und absolut positioniert, damit die umgebende kompakte Zeile nicht springt. Eine separate assertive Live-Region kündigt nur neue Fehlermeldungen an. Wird die Eingabe verändert, wird der alte Fehler entfernt und kann nach einem erneuten Submit wieder angekündigt werden. Ein erfolgreicher Submit setzt den Fehlerzustand zurück.

## Fehler

Parserfehler sind als `CommandParseError` mit strukturiertem Code verfügbar:

- `empty-input`
- `unknown-command`
- `unterminated-quote`
- `missing-argument`
- `too-many-arguments`
- `invalid-argument`

Ungültige oder kollidierende Command-Definitionen werden bereits beim Registrieren mit `CommandDefinitionError` abgewiesen.

`CommandRegistry.getDocumentation(nameOrAlias)` und `listDocumentation()` liefern eine reine normalisierte Ansicht mit Aliasen, Argumentmetadaten und einer abgeleiteten `usage`-Zeichenkette. `get()` und `list()` geben Kopien der Definitionen zurück und sind damit für lesende Discovery- und Devtools-Integrationen geeignet. Die Reihenfolge entspricht der Registrierungsreihenfolge.

Das öffentliche `HelpWidget` nutzt diese Ansichten automatisch, wenn es über einen Widget-/Workspace-Host gerendert wird. Ein Consumer muss nur das Widget registrieren und einen Command auf dessen `HELP_WIDGET_ID` definieren; eine separate Help-Liste ist nicht erforderlich.

## Architekturgrenze

Konkrete Commands wie `planet`, `market` oder andere Spielbegriffe gehören ausschließlich in die Consumer-Anwendung beziehungsweise in den Playground. WidgetForge stellt Registry, Parser, die generische Eingabekomponente und die Verbindung zur Navigation bereit.

## Launcher-Fenster

`WorkspaceHost` bietet eine generische `New window`-Aktion. Sie öffnet über `WindowManager.openEmptyWindow()` ein normales Floating-Window mit einem framework-eigenen Launcher-Root; Consumer müssen dafür kein Dummy-Widget registrieren. Übergibt der Host eine `CommandRegistry` über `commands`, wird der Launcher automatisch fokussiert.

```vue
<WorkspaceHost
  :windows="windows"
  :docks="docks"
  :registry="widgets"
  :commands="commands"
/>
```

Die Navigation des Launcher-Roots nutzt dieselbe `CommandRegistry` und dieselbe Widget-Parameterprüfung wie die normale Widget-Navigation. Der typisierte `WidgetNavigationContext` markiert das aktuelle Launcher-Fenster als Ziel; ein erfolgreicher Command ersetzt nur dessen Root-Pane. Fensterinstanz, Geometrie, Optionen, Fokus und Z-Reihenfolge bleiben erhalten. Ein ungültiger Command verändert den Workspace nicht und lässt die Eingabe für die Korrektur fokussiert.

Der leere Launcher zeigt ausschließlich die normale `CommandInput`-Zeile mit Eingabefeld und `Open`-Aktion. Überschrift und Einführungstext gehören nicht zum Launcher-Inhalt; seine Oberfläche nutzt die normalen semantischen Window-/Pane-Surfaces.
