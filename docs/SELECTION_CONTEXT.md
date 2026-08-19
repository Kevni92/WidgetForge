# Selection Context

Der Selection Context koppelt Widgets über generische Auswahlzustände, ohne direkte Widget-zu-Widget-Referenzen und ohne Domain-Wissen im Framework.

## Selection Keys

Ein Consumer definiert typisierte Keys aus `channel + scope`:

```ts
const colonySelection = createSelectionKey<string>('colony', 'operations')
const shipSelection = createSelectionKey<ShipReference>('ship', 'operations')
```

Der Framework-Core interpretiert die Werte nicht. Strings, IDs, opaque Referenzen oder beliebige Consumer-Typen bleiben vollständig außerhalb der Framework-Domain. Gleiche Channels in unterschiedlichen Scopes sowie unterschiedliche Channels im selben Scope sind isoliert.

## Store und Vue API

`SelectionStore` unterstützt `get`, `state`, `select`, `clear` und `subscribe`. In Vue verwendet ein Widget:

```ts
const selection = useSelection(colonySelection)
selection.select('ARC-02')
```

Mehrere Consumer desselben Keys beobachten dieselbe reaktive Auswahl. Ein Update verändert nur den Selection-State; es öffnet, schließt oder remountet keine Widget-Instanz.

Ein Consumer kann explizit einen Store über `SelectionProvider` oder `provideSelectionStore()` injizieren. Ohne expliziten Provider erzeugt WidgetForge einen isolierten Fallback-Store pro Vue-App. `WorkspaceCollectionHost` kann zusätzlich einen expliziten gemeinsamen `selectionStore` erhalten und stellt ihn seinen Workspaces bereit.

## Follow und Pin

`useLinkedSelection()` verbindet einen Selection-Key mit lokalem Widget View State. Der Adapter sagt nur, wo `followSelection` und `pinnedSelection` im Consumer-eigenen View-State liegen:

```ts
const linked = useLinkedSelection(colonySelection, {
  read: (state) => state.selection,
  write: (state, selection) => ({ ...state, selection }),
})
```

- Follow: `linked.selection` entspricht der aktuellen globalen Auswahl.
- Pin: `linked.pin()` speichert die aktuelle Auswahl im Widget View State und ignoriert danach globale Änderungen.
- Re-Follow: `linked.follow()` übernimmt sofort wieder die aktuelle globale Auswahl.

Der gepinnte Wert muss deshalb als `WidgetViewStateValue` serialisierbar sein. Der allgemeine `SelectionStore` selbst hat diese Einschränkung nicht und kann opaque Consumer-Werte transportieren.

## Selection ist nicht Navigation

Selection und Navigation bleiben getrennte Konzepte:

- Selection beschreibt, worauf bereits geöffnete Widgets aktuell reagieren.
- Navigation entscheidet, ob bzw. welches Widget geöffnet oder fokussiert wird.

Eine Selection-Änderung ruft niemals automatisch den `WidgetNavigator` oder `WindowManager` auf. Consumer können beide APIs bewusst kombinieren, aber das Framework koppelt sie nicht implizit.

## Persistenz

Der globale Selection-Store ist Runtime-State und wird nicht in Workspace-Snapshots oder Layout-Presets geschrieben. Follow-/Pinned-Modus und die gepinnte serialisierbare Referenz gehören dagegen zum lokalen Widget View State und können über dessen Consumer-Storage reload-persistent bleiben.
