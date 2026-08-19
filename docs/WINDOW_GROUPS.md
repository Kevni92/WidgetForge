# Window Groups

`WindowGroupManager` gruppiert ausschließlich Floating Windows. Pane-Bäume und Widgets werden dadurch nicht gekoppelt.

## Semantik

- Eine Group-ID referenziert stabile Window-Instance-IDs.
- Ein Drag auf einem Gruppenmitglied verschiebt alle Mitglieder mit exakt demselben, gemeinsam begrenzten Delta. Die relative Anordnung bleibt erhalten.
- Minimieren und Wiederherstellen eines Gruppenmitglieds wirkt auf die gesamte Gruppe.
- `closeGroup()` ist als imperative Gruppenaktion verfügbar; normales Schließen eines einzelnen Fensters entfernt nur dieses Mitglied.
- Layer (`normal` / `always-on-top`) bleiben Eigenschaften der einzelnen Fenster und werden durch Gruppen nicht verändert.
- Snap oder Maximieren löst das betroffene Fenster aus der Gruppe, weil Gruppen nur Floating Windows repräsentieren.

## Persistenz

`WindowGroupManager.snapshot()` liefert ausschließlich serialisierbare Group-IDs und Window-Instance-IDs. `restore()` stellt die Gruppenzuordnung wieder her, nachdem die Fenster selbst wiederhergestellt wurden. Es werden keine DOM-/Vue-Objekte gespeichert.

Ein `WindowGroupManager`, der über `createWindowGroupManager(windowManager)` erzeugt wird, ist automatisch an diesen WindowManager gebunden. `WindowManagerHost` erkennt ihn ohne zusätzlichen WorkspaceHost-Contract und rendert eine dezente Gruppenmarkierung über Theme-Tokens.
