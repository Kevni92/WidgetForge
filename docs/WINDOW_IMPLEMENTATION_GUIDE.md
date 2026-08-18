# Window Implementation Guide

## Zweck

Dieses Dokument hält technische Leitlinien für das Window-System von WidgetForge fest. Als Referenz wurde insbesondere die aktuelle Implementierung von Dockview untersucht. Dockview wird **nicht** als Abhängigkeit eingebunden und seine öffentliche API wird nicht nachgebaut. Übernommen werden ausschließlich robuste Architektur- und Implementierungsprinzipien.

Referenz: https://github.com/dockview/dockview

## Verbindliche Grundsätze

### 1. WidgetForge-State ist die Wahrheit

Fensterposition, Größe, Fokus, Z-Reihenfolge und Instanz-ID werden im WidgetForge-State gehalten. Das DOM ist Darstellung und Eingabeschicht, nicht die primäre Datenquelle.

DOM-Messungen sind nur dort zulässig, wo reale Container-/Viewport-Größen benötigt werden. Änderungen werden anschließend über definierte Window-Manager-Operationen in den State zurückgeführt.

### 2. Core und Vue/DOM strikt trennen

Geometrie, Fokusreihenfolge, Constraints und Window-State sollen soweit sinnvoll in TypeScript-Core-Logik leben und ohne DOM testbar sein.

Vue-Komponenten übernehmen:

- Rendering,
- DOM-Refs,
- Pointer-Events,
- ResizeObserver-Anbindung,
- Weiterleitung von Benutzerinteraktionen an den Core.

Die Vue-Schicht darf nicht zum eigentlichen Window Manager werden.

### 3. Stabile Identität, kein Remount durch Bewegung

Eine geöffnete Widget-Instanz besitzt eine stabile Instanz-ID. Fokuswechsel, Verschieben, Resize oder spätere Layout-Änderungen dürfen die Widget-Komponente nicht unnötig neu mounten.

Listenindizes oder aktuelle Z-Positionen dürfen nicht als Komponentenidentität verwendet werden.

### 4. Expliziter Lifecycle und Cleanup

Jede längerlebige Ressource braucht einen expliziten Cleanup-Pfad:

- DOM-Event-Listener,
- globale Pointer-Listener,
- ResizeObserver,
- temporäre Drag-/Resize-Sessions,
- interne Event-Subscriptions.

Eine neue Interaktionssession ersetzt und bereinigt eine eventuell vorherige Session. Close/Unmount muss sämtliche zugehörigen Ressourcen deterministisch freigeben.

### 5. Drag/Resize als definierte Interaktionssession

Pointer-Interaktionen folgen einem klaren Ablauf:

1. `pointerdown` startet eine Session und speichert ausschließlich Startwerte.
2. Pointer Capture wird verwendet, wenn verfügbar.
3. `pointermove` berechnet neue Geometrie aus Startzustand + Pointer-Differenz.
4. Constraints werden zentral angewendet.
5. Der Window-State wird aktualisiert.
6. `pointerup` und `pointercancel` beenden dieselbe Session und räumen Listener/Capture auf.

Kritische Berechnungen dürfen nicht davon abhängen, dass das DOM bei jedem Move erneut den gerade mutierten Zustand korrekt zurückliefert.

### 6. Geometrie und Constraints als pure Funktionen

Move-/Resize-Mathematik soll getrennt von DOM-Events implementiert werden. Mindestens folgende Funktionen müssen isoliert testbar sein:

- Position aus Pointer-Differenz berechnen,
- Größe aus Handle + Pointer-Differenz berechnen,
- Min-/Max-Größe anwenden,
- Viewport-/Container-Grenzen anwenden,
- Position nach Größenänderung korrigieren.

Damit bleiben Pointer-Handler klein und Regressionen reproduzierbar.

### 7. Viewport-Verhalten explizit definieren

Ein Fenster darf nicht unkontrolliert vollständig unerreichbar werden. Das Verhalten wird nicht implizit durch CSS bestimmt.

WidgetForge definiert zentral:

- wie viel eines Fensters mindestens erreichbar bleiben muss,
- wie übergroße Fenster behandelt werden,
- wie sich ein Container-Resize auf bestehende Fenster auswirkt,
- wie Min-/Max-Größen mit Viewport-Grenzen zusammenspielen.

### 8. Fokus und Z-Reihenfolge zentral verwalten

Fokus und Z-Reihenfolge sind Window-Manager-State. Eine Interaktion mit einem Fenster setzt den Fokus zentral und bringt es deterministisch nach vorne.

Beim Schließen eines Fensters muss die verbleibende Reihenfolge konsistent bleiben. Komponenten dürfen eigene freie `z-index`-Werte nicht verwalten.

### 9. ResizeObserver defensiv verwenden

Aus Dockviews Implementierung werden folgende Schutzmaßnahmen übernommen:

- Resize-Ereignisse für bereits entfernte/disposed Komponenten ignorieren,
- versteckte Elemente mit bedeutungslosen `0x0`-Messungen nicht als echten Layoutzustand übernehmen,
- detached DOM ignorieren,
- identische Messungen nicht erneut propagieren,
- Subpixel-Jitter nicht als permanente Layoutänderung behandeln.

Wichtig: Der Observer beobachtet Container-/Rendering-Änderungen. Er ersetzt nicht den eigenen Window-State.

### 10. Ereignisse haben definierte Semantik

Window-Operationen sollen klar zwischen Benutzerinteraktion und programmatischer Änderung unterscheidbar bleiben, falls spätere Systeme dies benötigen.

Interaktionen sollten mindestens konzeptionell unterscheiden:

- Start,
- laufende Änderung,
- Commit/Ende,
- Abbruch.

Event-Reihenfolgen werden durch Tests abgesichert. Add/Close/Focus darf keine widersprüchlichen Zwischenzustände nach außen melden.

### 11. State von Beginn an serialisierbar halten

Auch bevor Workspace-Persistenz implementiert wird, soll der Window-State keine nicht serialisierbaren DOM-/Vue-Objekte enthalten.

Persistierbare Daten sind beispielsweise:

- Instanz-ID,
- Widget-ID,
- Parameter,
- Position,
- Größe,
- Reihenfolge,
- definierter Fensterzustand.

DOM-Elemente, Komponenteninstanzen und Event-Handler gehören nicht hinein.

## Vue-spezifische Leitlinien

Dockview hält seine eigentliche Engine außerhalb von Vue und verwendet die Vue-Schicht als Adapter. Diesen Grundsatz übernehmen wir.

Für WidgetForge bedeutet das:

- Core-Service-Objekte nicht unnötig tief durch Vue proxyifizieren,
- Vue-Reaktivität nur für den Zustand nutzen, der tatsächlich für Rendering relevant ist,
- Komponenten über stabile Keys erhalten,
- Widget Context klein halten,
- keine Registry-/Window-Interna direkt an Widgets durchreichen.

## Testmatrix für #7 bis #10

### #7 Widget Host

- zwei Instanzen desselben Widget-Typs bleiben isoliert,
- stabile Instanz-ID,
- Parameteränderungen remounten nicht unnötig,
- Unmount räumt Context-/Lifecycle-Ressourcen auf,
- ungültige Instanz rendert definierten Fehlerzustand.

### #8 Window Shell

- Shell bleibt rein präsentational,
- Titelbereich und Content sind getrennt,
- Close-/Focus-Interaktion wird nur nach außen gemeldet,
- Widget wird durch Shell-Änderungen nicht remounted,
- Styles kommen ausschließlich aus Theme-Tokens.

### #9 Window Manager

- Open/Close/Focus deterministisch,
- stabile IDs unabhängig von Reihenfolge,
- Fokus bringt Fenster nach vorne,
- Close verändert keine fremde Instanz,
- Z-Reihenfolge bleibt nach wiederholtem Fokus und Close konsistent,
- Core-State enthält keine DOM-/Vue-Objekte,
- ungültige Event-Reihenfolgen werden in Tests erkannt.

### #10 Drag/Resize

Zusätzlich zu Happy Paths zwingend testen:

- `pointercancel`,
- Pointer verlässt das Fenster/den Handle,
- mehrere Fenster und Fokuswechsel während Interaktion,
- Resize von allen vier Kanten und vier Ecken,
- Min-/Max-Größen,
- Container kleiner als Fenster,
- Fenster teilweise außerhalb des Containers,
- Container-Resize nach Positionierung,
- verstecktes oder gerade entferntes Fenster,
- wiederholte identische ResizeObserver-Messungen,
- Subpixel-/Rundungsfälle,
- Cleanup nach Unmount während aktiver Interaktion.

## Was bewusst nicht übernommen wird

- keine Dockview-Abhängigkeit,
- keine Dockview-Typen in der öffentlichen API,
- kein Docking-/Tab-/Split-Modell vor einem eigenen WidgetForge-Issue,
- kein großer zentraler DOM-Controller nach Dockview-Vorbild,
- keine direkte Übernahme von Quellcode,
- keine Position-/Größenwahrheit, die ausschließlich aus `getBoundingClientRect()` rekonstruiert wird.

## Referenzierte Dockview-Bereiche

Besonders relevant für die Analyse waren:

- `packages/dockview-core/src/overlay/overlay.ts`
- `packages/dockview-core/src/resizable.ts`
- `packages/dockview-core/src/lifecycle.ts`
- `packages/dockview-core/src/events.ts`
- `packages/dockview-core/src/dockview/dockviewComponent.ts`
- `packages/dockview-core/src/dockview/strictEventsSequencing.ts`
- `packages/dockview-core/src/dockview/deserializer.ts`
- `packages/dockview-vue/src/dockview/dockview.vue`
- `packages/dockview-core/src/__tests__/overlay/overlay.spec.ts`
