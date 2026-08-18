# Widget Contract

Der Widget Contract ist die kleinste öffentliche Beschreibung eines Widget-Typs. Er bleibt vollständig frei von konkreter Spieldomäne und enthält nur Informationen, die die Framework-Infrastruktur benötigt.

## Manifest

Ein Widget wird mit `defineWidget(...)` beschrieben. Das Manifest enthält:

- `id`: stabile, kleingeschriebene Widget-ID wie `planet.summary`
- `title`: Standardtitel für die spätere Window Shell
- `component`: Vue-Komponente mit dem fachlichen Inhalt
- `parameters`: optionale typisierte Parameterbeschreibung
- `window`: optionale Default-/Minimal-/Maximalgröße

`defineWidget(...)` validiert statische Fehler wie ungültige IDs, falsche Defaultwerte und widersprüchliche Größen früh. Die Validierung konkreter Instanzparameter gehört zur Widget Registry (#6).

## Parameter

Unterstützte primitive Parameterarten sind zunächst `string`, `number` und `boolean`. Mit `InferWidgetParameters<TSchema>` kann ein Consumer aus einem Schema den TypeScript-Typ der späteren Instanzparameter ableiten.

## Architekturgrenze

Das Manifest enthält keine Registry-, Window-Manager-, Transport- oder Spiellogik. Rendering und Widget Context werden erst durch die folgenden Framework-Schichten ergänzt.
