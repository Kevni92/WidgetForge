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

## Floating Window an Workspace-Kante verankern

Ein normales oder Utility-Window kann über das generische Window-Chrome an eine der vier Workspace-Kanten verankert werden. Die Aktion ist in einem gelockten Workspace sowie für Modal- und Overlay-Rollen nicht verfügbar. Die Auswahl erzeugt einen normalen `Dock` mit dem unveränderten Root-Pane; es gibt keinen zweiten Navbar-/Sidebar-State.

- `top` und `bottom` übernehmen die Fensterhöhe als Dock-Dicke, `left` und `right` die Fensterbreite,
- Fenster-Min-/Max-Constraints werden als Dock-Min-/Max-Dicke übernommen,
- mehrere Docks an derselben Kante werden deterministisch in Registrierungsreihenfolge gestapelt,
- der Dock-State enthält die serialisierbaren Rückkehrdaten des ursprünglichen Fensters.

`anchorWindowToDock()` und `detachDockToWindow()` validieren jeweils den vollständigen Workspace-Snapshot und rollen bei einem Fehler zurück. `WorkspaceHost` umschließt beide Aktionen mit genau einer History-Transaktion. Beim Anchoring verschwinden Window-Move, Resize und Window-Chrome; im permanenten Edit-Mode bietet das Kontextmenü am vollständigen Dock-Root den Rückweg zum Floating Window an. Pane-IDs und Widget-`instanceId`s bleiben dabei erhalten. Persistierte Docks können deshalb auch nach einem Reload wieder in ihr ursprüngliches Fenster zurückgeführt werden.

## Pane-Edit-Mode

`WorkspaceHost` besitzt die zentrale Edit-Session. `Ctrl` macht Pane-Grenzen sichtbar. `Ctrl` + Pointer-Drag auf einer beliebigen Pane-Fläche kann diesen Pane oder einen vollständigen verschachtelten Subtree in einen anderen Window- oder Dock-Pane verschieben. Wird der Drag auf einer freien Workspace-Fläche beendet, wird der Pane als neues Floating Window herausgelöst. Pane- und Tab-Grip-Icons werden im Edit-Mode nicht angezeigt; ein Tab-Button ist die Drag-Fläche für seinen direkten Tab-Pane-Knoten. Der Drag wird erst nach einer kurzen Bewegungsschwelle aktiv, damit ein Klick weiterhin funktioniert. Im Normalmodus bleibt der sichtbare Tab-Grip auf Tab-Reordering innerhalb der aktuellen Tabbar begrenzt.

Self-/Descendant-Drops werden verworfen. Ein kompletter Dock-Root kann nicht per Pane-Drag aus seinem Dock entfernt werden, weil ein Dock immer einen Root-Pane benötigt; im permanenten Edit-Mode ist dafür die separate Dock-Detach-Aktion zuständig. Ein kompletter Window-Root darf in einen anderen Host verschoben werden; das anschließend leere Quellfenster wird geschlossen.

## Tab-Reordering

Tab-Reordering ist eine eigene, nicht-strukturelle Layout-Mutation. `reorderTab()` berechnet den neuen Tab-Baum immutable; `activeId`, Pane-IDs, Widget-Instanz-IDs und gemountete Widget-Zustände bleiben erhalten. Die Vue-Schicht misst nur die Tabbar und zeigt eine Einfügemarke. Außerhalb der aktuellen Tabbar existiert für diese Session kein gültiges Drop-Ziel und kein Docking-Overlay.

## Pointer-Lifecycle

Jede Drag-Session besitzt genau einen zentralen Cleanup-Pfad. `pointerup`, `pointercancel`, Escape, verlorenes Pointer-Capture, Close/Unmount und das Starten einer neuen Session entfernen globale Listener und Drop-Previews deterministisch. Eine Session bleibt entweder `tab-reorder` oder `pane-drag`; sie wechselt nicht implizit den Typ. Erfolgreiche Layout-Mutationen werden über Workspace-History undo/redo-fähig aufgezeichnet.
