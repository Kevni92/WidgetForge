# Forge-Preset

`forgeDarkTheme` und `forgeLightTheme` sind offizielle vollständige WidgetForge-Themes. Beide verwenden ausschließlich den generischen `WidgetForgeTheme`-Vertrag und unterscheiden sich nur in konkreten Designwerten.

Der Core bleibt preset-unabhängig. Neue generische visuelle Tokens müssen weiterhin zuerst im Theme-Vertrag und im `defaultTheme` ergänzt werden; vollständige offizielle Presets werden dann im selben Schritt aktualisiert.

## Surface- und Elevation-Tokens

Die Surface-Tokens beschreiben die visuelle Rolle einer Oberfläche, nicht ihre technische Stapelreihenfolge:

- `surfaceWindow` / `borderStrong`: reguläre Fenster.
- `surfaceFloating` / `borderFloating`: Utility-Fenster und schwebende Menüs, Popovers und Toasts.
- `surfaceOverlay` / `borderOverlay`: temporäre Overlay-Flächen wie Docking-UI und DevTools.
- `surfaceModal` / `borderModal`: modale Dialogflächen.
- `backdrop`: tokenisierter Hintergrund für modale Flächen.
- `textPlaceholder`: lesbarer Placeholder-Text für generische Eingabefelder.

`shadow.sm`, `shadow.md` und `shadow.lg` bilden die Elevationsstufen. `layer` bleibt davon getrennt und steuert ausschließlich technische Z-Positionen. Consumer können die semantischen Tokens in einem Custom Theme überschreiben; generische Komponenten benötigen dafür keine CSS-Overrides.

## Compact-Density-Tokens

Die Größen-Tokens trennen sichtbare Glyphen von ihren interaktiven Flächen:

- `controlHeight` und `controlHeightCompact`: reguläre bzw. kompakte Controls wie Inputs, Buttons und Menüeinträge.
- `iconSize` / `iconButtonSize`: visuelle Glyphengröße bzw. minimale Hitbox für Icon-Actions.
- `titlebarHeight` / `tabHeight`: Window-Chrome und Tabs.
- `tableRowHeight` / `tableRowHeightCompact`: reguläre bzw. kompakte Tabellenzeilen.

Damit bleiben Forge Dark, Forge Light und Consumer-Themes kompakt, verwenden aber eine nachvollziehbare gemeinsame Größenstruktur.
