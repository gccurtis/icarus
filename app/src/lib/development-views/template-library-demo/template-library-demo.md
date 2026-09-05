# Template Library Demo

Lives at `src/lib/development-views/template-library-demo/template-library-demo.md`.
Concern documents are linked below.

## Purpose

A live future-state reference for the Templates library, rendered through the
project-scoped application route and reached from `/demo/templates`.

The first section is the product: the real Context, Content and Inspector
surface registries, on their real geometry, loading the real Template views.
The rest is the argument behind it: implemented behavior and data flow,
representation relationships, code-change inventory, verification invariants,
decisions that remain open, and a separately marked proposal for a durable
scratch-resource authoring lifecycle.

The current safe visibility boundary is narrower than the future-state filter
vocabulary: the capability returns only the viewer's templates as `Personal`.
`Project` and `Shared` remain deferred until an approved representation field
can authorize those relationships.

## Why the live route sits under `/app/[project]`

Capabilities resolve project scope from the calling page's pathname and admit
only `/app/<token>`. A conventional `/demo/templates` component could look
right but every remote read or mutation would be outside a project scope.

The friendly demo route therefore redirects to
`/app/[project]/reference/templates`. This inherits the application's client
model and authorization boundary without changing either. The reference page
then creates a fresh Workspace State coordinator for its three panes. It does
not restore or flush that coordinator, so looking at the reference cannot move
the reader's saved tabs, resize their panels or replace their selection.
Project route scope authorizes the call and any resource created with Use; it
does not make another member's template visible.

## Boundary

This view owns:

- the long-form reference page, navigation and section order;
- the isolated live-stage workspace coordinator;
- explanatory copies of implemented behavior, relationships, unresolved
  choices and the explicitly deferred authoring-lifecycle proposal;
- the visual inventory of implementation areas.

It does not own:

- template values, which come through the Template views' ordinary procedures;
- capability scope or mutation behavior;
- any Template product markup;
- document, slide-deck or spreadsheet editing;
- the representation contracts it explains.

## Public Contract

- **Entry:** [`template-library-demo.svelte`](template-library-demo.svelte)
- **Types:** `None`
- **Props:** `None`

## Dependencies

### Client models

| Object | Usage |
| --- | --- |
| Client Model | Supplies the scoped project and existing editor runtime registers |
| Configuration | Gives the reference coordinator explicit zero persistence thresholds |
| Workspace State | A fresh, un-restored coordinator for the live stage only |

### Capabilities

| Capability | Usage |
| --- | --- |
| None directly | The real Template views call their own browser doors |

### Composed views

| View | Usage |
| --- | --- |
| `$surfaces/context` | Loads `templates.overview-library` through the filesystem registry |
| `$surfaces/content` | Loads `templates.library` through the filesystem registry |
| `$surfaces/inspector` | Loads `templates.template` after selection |

### Presentation

The product stage uses the product surfaces unchanged. Explanatory chrome uses
plain semantic markup and public `--token-*` properties, following the Review
view's rule that the apparatus around a view must not look like another product
component being reviewed.

## Directory Documents

| Concern | Document | What it owns |
| --- | --- | --- |
| Components | [components.md](components/components.md) | Live stage, behavior map, data-flow diagram and change inventory |

## Rendered States

| State | Trigger | Visible result | Recovery |
| --- | --- | --- | --- |
| Initial | Scoped route renders | Live library with Nothing selected in the inspector | Select a shelf card or row |
| Selected | An owner-visible template is selected | Real Template inspector and active selection styling | Select another or delete |
| Narrow viewport | Stage is narrower than application geometry | The product stage scrolls horizontally rather than lying about flank widths | Scroll the stage |
| Missing view | A registry key has no component | The owning shell surface shows its ordinary placeholder | Fix the product registry/tree |
| Remote failure | A Template browser door rejects | The Template view owns the failure presentation | Retry through that view |

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
- Template visibility is owner-only and emits `Personal`; Project and Shared
  are documented as deferred vocabulary, not implemented access states.
- Scope proves project membership but carries no membership role. The reference
  uses the development owner; production writes still need role-aware scope.
- Batched collection writes and removals are atomic within one table file, but
  create, update, duplicate, remove and instantiate still have no transaction
  across table files; the reference does not claim otherwise.
- Matching pending commands share one promise per Workspace State instance, so
  sibling panes and keyed remounts cannot duplicate a write. This is not a
  durable cross-client request-id ledger, and the reference does not claim it is.
- Blank document and deck suffixes are chosen inside Project Resources from
  current project rows immediately before creation, never from a cached view.
- The authoring-session lane is labeled as a proposal: it requires a durable
  lease and expiry owner, and never claims that a generic tab close can safely
  delete scratch state.
