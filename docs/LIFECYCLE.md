# Widget- und Window-Lifecycle

WidgetForge verwendet pro geöffneter Window-Instanz genau einen `WidgetLifecycle`.

## Zustände

`created -> mounted -> active -> minimized -> active -> closed -> destroyed`

- `created`: Window-Instanz existiert im Manager, Vue-Inhalt ist noch nicht gemountet.
- `mounted`: `WidgetHost` ist gemountet, aber noch nicht aktiviert.
- `active`: Widget ist sichtbar und aktiv.
- `minimized`: Instanz und Vue-Komponente bleiben erhalten; der Inhalt wird nur ausgeblendet.
- `closed`: fachliches Schließen wurde ausgelöst; die Instanz ist nicht mehr offen.
- `destroyed`: terminaler Zustand. Registrierte Cleanup-Ressourcen werden genau einmal ausgeführt.

## Verantwortlichkeiten

- `WindowManager` erzeugt den Lifecycle und steuert Minimize, Restore, Close und Destroy.
- `WidgetHost` verwendet denselben Lifecycle für Mount und initiale Aktivierung.
- Minimieren darf die Widget-Komponente nicht unmounten.
- Close und Destroy sind semantisch getrennte Übergänge, werden beim normalen Fensterschließen aber deterministisch direkt nacheinander ausgeführt.
- `destroyed` ist terminal; ungültige Übergänge werfen `InvalidWidgetLifecycleTransitionError`.

## Ressourcen

Framework- oder Consumer-Adapter können Cleanup-Funktionen mit `addCleanup()` registrieren. Beim Destroy werden alle Cleanups ausgeführt. Fehler eines Cleanups verhindern nicht die Ausführung weiterer Cleanups; mehrere Fehler werden als `AggregateError` gemeldet.

Der Lifecycle ist bewusst klein. Er enthält keine Daten-, Transport- oder Window-Manager-Logik und ist kein allgemeiner Event-Bus.
