# Reactive Data API

Widgets konsumieren externe Daten ausschließlich über die WidgetForge Data API. Sie kennen weder Transport noch Serverprotokoll.

## Resource Keys

`createDataKey<T>(kind, id)` erzeugt einen typisierten Resource Key. `kind` und `id` identifizieren die Ressource; `T` beschreibt nur den erwarteten Werttyp für TypeScript.

## Data State

Ein Handle stellt einen reaktiven Zustand mit genau drei Zuständen bereit:

- `loading`: noch kein Wert vorhanden
- `ready`: aktueller Wert vorhanden
- `error`: Fehler vorhanden; ein bereits geladener Wert darf als stale data erhalten bleiben

## DataClient und Cache

`DataClient.acquire(key)` liefert für denselben Resource-Key immer denselben reaktiven Cache-State, solange der Eintrag lebt. Mehrere Consumer erhöhen nur die Consumer-Anzahl und erzeugen keine zusätzlichen Provider-Subscriptions.

- erster Consumer: Provider-Subscription wird gestartet
- weitere Consumer: teilen denselben State
- letzter `release()`: zugrunde liegende Subscription wird sofort beendet
- `cacheTimeMs = 0` (Default): Cache-Eintrag wird direkt entfernt
- `cacheTimeMs > 0`: letzter State bleibt für die konfigurierte Zeit erhalten und kann bei erneutem Acquire wiederverwendet werden

Jede neue zugrunde liegende Subscription besitzt eine interne Generation. Verspätete Events einer bereits beendeten Subscription werden ignoriert, damit Reconnect-/Unsubscribe-Races keinen neueren Cache-State überschreiben können.

## Provider-Vertrag

Ein `DataProvider` implementiert ausschließlich `subscribe(key, observer)` und liefert eine Unsubscribe-Funktion zurück. Widgets und `DataClient` arbeiten immer gegen diesen Vertrag.

## MockDataProvider

`MockDataProvider` implementiert denselben `DataProvider`-Vertrag und benötigt keinen Server. Ressourcen werden mit initialem Snapshot registriert und können optional über ein konfiguriertes Intervall fortgeschrieben werden.

Für Tests und Demos stehen kontrollierte Methoden zur Verfügung:

- `set(key, value)` setzt einen neuen Snapshot
- `advance(key)` führt genau einen definierten Update-Schritt aus
- `fail(key, error)` simuliert einen Data-Fehler
- `recover(key)` wechselt über `loading` zurück zum aktuellen Snapshot

Diese Funktionen gehören nur zum Mock Provider. Widgets kennen sie nicht und bleiben vollständig provider-unabhängig.

## RealtimeTransport

Ein externer Echtzeitkanal wird über `RealtimeTransport` angebunden. Der Vertrag enthält nur generische Infrastruktur:

- `connect()` / `disconnect()`
- beobachtbarer Connection-State: `disconnected`, `connecting`, `connected`, `reconnecting`, `error`
- Resource-Subscriptions anhand desselben `DataKey<T>`
- getrennte `snapshot`- und `update`-Zustellung
- Resource-Fehler

Snapshot und Update liefern jeweils einen vollständigen aktuellen Wert `T`. Protokollspezifische Deltas müssen vom konkreten Consumer-Transport vor der Übergabe materialisiert werden. WidgetForge interpretiert keine fachlichen Payloads.

`RealtimeDataProvider` adaptiert einen solchen Transport auf den normalen `DataProvider`. Aktive Data-Consumer bleiben bei Verbindungsunterbrechungen registriert. Transport-Subscriptions werden entfernt und nach dem nächsten `connected` automatisch wiederhergestellt. Bereits freigegebene Ressourcen werden nicht erneut subscribed.

Der Connection-State ist bewusst separat vom Resource-State verfügbar. Widgets müssen ihn nicht kennen; eine Anwendung kann ihn beispielsweise für globale Verbindungsanzeigen verwenden.

WidgetForge enthält keine WebSocket-, REST- oder sonstige protokollspezifische Implementierung. Verbindungsdetails, Authentifizierung und Serverprotokoll gehören in den Consumer-Transport.

## Vue

`DataClientProvider` stellt einen Client im Vue-Tree bereit. Widgets verwenden `useData(key)`. Das Composable ruft beim Vue-Unmount automatisch `release()` auf. Minimieren eines Widgets unmountet den Widget-Inhalt nicht und beendet daher auch keine Data-Subscription; Close/Destroy führt über den normalen Vue-Unmount zum Cleanup.

Der Playground verwendet weiterhin ausschließlich `MockDataProvider` und bleibt vollständig serverlos.
