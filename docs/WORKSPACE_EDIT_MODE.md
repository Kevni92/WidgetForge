# Workspace Edit Mode

WidgetForge trennt normale Nutzung und Layout-Bearbeitung explizit.

## Modi

- `normal`: Widgets und Fenster werden normal benutzt. Das Halten von `Ctrl` kann temporär den Edit-Mode aktivieren.
- `edit`: Pane-Grenzen, Auswahl und Layout-Handles werden sichtbar. Pane-Reparenting ist ohne dauerhaft gehaltene Modifier-Taste möglich.
- `locked`: strukturelle Layout-Interaktionen sind gesperrt. Widget-Interaktion, Fokus, Tabs sowie Window-Aktionen wie Minimieren/Schließen bleiben nutzbar.

`WorkspaceEditController` ist DOM-/Vue-unabhängig und hält Modus, Pane-Auswahl und optionale Pane-Locks. `snapshot()`/`restore()` sind vollständig serialisierbar und können von Anwendungen unabhängig vom Workspace-Snapshot persistiert werden.

## Interaktionsgrenzen

Der Layout-Lock blockiert Window Move/Resize/Snap/Docking, Pane-Reparenting, Tab-Reordering, Split-Resize und Dock-Resize. DOM ist dabei nie State-Wahrheit; die Hosts nutzen den Edit-State lediglich als Interaktions-Gate.

Im Edit-Mode kann ein Pane ausgewählt und per Context Menu bearbeitet werden. Direkte generische Aktionen sind Lock/Unlock und Delete. Split, Move und Widget-Retargeting werden als `paneAction` vom `WorkspaceHost` angefordert, weil die Anwendung das konkrete Ziel bzw. das einzusetzende Widget bestimmen muss. Die Core-Helfer `retargetWidgetPane` und `removePaneForEdit` bleiben framework- und domain-neutral.

Pane-spezifische Locks liegen im `WorkspaceEditController` und verändern den Pane-Tree nicht. Damit bleiben bestehende Workspace-Snapshots kompatibel; Anwendungen können Edit-/Lock-State separat speichern.

## Per-Window-Lock

Ein Fenster besitzt zusätzlich den kanonischen `WindowState.layoutLocked`-Wert. Dieser Lock ist unabhängig vom globalen Workspace-Modus und von Pane-Locks: Er friert die exakte Geometrie sowie den bestehenden Snap-/Restore-Zustand ein, ohne das Fenster zu docken oder zu verankern.

Das Locken und Entsperren ist nur im Edit-Mode möglich. Ein gelocktes Fenster liegt in einer eigenen deterministischen Layout-Ebene unter normalen Floating-Fenstern, bleibt fokussierbar und rendert seinen Widget-Inhalt interaktiv. Bewegung, Resize, Snap, Anchor und Window-Docking werden dagegen abgelehnt. Titelbar, Titel, Header-Actions und Resize-Griffe werden vollständig entfernt.

Im Edit-Mode markiert die generische Workspace-Auswahl auch ein chrome-less gelocktes Fenster. Sein Context Menu bietet `Unlock window` und `Layout…`; beide Aktionen arbeiten über die öffentliche Workspace-/Window-API und benötigen keine Playground-Sonderbehandlung. Der Layout-Dialog validiert responsive Anchors, Einheiten, Referenzen und Zyklen vor dem Speichern.

## Handle-Semantik

Die Drag-Griffe haben eine eindeutige, modusabhängige Bedeutung:

- `normal`: Generische Pane-Move-Handles werden nicht gerendert. Der Grip eines Tabs ist ein Reorder-Griff und kann nur die direkten Kinder derselben TabPane umsortieren.
- temporärer `Ctrl`-Edit und `edit`: Generische Handles werden für bewegliche Pane-Knoten eingeblendet. Der Tab-Grip bewegt den Pane-Knoten hinter dem Tab über den bestehenden Workspace-Docking-Pfad.
- `locked`: Normales Tab-Aktivieren bleibt möglich; Layout-Mutationen einschließlich Reordering und strukturellem Pane-Drag werden abgelehnt.

Tab-Reorder und Pane-Drag sind getrennte Pointer-Sessions. Ein Reorder verlässt die aktuelle Tabbar nicht in einen Docking-Preview. Eine kleine Bewegungsschwelle verhindert, dass ein einfacher Grip-Klick als Reorder-Commit interpretiert wird. Gültige Reorder- und Pane-Move-Operationen werden jeweils als eine Workspace-History-Transaktion geführt.
