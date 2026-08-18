# Roadmap

Die Roadmap ist absichtlich inkrementell. Jedes Thema wird als eigenes GitHub Issue umgesetzt und baut möglichst nur auf bereits abgeschlossenen Grundlagen auf.

## Phase 1 – Projektbasis

1. Vue-3-/TypeScript-Library und Playground grundlegend aufsetzen.
2. Test-, Typecheck-, Lint- und Build-Pipeline einrichten.
3. Playground über GitHub Pages veröffentlichen.
4. Design-Token-/Theme-Grundlage definieren.

## Phase 2 – Widget-Kern

5. Widget Contract und Manifest definieren.
6. Widget Registry implementieren.
7. Typisierte Widget-Parameter und Validierung implementieren.
8. Basis-Widget-Kontext für Vue bereitstellen.

## Phase 3 – Fenstersystem

9. Window Shell implementieren.
10. Window Manager für Instanzen, Fokus und Z-Reihenfolge implementieren.
11. Verschieben und Resize implementieren.
12. Minimieren/Wiederherstellen implementieren.
13. Mehrere Instanzen und optionales Singleton-Verhalten unterstützen.
14. Widget-/Window-Lifecycle definieren und testen.

## Phase 4 – Navigation und Commands

15. Interne Navigation zum Öffnen parametrisierter Widgets implementieren.
16. Command Registry und Parser implementieren.
17. Command-Eingabe im Playground integrieren.

## Phase 5 – Workspace

18. Workspace-State serialisierbar machen.
19. Workspace lokal speichern und wiederherstellen.
20. Gespeicherte Layouts/Workspaces vorbereiten.

## Phase 6 – Datenebene

21. Abstrakte Reactive Data API definieren.
22. Cache und geteilte Subscriptions implementieren.
23. Mock Data Provider für Playground und Tests implementieren.
24. Live-Änderungen im Playground simulieren.
25. Transport-Schnittstelle für externe Echtzeitverbindungen definieren.
26. Referenz-WebSocket-Adapter implementieren, ohne ein konkretes Spielprotokoll vorzuschreiben.

## Phase 7 – Simulations-UI-Primitives

Erst nach stabilem Kern:

27. Key/Value- und Statistikdarstellungen.
28. Einfache Tabelle.
29. Komplexe Datentabelle mit Sortierung/Filterung.
30. Standardisierte Loading-/Empty-/Error-States.
31. Verschachtelbares Tooltip-/Glossarsystem.
32. Notification-System.
33. Context-Menu- und Confirmation-Primitives.

## Phase 8 – Distribution

34. Öffentliche API konsolidieren.
35. Paket-Build und Exports prüfen.
36. Dokumentation und Integrationsbeispiel für ein externes Vue-Projekt erstellen.
37. npm-Publishing vorbereiten.

Die GitHub Issues sind die operative Planung. Diese Roadmap beschreibt nur Reihenfolge und Abhängigkeiten auf hoher Ebene.
