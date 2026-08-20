# WorkspaceTabs

`WorkspaceTabs` ist die generische globale Chrome für eine `WorkspaceCollectionManager`. Die Komponente verwaltet keine eigene Workspace-Liste, sondern bindet direkt an `manager.list()`, `manager.activateWorkspace()`, `manager.createWorkspace()`, `manager.renameWorkspace()` und `manager.deleteWorkspace()`.

Über den benannten `actions`-Slot können Consumer rechts eine eigene globale Action-Region ergänzen:

```vue
<WorkspaceTabs :manager="workspaces">
  <template #actions>
    <button type="button" aria-label="Create new window">+ New window</button>
  </template>
</WorkspaceTabs>
```

Die Region bleibt außerhalb der Tab-Liste reserviert. Bei vielen Workspaces scrollt nur der linke Tab-Bereich; die rechte Action-Fläche bleibt erreichbar und kann den Workspace-Canvas nicht überdecken. `WorkspaceTabs` kennt die Bedeutung der Consumer-Action nicht und bleibt dadurch generisch.

```vue
<WorkspaceTabs :manager="workspaces" :edit="workspaceEdit" />
<WorkspaceCollectionHost
  :manager="workspaces"
  :registry="registry"
  :commands="commands"
/>
```

Die technische Workspace-ID und der sichtbare Name bleiben getrennt. Einfachklick aktiviert einen Tab; Doppelklick oder `F2` startet den Inline-Rename. `Enter` bestätigt, `Escape` verwirft und ein gültiger Blur bestätigt die Änderung. Leere oder reine Whitespace-Namen werden verworfen. Rename verändert niemals die ID.

Der `+`-Button liegt immer hinter dem letzten Tab und erstellt einen leeren Workspace mit einer deterministischen, kollisionsfreien ID und aktiviert ihn unmittelbar. Die Tab-Leiste scrollt horizontal, damit der Add-Button auch bei vielen Workspaces erreichbar bleibt.

Delete-Affordances erscheinen nur bei aktivem permanentem oder temporärem Edit-Mode und nie im `locked`-Mode. Vor dem Löschen zeigt `WorkspaceTabs` den generischen `ConfirmationDialog` mit Workspace-Name und dem Hinweis auf Windows, Docks, Panes und Widget-State. Der letzte Workspace wird bereits im Core abgelehnt. Beim Löschen des aktiven Workspace wird zuerst der vorherige Tab gewählt, andernfalls der nächste.

`WorkspaceTabs` verwendet ausschließlich semantische Theme-Tokens. Die Komponente kann deshalb als globale Anwendungschrome außerhalb eines Workspace-Docks in beliebige Consumer-UIs integriert werden.
