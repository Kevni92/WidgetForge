# Data- und Mutation-Integration

Ein externer Consumer besitzt den konkreten Realtime-Transport und entscheidet über Verbindung, Authentifizierung, Serialisierung und Serverprotokoll. WidgetForge stellt nur die generischen Capabilities bereit.

```text
Consumer Realtime Transport
        ├── RealtimeDataProvider     -> DataClient     -> useData
        └── RealtimeMutationProvider -> MutationClient -> useMutation
```

## Bootstrap und Ownership

Die App erzeugt einen Transport, beide Adapter und die Clients. Wenn beide Capabilities dieselbe Verbindung verwenden sollen, werden beide Adapter mit demselben Transportobjekt erstellt. Die App ruft `connect()` und beim eigenen Shutdown `disconnect()` auf. Die Adapter verbinden oder trennen nicht selbständig.

```ts
const transport = new ConsumerRealtimeTransport()
const dataProvider = createRealtimeDataProvider(transport)
const mutationProvider = createRealtimeMutationProvider(transport)
const dataClient = createDataClient(dataProvider)
const mutationClient = createMutationClient(mutationProvider)

transport.connect()
```

Im Vue-Baum werden die Clients mit `DataClientProvider` und `MutationClientProvider` bereitgestellt. Widgets verwenden anschließend `useData(key)` und `useMutation(definition)` ohne Kenntnis der Verbindung.

## Serverautoritatives Update

```text
useMutation.execute(input)
  -> MutationClient
  -> RealtimeMutationProvider
  -> Consumer-Transport.request(...) / Server
  <- Mutation-Ergebnis

Server verändert Domain-State
  -> Server publiziert Snapshot/Update
  -> RealtimeDataProvider
  -> DataClient / useData
```

Ein Mutation-Erfolg patcht keinen Data-Cache automatisch. Das Widget wartet auf die serverautoritativ publizierte Data-Aktualisierung.

## Reconnect

- Aktive Data-Subscriptions werden nach einer neuen `connected`-Phase erneut gebunden.
- Eine während des Disconnects laufende Mutation endet mit einem Transportfehler, weil der Server sie eventuell bereits verarbeitet hat.
- Die alte Mutation wird nach Reconnect niemals automatisch erneut gesendet.
- Neue Mutationen sind nach erfolgreichem Reconnect wieder möglich.

WidgetForge schreibt kein WebSocket-Wire-Format vor. Begriffe wie `subscribe`, `snapshot`, `update`, `request` und `result` sind nur mögliche Consumer-Konzepte, keine Framework-Nachrichten.
