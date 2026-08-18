# Workspace Docking

## Grundmodell

Docking verändert ausschließlich den bestehenden Pane-Baum. Widgets kennen weder Drag-and-Drop noch Window- oder Dock-Manager.

- normaler Window-Drag kann ein Floating Window in ein anderes Window integrieren,
- `Ctrl` aktiviert den Workspace-Edit-Mode für Pane-Reparenting,
- Pane-ID und Widget-`instanceId` bleiben beim Reparenting erhalten,
- Window- und Dock-Hosts rendern weiterhin denselben `PaneHost`.

## Drop-Zonen

Jedes Ziel verwendet dieselben Zonen:

- `left`, `right`, `top`, `bottom`: erzeugen einen neuen Split,
- `center`: ersetzt einen Leaf-Pane; Split-Panes sind kein gültiges Center-Ziel.

Die Drop-Erkennung und Preview-Geometrie sind pure Core-Funktionen. Die Vue-Schicht misst nur die sichtbaren Zielrechtecke.

## Window-Docking

Während eines normalen Window-Drags prüft `WindowManagerHost` andere sichtbare Windows unter dem Pointer. Ein gültiges Ziel zeigt eine Drop-Preview. Beim Pointer-Up wird der Root-Pane des Quellfensters in den Zielbaum übernommen und das Quellfenster geschlossen. Snap und Window-Docking sind gegenseitig exklusiv; ein aktives Window-Drop-Ziel hat Vorrang vor Edge-Snap.

## Pane-Edit-Mode

`WorkspaceHost` besitzt die zentrale Edit-Session. `Ctrl` macht Pane-Grenzen sichtbar. `Ctrl` + Pointer-Drag auf einem Pane kann diesen Pane oder einen vollständigen verschachtelten Subtree in einen anderen Window- oder Dock-Pane verschieben.

Self-/Descendant-Drops werden verworfen. Ein kompletter Dock-Root kann nicht aus seinem Dock entfernt werden, weil ein Dock immer einen Root-Pane benötigt. Ein kompletter Window-Root darf in einen anderen Host verschoben werden; das anschließend leere Quellfenster wird geschlossen.

## Pointer-Lifecycle

Jede Drag-Session besitzt genau einen zentralen Cleanup-Pfad. `pointerup`, `pointercancel`, Close/Unmount und das Starten einer neuen Session entfernen globale Listener und Drop-Previews deterministisch. Undo gehört nicht zu diesem Feature.
