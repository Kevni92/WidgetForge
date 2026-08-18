# WidgetForge

WidgetForge ist ein wiederverwendbares Vue-3-/TypeScript-UI-Framework für komplexe Browser- und Simulationsspiele.

Der Kern ist ein fensterbasiertes Widget-System: Spiele registrieren fachliche Widgets, WidgetForge übernimmt deren Darstellung, Instanziierung, Fensterverwaltung und gemeinsame UI-Infrastruktur.

## Status

WidgetForge befindet sich im frühen Aufbau. Die Umsetzung erfolgt inkrementell über GitHub Issues; öffentliche APIs werden nur eingeführt, wenn das jeweilige Issue sie benötigt.

## Entwicklung

Voraussetzung ist Node.js `^20.19.0 || ^22.13.0 || >=24.0.0`.

```bash
npm install
npm run lint
npm run test
npm run typecheck
npm run build
```

Der Build erzeugt das veröffentlichbare Library-Artefakt unter `dist/`. Vue bleibt Peer Dependency und wird nicht in WidgetForge eingebündelt.

## Playground

Der Playground ist ein eigenständiger Consumer der öffentlichen WidgetForge-Package-API.

```bash
npm install
npm run build
npm install --prefix playground
npm run dev --prefix playground
```

Tests und Production-Build des Playgrounds:

```bash
npm run test --prefix playground
npm run build --prefix playground
```

Nach erfolgreichem Deployment ist der Playground unter `https://kevni92.github.io/WidgetForge/` erreichbar.

## Struktur

- `src/index.ts` – einziger öffentlicher Package-Entry-Point
- `src/core/` – frameworknahe, möglichst UI-unabhängige Kernlogik
- `src/vue/` – Vue-spezifische Integration und Komponenten
- `src/data/` – transportunabhängige reaktive Datenebene
- `src/primitives/` – generische UI-Primitives
- `docs/` – Konzept, Architektur, Roadmap und Workflow
- `playground/` – eigenständige Demo-/Referenzanwendung und GitHub-Pages-Ausgabe

Siehe `docs/CONCEPT.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md` und `AGENTS.md`.
