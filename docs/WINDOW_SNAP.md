# Window Snap

WidgetForge berechnet Snap-Zonen ausschließlich relativ zur nutzbaren Floating-Fläche des `WindowManagerHost`. Befindet sich dieser in einem `WorkspaceHost`, sind Top-/Bottom-/Side-Docks bereits aus dieser Fläche herausgerechnet.

## Zonen

Die aktuelle Core-Implementierung unterstützt:

- `left` – linke Hälfte
- `right` – rechte Hälfte
- `top` – obere Hälfte
- `bottom` – untere Hälfte
- Quarter- und Drittel-Zonen (`top-left`, `right-two-thirds` usw.)

Die Edge-Erkennung ist pure Core-Logik. Außerhalb des konfigurierten Randbereichs wird kein Snap vorgeschlagen. An oberen Ecken hat `top` Vorrang; Corner-/Quarter-Snap bleibt damit bewusst außerhalb dieses Issues.

## Preview und Commit

Während eines normalen Window-Drags berechnet `WindowManagerHost` die Zone aus den Pointer-Koordinaten und zeigt einen nicht interaktiven, semantisch gethemten Preview. Erst `pointerup` committed den Snap. `pointercancel`, Close und Unmount räumen Preview und Pointer-Session ohne Commit auf.

Der Preview trägt zusätzlich den semantischen Zonenamen und erklärt `Release to snap as layout`. Dadurch bleibt die Snap-Zone auch ohne Kenntnis der Geometrie verständlich. Nach `Snap → Lock` zeigt die Titlebar-Aktion `Als Layout übernehmen`; der resultierende Status wird als `Locked layout · Responsive active` sichtbar.

Die Standard-Titlebar bietet keine Snap-/Layout-Auswahl. Snap erfolgt im Default-Chrome ausschließlich über Drag und die vorhandenen Zonen/Previews; Maximieren, Restore und die Snap-Zustände bleiben davon getrennte Window-State-Operationen.

## Floating-Geometrie

Beim ersten Snap wird die vorherige Floating-Geometrie in `WindowState.snap.floatingGeometry` gespeichert. Ein Wechsel zwischen Snap-Zonen überschreibt sie nicht. Wird ein gesnapptes Window wieder aus dem Rand gezogen, wird diese Größe wiederhergestellt und sinnvoll unter dem Pointer platziert.

## Resize

Bei einer Änderung der Floating-Fläche – etwa durch Viewport- oder Dock-Resize – berechnet `WindowManager.constrainToContainer()` die Geometrie gesnappter Windows deterministisch aus ihrer Zone neu. Gleichzeitig werden die gespeicherte Floating-Geometrie und maximierte Restore-Geometrien gegen die neue Fläche normalisiert. Manuelles Resize eines gesnappten Windows materialisiert dagegen die neue freie Pixel-Geometrie und setzt `snap` auf `null`; spätere Container-Resizes verwenden dann nur noch die normale Geometrie-Normalisierung. Ein Titlebar-Drag aus einem Snap führt weiterhin über die bestehende pointer-relative Restore-Logik in den Floating-Zustand.

## Persistenz

Workspace-Snapshots speichern Snap-Zone und Floating-Geometrie. Ältere Snapshots ohne `snap` werden als unsnapped interpretiert. `restoreWorkspace(..., { container })` kann die gespeicherte Geometrie direkt gegen die aktuelle Floating-Fläche wiederherstellen; zusätzlich passt der Host beim ersten realen Größenwert gesnappte und freie Windows deterministisch an.

## Lock-Abgrenzung

Ein Per-Window-Lock ist kein Dock. Ein Fenster darf vor dem Lock gesnappt sein; beim Lock wird die Zone in einen responsiven `layoutSpec` mit Workspace-Kanten und Prozentgrößen übersetzt. Während des Locks werden Move, Resize, Snap, Unsnap, Anchor und Window-Docking nicht angeboten bzw. abgelehnt. Nach dem Unlock bleibt derselbe responsive Vertrag bestehen, bis die erste manuelle Geometrieänderung ihn materialisiert. Siehe [Responsive Window Layout](./WINDOW_LAYOUT.md).

Ändert sich die verfügbare Floating-Fläche, markiert der Window-Host gelockte responsive Fenster, deren aufgelöste Geometrie sich geändert hat, als `Resize affects this layout`. Das Feedback ist nicht interaktiv und verändert den kanonischen Workspace-State nicht.
