# Workspace Edit Mode

WidgetForge trennt normale Nutzung und Layout-Bearbeitung explizit.

## Modi

- `normal`: Widgets und Fenster werden normal benutzt. Das Halten von `Ctrl` kann temporär den Edit-Mode aktivieren.
- `edit`: Pane-Grenzen, Auswahl und Layout-Handles werden sichtbar. Pane-Reparenting ist ohne dauerhaft gehaltene Modifier-Taste möglich.
- `locked`: strukturelle Layout-Interaktionen sind gesperrt. Widget-Interaktion, Fokus, Tabs sowie Window-Aktionen wie Minimieren/Schließen bleiben nutzbar.

`WorkspaceEditController` ist DOM-/Vue-unabhängig und hält Modus, Pane-Auswahl und optionale Pane-Locks. `snapshot()`/`restore()` sind vollständig serialisierbar und können von Anwendungen unabhängig vom Workspace-Snapshot persistiert werden.

## Interaktionsgrenzen

Der Layout-Lock blockiert Window Move/Resize/Snap/Docking, Pane-Reparenting, Split-Resize und Dock-Resize. DOM ist dabei nie State-Wahrheit; die Hosts nutzen den Edit-State lediglich als Interaktions-Gate.

Im Edit-Mode kann ein Pane ausgewählt und per Context Menu bearbeitet werden. Direkte generische Aktionen sind Lock/Unlock und Delete. Split, Move und Widget-Retargeting werden als `paneAction` vom `WorkspaceHost` angefordert, weil die Anwendung das konkrete Ziel bzw. das einzusetzende Widget bestimmen muss. Die Core-Helfer `retargetWidgetPane` und `removePaneForEdit` bleiben framework- und domain-neutral.

Pane-spezifische Locks liegen im `WorkspaceEditController` und verändern den Pane-Tree nicht. Damit bleiben bestehende Workspace-Snapshots kompatibel; Anwendungen können Edit-/Lock-State separat speichern.
