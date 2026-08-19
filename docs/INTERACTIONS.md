# Context menus and confirmations

## Pane- und Tab-Drag

Pane- und Tab-Griffe sind an den Workspace-Modus gebunden. Im `normal`-Modus sind generische Pane-Griffe nicht sichtbar; ein Tab-Grip sortiert den Tab ausschließlich innerhalb seiner aktuellen TabPane. Der Grip zeigt während einer gültigen Bewegung eine Einfügemarke und erzeugt keinen Docking-Preview. Ein Drag außerhalb der Tabbar wird verworfen.

Im `edit`-Modus sowie im temporären Ctrl-Edit werden generische Handles und die strukturelle Docking-Semantik aktiviert. Der Tab-Grip repräsentiert dann den Pane-Knoten hinter dem Tab und nutzt die normalen Center-/Edge-Drop-Zonen. Gesperrte Quellen und Ziele bieten keine aktive Affordance. Reorder und Pane-Docking sind exklusive Pointer-Session-Typen; Escape, Pointer-Abbruch, verlorenes Capture und Unmount setzen Preview und Session vollständig zurück.

## Context menu

`createContextMenuController()` creates explicit menu state that can be shared with one `ContextMenuHost`. Any widget or consumer content that receives the controller can call `show()` with coordinates and generic menu items.

Menu items contain an ID, label, optional disabled/danger state and optionally a normal `NavigationIntent`. The host delegates targets to the existing `WidgetNavigator`; it never opens windows directly. Non-navigation actions are returned to the consumer through the request's `onSelect` callback.

The host focuses the first enabled item when opened, supports Arrow Up/Down, Home, End and Escape, closes on outside pointer interaction and restores the previously focused element after closing.

## Confirmation dialog

`ConfirmationDialog` is controlled through its `open` prop and `update:open` event. It emits `confirm` or `cancel` but performs no operation itself.

The default initial focus is the cancel action. Consumers can explicitly choose confirmation focus where appropriate. Tab focus is contained between the dialog actions, Escape cancels, clicking the backdrop cancels and focus is restored after the controlled dialog closes.

Both components are domain-neutral and use only semantic WidgetForge theme tokens.
