# Window Roles

WidgetForge trennt semantische Window-Rollen vom konkreten `zIndex`. Anwendungen wählen eine Rolle; die Framework-Hosts leiten daraus Stacking, Interaktion und Chrome ab.

## Rollen

- `normal`: reguläres Workspace-/Task-Fenster.
- `utility`: Werkzeug-/Hilfsfenster. Es liegt semantisch über normalen Fenstern, behält aber seine normale Window- und Layer-Identität.
- `overlay`: kurzlebige, chrome-arme Oberfläche. Standardmäßig ohne Header sowie ohne Minimize/Maximize.
- `modal`: blockiert die Interaktion mit allen darunterliegenden Fenstern, wird als `dialog` mit `aria-modal` gerendert und besitzt die höchste Rollenebene.

`windowRoleRank()` definiert ausschließlich die interne Rollenreihenfolge. Consumer sollen keine eigenen zIndex-Werte setzen oder Widget-Code mit Stacking-Regeln versehen.

## Modal-Semantik

Solange mindestens ein sichtbares Modal existiert, wird das oberste Modal fokussiert gehalten. Hintergrundfenster sind für Pointer-Interaktion gesperrt und `aria-hidden`. Ein token-basierter Backdrop trennt den modalen Bereich visuell. `Escape` schließt ausschließlich das oberste schließbare Modal; danach erhält das nächste Modal oder das oberste verbleibende Fenster den Fokus.

Verschachtelte Modals sind deterministisch: nur das oberste ist interaktiv. Nicht schließbare Modals bleiben bei `Escape` geöffnet und werden erneut fokussiert.

## Persistenz

Die Rolle ist Teil von `WindowOptions` und wird daher mit dem bestehenden Workspace-Snapshot serialisiert und wiederhergestellt. Ältere Snapshots ohne `role` erhalten beim Restore automatisch `normal`.
