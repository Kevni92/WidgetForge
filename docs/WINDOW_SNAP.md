# Window Snap

WidgetForge berechnet Snap-Zonen ausschließlich relativ zur nutzbaren Floating-Fläche des `WindowManagerHost`. Befindet sich dieser in einem `WorkspaceHost`, sind Top-/Bottom-/Side-Docks bereits aus dieser Fläche herausgerechnet.

## Zonen

Die erste Version unterstützt:

- `left` – linke Hälfte
- `right` – rechte Hälfte
- `top` – gesamte Floating-Fläche

Die Edge-Erkennung ist pure Core-Logik. Außerhalb des konfigurierten Randbereichs wird kein Snap vorgeschlagen. An oberen Ecken hat `top` Vorrang; Corner-/Quarter-Snap bleibt damit bewusst außerhalb dieses Issues.

## Preview und Commit

Während eines normalen Window-Drags berechnet `WindowManagerHost` die Zone aus den Pointer-Koordinaten und zeigt einen nicht interaktiven, semantisch gethemten Preview. Erst `pointerup` committed den Snap. `pointercancel`, Close und Unmount räumen Preview und Pointer-Session ohne Commit auf.

Die Standard-Titlebar bietet keine Snap-/Layout-Auswahl. Snap erfolgt im Default-Chrome ausschließlich über Drag und die vorhandenen Zonen/Previews; Maximieren, Restore und die Snap-Zustände bleiben davon getrennte Window-State-Operationen.

## Floating-Geometrie

Beim ersten Snap wird die vorherige Floating-Geometrie in `WindowState.snap.floatingGeometry` gespeichert. Ein Wechsel zwischen Snap-Zonen überschreibt sie nicht. Wird ein gesnapptes Window wieder aus dem Rand gezogen, wird diese Größe wiederhergestellt und sinnvoll unter dem Pointer platziert.

## Resize

Bei einer Änderung der Floating-Fläche – etwa durch Viewport- oder Dock-Resize – berechnet `WindowManager.constrainToContainer()` die Geometrie gesnappter Windows deterministisch aus ihrer Zone neu. Gleichzeitig werden die gespeicherte Floating-Geometrie und maximierte Restore-Geometrien gegen die neue Fläche normalisiert. Manuelles Resize eines gesnappten Windows führt zuerst zurück in den Floating-Zustand.

## Persistenz

Workspace-Snapshots speichern Snap-Zone und Floating-Geometrie. Ältere Snapshots ohne `snap` werden als unsnapped interpretiert. `restoreWorkspace(..., { container })` kann die gespeicherte Geometrie direkt gegen die aktuelle Floating-Fläche wiederherstellen; zusätzlich passt der Host beim ersten realen Größenwert gesnappte und freie Windows deterministisch an.
