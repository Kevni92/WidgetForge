# Widget Capabilities

`WidgetManifest.capabilities` beschreibt ausschließlich UI-/Hosting-Eigenschaften eines Widgets. Domain-, Game- und Datenzustand gehört nicht in diesen Vertrag.

```ts
const widget = defineWidget({
  id: 'market.ticker',
  title: 'Market',
  component: MarketWidget,
  capabilities: {
    multipleInstances: false,
    dockable: false,
    tabCompatible: true,
    preferredAspectRatio: 1.45,
    minimumUsefulSize: { width: 420, height: 260 },
    supportsCompactMode: false,
  },
})
```

## Felder

- `multipleInstances`: erlaubt mehrere gleichzeitige Instanzen. Default `true`.
- `dockable`: erlaubt Hosting in Dock-Flächen. Default `true`.
- `tabCompatible`: erlaubt Hosting unter einem Tab-Container. Default `true`.
- `preferredAspectRatio`: positive Seitenverhältnis-Empfehlung für generische Hosts/Layout-Tools.
- `minimumUsefulSize`: kleinste fachlich sinnvolle UI-Größe. Sie verstärkt die Window-Minimumgröße.
- `supportsCompactMode`: signalisiert, ob ein Host eine kompakte Darstellung anbieten darf. Default `true`.

Die Defaults sind absichtlich permissiv, damit bestehende Widgets ohne Capability-Block unverändert funktionieren.

## Legacy `window.singleton`

`window.singleton` bleibt aus Kompatibilitätsgründen unterstützt. Neue Widgets sollten `capabilities.multipleInstances = false` verwenden. `defineWidget()` normalisiert diese Angabe intern auf das bestehende Singleton-Verhalten, sodass WindowManager, Navigation und Command-basierte Öffnungen dieselbe Instanzregel verwenden. Die widersprüchliche Kombination `window.singleton=true` mit `multipleInstances=true` wird bereits bei der Definition abgelehnt.

## Zentrale Durchsetzung

Capabilities werden durch `WidgetRegistry.getCapabilities()` normalisiert. `DockManager` prüft komplette Pane-Bäume vor `add` und `setRootPane`: `dockable=false` verhindert Dock-Hosting, und `tabCompatible=false` verhindert das Einbetten unter Tabs. `minimumUsefulSize` und `multipleInstances` werden in die bestehende Window-Metadaten-Pipeline normalisiert.

Für reine Vorprüfungen stehen `paneIsDockable()` und `paneIsTabCompatible()` bereit; `assertPaneCapabilities()` liefert bei einer Verletzung einen `WidgetCapabilityError`.

Widgets selbst sollen keine Window-/Dock-/Pane-Manager importieren und keine Host-Sonderlogik duplizieren. Sie deklarieren nur ihre Fähigkeiten; generische Hosts entscheiden anhand der Registry.
