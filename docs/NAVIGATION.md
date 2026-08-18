# Interne Widget-Navigation

Widgets öffnen andere Widgets ausschließlich über einen `WidgetNavigator`. Sie kennen weder `WindowManager` noch `WidgetRegistry` und verändern keinen globalen Window-State direkt.

## Navigation Intent

Ein Navigation Intent besteht aus einer Ziel-Widget-ID und optionalen Parametern. Der Navigator validiert das Ziel über die Registry und öffnet es anschließend über die normale `WindowManager.open()`-Pipeline.

Dadurch gelten für Navigation dieselben Regeln wie für andere Window-Öffnungen:

- Widget-Parameter werden zentral validiert.
- unbekannte Ziele werden abgewiesen.
- Singleton-Widgets werden fokussiert beziehungsweise wiederhergestellt statt dupliziert.
- Lifecycle, Fokus und Z-Reihenfolge werden ausschließlich vom Window Manager gesteuert.

## Vue API

`WindowManagerHost` stellt den Navigator für seine Widget-Unterstruktur bereit. Widgets greifen mit `useWidgetNavigation()` darauf zu und erhalten nur die kleine `WidgetNavigator`-Schnittstelle mit `navigate(intent)`.

Für eigene Host-Strukturen kann ein Consumer einen Navigator mit `createWidgetNavigator()` erzeugen und über `provideWidgetNavigation()` bereitstellen.

Wird `useWidgetNavigation()` außerhalb eines Navigation-Providers verwendet, wird `WidgetNavigationUnavailableError` geworfen.

## Fehler

Navigation-spezifische Validierungsfehler werden als `WidgetNavigationError` mit einem strukturierten Code gemeldet:

- `unknown-widget`
- `invalid-parameters`

Bei ungültigen Parametern werden die Parameter-Issues aus der Registry weitergereicht. Andere unerwartete Fehler werden nicht verschluckt.

## Architekturregel

Navigation ist ein Intent vom aufrufenden Widget an das Framework. Ein Widget darf niemals die konkrete Window-Manager-Instanz verwenden, um andere Widgets zu öffnen oder zu fokussieren.
