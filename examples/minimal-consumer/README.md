# Minimal packaged consumer

This project is intentionally independent from the WidgetForge source tree. CI installs the npm tarball produced by `npm pack`, then typechecks and builds this app.

It validates the publishable contract:

- imports runtime APIs only from `widgetforge`
- imports framework styles only from `widgetforge/style.css`
- registers a consumer-owned Vue widget through `defineWidget`
- creates a registry and window manager through public factories
- opens and renders the widget with `WindowManagerHost`

For a local package check from the repository root, build and pack WidgetForge first, install this example's dependencies, install the generated tarball into this directory, then run its `typecheck` and `build` scripts.
