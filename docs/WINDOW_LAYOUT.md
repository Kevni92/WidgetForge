# Responsive Window Layout

## Kanonischer Zustand

`WindowState.geometry` ist immer die aktuell aufgelöste Pixel-Geometrie. Wenn `layoutSpec` vorhanden ist, beschreibt dieser serialisierbare Vertrag die gewünschte responsive Geometrie und ist die Quelle für die nächste Auflösung. DOMRects und Browserfenster sind keine State-Wahrheit; der Resolver erhält ausschließlich die Floating-Workspace-Größe.

`layoutSpec` besteht aus einer horizontalen und einer vertikalen Achse. Jede Achse verwendet genau eine der folgenden Formen:

- `start + size`
- `end + size`
- `start + end` beziehungsweise `auto` für Füllen zwischen den Ankern

Anker zeigen auf `workspace`-Kanten oder auf eine Kante eines anderen Fensters derselben Floating-Fläche. Fensterreferenzen verwenden stabile `instanceId`-Werte. Selbstreferenzen, unbekannte IDs, Achsenfehler und Zyklen werden mit `WindowLayoutValidationError` abgelehnt.

`px`-Werte sind Pixel. `percent` bezieht sich auf die jeweilige Breite oder Höhe der Floating-Fläche. Offsets sind vorzeichenbehaftet und werden nach der Zielkante angewendet. Fensterreferenzen werden topologisch und unabhängig von Z-Reihenfolge aufgelöst.

## Constraints und Fehlerfälle

Min-/Max-Größen werden nach der Berechnung deterministisch geklammert. Bei einem `start + end`-Füllbereich bleibt der Startanker erhalten; eine zu kleine Fläche kann deshalb über die Workspace-Kante hinauslaufen, wenn die deklarierte Mindestgröße sonst nicht eingehalten werden kann. Eine umgekehrte Ankerreihenfolge ist dagegen ein widersprüchiger Vertrag und wird abgelehnt.

Ein Fenster ohne `layoutSpec` behält das bestehende pixelbasierte Verhalten. `createAbsoluteWindowLayoutSpec()` kann bei Bedarf eine feste Pixelgeometrie als deklarativen Vertrag ausdrücken, etwa um ein gelocktes Fenster im generischen Layout-Dialog zu bearbeiten.

## Lock, Unlock und Referenzen

Ein Lock friert bei einem freien Fenster weiterhin nur dann Pixel ein, wenn kein Layout-Vertrag vorhanden ist. Wird ein gesnapptes Fenster gelockt, wird die Snap-Zone in semantische Kanten und Prozentgrößen übersetzt. Ein Unlock verändert die aktuelle aufgelöste Geometrie nicht; der Vertrag darf bestehen bleiben. Die erste manuelle Bewegung oder Größenänderung materialisiert den aktuellen Zustand und entfernt den Vertrag. Ein abhängiges Fenster kann ein entsperrtes Referenzfenster weiterhin verwenden und folgt dessen aktueller Geometrie.

Wird ein referenziertes Fenster geschlossen, materialisiert der `WindowManager` alle direkten abhängigen Verträge vor dem Entfernen in äquivalente absolute Pixelanker. Dadurch entstehen keine dangling references und die abhängigen Fenster bleiben an derselben Stelle.

## Snap-Mapping

Snap bleibt eine Window-Aktion. Beim Lock wird die Zone semantisch abgebildet: Hälften und Viertel verwenden Workspace-Kanten plus 50 Prozent, Drittel verwenden ein Drittel beziehungsweise zwei Drittel. Beim Resize wird der Vertrag neu aufgelöst; die alte Snap-Geometrie dient weiterhin als Floating-Restore-Geometrie.

## Persistenz und History

Workspace-Version 3 speichert `layoutSpec` optional neben `geometry`; alte v1-, v2- und v3-Dokumente ohne dieses Feld bleiben gültig. Restore löst vorhandene Verträge mit der übergebenen aktuellen Floating-Größe auf. Eine Workspace-Größenänderung erzeugt keinen History-Eintrag. Änderungen am Vertrag, einschließlich Ankern, Einheiten, Referenzen, Materialisierung und Löschen referenzierter Fenster, erzeugen dagegen genau einen semantischen History-Schritt und sind über Undo/Redo wiederherstellbar.

## Edit-Mode

Das generische Context Menu eines ausgewählten Fensters enthält `Layout…` für freie und gelockte Fenster. Der modale Dialog zeigt Instanz-ID, aufgelöste Pixelwerte und absolute beziehungsweise responsive Eingaben. Responsive Eingaben unterstützen Workspace-/Fensteranker, signed offsets, px/%-Einheiten und Füllen zwischen Ankern. Vor `Save` wird der vollständige Vertrag gegen alle Fenster der Fläche validiert; `Cancel`, Escape und Fokus-Trapping verändern den Workspace nicht.
