# Workspace Edit Mode

WidgetForge trennt normale Nutzung und Layout-Bearbeitung explizit.

## Modi

- `normal`: Widgets und Fenster werden normal benutzt. Das Halten von `Ctrl` kann temporär den Edit-Mode aktivieren.
- `edit`: Der sichtbare `Edit layout`-Befehl aktiviert einen persistenten Layout-Editor. Eine stabile Editor-Chrome zeigt `Layout editing` und `Done`; Pane-Grenzen, Window-Hosts und Layout-Beziehungen werden sichtbar. Pane-Reparenting ist ohne dauerhaft gehaltene Modifier-Taste möglich.
- `locked`: strukturelle Layout-Interaktionen sind gesperrt. Widget-Interaktion, Fokus, Tabs sowie Window-Aktionen wie Minimieren/Schließen bleiben nutzbar.

`WorkspaceEditController` ist DOM-/Vue-unabhängig und hält Modus, Pane-Auswahl, Window-Host-Auswahl und optionale Pane-Locks. `snapshot()`/`restore()` sind vollständig serialisierbar und können von Anwendungen unabhängig vom Workspace-Snapshot persistiert werden.

Im persistenten Edit Mode liegt eine eigene, nicht persistierte Interaction-Layer über dem Window-Content. Sie nimmt Pointer-Selection und strukturelles Pane-Dragging entgegen; sie ist keine Quelle für DOM-Geometrie oder Layout-State. Der fachliche Widget-Content wird mit semantischem Dimming zurückgenommen und per `inert` aus dem Fokus-/Aktionspfad genommen. Editor-Chrome, Inspector und Window-Host-Selection bleiben interaktiv. Unselected-, Hovered- und Selected-Hosts besitzen getrennte visuelle Marker. Window-Hosts sind im Edit Mode keyboard-fokussierbar; `Escape` verwirft nur aktive transiente Aktionen, während `Done` den gesamten Modus beendet und Selection-/Preview-Zustände bereinigt.

Ausgewählte Windows zeigen vier getrennte Connector-Handles. Ein Drag auf einen Handle erzeugt zunächst nur einen validierten Draft: horizontale und vertikale Kanten werden getrennt geprüft, Self-/Cycle-/Cross-Axis-Ziele werden verworfen und eine Ghost-Geometrie folgt dem letzten gültigen Target. Erst der Drop schreibt über die pure Core-Operation `setWindowLayoutConstraint` einen Anchor mit `0 px`; bei zwei gegenüberliegenden Anchors wird die Size abgeleitet. Direkte Verbindungen werden als aktive responsive Regel markiert, damit der bestehende Resolver sie auch bei Workspace-Resize erneut auflöst. Die Connector-Linie ist eine Projektion dieses States und keine eigene State-Quelle.

## Interaktionsgrenzen

Der Layout-Lock blockiert Window Move/Resize/Snap/Docking, Pane-Reparenting, Tab-Reordering, Split-Resize und Dock-Resize. DOM ist dabei nie State-Wahrheit; die Hosts nutzen den Edit-State lediglich als Interaktions-Gate.

Im Edit-Mode kann ein Pane ausgewählt und per Context Menu bearbeitet werden. Direkte generische Aktionen sind Lock/Unlock und Delete. Split, Move und Widget-Retargeting werden als `paneAction` vom `WorkspaceHost` angefordert, weil die Anwendung das konkrete Ziel bzw. das einzusetzende Widget bestimmen muss. Die Core-Helfer `retargetWidgetPane` und `removePaneForEdit` bleiben framework- und domain-neutral.

Pane-spezifische Locks liegen im `WorkspaceEditController` und verändern den Pane-Tree nicht. Damit bleiben bestehende Workspace-Snapshots kompatibel; Anwendungen können Edit-/Lock-State separat speichern.

## Per-Window-Lock

Ein Fenster besitzt zusätzlich den kanonischen `WindowState.layoutLocked`-Wert. Dieser Lock ist unabhängig vom globalen Workspace-Modus und von Pane-Locks: Er friert die exakte Geometrie sowie den bestehenden Snap-/Restore-Zustand ein, ohne das Fenster zu docken oder zu verankern.

Das Locken und Entsperren ist nur im Edit-Mode möglich. Ein gelocktes Fenster liegt in einer eigenen deterministischen Layout-Ebene unter normalen Floating-Fenstern, bleibt fokussierbar und rendert seinen Widget-Inhalt interaktiv. Bewegung, Resize, Snap, Anchor und Window-Docking werden dagegen abgelehnt. Titelbar, Titel, Header-Actions und Resize-Griffe werden vollständig entfernt.

Im Edit-Mode markiert die generische Workspace-Auswahl auch ein chrome-less gelocktes Fenster. Die Window-Host-Auswahl verwendet die `instanceId` unabhängig von der Root-Pane-ID und stellt eine sichtbare `Lock`-/`Unlock`-Action bereit; dadurch bleibt Unlock auch ohne Titlebar direkt per Keyboard erreichbar. Das Context Menu bietet zusätzlich `Unlock window` und `Layout…`; alle Aktionen arbeiten über die öffentliche Workspace-/Window-API und benötigen keine Playground-Sonderbehandlung. Der Layout-Dialog validiert responsive Anchors, Einheiten, Referenzen und Zyklen vor dem Speichern.

Ein gelocktes Fenster darf Widget-internen Fokus behalten. Dieser fachliche Fokus wird weiterhin im Window-State geführt, steuert aber nicht mehr den Floating-Window-Active-Border: Für gelockte Fenster bleibt die äußere Shell passiv. Eine Edit-Auswahl wird separat über das Window-Selection-Marker-Attribut dargestellt.

## Handle-Semantik

Die Drag-Griffe haben eine eindeutige, modusabhängige Bedeutung:

- `normal`: Generische Pane-Move-Handles werden nicht gerendert. Der Grip eines Tabs ist ein Reorder-Griff und kann nur die direkten Kinder derselben TabPane umsortieren.
- temporärer `Ctrl`-Edit und `edit`: Generische Handles werden für bewegliche Pane-Knoten eingeblendet. Der Tab-Grip bewegt den Pane-Knoten hinter dem Tab über den bestehenden Workspace-Docking-Pfad.
- `locked`: Normales Tab-Aktivieren bleibt möglich; Layout-Mutationen einschließlich Reordering und strukturellem Pane-Drag werden abgelehnt.

Tab-Reorder und Pane-Drag sind getrennte Pointer-Sessions. Ein Reorder verlässt die aktuelle Tabbar nicht in einen Docking-Preview. Eine kleine Bewegungsschwelle verhindert, dass ein einfacher Grip-Klick als Reorder-Commit interpretiert wird. Gültige Reorder- und Pane-Move-Operationen werden jeweils als eine Workspace-History-Transaktion geführt.

Der sichtbare Selection-Inspector ist der primäre Layout-Einstieg neben dem Context Menu. Er stellt Geometrie, Snap-/Lock-Zustand und den Status einer responsive Regel gemeinsam dar und bietet `Layout bearbeiten` sowie `Lock`/`Unlock` mit zugänglichem `aria-pressed`-Zustand. Der Window-Host stellt außerdem eine benannte `Edit layout`-Aktion bereit; Escape schließt Dialoge bzw. aktive Picker-Zustände, während Tab innerhalb des Dialogs bleibt.

Im persistenten Edit Mode liegen zusätzlich acht Resize-Zonen am ausgewählten Window: vier Kanten und vier Ecken. Sie liegen unter den mittigen Connector-Handles aus #189 und konkurrieren nicht mit deren eigener Pointer-Priorität. Eine Resize-Geste erzeugt über `resizeWindowLayoutSpec` nur einen transienten Resolver-Draft; bestehende Start-/End-Targets, px/%-Einheiten und der Stretch-Modus bleiben erhalten. Erst Pointer-Up schreibt genau eine aktive Layoutregel und eine History-Aktion. Escape, Pointer-Cancel und verlorene Pointer-Capture verwerfen den Draft. Die Resize-Zonen gelten auch für ein `layoutLocked` Window im Edit Mode, ohne den Lock vorübergehend zu entfernen; außerhalb des Edit Mode bleibt der bestehende Lock vollständig wirksam.

Der Selection Inspector ist im Edit Mode eine stabile rechte Property-Seitenleiste außerhalb der persistierten Floating-Fläche. Ohne Selection zeigt er einen Empty State; Selection-Wechsel aktualisiert dasselbe Panel. Es gruppiert Position, Size, Achsenmodi, aktive Constraint-Karten und Min-/Max-Größen. X/Y sowie Stretch-Size werden als berechnet/read-only dargestellt, während echte Freiheitsgrade numerisch bearbeitbar bleiben. Constraint-Karten zeigen Host/ID, Target-Edge und physischen Abstand bzw. gleichgerichteten Versatz inklusive Unit; Target-Wechsel, Unit-Wechsel und Disconnect nutzen die bestehenden Core-Resolver-/Validation-Funktionen. Eingaben erzeugen zunächst Vue-lokale Preview-Drafts, committen bei Blur/Enter genau eine History-Aktion und rollen bei Escape zurück. Das Panel kann eingeklappt werden, damit Workspace-Edges erreichbar bleiben.
