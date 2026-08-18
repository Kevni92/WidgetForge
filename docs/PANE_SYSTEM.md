# Pane System

`Pane` ist die generische Content- und Layout-Abstraktion von WidgetForge.

## Verantwortung

Ein Pane ist DOM-unabhängig und serialisierbar. Es enthält entweder ein Widget (`kind: widget`) oder weitere Panes als Split (`kind: split`). Windows, Docks und andere Workspace-Hosts sollen Pane-Bäume verwenden, statt Widget-Inhalte selbst zu modellieren.

Widgets kennen das Pane-System nicht. Reparenting, Splitten und Resize sind Workspace-Verantwortung.

## Widget Pane

Ein Widget-Pane besitzt eine stabile Pane-ID, Widget-ID, Widget-Instanz-ID, serialisierbare Parameter und optionale Pane-Einstellungen.

## Split Pane

Ein Split-Pane besitzt eine stabile Pane-ID, die Achse `horizontal` oder `vertical`, mindestens zwei Kinder und positive Gewichte. Gewichte beschreiben die relative Platzverteilung; konkrete Pixelberechnung ist Aufgabe des Renderers.

## Pane-Einstellungen

Generische Einstellungen umfassen insbesondere Resizability, Min-/Max-Größe, Grow, Overflow sowie einen semantischen Hintergrund. `backgroundColor` ist ein expliziter Consumer-Override; Framework-Defaults bleiben tokenbasiert.

## Tree-Operationen

Tree-Operationen sind pure Funktionen und erzeugen neue Bäume. Unterstützt werden Finden, Ersetzen, Entfernen mit automatischem Split-Collapse, Splitten an einer Kante, Verschieben eines Subtrees und Aktualisieren von Split-Gewichten.

Pane-IDs müssen innerhalb eines Baums eindeutig sein. Ein Pane darf nicht in einen eigenen Descendant verschoben werden. Der Root-Pane darf nicht in sich selbst reparented werden.

## Architekturgrenze

#60 enthält keinerlei Vue-, Pointer-, Window- oder Dock-Logik. `PaneHost` folgt separat. Window-/Dock-Hosts sollen später ausschließlich den Root-Pane kennen und Rendering an `PaneHost` delegieren.
