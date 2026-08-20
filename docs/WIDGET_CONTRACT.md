# Widget Contract

Der Widget Contract ist die kleinste öffentliche Beschreibung eines Widget-Typs. Er bleibt vollständig frei von konkreter Spieldomäne und enthält nur Informationen, die die Framework-Infrastruktur benötigt.

## Manifest

Ein Widget wird mit `defineWidget(...)` beschrieben. Das Manifest enthält:

- `id`: stabile, kleingeschriebene Widget-ID wie `planet.summary`
- `title`: Standardtitel für die spätere Window Shell
- `component`: Vue-Komponente mit dem fachlichen Inhalt
- `description`: optionale kurze, verbraucherorientierte Beschreibung
- `documentation`: optionale serialisierbare Zusammenfassung, Details und Beispiele
- `parameters`: optionale typisierte Parameterbeschreibung
- `window`: optionale Default-/Minimal-/Maximalgröße

`defineWidget(...)` validiert statische Fehler wie ungültige IDs, falsche Defaultwerte und widersprüchliche Größen früh. Die Validierung konkreter Instanzparameter gehört zur Widget Registry (#6).

## Parameter

Unterstützte primitive Parameterarten sind zunächst `string`, `number` und `boolean`. Jede Parameterdefinition kann zusätzlich `description` und einen typkompatiblen `example` tragen. Mit `InferWidgetParameters<TSchema>` kann ein Consumer aus einem Schema den TypeScript-Typ der späteren Instanzparameter ableiten.

`type`, `required` und `default` stehen ausschließlich an der Parameterdefinition und bleiben auch für Discovery und Help die kanonische Quelle. Dokumentationsfelder wiederholen diese Laufzeitinformationen nicht.

## Discovery

`WidgetRegistry.getDocumentation(id)` und `WidgetRegistry.listDocumentation()` liefern eine reine normalisierte Dokumentationsansicht ohne Vue-Komponente. Sie enthält die geordnete Parameterliste mit Typ, Pflichtigkeit, Defaultwert, Beschreibung und Beispiel. Die Registry-Methoden `get()` und `list()` geben Kopien der Definitionen zurück; eine Veränderung durch Consumer verändert nicht den Registry-Zustand. Vollständige Metadatenrichtlinien stehen in [`DISCOVERY.md`](./DISCOVERY.md).

## Architekturgrenze

Das Manifest enthält keine Registry-, Window-Manager-, Transport- oder Spiellogik. Rendering und Widget Context werden erst durch die folgenden Framework-Schichten ergänzt.
