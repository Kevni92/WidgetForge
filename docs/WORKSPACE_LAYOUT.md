# Workspace Layout

WidgetForge unterscheidet zwischen frei beweglichen Windows und am Workspace-Rand verankerten Docks. Beide enthalten ausschließlich einen Root-Pane und verwenden für ihren Inhalt denselben `PaneHost`.

## Docks

Ein Dock besitzt eine stabile ID, eine Position `top`, `bottom`, `left` oder `right`, einen Root-Pane sowie eine Dicke mit optionalen Min-/Max-Grenzen. Docks besitzen keine Window-Chrome und benötigen keinen Fokus.

Workspace-Kanten für Floating Windows werden über die Layout-Constraints im Layout Edit Mode definiert. Das verändert die Geometrie responsiv, ohne aus dem Window ein Dock zu machen. Ein `Dock` ist dagegen eine explizit registrierte strukturelle Workspace-Fläche mit eigener ID, Root-Pane und Dock-Dicke. Die Registrierung mehrerer Docks an derselben Kante ist deterministisch: früh registrierte Docks liegen näher an der Workspace-Kante.

Ein Dock kann wie jedes Window einen einzelnen Widget-Pane oder einen beliebig verschachtelten Split-Pane enthalten. Eine Topbar ist daher kein Sondertyp, sondern beispielsweise:

`Top Dock -> horizontaler Root-Pane -> Left Pane | Center Pane | Right Pane`

## Floating Area

Die Funktion `calculateWorkspaceDockLayout` berechnet aus Containergröße und geordneter Dock-Liste die Rechtecke der Docks und die verbleibende Floating-Fläche. Docks werden in Registrierungsreihenfolge nacheinander vom verbleibenden Rechteck abgezogen.

`WorkspaceHost` verwendet diese Berechnung und rendert den bestehenden `WindowManagerHost` ausschließlich in der verbleibenden Floating-Fläche. Dadurch berücksichtigen spätere Snap- und Window-Interaktionen Docks automatisch.

## Resize

Resizable Docks besitzen nur an ihrer inneren Workspace-Kante einen Resize-Handle. Die resultierende Dicke wird im `DockManager` normalisiert und bleibt serialisierbarer State. Pointer-Sessions werden bei Up, Cancel und Unmount bereinigt.

## Persistenz

Workspace-Format v3 kann optional einen `DockManager` in `captureWorkspace`, `serializeWorkspace` und `restoreWorkspace` einbeziehen. Snapshots ohne Docks bleiben kompatibel. Enthält ein Snapshot Docks, verlangt Restore explizit einen DockManager, damit Dock-State nicht stillschweigend verloren geht. Die optionalen Restore-Metadaten älterer Docks fehlen und verwenden beim `detachDockToWindow()`-Aufruf deterministische Fallback-Geometrie. Ein Dock wird nicht über die normale Window-Chrome erzeugt; die Umwandlung eines Floating Windows in ein Dock ist kein produktiver Window-Befehl.

## Architekturgrenze

Es gibt keine speziellen Navbar-, Toolbar- oder Sidebar-Komponenten im Core. Solche Oberflächen werden ausschließlich aus `Dock + Pane + Widget` zusammengesetzt.
