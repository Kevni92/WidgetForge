# Architektur

## Grundsatz

WidgetForge ist Infrastruktur. Das Framework kennt Widgets, Fenster, Navigation, Commands, Design Tokens und Datenquellen, aber keine konkrete Spieldomäne.

## Schichten

### 1. Core

Framework-unabhängige bzw. möglichst UI-arme Logik:

- Widget-Typen und Manifest-Verträge
- Widget Registry
- Instanz-IDs und Parameter-Validierung
- Workspace-State
- Command-Auflösung
- interne Navigation

### 2. Vue Integration

Vue-spezifische Adapter und Komponenten:

- Window Shell
- Window Host/Manager
- Composables für Widget-Kontext und Navigation
- Theme-/Token-Integration
- Data-Composables

### 3. Data Layer

Transportunabhängige reaktive Datenversorgung:

- Data API
- Cache/Store
- Subscription-Verwaltung
- Provider-/Transport-Schnittstelle
- Mock Provider für Playground/Tests
- später optionaler WebSocket-Adapter

### 4. UI Primitives

Kleine, wiederverwendbare Bausteine für simulationslastige Oberflächen. Diese dürfen weder Spielobjekte noch konkrete Produktoptik voraussetzen.

### 5. Playground

Eine eigenständige Demo-Anwendung, die ausschließlich die öffentliche WidgetForge-API nutzt. Sie dient als Referenz, visueller Test und GitHub-Pages-Ausgabe.

## Abhängigkeitsregeln

- Spiel-Widgets dürfen WidgetForge importieren.
- WidgetForge darf niemals Spiel-Widgets importieren.
- Generische Komponenten dürfen keine konkrete Spieldomäne kennen.
- Widgets sprechen nicht direkt miteinander.
- Widgets öffnen andere Inhalte über Navigation/Framework-Services.
- Widgets verwalten keine WebSocket-Verbindungen selbst.
- Fensterzustand und Spieldaten bleiben getrennt.
- Visuelle Komponenten verwenden Design Tokens statt Produkt-Hardcodes. Surface- und Elevation-Tokens (`surfaceWindow`, `surfaceFloating`, `surfaceOverlay`, `surfaceModal`, semantische Border/Shadow-Tokens und `backdrop`) beschreiben die Darstellung; `layer` und `zIndex` bleiben technische Stacking-Werte.

## Komponentenregeln

Eine Komponente soll genau eine klar erkennbare UI-Verantwortung besitzen. Aufteilung erfolgt nach Verhalten und Verantwortlichkeit, nicht nach einer willkürlichen Zeilenanzahl.

Warnsignale für eine zu große Komponente:

- mehrere voneinander unabhängige Verhaltensbereiche,
- eigene Datenbeschaffung plus Window-Management plus Darstellung,
- schwer isoliert testbare Logik,
- viele Props, die unterschiedliche Teilfunktionen konfigurieren,
- Änderungen an einer Funktion brechen regelmäßig andere Bereiche.

Große Komponenten werden in kleinere Komponenten oder Composables zerlegt, wenn dadurch Verantwortlichkeiten klarer werden.

## Widget Contract

Die konkrete TypeScript-API wird in einem eigenen Issue festgelegt. Konzeptionell benötigt eine Widget-Definition:

- `id`
- `component`
- Parameter-Schema/Typ
- Metadaten für Titel/Fenster
- Capability-Metadaten, falls benötigt

Die Definition soll deklarativ bleiben. Verhalten, das alle Widgets betrifft, gehört in Framework-Services und nicht in jedes Manifest.

## Window Management

Der Window Manager verwaltet ausschließlich UI-Zustand und Lifecycle. Fachliche Widget-Inhalte bleiben davon unabhängig.

Ein Fenster besitzt eine eigene Instanz-ID. Widget-Typ und Widget-Parameter sind davon getrennt. Dadurch sind mehrere Instanzen desselben Widgets möglich.

Strukturelle Änderungen werden als immutable Pane-Operationen vorbereitet. Ein Multi-Owner-Commit validiert den vollständigen Ziel-Workspace vor der Manager-Mutation und rollt bei einem Fehler auf den vorherigen serialisierbaren Snapshot zurück. Fenstergeometrie wird über pure Core-Funktionen relativ zur aktuellen Floating-Fläche normalisiert; DOM-Messung liefert nur die Containergröße. Preview-Zustände bleiben Vue-lokal und werden nie als kanonischer Workspace-State behandelt. Responsive Window-Layoutregeln bleiben als deklarativer `layoutSpec` im Core und werden über einen deterministischen Abhängigkeitsresolver in `geometry` aufgelöst; DOM bleibt dabei ausschließlich Quelle der Floating-Flächengröße. Modale Fenster werden zusätzlich über die generische Vue-Window-Infrastruktur fokussiert: der Initialfokus wird erst nach dem Mount gesetzt, Tab/Shift+Tab werden dynamisch innerhalb des obersten Dialogs gehalten und der ursprüngliche Auslöser wird nach dem Schließen wieder fokussiert. Ist er nicht mehr verfügbar, erhält der Window-Host einen programmatischen Fokus als definierter Fallback.

Der Core führt ergänzend einen serialisierbaren `layoutSpecState` (`active`, `dormant`, `materialized`, `none`). Die Vue-Hosts leiten daraus Inspector-Badges, Snap-/Lock-Feedback und Resize-Hinweise ab; visuelle Beziehungen bleiben nicht interaktive Overlays. Der responsive Editor bietet directional UX und Canvas-Picking, übersetzt diese Eingaben aber weiterhin in den bestehenden Start-/End-Vertrag.

Action-Chrome bleibt ebenfalls von der Fachlichkeit getrennt. `WidgetActionToolbar` misst die verfügbare primäre Dimension des Host-Elements und delegiert die deterministische Aufteilung von Prioritäten, vollständigen Gruppen und Overflow an eine DOM-unabhängige Core-Funktion. Der Overflow-Renderer wird per Teleport außerhalb von clip-penden Dock-Flächen platziert, verwendet dieselben Action-Bindings und besitzt eine eigene Menü-/Fokus-Semantik. Dadurch kann dieselbe Toolbar in Top-, Bottom- und Seiten-Docks sowie in Fenster-Chrome verwendet werden, ohne WindowManager- oder DockManager-Kopplung.

## Navigation

Navigation wird als Intent formuliert und zentral aufgelöst. Fachliche Widgets sollen nicht wissen müssen, wie Fenster erzeugt oder fokussiert werden. Eine globale Navigation kann über `createActiveWorkspaceNavigator()` gegen eine `WorkspaceCollectionManager` gebunden werden; der aktive `WindowManager` wird erst beim Aufruf des Intents aufgelöst und deshalb nicht beim Workspace-Wechsel veraltet. Ein im `WindowManagerHost` bereitgestellter Navigator bleibt dagegen an den aufrufenden Workspace gebunden. Dadurch öffnen globale Workspace-Chrome-Aktionen im aktiven Workspace, während interne Widget-Navigation ihren Caller-Kontext behält.

## Datenmodell

Das Framework trennt mindestens:

- Widget-/Workspace-State
- User-/Theme-Preferences
- externe fachliche Daten
- Connection-/Transport-State

Diese Zustände dürfen nicht in einem unstrukturierten globalen Store vermischt werden.

## Realtime-Prinzip

Der Data Layer stellt reaktive Daten bereit. Provider liefern Snapshots und Änderungen. Mehrere Konsumenten derselben Ressource sollen sich einen Cache bzw. eine Subscription teilen können.

Der WebSocket-Adapter ist austauschbar. Die Library darf nicht davon ausgehen, dass jedes Produkt dasselbe Nachrichtenprotokoll verwendet.

## Testing

Tests sind Bestandteil jedes Issues.

Mindestens erforderlich:

- Unit-Tests für Core-Logik und Parser,
- Component-Tests für Vue-Komponenten,
- Lifecycle- und Interaktionstests für Window-Verhalten,
- Tests für Fehler- und Randfälle,
- Integrationstests für zentrale Flows wie `Registry -> Widget öffnen -> Fenster verwalten`,
- Mock-Provider-Tests für Data-Layer-Verhalten.

Ein Feature gilt nicht als fertig, wenn die dazugehörigen Tests fehlen.

## Playground als Architekturtest

Der Playground darf keine internen APIs oder Sonderwege verwenden. Alles, was dort demonstriert wird, muss genau so aus einem externen Projekt mit dem npm-Package nutzbar sein.
