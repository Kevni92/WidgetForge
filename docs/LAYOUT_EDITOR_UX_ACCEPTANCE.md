# Layout Editor UX Acceptance

Issue #192 is covered by a dedicated consumer fixture at:

```text
/?fixture=layout-acceptance
```

The fixture uses only the public WidgetForge API. It creates a left menu, a free center canvas, and a right menu whose responsive layout rules keep both menus attached to the workspace edges. The fixture also provides consumer-owned persistence, history controls, and a real widget action for the normal-mode regression check.

## Tested workflow

The Playwright suite exercises:

- normal interaction before and after `Done`;
- entering Layout Edit mode, selecting a window, and inspecting handles and state;
- pointer drag from `Center Canvas.right` to `Right Menu.left`, including target marker and ghost preview;
- direct resize with preview and responsive geometry preservation;
- Inspector editing of an exact 20 px physical gap;
- workspace resize from 1440×900 to 1024×768;
- keyboard constraint targeting, workspace-edge targets, invalid input, cancel, and cycle prevention;
- Stretch geometry between both menus with exact left and right distances;
- three semantic undo/redo actions (constraint creation, resize, Inspector edit);
- persistence through reload;
- the narrow 720×600 viewport with horizontal containment and reachable editing chrome.

The viewport matrix is defined in `playwright/layout-editor.acceptance.spec.ts`. Checkpoint screenshots are generated for the normal state, edit state, selection, pointer drag, committed constraint, Inspector 20 px state, resized workspace, workspace-edge targeting, narrow viewport, and Stretch state. CI uploads them together with traces and videos as the `playwright-ux-acceptance` artifact when available.

## UX heuristic review

| Heuristic | Result |
| --- | --- |
| Visibility of system status | Pass: edit mode, selected window, target marker, drag ghost, preview overlay, Inspector rule, and history controls expose state. |
| Match between system and user language | Pass: labels use window titles, instance IDs, edge names, `Distance`, `Offset`, and `Stretch`. |
| User control and freedom | Pass: cancel, Escape, `Done`, remove constraint, undo, redo, and reload persistence are covered. |
| Error prevention and recovery | Pass: invalid distance is rejected without removing existing relations; cycles are absent from the keyboard target list. |
| Flexibility and efficiency | Pass: pointer and keyboard connection paths are both covered. |
| Responsive clarity | Pass: workspace-edge menus remain anchored and the 720 px viewport keeps the editor usable without horizontal page overflow. |
| Accessibility basics | Pass: controls have accessible names, keyboard targets use a listbox/option pattern, status messages use `role=status`, and focus-visible styles remain present. |

The acceptance flow also exposed and fixed two interaction edge cases: a successful pointer connection no longer opens the keyboard picker from the follow-up click, and History restore ignores incomplete intermediate manager snapshots while windows are reopened.

## Issue #204 extension

The same public fixture now covers the final Inspector-mobility, SurfaceStyle, and layout-editor polish acceptance pass:

- static Topnav/Left Menu chrome stays separate from edit selection; a workspace-bottom constraint does not convert a window into a dock or reflow the static chrome;
- dock, window, and directly selected pane styles remain scoped to their host, including custom backgrounds, single-side borders, padding link/unlink, radius, shadow, and reset;
- window constraints remain independent from SurfaceStyles through resize and reload, including the 20 px Center Canvas → Right Menu gap;
- atomic border history, undo/redo, keyboard Inspector controls, minimized/floating/docked Inspector states, sharp editor chrome, and dimmed content are exercised;
- dark and light theme checkpoints, 1440×900, 1024×768, and 720×600 viewport coverage are retained.

The extended suite contains 16 tests and produces 19 named checkpoints (the original 01–10 plus 11–19 for workspace-bottom targeting, Topnav/Left Menu styling, final normal mode, pane/dock styling, window styling with constraints, keyboard/dimming, and the light theme). The fixture still uses only the public consumer API and its existing persistence path.

### Issue #204 heuristic review

| Heuristic | Result |
| --- | --- |
| Hierarchy and visibility | Pass: the edit toolbar, Inspector selection kind, tabs, host-scoped style controls, relation lines, and dimmed content make the active editing context explicit. |
| Discoverability | Pass: dock/pane/window selection, Styles, constraint targets, mobility controls, and reset expose named, keyboard-reachable controls. |
| Precision and feedback | Pass: exact border/padding values, 20 px constraint distance, resize preservation, preview/commit, and atomic history are asserted. |
| Non-obstruction | Pass: the Inspector remains reachable at narrow width, bounds stay contained, and only content is blurred/dimmed while editor chrome stays sharp. |
| Consistency | Pass: the same SurfaceStyle contract is exercised for window, dock, and pane hosts and remains independent from layout constraints. |
| Recovery and persistence | Pass: reset, undo/redo, minimize/restore/dock, reload, and dark/light checkpoints retain predictable state. |
