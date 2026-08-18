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

Ein `DataProvider` implementiert ausschließlich `subscribe(key, observer)` und liefert eine Unsubscribe-Funktion zurück. Der Vertrag enthält bewusst noch keine konkrete Transport- oder Connection-Logik.

## Vue

`DataClientProvider` stellt einen Client im Vue-Tree bereit. Widgets verwenden `useData(key)`. Das Composable ruft beim Vue-Unmount automatisch `release()` auf. Minimieren eines Widgets unmountet den Widget-Inhalt nicht und beendet daher auch keine Data-Subscription; Close/Destroy führt über den normalen Vue-Unmount zum Cleanup.
