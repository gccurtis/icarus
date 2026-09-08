# Templates

The singleton library for reusable document, slide-deck, and spreadsheet bodies,
and the door into editing any of them.

| Content | Shows |
| --- | --- |
| [`library.svelte`](content/library.svelte) | Ten most recently used templates over a searchable, sortable, filterable table |
| [`editor.svelte`](content/editor.svelte) | Opens the focused template for editing in its own editor, then lands back on the library |

## Library

The centre has one vertical stack: header, recently used shelf, then the complete
table. Search reaches names, descriptions, and tags. Availability, target, and a
bounded multi-select tag menu compose, and every sort has an explicit direction.
A click selects the template for inspection. A double-click **edits** it: the
capability stages a copy of the template's body as a scratch document or deck,
and the ordinary editor opens on that copy in its own tab. The editor's Templates
panel is where the copy is saved back or discarded. `Use` is the separate gesture
that instantiates an independent project resource and opens its ordinary editor
for documents and decks, after asking, in one modal, what fills each hole, its
default offered first; the resource it makes carries no reference
back to the template. Spreadsheet materialization exists at the capability
boundary, but neither Use nor Edit reaches it until the spreadsheet editor
consumes represented resource ids.

The shelf is a horizontal scrollport with a quiet bottom scrollbar. Its rows are
not a second seed: recency is the `lastUsedAt` a template records when it is
instantiated. A resource made from a template carries no reference back to it,
and editing a template's working copy is never a use.

## Context: overview-library

The Overview context panel creates a represented empty template of any supported
target. An optional name sits above three colored icon actions for Document,
Slide deck, and Spreadsheet. Pressing an icon creates that kind
immediately; the view supplies a unique working name only when the field is
blank, then moves inspection to the returned id. A compact Total section breaks
the library down by scope and target.

## Inspector: template

The inspector performs a body-bearing read only for the selected template. It
shows target, availability, update time, creator, description, holes, and
tags. Name and fixed-height description fields autosave on blur. Four actions
sit in one row: Use, Edit, Duplicate, Delete. Edit opens the template's copy in
its editor, making the copy if the project has none yet. Duplicate always
creates an independent copy in the project. Delete is revision-checked and
removes the template with its version rows and its working copy; resources made
from it are untouched, because none refers back.

Each hole opens into its description, then one button reading its default scope
as a sentence, which opens a modal to change it — everything in the project,
particular kinds, or one of the project's named sets. Which scope holes exist is
not editable here: they are the names the body's prompt scopes use, found when
the template is saved.

## Capability seam

All stored reads and writes enter
[`$capabilities/templates/index.remote.ts`](../../../capabilities/templates/index.remote.ts).
It exposes the library and detail reads, template creation and revision updates,
duplication and removal, resource instantiation, and the open/commit/discard
authoring-stage commands. No view imports the generic store capability for
template work.

Every server procedure establishes request scope first. Mutations validate their
payload, enforce project ownership, and use the represented revision for
compare-and-set updates. Multi-record intents cross the Store's recoverable
unit-of-work boundary so a failure cannot publish only part of a template or its
authoring stage.

## Availability boundary

A template belongs to the project it was made in, so every row the library
shows is **Project** and anyone in the project may edit it. **Personal** stays
in the scope vocabulary as a future owner-only state and reports zero until one
is represented.

## Authoring boundary

There is no separate template editor. A template is edited as a **stage**: a
scratch resource holding its body, and a row that names the template, the
revision it was taken from, and the resource. The ordinary editor, runtime,
comments and change sets work on the scratch resource unchanged. Saving reads
its leader body, makes it portable, validates it as a template body, and writes
it as the template's next revision; the stage stays open until it is discarded.
One stage per template, shared by everyone in the project, so opening again
resumes the same copy.
