# WidgetForge

WidgetForge ist ein wiederverwendbares Vue-3-/TypeScript-UI-Framework für komplexe Browser- und Simulationsspiele.

Der Kern ist ein fensterbasiertes Widget-System: Spiele registrieren fachliche Widgets, WidgetForge übernimmt deren Darstellung, Instanziierung, Fensterverwaltung und gemeinsame UI-Infrastruktur.

## Status

WidgetForge befindet sich im frühen Aufbau. Die Umsetzung erfolgt inkrementell über GitHub Issues; öffentliche APIs werden nur eingeführt, wenn das jeweilige Issue sie benötigt.

## Entwicklung

Voraussetzung ist Node.js `^20.19.0 || >=22.12.0`.

```bash
npm install
npm run typecheck
npm run build
```

Der Build erzeugt das veröffentlichbare Library-Artefakt unter `dist/`. Vue bleibt Peer Dependency und wird nicht in WidgetForge eingebündelt.

## Struktur

- `src/index.ts` – einziger öffentlicher Package-Entry-Point
- `src/core/` – frameworknahe, möglichst UI-unabhängige Kernlogik
- `src/vue/` – Vue-spezifische Integration und Komponenten
- `src/data/` – transportunabhängige reaktive Datenebene
- `src/primitives/` – generische UI-Primitives
- `docs/` – Konzept, Architektur, Roadmap und Workflow
- `playground/` – wird in Issue #3 als eigenständiger Consumer aufgebaut

Siehe `docs/CONCEPT.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md` und `AGENTS.md`.
