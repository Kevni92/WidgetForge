# Distribution

WidgetForge 0.1 is prepared as an ESM-only Vue 3 package.

## Public package surface

Consumers import JavaScript and TypeScript APIs only from the package root:

- `widgetforge`
- `widgetforge/style.css`

No `src/*`, `core/*`, `vue/*`, `data/*` or `primitives/*` package subpaths are exported. Internal file layout therefore remains an implementation detail even when declaration files reference relative declarations inside `dist`.

The root entry explicitly lists its exports instead of forwarding an internal barrel with `export *`. Adding a new internal primitive therefore does not automatically make it public.

## Build artifacts

`npm run build` produces:

- `dist/index.js` — ESM library bundle
- `dist/index.d.ts` plus referenced declaration files — TypeScript contract
- `dist/widgetforge.css` — bundled framework component styles

Vue is a peer dependency and stays external to the JavaScript bundle.

## Package verification

`npm pack` is the release boundary. CI creates the actual package tarball and installs it into `examples/minimal-consumer`, which is not linked to the WidgetForge source tree. The example must pass both TypeScript checking and a production Vite build.

This catches missing package exports, missing declaration files, missing CSS, bundled peer-dependency mistakes and accidental reliance on internal source paths before publication.

## Publishing

The package metadata is prepared for public npm publication, but publishing itself is intentionally not automated by Issue #28. A release should only be published from a reviewed commit/tag after the normal CI and packaged-consumer validation are green.
