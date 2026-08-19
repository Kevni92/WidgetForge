# Widget Actions

Widget Actions trennen deklarative Bedienaktionen von Window-, Pane- und Dock-Chrome. Ein Widget beschreibt **was** angeboten und ausgeführt werden soll; generische Shell-Komponenten entscheiden nur über Darstellung, Gruppierung, Overflow und Accessibility.

## Contract

`WidgetAction` enthält mindestens `id`, `label` und einen Icon-Key bzw. ein darstellbares Icon-Token. Optional stehen `shortcut`, `tone`, `group`, `priority`, `alwaysVisible`, `overflowOnly`, `pressed`, `disabled`, `visible` und ein `target` zur Verfügung. `alwaysVisible` reserviert eine Action für die primäre Darstellung; `overflowOnly` hält sie ausschließlich im Overflow. Gruppen werden bei der Platzverteilung als Einheit behandelt, soweit der verfügbare Platz dies zulässt.

Unterstützte Targets:

- `navigation`: ein `NavigationIntent`, das über den vorhandenen `WidgetNavigator` ausgeführt wird,
- `command`: eine Command-Referenz, die ein Consumer über `provideWidgetActionExecutor()` auflösen kann,
- `callback`: eine Consumer-Callback-Referenz, ebenfalls über den Action Executor.

Businesslogik oder `WindowManager`-/`DockManager`-Zugriffe gehören nicht in die generische Toolbar.

## Statische und dynamische Actions

Statische Actions werden direkt in `defineWidget({ actions: [...] })` deklariert. Für zustandsabhängige Actions stellt `useWidgetContext().actions` folgende Runtime-API bereit:

- `items` – reaktive, aktuell aufgelöste Action-Liste,
- `register(action, handler?)` – registriert eine Action für die aktuelle Widget-Instanz und liefert einen Disposer,
- `setState(actionId, patch)` – aktualisiert unter anderem Label, Icon, Tone, Visible oder Disabled ohne Widget-Remount,
- `execute(actionId)` – führt dieselbe Action-Pipeline aus, die auch Chrome verwendet.

Ein lokal registrierter Handler läuft im Widget-Kontext und erhält nur Instanz-ID, Widget-ID und validierte Parameter. Für Navigation, Commands und Consumer-Callbacks werden ausschließlich die kontrollierten Execution-Services verwendet.

## Chrome-Rendering

`WidgetActionToolbar` ist der gemeinsame Renderer. Root-Widget-Fenster zeigen Actions in der Window-Titlebar. Widget-Panes in zusammengesetzten Layouts und Docks verwenden denselben Renderer als Pane-Toolbar. Dadurch bleiben Contract, Disabled/Visible-State, Tooltips und Keyboard-Verhalten identisch.

Die Toolbar sortiert nach `priority`, misst ihre verfügbare Breite bzw. Höhe über den Host und verschiebt weniger priorisierte Actions deterministisch in ein Overflow-Menü. `maxVisible` bleibt als optionale Obergrenze für kompakte Chrome bestehen; `PaneHost` passt sie an die gemessene Pane-Breite an. Hidden Actions werden nicht gerendert; Disabled Actions bleiben sichtbar, aber nicht ausführbar. Das Menü wird außerhalb potenziell clip-pender Dock-Flächen gerendert und verwendet weiterhin dieselben `WidgetActionBinding`-Instanzen, sodass die Ausführung nicht dupliziert wird. `orientation: 'vertical'` unterstützt Seiten-Docks und andere vertikale Toolbar-Flächen.

## Accessibility und Keyboard

Jede Action ist ein echtes `<button>` mit `aria-label` und Tooltip. Shortcuts werden im Tooltip und im Overflow-Menü angezeigt; Icon-only-Darstellungen behalten ihren Accessible Name. Enter und Leertaste aktivieren Actions über denselben Ausführungspfad wie Pointer-Klicks. Das Overflow-Menü verwendet `role="menu"`/`menuitem`, die Hauptleiste `role="toolbar"`, unterstützt Pfeiltasten und Home/End, schließt mit Escape oder Außenklick und stellt den Fokus auf den Overflow-Trigger zurück.

## Fehlerverhalten

Ungültige oder doppelte Action-Definitionen werden beim Widget-Contract abgelehnt. Eine Action ohne lokalen Handler bzw. ohne den für ihr Target benötigten Navigation-/Command-/Callback-Service liefert einen expliziten `WidgetActionExecutionError`; generische Chrome greift dabei nie direkt auf Layout-Manager oder Domain-Services zu.
