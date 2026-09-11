# Template Library Demo

Lives at `src/lib/development-views/template-library-demo/template-library-demo.md`.
Concern documents are linked below.

## Purpose

A live future-state reference for the Templates library, rendered through the
project-scoped application route and reached from `/demo/templates`.

The first section is the product: the real Context, Content and Inspector
surface registries, on their real geometry, loading the real Template views.
The rest is the argument behind it: implemented behavior and data flow,
representation relationships, an exact file-by-file change audit, verification invariants,
decisions that remain open, and a separately marked proposal for a durable
scratch-resource authoring lifecycle.

The current safe visibility boundary is narrower than the future Project model:
the capability returns only the viewer's templates as `Personal`. `Project`
remains deferred until ownership and transfer are represented. `Shared` is not a
current availability state; future personal-template access should use an owner
and explicit access list.

## Implemented persistence

The live stage is not backed by component-local mock values. Accepted create,
rename, description, variable-description, tag, duplicate, and delete commands
write through the Templates capability into the representation store. Refresh
and server restart preserve them. Document and presentation `Use` also persists an
independent project resource without a continuing link to its template. Spreadsheet
materialization exists at the capability boundary, but its UI hand-off remains
disabled until the spreadsheet editor consumes represented resource ids.

The follow-on decision list is therefore not a list of missing CRUD behaviors.
It separates future ownership, production authorization, network-retry safety,
cross-table crash recovery, editor-session recovery, and remaining Use inputs.
Each rendered item states its trigger, current behavior, worst credible result,
and completion shape. Those five rows are the only product and architecture
decisions requested from the reviewer; the exact audit is evidence and scope
explanation rather than an additional decision.

## Why the live route sits under `/app/[project]`

Capabilities resolve project scope from the calling page's pathname and admit
only `/app/<token>`. A conventional `/demo/templates` component could look
right but every remote read or mutation would be outside a project scope.

All reference components and documents live under
`src/lib/development-views/template-library-demo`. The friendly demo route
redirects to `/demo/[project]/reference/templates`, whose route page is only
a project-scope adapter importing that development view. This inherits the
application's client model and authorization boundary without copying product
markup or moving the development implementation under app views. The reference
then creates a fresh Workspace State coordinator for its three panes. It does
not restore or flush that coordinator, so looking at the reference cannot move
the reader's saved tabs, resize their panels or replace their selection. Project
route scope authorizes the call and any resource created with Use; it does not
make another member's template visible.

## Boundary

This view owns:

- the long-form reference page, navigation and section order;
- the isolated live-stage workspace coordinator;
- explanatory copies of implemented behavior, relationships, unresolved
  choices and the explicitly deferred authoring-lifecycle proposal;
- the exact changed-file inventory, per-file change explanations, area
  justifications, and collapsible unified diffs.

It does not own:

- template values, which come through the Template views' ordinary procedures;
- capability scope or mutation behavior;
- any Template product markup;
- document, presentation or spreadsheet editing;
- the representation contracts it explains.

## Public Contract

- **Entry:** [`template-library-demo.svelte`](template-library-demo.svelte)
- **Types:** `None`
- **Props:** `None`

## Dependencies

### Client models

| Object          | Usage                                                                |
| --------------- | -------------------------------------------------------------------- |
| Client Model    | Supplies the scoped project and existing editor runtime registers    |
| Configuration   | Gives the reference coordinator explicit zero persistence thresholds |
| Workspace State | A fresh, un-restored coordinator for the live stage only             |

### Capabilities

| Capability    | Usage                                                |
| ------------- | ---------------------------------------------------- |
| None directly | The real Template views call their own browser doors |

### Composed views

| View                  | Usage                                                              |
| --------------------- | ------------------------------------------------------------------ |
| `$surfaces/context`   | Loads `templates.overview-library` through the filesystem registry |
| `$surfaces/content`   | Loads `templates.library` through the filesystem registry          |
| `$surfaces/inspector` | Loads `templates.template` after selection                         |

### Presentation

The product stage uses the product surfaces unchanged. Explanatory chrome uses
plain semantic markup and public `--token-*` properties, following the Review
view's rule that the apparatus around a view must not look like another product
component being reviewed.

## Directory Documents

| Concern    | Document                                  | What it owns                                                     |
| ---------- | ----------------------------------------- | ---------------------------------------------------------------- |
| Components | [components.md](components/components.md) | Live stage, behavior map, data-flow diagram and change inventory |

## Rendered States

| State           | Trigger                                     | Visible result                                                              | Recovery                      |
| --------------- | ------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------- |
| Initial         | Scoped route renders                        | Live library with Nothing selected in the inspector                         | Select a shelf card or row    |
| Selected        | An owner-visible template is selected       | Real Template inspector and active selection styling                        | Select another or delete      |
| Narrow viewport | Stage is narrower than application geometry | The product stage scrolls horizontally rather than lying about flank widths | Scroll the stage              |
| Missing view    | A registry key has no component             | The owning shell surface shows its ordinary placeholder                     | Fix the product registry/tree |
| Remote failure  | A Template browser door rejects             | The Template view owns the failure presentation                             | Retry through that view       |

## Accessibility

- The page has one `main`; the embedded product centre stays inside the live
  stage's labeled development frame rather than introducing a nested landmark.
- Sticky navigation uses ordinary anchors and every reference section has a
  stable id and heading.
- The stage status uses `aria-live="polite"` only when selection changes.
- The inventory filters are buttons with `aria-pressed`.
- Explanatory arrows and decoration are hidden from assistive technology.

## Layout and Overflow

- The document owns vertical scrolling.
- The live stage preserves a minimum workbench width and owns horizontal
  overflow at smaller viewports.
- Context and Inspector widths remain functions of the isolated Workspace
  State, so their real resize handles still work.
- The explanation uses a maximum measure of 84rem and collapses diagrams to one
  column before their labels become unreadable.

## Invariants

- No Template product view is copied into this directory.
- The reference imports no Template procedure or capability, so it cannot drift
  with their signatures or bypass their boundary.
- The isolated workspace state is never restored or flushed.
- `/demo/templates` never attempts a capability call; it redirects first.
- Template visibility is owner-only and emits `Personal`; Project is documented
  as a future ownership state, and Shared is absent from the current contract.
- Scope proves project membership but carries no membership role. The reference
  uses the development owner; production writes still need role-aware scope.
- Store provides a journaled, recoverable cross-table transaction. Template
  creation, revisions, duplication, removal, staging, and instantiation use it
  whenever one intent changes more than one represented row or table.
- Matching pending commands share one promise per Workspace State instance, so
  sibling panes and keyed remounts cannot duplicate a write. This is not a
  durable cross-client request-id ledger, and the reference does not claim it is.
- Blank document and presentation suffixes are chosen inside Project Resources from
  current project rows immediately before creation, never from a cached view.
- The authoring-session lane is labeled as a proposal: it requires a durable
  lease and expiry owner, and never claims that a generic tab close can safely
  delete scratch state.
