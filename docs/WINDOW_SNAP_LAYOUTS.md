# Window Snap Layouts

WidgetForge unterscheidet Snap-Layouts und Maximieren semantisch.

## Snap-Layouts

Unterstützt werden linke/rechte sowie obere/untere Hälfte, vier Viertel und horizontale `1/3 + 2/3`-Varianten. `snapWindowGeometry()` berechnet alle Geometrien deterministisch relativ zur verfügbaren Floating-Fläche des `WindowManagerHost`.

Pointer-Edge-Detection verwendet Halves und Quarters. Die 1/3-/2/3-Varianten werden über den generischen `WindowSnapLayoutPicker` gewählt.

## Maximized

`maximized` ist ein eigener `WindowMode`, kein Alias für eine Snap-Zone. Beim Maximieren wird die ursprüngliche Floating-Geometrie als `restoreGeometry` gespeichert. Ein Wechsel von Snap zu Maximized oder zwischen Snap-Layouts behält diese ursprüngliche Floating-Geometrie bei. `restore()` auf einem maximierten Fenster kehrt dorthin zurück.

Aktive Snap- und Maximize-Geometrien werden bei Größenänderungen des verfügbaren WindowManager-Containers neu berechnet. Da `WorkspaceHost` den WindowManager innerhalb der durch Docks bereinigten Floating-Fläche rendert, überlagern Snap und Maximize keine Docks.

Workspace-Persistenz enthält Snap-Zone, `mode` und `restoreGeometry`. Alte v2-Snapshots ohne `restoreGeometry` bleiben für normale und minimierte Fenster gültig.
