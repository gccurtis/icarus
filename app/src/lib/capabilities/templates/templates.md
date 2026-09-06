# templates

The project-facing template library, with its mutations and the crossing that
turns a template into an ordinary editable resource.

| procedure | answers |
| --- | --- |
| `readTemplateLibrary` | Every valid template visible from the scoped project, projected as library metadata with creator name, permissions, and last use, plus quarantined invalid row notices |
| `readTemplate` | The full body and variables for one valid visible template, `unavailable` for a corrupt visible row, or `null` |
| `createTemplate` | A viewer-owned template with a server-built valid empty body and revision-one history |
| `updateTemplate` | An owner-only, compare-and-swap name, description, tag, or variable-help update plus an immutable version snapshot |
| `duplicateTemplate` | A visible template copied into the viewer's ownership at revision one |
| `removeTemplate` | An owner-only, compare-and-swap delete after current-project provenance and all version rows are removed; cross-project references refuse deletion |
| `instantiateTemplate` | A regular document, deck, or spreadsheet with template provenance and a revision-zero leader snapshot |

## Visibility and availability

The representation currently gives a template a `userId`, but no project id or
sharing field. The capability therefore makes only the claim stored data can
support:

- the viewer's templates are `personal`;
- every template owned by someone else is not visible. Project membership alone
  never grants access to that person's templates.

The request scope proves project membership but does not yet expose membership
role. The development user is the project owner; a production boundary must add
role-aware scope before project-resource creation can distinguish a viewer from
an editor. Template metadata mutation remains additionally owner-checked against
the represented template `userId`.

`project` remains in the public `TemplateAvailability` vocabulary as the one
named future ownership state. The capability never invents it. There is no
generic `shared` availability in the current contract; future access to a
personal template needs an explicit owner-and-access-list design instead.

A personal template has no represented project association. Deletion therefore
refuses while any resource outside the request's project still references it;
the scoped command never creates a dangling foreign-project `templateId` and
never mutates a project it was not authorized to enter.

`lastUsedAt` is the newest `_creationTime` of a document, deck, or spreadsheet
in the scoped project whose `templateId` names the template. Later edits to that
resource do not make the template appear newly used.

## Revisions and refusals

Updates and deletes require `baseRevision`. Stale, forbidden, and missing
requests are ordinary `accepted: false` answers, not transport errors. Invalid
payloads throw before the store is read. Every created or updated template
writes the corresponding `templateVersions` row. The current update door handles
metadata plus one variable description at a time; stable variable keys/defaults
and body authoring wait for the durable editor-session contract rather than
exposing a weakly validated generic object write.

Every stored row is re-admitted before projection or mutation. A malformed
legacy row is quarantined from the list, reported as unavailable on direct read,
and refused by update, duplicate, remove, and instantiate. One corrupt row
therefore cannot crash the rest of the library or be copied into new history.

## Instantiation boundary

Instantiation writes normal resource rows, not a private template-editor data
model. Documents and decks receive their represented body as a leader snapshot.
Spreadsheet templates are materialized from addresses into stable row/column
ids, sheet-cell rows, print ranges, dimensions, and a leader snapshot. All
materialized cells are admitted and persisted as one table batch rather than
rewriting the cell table once per cell.

There is deliberately no ad-hoc variable-values input. The representation
defines portable defaults, so instantiation substitutes those defaults into
prompt scopes (including nested defaults) and can open the seeded templates
without inventing another data shape. An unbound or cyclic variable hole returns
`variables-required` and writes nothing. Caller-supplied overrides wait for the
representation to define the command payload that records a person's answers.
Formula evaluation and derived-output creation are downstream editor/runtime
responsibilities, not side effects hidden in instantiation.

## Persistence boundary

The store makes each individual table replacement failure-safe: it admits a
batch first, writes a sibling next-file, renames that file into place, and only
then updates live memory. This removes phantom state after a failed write and
bounds collection creation/removal to one table persistence operation.

It is not yet a transaction across table files. Template/version writes,
provenance/template deletion, and resource/snapshot/cell instantiation cross
that boundary. Known validation and conflict refusals happen before writes, but
a later-table I/O failure still needs a represented transaction or explicit
recovery contract. The future-state reference calls this limitation out rather
than describing those mutations as atomic.
