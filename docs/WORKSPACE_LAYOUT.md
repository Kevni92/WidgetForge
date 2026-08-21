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

## Visueller Zustandsvertrag

Produktive Surface-Styles und temporäre Editor-Affordances bleiben getrennt:

- `data-focused` beschreibt den fachlichen Window-Fokus; `data-window-visual-focused` beschreibt, ob dieser Fokus die äußere Window-Surface visuell markieren darf. Bei `layoutLocked` bleibt die Surface trotz fachlichem Fokus ohne Focus-Border.
- `data-pane-active` beschreibt die aktive fachliche Pane-/Tab-Navigation und ändert keinen äußeren Window- oder Dock-Border.
- `data-layout-selection="selected|unselected"` beschreibt ausschließlich die temporäre Auswahl bzw. Hover-Kandidatur im Layout Edit Mode. Window-, Dock- und Pane-Selection wird über `outline`/Editor-Layer außerhalb der produktiven Borderbox dargestellt.
- `data-pane-locked` und `data-window-layout-locked` beschreiben Lock-Zustände; sie sind keine Focus- oder Selection-Zustände.

Beim Verlassen des Edit Mode werden die `data-layout-selection`-Marker entfernt. Interne Buttons, Inputs und Tabs behalten dagegen ihren eigenen `:focus-visible`- beziehungsweise Active-State.

Der Layout Inspector ist Editor-Chrome außerhalb der Floating-Layoutfläche. Sein UI-State (`docked`, `floating` oder `minimized` sowie die Floating-Position) wird deshalb separat als laufender `WorkspaceHost`-Session-State gehalten. Inspector-Bewegungen und Moduswechsel werden nicht in Workspace-/Window-History, Geometrie oder Layout-Snapshots geschrieben; beim Wechsel der Auswahl bleibt dieser State erhalten.

## Object- und Styles-Inspector

Im Edit Mode projiziert der Layout Inspector die aktuelle Host-Auswahl in zwei semantische Tabs: `Object` zeigt die Eigenschaften des ausgewählten Windows, Docks oder Panes, `Styles` bearbeitet den gemeinsamen `LayoutSurfaceStyle`. Die Tabs sind als WAI-ARIA-Tablist umgesetzt und per `ArrowLeft`/`ArrowRight` sowie `Home`/`End` bedienbar. Der Tab-Zustand ist reiner Inspector-UI-State und verändert weder Workspace-Auswahl noch Layout.

Die Auswahl bleibt im `WorkspaceEditController` getrennt nach Window, Dock und Pane. Jede Auswahl enthält eine stabile Host-Art und ID; bei einem Pane kommen Owner-Art und Owner-ID hinzu. Der Inspector besitzt diese Auswahl nicht selbst, sondern erhält sie als Projektion und gibt Style-Intents an den `WorkspaceHost` zurück. Dadurch können Window-, Dock- und Pane-Styles über dieselbe UI geändert werden, ohne Widgets oder konkrete Spieldomänen zu kennen.

Style-Eingaben werden während der Eingabe live angewendet. Der `WorkspaceHost` öffnet dafür eine gemeinsame History-Transaktion; Blur/Enter beziehungsweise ein direktes Toggle/Select committen genau eine Änderung, Escape verwirft die gesamte Vorschau. Das gilt auch für Docks und verschachtelte Panes. Gesperrte Hosts bleiben im Edit Mode für Style-Änderungen auswählbar; die temporäre Editor-Outline bleibt dabei unabhängig vom produktiven Surface-Style.

## Persistente Surface-Styles

`LayoutSurfaceStyle` ist das gemeinsame, serialisierbare Flächenmodell für Windows, Docks und Panes. Es beschreibt ausschließlich die produktive Oberfläche: Hintergrund (`theme`, `transparent` oder `custom`), vier unabhängig konfigurierbare Rahmen, Radius, vierseitiges Padding, Opazität und Schatten (`none`, `sm`, `md`, `lg`). Arbiträre CSS-Strings gehören nicht zum Modell.

Bei einem Window überschreibt ein gesetzter Surface-Style die rollen- und Chrome-basierte Surface-Basis. Editor-Auswahl, Fokus-Markierung und Layout-Affordances bleiben davon getrennt. Ist `surfaceStyle` nicht gesetzt, bleiben die bisherigen Theme- und Chrome-Defaults unverändert. Window-, Dock- und Pane-Snapshots klonen und persistieren den Style gemeinsam mit ihrem Besitzer; dadurch bleibt er auch über Restore, Undo/Redo und Pane-Mutationen stabil.

Panes akzeptieren die bisherigen `background`-/`backgroundColor`-Felder weiterhin. Sie werden im Renderpfad in das gemeinsame Surface-Modell projiziert. Wenn zusätzlich `settings.surfaceStyle` vorhanden ist, hat dieser Vorrang; neue Persistenz sollte daher den typisierten Surface-Style verwenden.
