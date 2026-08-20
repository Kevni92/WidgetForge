# WidgetForge – Konzept

## Vision

WidgetForge ist ein wiederverwendbares Vue.js-UI-Framework für komplexe Browser- und Simulationsspiele. Die Oberfläche wird primär aus frei verwalteten **Widgets in Fenstern** aufgebaut. Ein Spiel implementiert fachliche Widgets; WidgetForge stellt die Infrastruktur bereit, damit diese Widgets registriert, geöffnet, parametrisiert, verwaltet, gestaltet und mit Daten versorgt werden können.

Leitidee: **Ein neues UI-Feature soll im Normalfall aus einem Widget plus seiner Definition bestehen.** Das Framework übernimmt den Rest.

## Ziele

- Wiederverwendbare npm-Library auf Basis von Vue 3 und TypeScript.
- Kleine, klar verantwortliche Komponenten statt großer monolithischer Komponenten.
- Reine UI-Demo/Playground ohne Backend-Abhängigkeit.
- Veröffentlichung des Playgrounds über GitHub Pages.
- Strikte Trennung zwischen Framework-Infrastruktur und konkreter Spiellogik.
- Vollständig austauschbare visuelle Gestaltung über Design Tokens.
- Einfache Integration in unterschiedliche Endprodukte.
- Architektur, die spätere Live-Daten über WebSockets unterstützt, ohne WebSocket-Logik in Widgets zu verteilen.
- Testbarkeit als Grundanforderung, nicht als Nacharbeit.

## Kernmodell

### Widget

Ein Widget ist eine fachlich abgeschlossene UI-Einheit, z. B. Planetenübersicht, Markt, Schiff, Produktion oder Statistik.

Ein Widget besitzt eine Definition/Manifest mit mindestens:

- eindeutiger Widget-ID,
- Anzeigename,
- Vue-Komponente,
- typisierten Parametern,
- optionalen Fenster-Metadaten,
- optionalem Datenbedarf bzw. Daten-Adapter.

Beispielhaft soll ein Spiel ein Widget wie `planet-overview` mit einem Parameter `planetId` registrieren können. Danach kann WidgetForge Instanzen dieses Widgets erzeugen und verwalten.

### Widget Registry

Die Registry ist die zentrale Quelle aller verfügbaren Widgets. Sie validiert Definitionen und ermöglicht das Erzeugen von Widget-Instanzen anhand von Widget-ID und Parametern.

### Fenster

Widgets werden in Fenstern dargestellt. Fenster sollen schrittweise folgende Fähigkeiten erhalten:

- öffnen und schließen,
- fokussieren und Z-Reihenfolge verwalten,
- verschieben,
- Größe ändern,
- minimieren/wiederherstellen,
- mehrere Instanzen desselben Widget-Typs,
- optional Singleton-Verhalten pro Widget-Typ,
- Zustand speichern und wiederherstellen.

### Commands

Widgets sollen über eine einfache Kommandoeingabe geöffnet werden können. Ein Command löst sich auf eine Widget-ID plus Parameter auf. Beispielsweise kann ein Spiel einen Befehl definieren, der eine Planetenübersicht für eine konkrete ID öffnet.

Der Parser und die Ausführung gehören zum Framework; die fachlichen Commands werden vom jeweiligen Spiel registriert.

### Interne Navigation

Inhalte innerhalb eines Widgets sollen andere Widgets öffnen können, ohne direkt den Window Manager anzusprechen. Dafür stellt WidgetForge eine abstrakte Navigation bereit: Ziel + Parameter werden aufgelöst und als passende Widget-Instanz geöffnet.

Damit kann beispielsweise ein Planetenname innerhalb einer Tabelle oder Detailansicht die zugehörige Planetenansicht öffnen.

### Workspace

Der Workspace beschreibt den aktuellen UI-Zustand:

- offene Widget-Instanzen,
- Position und Größe,
- Fensterstatus,
- Fokus/Z-Reihenfolge,
- responsive Layoutverträge neben der aktuell aufgelösten Pixelgeometrie.

Der Zustand muss von konkreten Spielinhalten getrennt bleiben.

## Daten und Live-Updates

WidgetForge benötigt selbst keinen Server. Trotzdem soll die Datenanbindung von Anfang an abstrahiert sein.

Widgets sollen **keine WebSocket-Verbindungen selbst verwalten**. Stattdessen konsumieren sie reaktive Daten über eine Framework-Schnittstelle.

Geplantes Modell:

`Widget -> Data API -> Store/Cache -> Data Provider/Transport`

Für Entwicklung und GitHub Pages wird ein Mock-Provider verwendet. Ein späteres Spiel kann einen WebSocket-Provider anschließen.

Die Datenebene soll langfristig unterstützen:

- initiale Snapshots,
- Live-Updates,
- Subscribe/Unsubscribe anhand tatsächlich verwendeter Daten,
- gemeinsame Nutzung derselben Daten durch mehrere Widgets,
- Connection-/Loading-/Error-State,
- Reconnect und Wiederherstellung von Subscriptions im Transport-Adapter,
- serverautoritativen Zustand.

Transportdetails dürfen nicht in normalen Widget-Komponenten landen.

## Design und Theming

WidgetForge darf keine feste visuelle Identität voraussetzen. Farben, Typografie, Schriftgrößen, Abstände, Radien, Schatten, Layer, Fenstermaße und weitere visuelle Größen werden über semantische Design Tokens definiert.

Komponenten referenzieren Tokens, keine produktbezogenen Hardcodes. Dadurch kann dieselbe Library in stilistisch vollständig unterschiedlichen Spielen eingesetzt werden.

## Geplante UI-Bausteine

Neben dem Widget-/Fenstersystem sollen wiederverwendbare primitives für simulationslastige Oberflächen entstehen. Diese werden erst implementiert, wenn das Kernsystem stabil ist.

Geplant sind insbesondere:

- einfache Tabellen,
- komplexe Datentabellen mit Sortierung/Filterung,
- Key/Value- und Statistikdarstellungen,
- standardisierte Loading-/Empty-/Error-States,
- Notification-System,
- Context-Menüs,
- Modal-/Confirmation-Mechanismen,
- verschachtelbare Informations-Tooltips/Glossar,
- erklärbare Werte, bei denen ein Hover die Zusammensetzung eines Werts darstellen kann.

Tooltips sollen innerhalb ihres Inhalts wiederum interaktive/erklärbare Begriffe unterstützen können.

## Bewusst nicht Teil von WidgetForge

- Keine konkrete Spiellogik oder Simulation.
- Keine fest eingebauten Spielobjekte wie Planet, Schiff oder Ware.
- Kein eigener Game-Server.
- Keine Datenbank.
- Keine vorgeschriebene WebSocket-Protokollimplementierung.
- Keine hartcodierte Produktoptik.
- Keine frei auf dem Bildschirm verankerten Button-/Bubble-/Anchor-Shortcuts.
- Keine Businesslogik innerhalb generischer UI-Komponenten.
- Keine direkte Kopplung eines Widgets an ein anderes Widget.
- Keine riesigen All-in-one-Komponenten.

## Qualitätsprinzipien

1. Jede Komponente hat eine klar benennbare Verantwortung.
2. Kleine Komponenten werden durch Komposition zusammengesetzt.
3. Öffentliche APIs sind klein, typisiert und dokumentiert.
4. Framework-Code kennt keine konkrete Spieldomäne.
5. Abhängigkeiten zeigen von fachlichen Widgets zur Framework-API, nicht umgekehrt.
6. Jede neue Komponente und jedes neue Verhalten erhält Tests.
7. Fehlerfälle und Lifecycle-Verhalten werden genauso getestet wie der Happy Path.
8. Der Playground demonstriert die tatsächlich veröffentlichte API und vermeidet Sonderwege.
9. Kein Feature wird nur für die Demo implementiert, wenn es nicht über die Library-API nutzbar ist.
10. Architekturänderungen werden dokumentiert, bevor sich widersprüchliche Muster etablieren.

## Erfolgskriterium

WidgetForge ist erfolgreich, wenn ein neues Spiel die Library installieren, ein Widget mit Manifest und Parametern registrieren und dieses über dieselben Framework-Mechanismen als Fenster öffnen kann, ohne Window-Management, Styling-Infrastruktur, Persistenz oder Transportlogik neu zu implementieren.

## Lesen und serverseitige Mutationen

WidgetForge trennt das Beobachten externer Daten vom Anfordern serverseitiger Zustandsänderungen:

```text
READ
Widget -> DataClient -> DataProvider -> Consumer-Transport -> Server

WRITE
Widget -> MutationClient -> MutationProvider -> Consumer-Transport -> Server
```

`DataClient` stellt abonnierte Ressourcen, Cache- und Subscription-Zustand bereit. `MutationClient` führt explizite, typisierte Invocations aus. Mutationen werden weder gecacht noch dedupliziert; zwei explizite Aufrufe bleiben zwei Requests. Ein erfolgreicher Mutation-Request schreibt keine Data-Ressource lokal um und invalidiert keinen Cache automatisch. Der serverautoritativ publizierte Snapshot oder das Update kommt weiterhin über die Data-Pipeline zurück.

Die konkrete Netzwerktechnik, das Wire-Format, der Server und fachliche Fehlercodes bleiben vollständig beim Consumer. `MutationProvider` ist deshalb ein kleiner, transport- und domänenunabhängiger Vertrag. WidgetForge führt keine automatische Retry- oder Offline-Queue-Policy ein, weil ein Verbindungsabbruch nicht beweist, dass der Server eine Mutation nicht bereits verarbeitet hat.

`WidgetAction` bleibt davon getrennt: Ein Consumer kann in einem Action-Handler eine Mutation ausführen, aber Mutation und UI-/Navigations-Action sind keine gemeinsamen Framework-Konzepte.
