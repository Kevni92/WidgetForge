# Pane System

`Pane` ist die generische Content- und Layout-Abstraktion von WidgetForge.

## Verantwortung

Ein Pane ist DOM-unabhängig und serialisierbar. Es enthält entweder ein Widget (`kind: widget`) oder weitere Panes als Split (`kind: split`), Tabs (`kind: tabs`) oder Layer-Stack (`kind: stack`). Windows und Docks verwenden dieselben Pane-Bäume; es existiert keine host-spezifische Pane-Variante.

Widgets kennen das Pane-System nicht. Reparenting, Splitten, Collapse und Resize sind Workspace-Verantwortung.

## Pane-Typen

- `WidgetPane` besitzt stabile Pane-/Widget-Instanz-IDs, Parameter und optionale Pane-Einstellungen.
- `SplitPane` besitzt eine Achse, mindestens zwei Kinder und positive Gewichte.
- `TabPane` besitzt mindestens zwei Kinder und eine aktive direkte Child-ID.
- `StackPane` besitzt mindestens ein Kind. Alle Kinder werden in Reihenfolge als übereinanderliegende Layer gerendert; der letzte Layer liegt oben.

Alle Pane-Typen sind rekursiv kombinierbar und bleiben vollständig serialisierbar.

## Größenmodi und Constraints

`PaneSettings.sizeMode` unterstützt:

- `flex` (Default): verbleibender Platz wird anhand von Split-Gewicht und `grow` verteilt.
- `fixed`: `size` definiert die bevorzugte feste Pixelgröße.
- `content`: die bevorzugte Größe stammt aus einer intrinsischen Content-Größe des Renderers.

`minSize` und `maxSize` gelten unabhängig vom Größenmodus. `calculatePaneSplitLayout()` berechnet die eindimensionale Split-Verteilung als pure Core-Funktion. Die übergebene verfügbare Größe enthält keine Divider-Breite.

Die Fallback-Regel bei zu kleinen Containern ist deterministisch: Content-Panes und danach Fixed-Panes werden bis zu ihrem Minimum verkleinert. Reicht selbst die Summe aller Mindestgrößen nicht in den Container, werden Mindestgrößen **nicht** unterschritten; `overflow` meldet den nicht auflösbaren Überhang. Damit werden Min-/Max-Constraints nicht still verletzt.

## Collapse und Lock

`collapsible` erlaubt den expliziten Collapse-State `collapsed`. Ein kollabiertes Pane belegt im Split null Pixel. `setPaneCollapsed()` ändert diesen Zustand immutable.

`locked` betrifft ausschließlich Layout-Operationen. Gesperrte Panes können nicht entfernt, verschoben, gesplittet, kollabiert oder über Split-Divider resized werden. Widget-/Domain-State ist davon unberührt.

## Tree-Operationen

Tree-Operationen sind pure Funktionen und erzeugen neue Bäume. Unterstützt werden Finden, Ersetzen, Entfernen mit automatischem Parent-Collapse, Splitten an einer Kante, Tab-Docking, Verschieben eines Subtrees, Tab-Reihenfolge, Collapse und Split-Gewichte.

Pane-IDs müssen innerhalb eines Baums eindeutig sein. Ein Pane darf nicht in einen eigenen Descendant verschoben werden. Der Root-Pane darf nicht in sich selbst reparented werden.

## PaneHost

`PaneHost` ist der generische Vue-Renderer des Pane-Baums. Widget-Panes werden über `WidgetHost` gerendert; Split-, Tab- und Stack-Panes rekursiv über weitere `PaneHost`-Instanzen. Der Host kennt weder `WindowManager` noch `DockManager`.

Split-Divider sind nur zwischen zwei nicht kollabierten, entsperrten, resizablen `flex`-Panes aktiv. Fixed- und Content-Panes bleiben über ihre deklarativen Constraints bestimmt. Pointer-Listener werden bei Ende, Abbruch und Unmount deterministisch entfernt.

Stack-Layer werden im selben Host übereinander angeordnet. Es gibt dafür keine Window-/Dock-Sonderlogik.

## Persistenz

Workspace-Schema Version 3 persistiert `StackPane` sowie `sizeMode`, `size`, `collapsible`, `collapsed` und `locked`. Version-1- und Version-2-Snapshots bleiben restorebar; neue Snapshots werden als Version 3 geschrieben.

## Architekturgrenze

Pane-Modell und Constraint-Mathematik bleiben DOM-freier Core. `PaneHost` ist ausschließlich Renderer und Input-Adapter. Window-/Dock-Hosts kennen nur den jeweiligen Root-Pane und delegieren dessen Rendering an `PaneHost`.
