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

Pane-IDs und Widget-Instanz-IDs müssen innerhalb eines Baums eindeutig sein. Bei einem vollständigen Workspace müssen beide Identitäten auch über alle Window- und Dock-Bäume hinweg eindeutig bleiben. Ein Pane darf nicht in einen eigenen Descendant verschoben werden. Der Root-Pane darf nicht in sich selbst reparented werden.

## PaneHost

`PaneHost` ist der generische Vue-Renderer des Pane-Baums. Widget-Panes werden über `WidgetHost` gerendert; Split-, Tab- und Stack-Panes rekursiv über weitere `PaneHost`-Instanzen. Der Host kennt weder `WindowManager` noch `DockManager`.

Split-Divider sind nur zwischen zwei nicht kollabierten, entsperrten, resizablen `flex`-Panes aktiv. Fixed- und Content-Panes bleiben über ihre deklarativen Constraints bestimmt. Ein Separator besitzt während seiner Resize-Session exklusiv den Pointer. Im Normalmodus ist der Tab-Grip ausschließlich eine Reorder-Affordance für die direkte TabPane. Im Edit-Mode bzw. temporären Ctrl-Edit wird die gesamte Pane-Fläche zur strukturellen Drag-Affordance; Pane- und Tab-Grip-Icons werden dabei nicht gerendert. Ein Tab-Button repräsentiert den direkten Tab-Pane-Knoten. Ein Drop auf freie Workspace-Fläche erzeugt ein neues Floating Window für den herausgelösten Pane. Die kurze Bewegungsschwelle bewahrt Klick- und Widget-Aktionen. Pointer-Listener werden bei Ende, Abbruch, Escape, verlorenem Pointer-Capture und Unmount deterministisch entfernt.

Stack-Layer werden im selben Host übereinander angeordnet. Es gibt dafür keine Window-/Dock-Sonderlogik.

## Pane Context API

Widgets können mit `usePaneContext()` ausschließlich ihren aktuellen Render-Kontext lesen. Die API liefert reaktive, readonly Refs für:

- `paneId`
- `hostType` (`window`, `dock` oder bei direkter PaneHost-Nutzung `standalone`)
- `size` als aktuelle gemessene Pane-Größe
- `active` für die aktuelle strukturelle Aktivität, insbesondere den aktiven Tab-Zweig
- `visible` unter Einbeziehung von Host-Sichtbarkeit, Tab-Aktivität und Collapse-State
- `focused`, nur wenn der Host fokussiert und das Pane sichtbar ist
- `collapsed`

`PaneContext` veröffentlicht keine Manager, Pane-Tree-Referenzen oder DOM-Elemente. Größenmessung bleibt eine interne Vue-Adapter-Aufgabe und verwendet dieselbe `observeElementSize`-/`ResizeObserver`-Infrastruktur wie andere responsive Hosts. Observer werden beim Unmount deterministisch entfernt.

Ein Tab-Wechsel, Focus-/Minimize-Wechsel oder eine Host-Context-Änderung aktualisiert die Refs, ohne das Widget allein wegen der Context-Änderung neu zu mounten. Inaktive Tabs bleiben gemountet und melden eindeutig `active=false` sowie `visible=false`. Reparenting behält die Widget-Instanz-ID; der neue Host liefert anschließend den neuen Pane Context.

## Persistenz

Workspace-Schema Version 3 persistiert `StackPane` sowie `sizeMode`, `size`, `collapsible`, `collapsed` und `locked`. Version-1- und Version-2-Snapshots bleiben restorebar; neue Snapshots werden als Version 3 geschrieben.

`PaneContext` selbst ist Runtime-Zustand und wird nicht persistiert. Er wird aus dem kanonischen Pane-/Host-State und der aktuellen Rendergröße abgeleitet.

## Architekturgrenze

Pane-Modell und Constraint-Mathematik bleiben DOM-freier Core. `PaneHost` ist ausschließlich Renderer und Input-Adapter. Window-/Dock-Hosts kennen nur den jeweiligen Root-Pane und delegieren dessen Rendering an `PaneHost`.
