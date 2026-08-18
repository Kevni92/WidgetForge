# Widget- und Window-Lifecycle

WidgetForge trennt den logischen Lifecycle einer Widget-Instanz vom Vue-Mount-Zustand. Eine Window-Instanz besitzt genau einen Lifecycle-Controller; der serialisierbare Window-State enthält diesen Controller ausdrücklich nicht.

## Zustände

- `created`: Die Instanz und ihr Lifecycle existieren, der `WidgetHost` ist noch nicht gemountet.
- `mounted`: Der `WidgetHost` ist gemountet, die Instanz ist aber nicht aktiv/fokussiert.
- `active`: Der `WidgetHost` ist gemountet und die Instanz ist die aktive/fokussierte Window-Instanz.
- `minimized`: Das Fenster ist minimiert. Der `WidgetHost` bleibt gemountet; Minimieren ist kein Destroy und kein Remount.
- `closed`: Die Instanz wurde aus dem Window Manager entfernt. Ein noch gemounteter `WidgetHost` darf anschließend kontrolliert unmounten.
- `destroyed`: Terminaler Zustand nach `closed` und nachdem der `WidgetHost` unmounted ist.

## Übergänge

`create` wird beim Anlegen der Window-/Widget-Instanz erzeugt. `mount` und `unmount` werden ausschließlich vom `WidgetHost` an den gemeinsamen Lifecycle gemeldet. `activate` und `deactivate` folgen dem Fokus des Window Managers. `minimize` und `restore` folgen dem Window-State. `close` entfernt die Window-Instanz logisch aus dem Manager. `destroy` darf erst nach `close` und bei ungemountetem Host erfolgen.

Ein Fokus kann bereits vor dem ersten Vue-Mount angefordert sein. Der Lifecycle bleibt dann `created`; nach `mount` wird daraus deterministisch `active`.

## Minimieren

Minimierte Fenster behalten Instanz-ID, Parameter, Geometrie und Lifecycle. Der Content wird mit `v-show` verborgen und deshalb nicht aus dem Vue-Baum entfernt. Ressourcen, die an die Lebensdauer der Widget-Instanz gekoppelt sind, werden durch Minimieren nicht freigegeben.

## Schließen und Destroy

Beim Schließen wird zuerst der Lifecycle auf `closed` gesetzt und die Window-Instanz aus dem Manager entfernt. Dadurch unmountet Vue anschließend den zugehörigen Host. Der Host meldet `unmount`; erst danach wird `destroy` ausgeführt. War eine Instanz noch nie gemountet, kann der Window Manager sie nach `close` unmittelbar zerstören.

Damit können spätere Ressourcen und Data-Subscriptions zwischen temporärer Inaktivität, Minimieren, Schließen und finaler Zerstörung unterscheiden.

## Öffentliche Sicht

Widgets erhalten über `WidgetContext.lifecycle` nur die read-only Lifecycle-Schnittstelle mit aktuellem Zustand, Mount-Status, Event-Subscription und Historie. Mutierende Lifecycle-Operationen bleiben Framework-intern. Widgets erhalten dadurch keinen Zugriff auf Window-Manager-Interna.

## Fehlerverhalten

Ungültige Übergänge werfen `InvalidWidgetLifecycleTransitionError` und verändern den Zustand nicht. Lifecycle-Listener werden erst nach einem erfolgreich committed Übergang aufgerufen. Fehler in einem Consumer-Listener werden isoliert und rollen den bereits erfolgten Zustand nicht zurück.

## Persistenz

Der Lifecycle-Controller ist Runtime-State und nicht Bestandteil des serialisierbaren Workspace-/Window-State. Persistiert werden weiterhin nur deklarative Daten wie Widget-ID, Parameter, Window-Modus und Geometrie. Beim späteren Wiederherstellen eines Workspace wird für jede Instanz ein neuer Runtime-Lifecycle erzeugt.
