# Roadmap

WidgetForge wird inkrementell über GitHub Issues umgesetzt. Die Issues sind bewusst klein gehalten und enthalten ihre konkreten Akzeptanzkriterien und Abhängigkeiten.

## Phase 1 – Projektbasis

1. #1 Projektgrundgerüst für Vue 3 + TypeScript + Library aufsetzen
2. #2 Test-, Lint-, Typecheck- und Build-Pipeline einrichten
3. #3 Playground-App erstellen und über GitHub Pages veröffentlichen
4. #4 Design-Token- und Theme-Grundlage definieren

## Phase 2 – Widget-Kern

5. #5 Widget Contract und Manifest definieren
6. #6 Widget Registry und Parameter-Validierung implementieren
7. #7 Vue Widget Host und Widget Context implementieren

## Phase 3 – Fenstersystem

8. #8 Window Shell als generischen Widget-Rahmen implementieren
9. #9 Window Manager für Instanzen, Fokus und Z-Reihenfolge implementieren
10. #10 Fenster verschiebbar und skalierbar machen
11. #11 Fensterzustände: Minimieren, Wiederherstellen und Instanzregeln
12. #12 Widget- und Window-Lifecycle definieren und implementieren

## Phase 4 – Navigation und Commands

13. #13 Interne Widget-Navigation implementieren
14. #14 Command Registry und Parser implementieren
15. #15 Command-Eingabe als Framework-Komponente integrieren

## Phase 5 – Workspace

16. #16 Workspace-State serialisieren, speichern und wiederherstellen

## Phase 6 – Daten und Live-Updates

17. #17 Abstrakte Reactive Data API für Widgets definieren
18. #18 Data Cache und geteilte Subscriptions implementieren
19. #19 Mock Data Provider mit simulierten Live-Updates implementieren
20. #20 Austauschbare Echtzeit-Transport-Schnittstelle definieren

Der Playground bleibt dabei serverlos. Ein konkretes Serverprotokoll ist nicht Teil von WidgetForge.

## Phase 7 – Simulations-UI-Primitives

21. #21 Verschachtelbares Tooltip- und Glossarsystem implementieren
22. #22 Key/Value- und Statistik-Primitives implementieren
23. #23 Einfache Tabellen-Komponente implementieren
24. #24 Komplexe DataTable für große Simulationsdaten implementieren
25. #25 Standardisierte Loading-, Empty- und Error-States implementieren
26. #26 Notification-System implementieren
27. #27 Context-Menu- und Confirmation-Primitives implementieren

## Phase 8 – Distribution

28. #28 Öffentliche API konsolidieren und npm-Paket vorbereiten

## Phase 9 – Composable Workspace

60. #60 Pane- und Layout-Modell für verschachtelbare Workspace-Inhalte einführen
61. #61 Rekursiven PaneHost für Widgets und Split-Layouts implementieren
62. #62 Windows auf Root-Panes migrieren und Pane-basierte Inhalte unterstützen
63. #63 Window-Layer und konfigurierbare Window-Präsentation implementieren
64. #64 Workspace-Docks für Top-, Bottom- und Sidebars implementieren
65. #65 Window-Snap mit Edge-Vorschau und Snap-Zuständen implementieren
66. #66 Window-Docking und Pane-Edit-Mode per Drag & Drop implementieren
67. #67 Playground als realistische fullscreen Workspace-Demo umbauen

`Pane` ist dabei die allgemeine Content-/Layout-Einheit. Windows und Docks hosten Pane-Bäume; Widgets selbst kennen weder Window-, Dock- noch Pane-Management.

## Arbeitsregel

Grundsätzlich wird ein Issue abgeschlossen, getestet und – sofern visuell relevant – im GitHub-Pages-Playground demonstriert, bevor der nächste darauf aufbauende Schritt begonnen wird. Die verbindlichen Qualitäts- und Architekturregeln stehen in `AGENTS.md` und `docs/DEVELOPMENT_WORKFLOW.md`.
