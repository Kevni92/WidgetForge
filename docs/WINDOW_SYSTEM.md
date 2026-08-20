# Window System

## Zuständigkeit

Der `WindowManager` besitzt den kanonischen Fensterzustand. Vue-Komponenten stellen diesen Zustand dar und leiten Benutzerinteraktionen an den Manager weiter. DOM-Positionen oder `getBoundingClientRect()` sind nicht die persistente Wahrheit.

## Window Content

Ein Window enthält genau einen kanonischen `rootPane`. Der Root-Pane kann ein Widget-Pane oder ein beliebig verschachtelter Split-Pane sein. Das Window selbst enthält keine parallelen `widgetId`-/`parameters`-Felder mehr.

`WindowManager.open({ widgetId, parameters })` bleibt als Convenience-API erhalten und erzeugt intern einen Widget-Root-Pane. `openPane(...)` öffnet vollständige Pane-Bäume. Layoutänderungen laufen über `setRootPane(...)` und werden vom `PaneHost` gerendert.

`openEmptyWindow()` beziehungsweise `openLauncherWindow()` erzeugt ein normales Fenster mit einem framework-eigenen Command-Launcher-Root. `replaceLauncherWindow()` validiert das Ziel-Widget und ersetzt den Root-Pane atomar; die Fensterinstanz bleibt stabil und die neue Widget-Instanz erhält deterministisch die ID `<windowInstanceId>.widget`. Ohne expliziten Fenstertitel wird der Titel aus dem Widget-Manifest aktualisiert. Die Fenstergröße wird nur gegen die Ziel-Constraints angepasst.

Damit gilt die Architekturgrenze:

`Window -> Root Pane -> Widget / Split Panes`

Widgets kennen weder WindowManager noch Pane-Management.

## Floating-Geometrie

Jede Fensterinstanz besitzt serialisierbar:

- `position: { x, y }`
- `size: { width, height }`
- `constraints.minSize`
- `constraints.maxSize`
- Fokus und Z-Reihenfolge
- `layoutLocked` als unabhängiger Per-Window-Layout-Lock
- den vollständigen Root-Pane-Baum

Koordinaten sind relativ zum Container des `WindowManagerHost`.

## Workspace-Persistenz

Workspace-Format v3 speichert den Root-Pane-Baum, Titel, Geometrie, Constraints, Window-Mode, Fokus, Z-Reihenfolge und den Per-Window-Lock. Das alte Format v1 wird beim Restore weiterhin gelesen und als einzelner Widget-Root-Pane migriert. Fehlt `layoutLocked` in älteren Dokumenten, wird `false` verwendet. Runtime-Lifecycle-Objekte bleiben ausdrücklich außerhalb des serialisierten States.

Ein Launcher-Root ist Teil desselben serialisierbaren Pane-Modells. Dadurch können sowohl ein noch leerer Launcher als auch der nachfolgende Widget-Zustand ohne Sonderformat gespeichert und wiederhergestellt werden.

## Dragging

- Dragging beginnt ausschließlich an dem von `WindowShell` markierten Titelbereich.
- Die Berechnung basiert auf Startgeometrie plus Pointer-Differenz.
- Pointer Capture wird genutzt, wenn der Browser es unterstützt.
- Globale Pointer-Listener halten die Interaktion funktionsfähig, wenn der Pointer den Titelbereich verlässt.
- `pointerup`, `pointercancel`, Close und Unmount beenden die Session und entfernen Listener/Capture.

## Resize

Es existieren acht Resize-Richtungen:

- `top`, `bottom`, `left`, `right`
- `top-left`, `top-right`, `bottom-left`, `bottom-right`

Widget-Metadaten `window.minSize` und `window.maxSize` werden bei der Convenience-API zentral berücksichtigt. Pane-basierte Windows können Constraints explizit beim Öffnen setzen.

## Container-Grenzen

WidgetForge erzwingt nicht, dass ein Fenster vollständig in den Container passen muss. Das ist wichtig für kleine Viewports und große Simulationswidgets.

Stattdessen gilt:

- mindestens 64 px eines Fensters bleiben horizontal erreichbar,
- mindestens 32 px bleiben vertikal erreichbar,
- die obere Fensterkante wird nicht oberhalb des Containers abgelegt,
- übergroße Fenster bleiben erlaubt,
- bei einer Container-Verkleinerung werden bestehende Fenster auf diese Erreichbarkeitsregeln zurückgeführt,
- Min-/Max-Größen werden nicht zugunsten des Containers verletzt.

## ResizeObserver

Der `WindowManagerHost` beobachtet ausschließlich seine Containergröße. Messungen werden auf ganze Pixel gerundet, bei identischem Ergebnis dedupliziert, bei `0x0`, verstecktem oder entferntem Element ignoriert und beim Unmount vollständig abgemeldet. Der Observer ersetzt niemals den Window-State.

## Fokus und Z-Reihenfolge

Drag oder Resize fokussieren die betroffene Instanz über den `WindowManager`. Der Manager hält die Z-Reihenfolge deterministisch und normalisiert sie nach Fokus- oder Close-Operationen.

Gelockte Fenster werden vor normalen Floating- und Always-on-top-Fenstern gestapelt. Fokus kann die Reihenfolge innerhalb der gelockten Gruppe deterministisch ändern, hebt ein gelocktes Fenster aber niemals über ein normales Floating-Fenster.

## Folgende Erweiterungen

Window-Layer/Presentation, Workspace-Docks, Snapping sowie Window-/Pane-Docking werden in den separaten Issues #63 bis #66 auf diesem State-Modell aufgebaut.
