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
