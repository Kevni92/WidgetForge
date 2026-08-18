# Reactive Data API

Widgets konsumieren externe Daten ausschließlich über die WidgetForge Data API. Sie kennen weder Transport noch Serverprotokoll.

## Resource Keys

`createDataKey<T>(kind, id)` erzeugt einen typisierten Resource Key. `kind` und `id` identifizieren die Ressource; `T` beschreibt nur den erwarteten Werttyp für TypeScript.

## Data State

Ein Handle stellt einen reaktiven Zustand mit genau drei Zuständen bereit:

- `loading`: noch kein Wert vorhanden
- `ready`: aktueller Wert vorhanden
- `error`: Fehler vorhanden; ein bereits geladener Wert darf als stale data erhalten bleiben

## DataClient

`DataClient.acquire(key)` erzeugt ein Handle und startet die zugrunde liegende Provider-Subscription. `release()` beendet die Subscription idempotent. In #18 wird diese interne Subscription-Verwaltung um Cache und geteilte Consumer erweitert, ohne die Widget-API zu ändern.

## Provider-Vertrag

Ein `DataProvider` implementiert ausschließlich `subscribe(key, observer)` und liefert eine Unsubscribe-Funktion zurück. Der Vertrag enthält bewusst noch keine konkrete Transport- oder Connection-Logik.

## Vue

`DataClientProvider` stellt einen Client im Vue-Tree bereit. Widgets verwenden `useData(key)`. Das Composable ruft beim Vue-Unmount automatisch `release()` auf. Minimieren eines Widgets unmountet den Widget-Inhalt nicht und beendet daher auch keine Data-Subscription; Close/Destroy führt über den normalen Vue-Unmount zum Cleanup.
