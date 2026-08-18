# Window System

## Zuständigkeit

Der `WindowManager` besitzt den kanonischen Fensterzustand. Vue-Komponenten stellen diesen Zustand dar und leiten Benutzerinteraktionen an den Manager weiter. DOM-Positionen oder `getBoundingClientRect()` sind nicht die persistente Wahrheit.

## Floating-Geometrie

Jede Fensterinstanz besitzt serialisierbar:

- `position: { x, y }`
- `size: { width, height }`
- `constraints.minSize`
- `constraints.maxSize`
- Fokus und Z-Reihenfolge

Koordinaten sind relativ zum Container des `WindowManagerHost`.

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

Widget-Metadaten `window.minSize` und `window.maxSize` werden zentral berücksichtigt. Ohne eigene Angaben verwendet WidgetForge sichere Fallback-Größen.

## Container-Grenzen

WidgetForge erzwingt nicht, dass ein Fenster vollständig in den Container passen muss. Das ist wichtig für kleine Viewports und große Simulationswidgets.

Stattdessen gilt:

- mindestens 64 px eines Fensters bleiben horizontal erreichbar,
- mindestens 32 px bleiben vertikal erreichbar,
- die obere Fensterkante wird nicht oberhalb des Containers abgelegt,
- übergroße Fenster bleiben erlaubt,
- bei einer Container-Verkleinerung werden bestehende Fenster auf diese Erreichbarkeitsregeln zurückgeführt,
- Min-/Max-Größen eines Widgets werden nicht zugunsten des Containers verletzt.

Die Standardwerte sind über die öffentlichen Core-Konstanten dokumentiert.

## ResizeObserver

Der `WindowManagerHost` beobachtet ausschließlich seine Containergröße. Messungen werden:

- auf ganze Pixel gerundet,
- bei identischem Ergebnis dedupliziert,
- bei `0x0`, verstecktem oder bereits entferntem Element ignoriert,
- beim Unmount vollständig abgemeldet.

Der Observer ersetzt niemals den Window-State.

## Fokus und Z-Reihenfolge

Drag oder Resize fokussieren die betroffene Instanz über den `WindowManager`. Der Manager hält die Z-Reihenfolge deterministisch und normalisiert sie nach Fokus- oder Close-Operationen.

## Bewusst nicht enthalten

Mit dem Floating-Window-System werden noch nicht implementiert:

- Docking,
- Tabs oder Split-Groups,
- Snapping/Smart Guides,
- native Browser-Popouts.

Diese Funktionen benötigen bei Bedarf eigene Issues und dürfen das bestehende Window-State-Modell erweitern, aber nicht ersetzen.
