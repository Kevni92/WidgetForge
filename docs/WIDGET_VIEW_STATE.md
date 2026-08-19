# Widget View State

Widget View State speichert lokalen, serialisierbaren UI-Zustand einer Widget-Instanz getrennt von Workspace-Layout, Widget-Parametern und Domain-Daten.

## Manifest

Ein Widget kann `viewState` deklarieren:

```ts
const widget = defineWidget({
  id: 'market.ticker',
  title: 'Market',
  component: MarketWidget,
  viewState: {
    version: 1,
    defaultState: { filter: '', sortColumn: 'volume', sortDirection: 'desc' },
    validate: (value): value is MarketViewState => isMarketViewState(value),
  },
})
```

`defaultState` und jeder gespeicherte Zustand müssen JSON-serialisierbar sein; nicht-finite Zahlen, Funktionen, DOM-/Vue-/Runtime-Objekte oder zyklische Strukturen sind nicht erlaubt. `validate` gehört zum Widget und enthält ausschließlich Schemawissen des Consumers.

## Composable

Innerhalb des Widgets liefert `useWidgetViewState<T>()` den aktuellen Zustand sowie `replace`, `update` und `reset`. Änderungen ersetzen den serialisierbaren Zustand atomar und remounten das Widget nicht.

```ts
const view = useWidgetViewState<MarketViewState>()
view.update((state) => ({ ...state, filter: 'metal' }))
```

## Persistenz und Isolation

`createWidgetViewStateStore()` verwaltet State nach `scopeId + instanceId`. Dadurch können gleiche Instance-IDs in verschiedenen virtuellen Workspaces getrennt bleiben. Neue Instance-IDs starten immer mit `defaultState`; ein Workspace-/Widget-Duplikat erhält damit ohne explizite Übernahme einen frischen lokalen View-State.

Für Browser-Persistenz kann der Consumer `createLocalStorageWidgetViewStateStorage()` injizieren und den Store über `WidgetViewStateProvider` bzw. `provideWidgetViewState()` bereitstellen. Diese Persistenz ist bewusst unabhängig von `WorkspaceSnapshot`, Layout-Presets und `DataClient`.

## Versionierung

Jede Definition besitzt eine positive `version`. Stimmt die gespeicherte Version nicht überein, wird optional `migrate(value, fromVersion)` aufgerufen. Das Ergebnis muss serialisierbar sein und den Validator erfüllen. Ohne gültige Migration oder bei beschädigtem gespeicherten Zustand wird deterministisch `defaultState` verwendet.

Für eine neue View-State-Version:

1. `version` erhöhen.
2. `defaultState` und Validator auf das neue Format aktualisieren.
3. Falls alte lokale UI-Einstellungen erhalten bleiben sollen, eine pure `migrate`-Funktion ergänzen.
4. Migration und Invalid-State-Fallback mit Fixtures testen.

Domain-/Game-Daten gehören nicht in View State. Dafür bleibt die Data API zuständig.
