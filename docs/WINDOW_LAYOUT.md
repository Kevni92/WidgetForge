# Responsive Window Layout

## Kanonischer Zustand

`WindowState.geometry` ist immer die aktuell aufgelöste Pixel-Geometrie. Ein `layoutSpec` kann dabei aktiv oder dormant sein: Nur die Kombination aus `layoutLocked: true` und `layoutSpec` ist ein aktiver responsive Vertrag. Bei `layoutLocked: false` bleibt der Vertrag als gespeicherte Vorlage erhalten, während die aktuelle Pixel-Geometrie maßgeblich ist. DOMRects und Browserfenster sind keine State-Wahrheit; der Resolver erhält ausschließlich die Floating-Workspace-Größe.

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

Ein Lock friert bei einem freien Fenster weiterhin nur dann Pixel ein, wenn kein Layout-Vertrag vorhanden ist. Wird ein Fenster mit dormantem Vertrag erneut gelockt, wird dieser sofort gegen die bekannte Workspace-Größe aufgelöst. Wird ein gesnapptes Fenster gelockt, wird die Snap-Zone in semantische Kanten und Prozentgrößen übersetzt. Ein Unlock verändert die aktuelle aufgelöste Geometrie nicht; der Vertrag wird dormant. Die erste manuelle Bewegung oder Größenänderung materialisiert den aktuellen Zustand und entfernt den Vertrag. Ein abhängiges, gelocktes Fenster kann ein entsperrtes Referenzfenster weiterhin verwenden und folgt dessen aktueller Geometrie.

Workspace-Resizes und Änderungen an einem Fenster lösen nur aktive Verträge sowie deren echte abhängige Teilgraphen neu auf. Dormante Verträge werden weder durch fremde Fensterbewegungen, Fokusänderungen noch durch einen Workspace-Resize reaktiviert; ihre Pixel-Geometrie kann aber weiterhin als Referenz für aktive abhängige Fenster dienen.

Wird ein referenziertes Fenster geschlossen, materialisiert der `WindowManager` alle direkten abhängigen Verträge vor dem Entfernen in äquivalente absolute Pixelanker. Dadurch entstehen keine dangling references und die abhängigen Fenster bleiben an derselben Stelle.

## Snap-Mapping

Snap bleibt eine Window-Aktion. Beim Lock wird die Zone semantisch abgebildet: Hälften und Viertel verwenden Workspace-Kanten plus 50 Prozent, Drittel verwenden ein Drittel beziehungsweise zwei Drittel. Beim Resize wird der responsive Vertrag neu aufgelöst; eine freie manuelle Geometry-Änderung beendet dagegen einen vorhandenen Snap-State und materialisiert die aktuelle Pixel-Geometrie.

## Persistenz und History

Workspace-Version 3 speichert `layoutSpec` optional neben `geometry`; alte v1-, v2- und v3-Dokumente ohne dieses Feld bleiben gültig. Restore löst vorhandene Verträge mit der übergebenen aktuellen Floating-Größe auf. Eine Workspace-Größenänderung erzeugt keinen History-Eintrag. Änderungen am Vertrag, einschließlich Ankern, Einheiten, Referenzen, Materialisierung und Löschen referenzierter Fenster, erzeugen dagegen genau einen semantischen History-Schritt und sind über Undo/Redo wiederherstellbar.

## Edit-Mode

Das generische Context Menu eines ausgewählten Fensters enthält `Layout…` für freie und gelockte Fenster. Der modale Dialog zeigt Instanz-ID, aufgelöste Pixelwerte und absolute beziehungsweise responsive Eingaben. Responsive Eingaben unterstützen Workspace-/Fensteranker, signed offsets, px/%-Einheiten und Füllen zwischen Ankern. Vor `Save` wird der vollständige Vertrag gegen alle Fenster der Fläche validiert; `Cancel`, Escape und Fokus-Trapping verändern den Workspace nicht.

Im Edit-Mode ist der Einstieg zusätzlich als sichtbare `Edit layout`-Aktion und als Selection-Inspector verfügbar. Der Inspector zeigt Titel, stabile `instanceId`, die aufgelöste Geometrie in Pixeln sowie den kombinierten Oberflächen-/Regelstatus. `Floating`, `Snapped` und `Locked layout` beschreiben die Oberfläche; `Responsive active`, `Responsive dormant` und `Free geometry / materialized` beschreiben den Vertrag. Die öffentliche Core-Funktion `deriveWindowLayoutStatus()` hält diese Ableitung unabhängig von DOMRects.

Der Layout-Dialog verwendet im Primärpfad `Left`, `Right`, `Top`, `Bottom`, `Width` und `Height`. Fensterziele sind nach Workspace und Windows gruppiert und zeigen Titel plus stabile ID. `Auf Canvas wählen` aktiviert einen nicht-invasiven Pick-Modus; die Quelle und das gewählte Zielfenster werden im Workspace markiert.

Jede Achse wird im Dialog über genau einen `WindowLayoutAxisMode` bearbeitet:

- `start-size`: `Left + Width` beziehungsweise `Top + Height`,
- `end-size`: `Right + Width` beziehungsweise `Bottom + Height`,
- `stretch`: beide Kanten, die Größe wird als `auto` berechnet.

`stretch` ersetzt den früheren unabhängigen `Fill between ...`-Schalter. Beim Moduswechsel werden fehlende Gegenanker deterministisch aus der aktuellen Geometrie vorbelegt; beim Wechsel von `stretch` zu einer festen Größe wird die aktuell aufgelöste Dimension in Pixel materialisiert. Berechnete Größen werden nur für die Darstellung sinnvoll gerundet, nicht im Vertrag.

Ein Wechsel zwischen `px` und `percent` ist eine geometrieerhaltende Konvertierung. Breiten und horizontale Offsets verwenden die aktuelle Workspace-Breite, Höhen und vertikale Offsets die aktuelle Workspace-Höhe. Die öffentliche Core-Funktion `convertWindowLayoutValue()` behandelt dabei auch negative Werte und 0; die UI rundet nur die Eingabeanzeige auf höchstens drei Nachkommastellen. Der reine Unit-Wechsel verändert die aufgelöste Pixelgeometrie nicht.

Beim Wechsel von freier Geometrie zu Responsive wird zunächst `Left + Width` sowie `Top + Height` mit Workspace-Ankern und den aktuellen Pixelwerten erzeugt. Existiert nach einem Unlock noch eine dormante Regel, bietet der Dialog explizit die Wahl zwischen der retained Regel und einem Neustart aus der aktuellen Geometrie.

Responsive Fensterreferenzen werden im Edit-Mode als gestrichelte, nicht interaktive Beziehungen dargestellt. `findWindowLayoutDependents()` liefert für Resize-Feedback den direkten und transitiven Abhängigkeitsgraphen deterministisch sortiert.
