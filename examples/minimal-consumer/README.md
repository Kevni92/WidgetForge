# Minimal packaged consumer

This project is intentionally independent from the WidgetForge source tree. CI installs the npm tarball produced by `npm pack`, then typechecks and builds this app.

It validates the publishable contract:

- imports runtime APIs only from `widgetforge`
- imports framework styles only from `widgetforge/style.css`
- registers a consumer-owned Vue widget through `defineWidget`
- creates a registry and window manager through public factories
- creates DataClient and MutationClient from the public package root
- uses one consumer-owned fake realtime transport for both subscriptions and mutation requests
- provides both clients through `DataClientProvider` and `MutationClientProvider`
- opens and renders the widget with `WindowManagerHost`

The fake transport deliberately contains no WebSocket protocol or domain logic. It exists only to verify that the published declarations support the read/write wiring; connection ownership remains in the consuming app.

For a local package check from the repository root, build and pack WidgetForge first, install this example's dependencies, install the generated tarball into this directory, then run its `typecheck` and `build` scripts. The repository's complete read/write boundary is described in `docs/DATA_MUTATION_INTEGRATION.md`.
