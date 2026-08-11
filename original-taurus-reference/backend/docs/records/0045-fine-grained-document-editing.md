# 0045 Fine-grained Document editing

This increment completes roadmap R3. The Document operation vocabulary now
captures ordinary text edits and rearrangement directly, with enough exact
prior-state information to reject stale intent today and support proven
semantic rebase in R4. Every new operation remains an append-only, authored,
invertible ChangeSet revision; no alternate revision model or persistence path
was introduced.

## `core/capability/document/editing.go`

### Implement exact fine-grained editing operations

Add lowercase SHA-256 text and Mark preconditions, UTF-8 byte-range splice,
stable-ID Row/Block/Atom moves, full Mark replacement, and the smallest useful
Block split/join. Each application checks live digest, parent, predecessor,
range, or adjacency facts and returns a deterministic conflict when the
authored state no longer matches.

### Derive complete compensating operations

Build inverses from before/after snapshots. Text compensation restores removed
bytes and exact Marks; moves restore original parent/order; Mark update restores
the prior value; split and join invert each other while preserving Row, Block,
Atom, kind, and style identities.

## `core/capability/document/editing.go.md`

### Document the R3 engine verbatim

The new companion reproduces every source byte in logical sections and explains
digest validation, splice anchor transformation, stable movement, minimal
split/join constraints, and inverse construction.

## `core/capability/document/changeset.go`

### Extend the typed operation envelope

Register the seven R3 wire operations and their source-parent, predecessor,
counterpart, byte-range, replacement, and digest fields. Clone splice payloads,
validate R3 shapes, assign missing split identities, delegate application and
inverse construction, and describe the expanded conflict boundary.

## `core/capability/document/changeset.go.md`

### Keep the change-set companion synchronized

The companion reproduces the expanded operation constants, fields, delegates,
cloning, validation, and ID assignment exactly, with current prose for the
twenty-two-operation vocabulary.

## `core/capability/document/history.go`

### Summarize fine-grained intent safely

Include move source parents, join counterparts, split payload identities, and
Mark/anchor identities in bounded, content-free affected-object summaries so
History describes the actual user gesture without exposing text or inverse
recipes.

## `core/capability/document/history.go.md`

### Keep History documentation exact

The companion reproduces the R3 summary logic verbatim and explains the added
affected-ID coverage.

## `core/capability/document/changeset_test.go`

### Prove validation, replay, identity, and exact undo

Cover Unicode boundary rejection, stale and malformed digests, deterministic
Mark transformation, same-parent and cross-parent moves, stale predecessor
conflicts, Mark-breaking Atom moves, Mark replacement, minimal split/join,
stable IDs, History summaries, and exact compensation.

## `core/platform/storage/sqlite/sqlite_test.go`

### Prove operation JSON remains opaque and lossless

Round-trip a splice and its private inverse, including replacement text and
digest fields, through SQLite. This verifies that R3 needs no schema migration
because the Store persists typed operations as whole JSON values.

## `core/handlers/document/document.go`

### Generalize content-conflict wording

Map `ErrConflict` to a stable message that covers stale digests, ordering,
parents, ranges, and adjacency as well as missing IDs, instead of incorrectly
claiming every conflict references deleted content.

## `core/handlers/document/document.go.md`

### Keep the handler companion synchronized

The verbatim handler section now carries the generalized R3 conflict response.

## `core/transport/transport_test.go`

### Exercise R3 through the public HTTP boundary

Submit splice, movement, split, and join requests through the registered route,
verify their resolved effects, and confirm a stale text digest maps to a
content-conflict response.

## `dev-test/changesets/run.sh`

### Drive the fine-grained workflow against a running service

Extend the executable suite with digest calculation, text splice, stable Row
movement, and a split/join round trip using explicit identities.

## `dev-test/changesets/manual.md`

### Explain the R3 request parameters

Add all seven operation shapes and document byte offsets, lowercase digests,
move source/destination anchors, canonical Mark hashing, conflict behavior, and
the deliberately narrow split/join contract.

## `docs/architecture/capabilities/documents/README.md`

### Make the operation and conflict model current

Expand the catalog to twenty-two operations and define prior-state hashing,
UTF-8 range semantics, Mark anchor transformation, stable movement, minimal
split/join, exact inverses, and the boundary between R3 preconditions and R4
semantic rebase.

## `docs/architecture/capabilities/documents/atoms-and-marks.md`

### Document precise inline editing

Describe splice as the preferred ordinary typing primitive, retain
`set_atom_text` compatibility, define anchor movement, and add digest-guarded
Mark update.

## `docs/architecture/capabilities/documents/data-model.md`

### Connect stable identity to first-class movement

Clarify that Rows, Blocks, and Atoms keep their IDs while moving within or
across parents instead of being deleted and recreated.

## `docs/architecture/persistence.md`

### Record the schema-neutral persistence result

Explain why opaque operation and inverse JSON carries every R3 field without a
relational migration.

## `docs/architecture/transport.md`

### Identify the expanded submission surface

Keep the existing synchronous change route while noting that its typed
operation union now accepts splice, move, Mark update, and split/join.

## `docs/backend-guide.md`

### Surface fine-grained edits to clients

Update the endpoint catalog with the new operation families and their
precondition-conflict behavior.

## `docs/orientation/README.md`

### Advance the Document capability vocabulary

Orient new contributors to fine-grained text, identity-preserving movement,
Mark preconditions, and the unchanged append-only revision model.

## `docs/support/document-backend-roadmap.md`

### Complete R3 and advance the next target

Link this record from R3 and move the active implementation direction to R4,
proven semantic rebase.

## `docs/support/checklists/document-backend.md`

### Close every R3 checklist item

Mark splice, Row/Block/Atom movement, Mark update, and editor-sized split/join
complete and set R4 as the live focus.

## `docs/support/document-backend-alignment-gaps.md`

### Close the fine-grained editing gap

Replace the former missing-operation assessment with the implemented R3
contract and explicitly leave safe stale-revision admission to R4.
