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
A click selects the template for inspection; a double-click moves the singleton
Template category into its authoring shell without creating a resource or a
second workspace tab. `Use` is the only gesture that instantiates an independent
project resource and opens its ordinary editor for documents and slide decks.
Spreadsheet materialization exists at the capability boundary, but its library
handoff is visibly disabled until the mock-backed spreadsheet editor consumes
the created resource id. Represented variable
defaults are resolved before the write; an unbound, cyclic, or excessively
expanding variable refuses before any resource write.

The shelf is a horizontal scrollport with a quiet bottom scrollbar. Its rows are
not a second seed: recency is derived by joining represented documents,
slide-decks, and spreadsheets back through their `templateId` provenance and
taking the newest resource creation time per template. Later resource edits do
not make an old template use look recent again.

## Context: overview-library

The Overview context panel creates a represented empty template of any supported
target. An optional name sits above three colored icon actions for Document,
Slide deck, and Spreadsheet. Pressing an icon creates that kind immediately;
the view supplies a unique working name only when the field is blank, then moves
inspection to the returned id. A compact Total section breaks the library down
by scope and target.

## Inspector: template

The inspector performs a body-bearing read only for the selected template. It
shows target, availability, update time, creator, description, variables, and
tags. Name and fixed-height description fields autosave on blur; variable help
text autosaves, while clicking a variable name marks the future default-settings
modal boundary without exposing keys or defaults in the disclosure. Tag creation
is kept above the tags it adds. Duplicate always creates
an independent viewer-owned copy. Delete is owner-only, revision-checked, removes
version rows, and clears provenance from existing resources rather than deleting
those resources. Batched removals avoid repeated whole-table rewrites. Use
creates a new resource and leader snapshot through the Templates capability;
spreadsheet cells are admitted in one store batch.

The inspector displays the represented variable label and optional description.
Stable keys and templated resource-set defaults remain in the capability model,
but their future settings modal is not implemented. The library does not invent
type or requiredness fields that representation does not carry.
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

There is no separate template editor implementation in this future state. The
singleton Template category owns a quiet, left-aligned Library return bar. The
intended authoring body stages the template under a real
resource id and borrows the ordinary document or slide-deck runtime below that
header. Variable-bearing Prompt positions render as Template blocks while
authoring; Done flushes the runtime, compare-and-sets the body back into the
template, and then cleans up the stage.

That stage needs durable identity before it is safe. Workspace close and reopen
are persisted and undoable, and runtime release begins an asynchronous flush;
deleting a scratch resource merely because a tab closed can therefore revive a
dead tab or race unsaved changes. A future represented edit-session row must
associate template, user, stage id, base revision, and expiry. Until that schema
is approved, the compatibility content names the boundary and the library does
not route into the old session-local authoring mock.
