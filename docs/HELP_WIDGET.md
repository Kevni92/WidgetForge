# Help- und Reference-Widget

`HelpWidget` ist eine generische WidgetForge-Komponente für die lesende Dokumentation registrierter Widgets und Commands. Sie enthält keine Spieldomäne und pflegt keine eigene Liste von Definitionen.

## Registrierung

Das Help-Widget wird wie jedes andere Widget registriert:

```ts
import { HELP_WIDGET_ID, HelpWidget, defineWidget } from 'widgetforge'

const helpWidget = defineWidget({
  id: HELP_WIDGET_ID,
  title: 'Help & Reference',
  description: 'Browse the available widgets and commands.',
  component: HelpWidget,
})
```

Die Anwendung muss `helpWidget` in dieselbe `WidgetRegistry` aufnehmen wie die übrigen Widgets und kann anschließend einen normalen Command mit `widgetId: HELP_WIDGET_ID` definieren. `WorkspaceHost`, `WindowManagerHost`, `DockHost` und `PaneHost` stellen den Dokumentations-Context aus ihren öffentlichen Registry-Props bereit. Für eigene Host-Strukturen kann ein Consumer alternativ `createWidgetDocumentationProvider(...)` und `provideWidgetDocumentation(...)` verwenden.

```vue
<WorkspaceHost
  :windows="windows"
  :docks="docks"
  :registry="widgets"
  :commands="commands"
/>
```

Das Widget ruft ausschließlich `listDocumentation()` über den öffentlichen Provider auf. Es importiert keine Registry-Maps und kennt weder `WindowManager` noch `DockManager`.

## Verhalten

- Widgets und Commands werden deterministisch nach Titel beziehungsweise Name sortiert.
- Die Suche ist unabhängig von Groß-/Kleinschreibung und durchsucht IDs, Titel, Commandnamen, Aliase, Beschreibungen und Parameternamen.
- Der Filter trennt `All`, `Widgets` und `Commands`.
- Eine Widget-Detailansicht zeigt Beschreibung, zugeordnete Command-Usages sowie typisierte Parameter mit Pflichtigkeit, Default, Beschreibung und Beispiel.
- Eine Command-Detailansicht zeigt Usage, Argumente, Ziel-Widget und Beispiele.
- Usage- und Beispielzeilen können über die Clipboard-API kopiert werden. Es gibt keine direkte Run-Aktion und keine Mutation an Window-/Workspace-Managern.
- Fehlende optionale Metadaten bleiben leer; das Widget erfindet keine Beschreibung.

Die Darstellung verwendet semantische Theme-Tokens, native semantische Tabellen und keyboard-bedienbare Buttons. In schmalen Hosts wechselt sie zwischen Referenzliste und Detailseite; in breiteren Hosts werden beide Bereiche nebeneinander angezeigt.
