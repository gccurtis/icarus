# templates

The project's template library, its mutations, the crossing that turns a
template into an ordinary editable resource, and the crossing back: a template
opened in an ordinary editor and saved into.

| procedure | answers |
| --- | --- |
| `readTemplateLibrary` | Every valid template in the scoped project, projected as library metadata with creator name, permissions and last use, plus quarantined invalid row notices |
| `readTemplate` | The full body and variables for one valid template in the project, `unavailable` for a corrupt row, or `null` |
| `readResourceTemplate` | For one document or deck: the stage it is, if any |
| `createTemplate` | A template in the scoped project with a server-built valid empty body and revision-one history |
| `createTemplateFromResource` | A template from a live document, a live deck, or one slide of a deck as a one-slide deck, its body made portable first; says what could not travel |
| `updateTemplate` | A compare-and-swap name, description, tag, variable-help or variable-list update plus an immutable version snapshot |
| `duplicateTemplate` | A template in the project copied into a new one at revision one |
| `removeTemplate` | A compare-and-swap delete after the stage and all version rows are removed |
| `instantiateTemplate` | A regular document, deck, or spreadsheet with a revision-zero leader snapshot and no reference back to the template, its prompt scopes filled from the caller's answers, else each variable's default |
| `openTemplateStage` | The template's stage, made if absent: a scratch document or deck holding the template body, and the row that says so |
| `commitTemplateStage` | The stage resource's leader body, made portable and validated, written as the template's next revision |
| `discardTemplateStage` | The stage row and its scratch resource removed, with the resource's snapshots, change sets and comments |

## Visibility

A template belongs to one project. `projectId` is required on every row, the
library lists the scoped project's templates and nothing else, and every
procedure that names a template answers `not-found` for one in another
project. Anyone the scope admits to the project may read, edit, save into,
duplicate and delete its templates; `userId` and `createdBy` record who made
one and grant nothing. Every template is `project`; `personal` stays in the
availability vocabulary for a future owner-only state the capability never
invents.

A resource made from a template is a copy and nothing more: it carries no
reference to the template, and later changes to the template never reach it.
The template records `lastUsedAt` when it is instantiated, which is all the
library's recency reads. Opening a template to edit it is not a use.

## Bodies

A body is `document`, `slides`, or `spreadsheet`. A template made from one slide
is a deck body holding that slide, the layout it uses, and the theme and styles
it is drawn with, and no sections; nothing distinguishes it from any other deck
template afterwards.

A body made from a live resource is made portable first: formula ids, generated
output ids, links to people and resources, images stored in the project, and
scope terms naming project resources are dropped, and each is said back to the
caller. A template turns a value into a function, so this holds inside one
project as much as across two: a prompt's scope is what the variables fill, and
a formula keeps its expression and loses its instance, its project-neutral
form, drawn as unbound in the editor until a formula is made for it again. The
body is then admitted exactly as a stored one would be, so a template can never
hold what a template may not.

## Variables

A variable exists because the body names it. Saving a stage or making a template
from a resource declares every name the body asks for, so the list is found
rather than authored; the panels edit a variable's description and default and
never its membership.

**A body asks in two ways, so a variable is answered in two ways.** A prompt's
scope naming one makes it a `scope`: a group of resources, which always has an
answer because the whole project is the floor. A template atom in the prose makes
it a `text`: words, filled from the caller, else the variable's own `text`, else
nothing. That last case is the only thing that can hold a placement up, and
`instantiateTemplate` refuses it with the names of what is still empty. A name
used both ways is a scope, because otherwise the template could never be placed.

A variable's `default` is what it selects when the caller says nothing: the
whole project, kinds, one of the project's named sets, or another variable. A
variable declared without one means the whole project. Instantiation fills
every prompt scope from the caller's answers, else the default; an answer is a
resource set, and a named set it points at is checked to exist before anything
is written. A body naming a variable the template does not declare is refused
rather than guessed at.

**A rule that cannot be said inline is stored, and what points at it is one
term.** Both a default and an answer arrive as whatever somebody built, which
may exclude things and may name particular resources — neither of which the
templated vocabulary holds. `normalizeScope` writes those as a `resourceSets`
row bound to the variable that owns them, and the default or answer becomes a
single `set` term naming it. That is not bookkeeping: resolving a template
substitutes a variable term for what fills it, on either side of a prompt's
scope, and one term for a difference cannot be expressed on the excluding side.
A rule that is only the project, kinds or named sets is kept inline and writes
nothing. Reading a template back expands a bound default into the rule it holds,
so a builder opens on what was built; a named set is left as the named set
somebody chose. The rows go when their owner does: a template removed, a
variable dropped, a working copy discarded.

`updateTemplate` still takes a whole variable list, because that is how a
description or a default is written, and it refuses with `variable-in-use` while
the body still names a variable the list drops.

## Stages

A stage is how a template is edited: a scratch document or deck the ordinary
editor and runtime work on unchanged, and a row naming the template, the
revision it was taken from, and the resource. One per template, shared by
everyone in the project; opening again reuses it, so several people editing a
template are editing one copy through the editor's own collaboration. Saving
reads the scratch leader body, makes it portable, validates it, and writes it as
the template's next revision; the stage stays open until it is discarded, so
saving twice is ordinary. A name, tag or variable edit never touches the body,
so it carries the stage to the new revision. The stage is the only thing that
writes a template's body, so a copy and its template cannot drift apart; the
compare-and-swap on save refuses only a second session's save that landed
first. Comments are stripped like everything else that does not travel: the
comments capability refuses to start a thread on a stage resource, and any
thread that reaches one goes with the stage when it is discarded. A spreadsheet
template cannot be staged until its editor lands.

Project Overview leaves stage resources out of its index, and a resource set
never counts one.

## Revisions and refusals

Updates, deletes and saves require `baseRevision`. Stale and missing requests
are ordinary `accepted: false` answers, not transport errors. Invalid payloads
throw before the store is read. Every created or updated template writes the
corresponding `templateVersions` row.

Every stored row is re-admitted before projection or mutation. A malformed
legacy row is quarantined from the list, reported as unavailable on direct read,
and refused by update, duplicate, remove, and instantiate. One corrupt row
therefore cannot crash the rest of the library or be copied into new history.

## Instantiation boundary

Instantiation writes normal resource rows, not a private template-editor data
model. Documents and decks receive their represented body as a leader snapshot.
Spreadsheet templates are
materialized from addresses into stable row/column ids, sheet-cell rows, print
ranges, dimensions, and a leader snapshot. All materialized cells are admitted
and persisted as one table batch rather than rewriting the cell table once per
cell. Formula evaluation and derived-output creation are downstream
editor/runtime responsibilities, not side effects hidden in instantiation.

## Persistence boundary

The store makes each individual table replacement failure-safe: it admits a
batch first, writes a sibling next-file, renames that file into place, and only
then updates live memory. This removes phantom state after a failed write and
bounds collection creation/removal to one table persistence operation.

It is not yet a transaction across table files. Template/version writes,
provenance/template deletion, stage creation and discard, and
resource/snapshot/cell instantiation cross that boundary. Known validation and
conflict refusals happen before writes, but a later-table I/O failure still
needs a represented transaction or explicit recovery contract.
