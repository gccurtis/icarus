---
name: icarus-editor-change
description: Review, diagnose, or change Icarus document, presentation, and spreadsheet editors or their surrounding workspace panels, with state-lifetime tracing and Chromium interaction and visual verification.
---

# Icarus editor change

Use the requested mode: an audit produces evidence and recommendations; diagnosis
establishes a cause; implementation changes behavior and adds regression coverage.
This workflow does not expand that authority. Start with root `AGENTS.md` and the
task handoff, not historical reference pages.

## Locate the owning chain

- Begin in `app/src/lib/app-views/categories/`: `document-editor/`,
  `presentation-editor/`, or `spreadsheet-editor/`. Inspect the affected context,
  inspector, content, and `procedures/` paths rather than assuming the panel owns
  the editor's state.
- Surface primitives live under `app/src/lib/components/authored/`. Follow the
  category's actual imports; the presentation still has a slide surface because
  a slide is a constituent, not an obsolete resource name.
- Trace tab identity and lifecycle through
  `app/src/lib/model/client/workspace-state/` and the relevant
  `document-runtimes/`, `presentation-runtimes/`, or `spreadsheet-runtimes/` model.
  A mounted view, a tab, and its resource can have different lifetimes.
- For persisted changes, follow the actual capability into
  `app/src/lib/capabilities/`. Read the
  [Store workflow](../icarus-store-change/SKILL.md) alongside this workflow only
  if the task crosses that persistence boundary.

For interaction defects, record the input sequence and state owner before editing:
focus/selection, queued or in-flight work, tab switching, commit/cancel, and reload
are common decision boundaries. Distinguish a UI draft from saved resource state;
do not make a later selection the recipient of an earlier editing session.

## Implement at the right boundary

Keep rendering and event wiring in components, substantial behavior in the owning
`procedures/`, and lifetime effects in `procedures/effects/`. Inspect neighboring
editor patterns for aesthetic consistency, but retain independent editor-owned
state and behavior. Use the actual tokens in `app/src/lib/styles/` and primitives
in `app/src/lib/components/`; a plausible token name is not evidence it exists.

For a reproduced defect, add the smallest regression that fails for that cause.
Exercise commands through their normal UI path when wiring, focus, geometry, or
mounting is part of the risk. A pure helper test cannot prove those interactions.

## Verify behavior and appearance

Use the root helpers with an available, task-owned port. Read `--help` and use
`--plan` when selecting verification scope. Never point resettable browser tests
at the human review Store. `app/test/browser/fixtures.ts` supplies per-test reset
behavior; import its `test`/`expect` when adding product browser scenarios.

Relevant executable examples are `app/test/browser/document-editor.spec.ts`,
`presentation-editor.spec.ts`, `spreadsheet-editor.spec.ts`, and
`spreadsheet-range-writing.spec.ts`. Template appearance and isolation examples
live in `template-presentation-appearance.spec.ts`,
`template-external-isolation.spec.ts`, and `templates/visual-checks.ts` there.
Choose relevant examples; do not load all suites for a small panel change.

Check the states affected by the change, as applicable:

- Actual selection/typing/dragging, commit and cancel, undo/redo, and persistence.
- Switching away and back, independent tabs, and empty/missing resources.
- Wide and compact panels, changed zoom, scrolling, and overlay positioning.
- Computed paper/background colors, text clipping, controls, and empty states.

Capture and inspect screenshots of the changed states. Pair visual inspection
with meaningful rendered assertions so defects are caught automatically; a saved
screenshot alone is not an assertion. Check browser errors, and distinguish test
driver mistakes from product defects before patching either. Run focused unit and
Chromium coverage plus the relevant architecture/type checks; broaden according
to the actual cross-feature risk. Record commands, passes, skips, screenshots,
and any unverified behavior in the handoff without claiming more than was tested.
