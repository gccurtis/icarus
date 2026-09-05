# Templates

The singleton library for reusable document, slide-deck, and spreadsheet bodies.

| Content | Shows |
| --- | --- |
| [`library.svelte`](content/library.svelte) | Ten most recently used templates over a searchable, sortable, filterable table |
| [`editor.svelte`](content/editor.svelte) | Compatibility landing that explains why authoring belongs in the ordinary editors |

## Library

The centre has one vertical stack: header, recently used shelf, then the complete
table. Search reaches names, descriptions, and tags. Availability, target, and a
bounded multi-select tag menu compose, and every sort has an explicit direction.
A click selects the template for inspection; a double-click instantiates an
independent project resource and opens its ordinary editor for documents and
slide decks. Spreadsheet materialization exists at the capability boundary, but
its library handoff is visibly disabled until the mock-backed spreadsheet editor
consumes the created resource id. Represented variable
defaults are resolved before the write; an unbound, cyclic, or excessively
expanding variable refuses before any resource write.

The shelf is a horizontal scrollport with a quiet bottom scrollbar. Its rows are
not a second seed: recency is derived by joining represented documents,
slide-decks, and spreadsheets back through their `templateId` provenance and
taking the newest resource creation time per template. Later resource edits do
not make an old template use look recent again.

## Context: overview-library

The context panel creates a represented empty template of any supported target.
It also reports one compact breakdown by availability and target. Create waits
for the Templates capability, refreshes every mounted library query, and selects
the returned id.

## Inspector: template

The inspector performs a body-bearing read only for the selected template. It
shows target, availability, update time, creator, description, variables, and
tags. Description and tags are editable for the owner. Duplicate always creates
an independent viewer-owned copy. Delete is owner-only, revision-checked, removes
version rows, and clears provenance from existing resources rather than deleting
those resources. Batched removals avoid repeated whole-table rewrites. Use
creates a new resource and leader snapshot through the Templates capability;
spreadsheet cells are admitted in one store batch.

Variables display exactly the represented contract: `name`, `label`, optional
`description`, and optional templated resource-set `default`. The library does
not invent type or requiredness fields that representation does not carry.
Instantiation resolves represented defaults, including nested defaults. It does
not invent caller-supplied answers before representation defines that payload.

## Capability seam

All stored reads and writes enter
[`$capabilities/templates/index.remote.ts`](../../../capabilities/templates/index.remote.ts).
It exposes:

- `readTemplateLibrary`
- `readTemplate`
- `createTemplate`
- `updateTemplate`
- `duplicateTemplate`
- `removeTemplate`
- `instantiateTemplate`

Every server procedure establishes request scope first. Mutations validate their
payload, enforce ownership where relevant, and use the represented revision for
compare-and-set updates. Template versions are written with creates and accepted
updates. No view imports the generic store capability for template work. Store
writes are failure-safe within one table, but the model has no transaction
across the several tables touched by versioning, deletion, or instantiation; the
reference documents that recovery decision explicitly.

## Availability boundary

Representation currently records a template owner but no project ownership or
sharing policy. The capability therefore returns only viewer-owned **Personal**
rows. **Shared** and **Project** remain in the visual vocabulary and report zero
until a represented availability/project association is approved. Project
membership and tags are never used to manufacture access.

## Authoring boundary

There is no separate template editor in this future state. The intended flow is
to stage the template body under a real resource id, use the ordinary document
or slide-deck runtime, flush it, compare-and-set the body back into the template,
then clean up the stage.

That stage needs durable identity before it is safe. Workspace close and reopen
are persisted and undoable, and runtime release begins an asynchronous flush;
deleting a scratch resource merely because a tab closed can therefore revive a
dead tab or race unsaved changes. A future represented edit-session row must
associate template, user, stage id, base revision, and expiry. Until that schema
is approved, the compatibility content names the boundary and the library does
not route into the old session-local authoring mock.
