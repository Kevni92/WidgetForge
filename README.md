# WidgetForge

WidgetForge ist ein wiederverwendbares Vue-3-/TypeScript-UI-Framework für fensterbasierte Widget-Oberflächen in Browser- und Simulationsspielen.

Spiele registrieren ihre fachlichen Vue-Widgets. WidgetForge übernimmt Registry, Fensterinstanzen, Navigation, Workspace-State, Data-Abstraktion, Themes und generische Simulations-UI-Primitives.

## Getting Started

Voraussetzung ist Vue 3.5+ und Node.js `^20.19.0 || ^22.13.0 || >=24.0.0`.

Nach Veröffentlichung des npm-Pakets:

```bash
npm install widgetforge vue
```

Framework-Styles einmal im App-Entry importieren:

```ts
import 'widgetforge/style.css'
```

Die Runtime-API kommt ausschließlich aus dem Package-Root:

```ts
import {
  WindowManagerHost,
  createWidgetRegistry,
  createWindowManager,
  defineWidget,
} from 'widgetforge'
```

Ein Consumer definiert sein eigenes Vue-Widget mit `defineWidget`, registriert es über `createWidgetRegistry`, erzeugt einen `createWindowManager` und öffnet es anhand seiner Widget-ID. Ein vollständiges, gegen das gepackte npm-Artefakt validiertes Beispiel liegt unter `examples/minimal-consumer`.

### Data und Mutationen in Vue

Die App erstellt ihre Provider und stellt sie im Vue-Baum bereit. Ein Mutation-Provider kapselt dabei den konkreten Consumer-Transport; WidgetForge öffnet keine WebSocket-Verbindung selbst:

```ts
import {
  MutationClientProvider,
  createMutationClient,
  useMutation,
} from 'widgetforge'
```

```vue
<MutationClientProvider :client="mutationClient">
  <WidgetForgeWorkspace />
</MutationClientProvider>
```

Ein Widget verwendet `useMutation(definition)`. Das Binding stellt `state`, `execute(input)` und `reset()` bereit. `state.status` ist `idle`, `pending`, `success` oder `error`; `pending` kann beispielsweise für `disabled` und `aria-busy` verwendet werden. Ein erfolgreicher Request verändert keinen Data-Cache automatisch. Fehler bleiben lokal am Binding und werden nicht ungefragt als Notification angezeigt.

## Package Contract

- ESM-only
- Vue ist Peer Dependency und wird nicht gebündelt
- JavaScript/TypeScript API: `widgetforge`
- Styles: `widgetforge/style.css`
- keine öffentlichen internen Source-Subpaths
- TypeScript-Declarations werden mit dem Package ausgeliefert

## Entwicklung

```bash
npm install
npm run lint
npm run test
npm run typecheck
npm run build
npm run pack:check
```

Der Playground ist ein eigenständiger Consumer der öffentlichen API:

```bash
npm install --prefix playground
npm run test --prefix playground
npm run build --prefix playground
```

Nach erfolgreichem Deployment ist er unter `https://kevni92.github.io/WidgetForge/` erreichbar.

## Struktur

- `src/index.ts` – einziger JavaScript-/TypeScript-Package-Entry-Point
- `src/core/` – UI-unabhängige Kernlogik
- `src/vue/` – Vue-Integration und Hosts
- `src/data/` – transportunabhängige reaktive Datenebene
- `src/primitives/` – generische UI-Primitives
- `playground/` – Referenz-/Demo-Anwendung
- `examples/minimal-consumer/` – npm-Tarball-Consumer für Package-Validierung
- `docs/` – Konzept, Architektur und Distribution

Siehe insbesondere `docs/CONCEPT.md`, `docs/ARCHITECTURE.md`, `docs/DISTRIBUTION.md` und `AGENTS.md`.
