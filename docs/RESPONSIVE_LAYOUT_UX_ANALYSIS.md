# UX-Analyse: Responsive Layout, Snap und Lock

## Untersuchter Stand

- Repository: `Kevni92/WidgetForge`
- getesteter Commit: `ce345dd` (`main`, nach Merge von #167)
- lokaler Playground: `http://127.0.0.1:5174/WidgetForge/`
- Viewports: `1440×900`, `960×720` und `720×600`
- Methode: echte UI-Bedienung mit Playwright/Codex, Accessibility-Snapshots, DOM-Zuständen und temporären Screenshots außerhalb des Repositories

Die Analyse ist bewusst eine Beobachtung des aktuellen Produkts. Es wurden keine produktiven UX-Änderungen vorweggenommen.

## Kurzfazit

Die technische Funktionalität ist vorhanden, aber das mentale Modell ist derzeit über mehrere versteckte Ebenen verteilt:

1. Edit Mode liegt im überlaufenden `Workspace utilities`-Menü.
2. `Layout…` liegt im Fenster-Kontextmenü.
3. Responsive-Editing verwendet technische Achsenbegriffe (`Horizontal Start/End`, `Vertical Start/End`).
4. Snap wird erst beim Lock stillschweigend in einen Responsive-Spec übersetzt.
5. Active, dormant und materialisierte Regeln haben keine sichtbare Statusdarstellung.

Der empfohlene Zielzustand ist deshalb ein dreistufiges Modell:

```text
Floating  →  Snapped  →  Locked layout
```

Responsive Anchors, px/% und Fill sind Details des `Locked layout`, keine gleichwertigen konkurrierenden Modi.

## Beobachtete Workflows

### A – Responsives Left Menu

Im Desktop-Viewport war der reproduzierbare Weg:

```text
Workspace utilities (…) → Editing → Window auswählen
→ Context Menu → Layout… → Responsive
→ Anchors/Einheiten setzen → Save → Window locken
→ Viewport ändern
```

Befunde:

- Der Einstieg in den Edit Mode ist nicht als `Edit` sichtbar, sondern als Overflow-Aktion.
- Die Auswahl ist visuell über einen Rahmen erkennbar; im Accessibility-Snapshot gibt es keinen erklärenden Auswahlstatus. Der DOM-Zustand ist nur über `data-window-selected`/`data-pane-selected` sichtbar.
- Der Responsive-Dialog zeigt zwei technische Gruppen mit `Start`, `End`, Offset, Einheit und `Fill between anchors`.
- Beim Wechsel von Absolute zu Responsive wurden bestehende px-Werte als Offset übernommen. In der Analyse blieb bei einem 720px-Viewport ein Startoffset von 452px erhalten; das Window begann dadurch weit rechts und war teilweise abgeschnitten.
- Es ist nicht sichtbar, ob die Regel bereits aktiv ist oder erst durch Lock dauerhaft wirksam wird.

### B – Footer rechts neben einem Left Menu

Im Responsive-Dialog wurden Window-Ziele über Dropdowns gewählt. Die Optionen enthalten Titel, Instanz-ID und Kante, beispielsweise `Operations Alerts (alerts-main) right`. Mit einem zweiten Ziel (`Workspace right`) ließ sich `Fill between anchors` aktivieren.

Befunde:

- Die Beziehung „rechts neben diesem Window“ muss in zwei Achsen aus technischen Start-/End-Feldern zusammengesetzt werden.
- Es gibt keinen Canvas-Picker, keine Zielvorschau und keine sichtbare Verbindung zwischen Quelle und Ziel.
- Titel plus ID sind eindeutig, aber lange Listen erschweren die Auswahl.
- `Fill between anchors` deaktiviert Width/Height korrekt, erklärt aber nicht, warum das Feld deaktiviert ist.
- Nach dem Speichern bleibt die Beziehung im Workspace unsichtbar; ein Nutzer kann Abhängigkeiten nicht erkennen.

### C – Snap → Lock

Ein Drag an den linken Rand erzeugte im Playground eine linke Hälfte von `720×757px`. Das anschließende Lock zeigte nur ein generisches Lock-Symbol. Erst `Context Menu → Layout…` machte sichtbar, dass daraus ein Responsive-Spec mit `Workspace left`, `50%` Breite und vertikalem Fill entstanden war.

Befund: Die technische Konvertierung ist sinnvoll, aber die UI kommuniziert sie zu spät. Lock wirkt eher wie eine Sperre als wie „als Layout übernehmen“.

### D – Absolute vs. Responsive

Der Absolute-Dialog ist kompakt und eindeutig pixelorientiert (`X`, `Y`, `Width`, `Height`, jeweils px/%). Responsive ersetzt diese Eingaben durch zwei Achsengruppen und viele Zieloptionen. Der aktive Modus ist nur innerhalb des Dialogs sichtbar; im normalen Workspace gibt es keinen Zustandshinweis.

Die Nutzerabsichten „exakt hier bleiben“ und „mit dem Workspace verändern“ sind damit technisch abbildbar, aber nicht als dauerhaftes Modell erklärt. Lock kann in beiden Fällen auftreten und verstärkt die Begriffsüberlappung.

### E – Unlock → Bearbeiten → Re-Lock

Nach `Unlock` blieb der zuvor erzeugte Responsive-Spec im Layout-Dialog sichtbar, während die Geometrie unverändert blieb. Der Zustand war im Workspace selbst nicht als dormant markiert. Eine manuelle Größenänderung veränderte die aufgelöste Geometrie; in diesem Lauf zeigte der erneut geöffnete Dialog weiterhin den Responsive-Zustand. Das ist für Nutzer überraschend, weil die Materialisierung weder erklärt noch sichtbar gemacht wird.

### F – Mehrere gelockte Flächen

Für die Untersuchung wurden drei Windows gelockt (Commodity Exchange, Colony Administration und Operations Alerts) und anschließend bei `720×600` geprüft. Die Frames blieben als unabhängige Flächen sichtbar; es gab keine Dependency-Liste, keine Anchor-Linien und keine Reflow-Vorschau. Bei übernommenen px-Offsets konnten Flächen überlappen oder außerhalb der sinnvollen Arbeitsfläche beginnen.

Die Auswahl eines einzelnen Windows funktioniert, aber bei mehreren gelockten Flächen fehlt die Information, welches Window Quelle, Ziel oder abhängiger Verbraucher ist.

## Antworten auf die UX-Fragen

| Frage | Empfehlung |
| --- | --- |
| Zugang zu `Layout…` | Primär über sichtbare Selection-Toolbar/Inspector im Edit Mode, zusätzlich Context Menu als Kurzweg. |
| Lock | Als `Als Layout übernehmen` bzw. `Locked layout` erklären; Icon-Toggle allein reicht nicht. |
| Responsive-Terminologie | Im Primärpfad `Anchored layout` oder `Responsive layout`; `Responsive` als erklärter Begriff beibehalten, aber nicht als konkurrierenden Hauptzustand präsentieren. |
| Start/End vs. Left/Right | Primär `Left`, `Right`, `Top`, `Bottom`, `Width`, `Height`; Start/End nur in Advanced-Details. |
| Target-Auswahl | Kombination aus gruppiertem Target-Picker und `Auf Canvas wählen`; Dropdown allein ist für Beziehungen zu wenig anschaulich. |
| Anchor-Linien | Ja, nicht-interaktiv und nur im Edit Mode; Quelle, Zielkante und Richtung müssen erkennbar sein. |
| Fill zwischen Anchors | Bei zwei gegenüberliegenden Kanten automatisch vorschlagen und ausdrücklich erklären; optional als Detail sichtbar lassen. |
| Snap-Konvertierung | Beim Lock/„Als Layout übernehmen“, mit sichtbarer Bestätigung der erzeugten Beziehung. Snap bleibt bis dahin temporär. |
| Dormanter Spec | Ja, als eigener sichtbarer Zustand (`Responsive rule retained`, aber aktuell nicht aktiv). |
| Vier konkurrierende Systeme | Floating, Snapped und Locked layout als Hauptzustände; Dock ist eine Platzierungsaktion, Anchors sind ein Detail des Locked layout. |

## Empfohlener Haupt-Workflow

```text
Edit Mode
→ Window auswählen
→ Selection-Toolbar/Inspector öffnen
→ Layout bearbeiten
→ Left/Right/Top/Bottom oder Target-Picker setzen
→ Größe und Fill prüfen
→ Apply
→ Als Layout übernehmen / Lock
→ Status und Resize-Preview prüfen
```

Für Snap gilt ein verkürzter Weg:

```text
Window ziehen → Snap-Preview → Als Layout übernehmen
```

Dabei muss die Bestätigung die erzeugte Responsive-Regel in verständlicher Sprache zeigen.

## Ziel-UI und Prioritäten

- **P1:** Layout und Edit Mode auffindbar machen; aktiven/dormanten Zustand sichtbar machen.
- **P1:** Anchor-Editor von `Start/End` auf Richtungen und verständliche Targets umstellen.
- **P1:** Snap → Lock als bewusstes „Als Layout übernehmen“ erklären; Re-Lock/Materialisierung sichtbar machen.
- **P2:** Canvas-Target-Picker, Anchor-Linien und Dependency-/Resize-Preview ergänzen.
- **P2:** Offscreen- oder übernommene px-Offsets vor Apply erklären bzw. in eine sichere Zielgeometrie überführen.

## Vergleich und verworfene Alternativen

- **Windows Snap:** gutes Vorbild für sofortige Drag-Preview; die automatische Übernahme sollte bei WidgetForge aber erst mit einer bestätigten Layout-Aktion dauerhaft werden.
- **Figma Constraints/Auto Layout:** gutes Vorbild für Richtungsbegriffe, Inspector und visuelle Beziehungen; die vollständige Figma-Komplexität wäre für WindowForge überdimensioniert.
- **Visual Studio/Dashboard Docking:** gutes Vorbild für Docking als separate Platzierungsaktion; Dock sollte deshalb nicht mit Responsive Anchors verschmolzen werden.
- **Nur Context Menu:** erhält technische Kürze, löst aber Discoverability und Status nicht.
- **Nur ein zentraler Inspector:** wäre auffindbar, ersetzt aber den schnellen Context-Menu-Weg nicht. Die Kombination ist vorzuziehen.
- **Automatisches Fill ohne Erklärung:** reduziert Eingaben, verschleiert aber die Ursache deaktivierter Größenfelder. Automatik plus explizite Zusammenfassung ist verständlicher.

## Folge-Issues

Aus der Analyse wurden drei klar getrennte Umsetzungs-Issues angelegt:

1. [#169 – Responsive Layout Inspector und sichtbarer Workspace-Edit-Flow](https://github.com/Kevni92/WidgetForge/issues/169)
2. [#170 – Responsive Anchor-Editor mit Left/Right/Top/Bottom und visuellem Target-Picker](https://github.com/Kevni92/WidgetForge/issues/170)
3. [#171 – Snap-, Lock- und Responsive-State mit Preview und Materialisierungsfeedback zusammenführen](https://github.com/Kevni92/WidgetForge/issues/171)

Die Issues enthalten jeweils Problem, Zielzustand, Ablauf, technische Komponenten, Akzeptanzkriterien, Unit-/Component-/Playwright-Tests, Abgrenzung sowie die Vorgabe für eigenen Branch, PR, vollständige CI und Merge.

## Abschlussgrenze

Dieses Dokument entscheidet die UX-Richtung, implementiert aber keine der drei Produktänderungen. Die eigentliche Umsetzung beginnt erst in #169, #170 und #171.
