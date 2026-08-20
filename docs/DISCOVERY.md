# Discovery und Dokumentation

WidgetForge-Definitionen können optionale, serialisierbare Metadaten für Help-, Reference- und Devtools-Oberflächen tragen. Diese Metadaten beschreiben den öffentlichen Consumer-Vertrag; sie mounten keine Vue-Komponente und enthalten keine Laufzeitobjekte.

## Widget-Definitionen

```ts
const market = defineWidget({
  id: 'market.ticker',
  title: 'Market Ticker',
  description: 'Shows current market data.',
  documentation: {
    summary: 'A compact market overview.',
    details: 'Use commodity to focus the view.',
    examples: ['Open METALS with 10 rows.'],
  },
  component: MarketWidget,
  parameters: {
    commodity: {
      type: 'string',
      description: 'Optional commodity symbol.',
      example: 'METALS',
    },
    rows: {
      type: 'number',
      default: 10,
      description: 'Maximum number of rows.',
      example: 10,
    },
  },
})
```

`description` ist die kurze Beschreibung des Widgets. `documentation` kann ergänzende Zusammenfassung, Details und textuelle Beispiele enthalten. Parameter tragen ihre Beschreibung und – falls sinnvoll – einen typisierten Beispielwert direkt an ihrer Parameterdefinition.

`type`, `required` und `default` bleiben die kanonische Laufzeitdefinition. Sie werden nicht in einem separaten Dokumentationsobjekt wiederholt. Ein `example` muss zum definierten primitiven Typ passen; die TypeScript-Definition und die Laufzeitvalidierung prüfen das.

## Command-Definitionen

Commands können dieselben Argument-Metadaten sowie eine kurze Beschreibung, Kategorie und Beispiele erhalten:

```ts
const openMarket = {
  name: 'market',
  aliases: ['mkt'],
  widgetId: 'market.ticker',
  description: 'Open the commodity exchange.',
  category: 'Widgets',
  examples: ['market 8'],
  arguments: [
    { name: 'rows', type: 'number', default: 8, description: 'Number of rows.', example: 8 },
  ],
}
```

`CommandRegistry` behält die bestehende Parserdefinition als Quelle der Wahrheit. `getDocumentation(name)` und `listDocumentation()` liefern daraus eine reine, normalisierte Ansicht mit Aliasen, Argumenten und abgeleiteter `usage`-Zeichenkette. Die entsprechenden Methoden von `WidgetRegistry` liefern Widget-ID, Titel, Beschreibungen, Beispiele und eine geordnete Parameterliste.

`get()` und `list()` liefern Kopien der registrierten Definitionen. Consumer dürfen diese Ergebnisse lesen oder lokal verändern, ohne den internen Registry-Zustand zu verändern. Die Reihenfolge der Aufzählung entspricht der Registrierungsreihenfolge.

## Schreiben von Metadaten

- Beschreibungen erklären Verhalten und Nutzung, nicht konkrete Spiellogik im Framework-Core.
- Parameterbeschreibungen nennen Bedeutung, Einheit oder erwartete Form.
- Pflichtigkeit und Defaultwerte werden nur in `required` und `default` gepflegt.
- Beispiele müssen realistisch und typkompatibel sein; sie ersetzen keine Validierung.
- Dokumentationsfelder bleiben reine Strings oder primitive Beispielwerte und enthalten keine Vue-Komponenten, Funktionen oder Provider.
- Bestehende Definitionen ohne Metadaten bleiben gültig.
