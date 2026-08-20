# Advanced Window Chrome

Window-Chrome ist generische Presentation-Konfiguration und enthält keine Widget-/Domainlogik.

## Optionen

`WindowOptions` unterstützt zusätzlich:

- `header: always | focused | hover | hidden`
- `chrome: default | borderless | none`
- `glass` für transparente/gläserne Präsentation
- optionale `icon`, `badge` und `status`-Texte
- deklarative `headerActions` mit stabiler ID, Label, Seite, Icon/Tooltip und optionaler `actionRef`

Header-Actions enthalten bewusst keine Callbacks. `WindowShell` emittiert lediglich das ausgewählte Action-Objekt als Intent; die Anwendung entscheidet außerhalb des Window-Core über dessen Bedeutung.

## Chrome-less Fenster

`chrome: none` entfernt Rahmen, Shadow und Header. Wenn das Fenster beweglich ist, stellt `WindowFrame` ausschließlich am oberen Rand einen kleinen Drag-Strip bereit. Dadurch bleibt das Fenster verschiebbar, ohne Widget-Interaktion im gesamten Content als Drag-Fläche zu missbrauchen.

Ein `layoutLocked`-Fenster ist unabhängig von `chrome` immer chrome-less: Titlebar, Titel, Header-Actions und Resize-Griffe werden nicht gerendert. Der Content startet direkt an der Window-Surface, bleibt aber vollständig fokussier- und interaktiv. Die generische Edit-Mode-Auswahl und das Context Menu übernehmen das Unlock.

## Lifecycle

Focus- und Hover-basierte Header-Sichtbarkeit verändert nur die Chrome. Der Pane-/Widget-Host bleibt stabil gemountet. Header-Actions sind native Buttons und damit per Tastatur fokussier- und auslösbar.

Alle Varianten werden über semantische Theme-Tokens sowie Presentation-Optionen gestylt; Widgets müssen keine Window-Chrome-Klassen oder zIndex-Regeln kennen.
