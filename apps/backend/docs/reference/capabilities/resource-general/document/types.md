# Document type reference

Canonical type authority is
`domain/model.ts`. Wire decoders return these types only
after strict JSON-shape admission; SQLite mappers persist/reconstruct the same
families.

## Aggregate and layout family

| Type | Purpose |
| --- | --- |
| `DocumentLifecycle` | `active | archived`; both are live states in the current table. |
| `DocumentOrigin` | `interactive | agent | automation`. |
| `DocumentHead` | Current aggregate metadata, revision/Base cursor, digest, timestamps. |
| `DocumentSnapshot` | Representation v1, revision, title/lifecycle, page layout, Style Registry, root Rows. |
| `DocumentPageLayout` | Page dimensions/orientation, margins, and page-number start/format, all in twips where applicable. |
| `DocumentRow`, `RowLayout`, `RowTrack` | Ordered Blocks plus gap/margins and aligned positive width-unit tracks. |
| `BlockPlacement` | Insert/move target: after Block, between Blocks, within Row, or new Row. |

Page orientation is `portrait | landscape`; page-number format is
`decimal | roman-lower | roman-upper`.

## Style family

- `DocumentSystemStyleRole`: `heading-1` through `heading-6`.
- `DocumentStyleRegistry`: defaults for every `DocumentBlockKind` and the Style
  array.
- `DocumentStyle`: stable ID/name, optional inheritance, Rich Text properties,
  Block properties, and optional heading role.
- `BlockStyleProperties`: alignment, wrapping, spacing, line height,
  indentation, keep-with-next, and keep-together.
- `BlockPresentationOverride`: local Block overlay with the same property set.

## Block and nested-content family

Every Block has `id`, `styleId`, and optional presentation. The closed union is:

| Kind | Canonical payload |
| --- | --- |
| `text` | `RichContent` |
| `code` | optional language and `RichContent` |
| `quote` | `RichContent` |
| `prompt` | exact `DerivedOutputRef` |
| `divider` | no additional payload |
| `callout` | tone and nested Rows |
| `list` | `DocumentList`: kind, optional numbered start, recursive `ListItem`s |
| `table` | `DocumentTable`: columns, rows, row-major cells, rectangular merges |
| `image` | immutable `MediaSnapshotRef`, dimensions, accessibility, crop, fit |
| `chart` | source discriminator, opaque specification, dimensions, optional digest, alt |

Supporting types include `TableColumn`, `TableRow`, `TableCell`, `TableMerge`,
`VisualDimensions`, `ImageBlockData`, and `ChartBlockData`. Rich Text types are
owned by `#rich-text`; Derived Output types by `#derived-outputs`.

## Operation family

`DocumentOperation` has 35 variants grouped as follows:

- Document/layout: `document.rename`, `document.set-lifecycle`,
  `layout.set-page`.
- Styles: `style.create`, `style.update`, `style.delete`, `style.set-default`,
  `style.apply-inline`.
- Rows: `row.insert`, `row.move`, `row.delete`, `row.set-layout`.
- Blocks: `block.insert`, `block.move`, `block.replace`, `block.delete`,
  `block.set-style`, `block.set-presentation`.
- Text/prompt: `rich-text.apply`, internal
  `prompt.apply-derived-output`.
- Lists: insert/move/delete item and checklist state.
- Tables: insert/move/delete row; insert/move/delete column; merge/unmerge.
- Visuals: image source/accessibility and shared visual dimensions.

The exact payload for each discriminant is in
`model.ts` and admitted by
`operationSchemas.ts`.

## History, Activity transaction, and idempotency family

| Type | Purpose |
| --- | --- |
| `DocumentBase` | Full canonical snapshot/digest at `baseSeq`. |
| `DocumentChangeSet` | Forward/inverse operations, request/revision metadata, touched IDs, compensation, digest. |
| `DocumentCommittedTransaction` | Accepted create/change/compensate/delete source transaction for outbox publication. Its `sourceTransactionId` is passed as Activity's idempotency key; Activity derives the ledger ID. The record retains request/ChangeSet/compensation data independently of compactable history. |
| `DocumentSubmissionReceipt` | Durable request digest/result replay. |
| `DocumentIdentity*` | Identity kind, active/tombstoned ledger state, transition set, and allowed compensation reactivation. |

`document_history` is persistence-level head history rather than a public
aggregate type. Each row is either a complete superseded `DocumentHead`
snapshot or a terminal deletion revision. The ID-only `document_resources`
root anchors reconstructable Bases, ChangeSets, and structural identity history
after the current `DocumentHead` has been removed.

Identity kinds are Style, Row, Block, List, List Item, Table, Table Row,
Table Column, Table Cell, Table Merge, Rich Text atom, and Rich Text mark.

## Attempt and ownership family

`DocumentAttemptState` is
`requested | computing | proposed | settled | unchanged | stale | failed`.
The common attempt records request identity/digest, Block, frozen Document
revision, state, optional settlement/diagnostic, and timestamps.

- `PromptCreationAttempt` freezes style/presentation/placement and definition;
  candidates record output ID/head revision.
- `PromptRefreshAttempt` freezes prompt Block, output ID, and applied revision.
- `FormulaEvaluationAttempt` freezes atom/expression/digest and may store the
  resolver snapshot digest and candidate Rich Text operations.
- `DocumentStageReceipt` owns one compute/settle claim and its running,
  completed, or failed outcome.
- `PromptOutputOwnership` tracks one dedicated output as pending, attached, or
  detached.

## Command/query and result family

Every command envelope has `requestId`, `origin`, and a command; optional
`actorId` exists in the domain type but the current wire decoder accepts only
`requestId`, `origin`, and `command`.

Commands:

- `document.create`, `document.submit`, `document.compensate`,
  `document.delete`, `document.purge`;
- `prompt.create.request`, `prompt.update-definition`,
  `prompt.refresh.request`;
- `formula.evaluate.request`.

Results include `document.created`, `document.changed`, `document.deleted` with
terminal revision, `document.purged`, prompt create/refresh requested, prompt
definition updated, or formula evaluation requested.

`document.delete` is logical deletion and requires `expectedRevision`.
`document.purge` is irreversible, takes only `documentId`, rejects a live
current row, and requires terminal deletion history.

**`document.create` takes no `documentId`.** The service allocates it and
returns it on `document.created`'s `head.id`. Supplying one is an unknown key
and therefore a 400 — a caller has no basis on which to name a resource that
does not exist yet. Every other command addresses an existing document and
still carries its id.

Queries are `document.list`, `document.load`, `document.history`, and
`document.attempt`; results are the corresponding listed/loaded/history/attempt
variants. `document.load` includes exact Derived Output revisions referenced by
the loaded snapshot.

## Internal intents and store commits

`DocumentInternalJobIntent` covers compaction and compute/settle for prompt
creation, prompt refresh, and formula evaluation. Every intent has a stable
idempotency key and either Document or attempt identity.

`ports/documentStore.ts` defines atomic input
families: `DocumentCreationCommit`, `DocumentMutationCommit`,
`PromptOwnershipTransition`, `PromptCreationFailureCommit`, and stage-claim
result.

## External ports

- `DocumentDerivedOutputs` narrows declare/get/getRevision/updateDefinition/
  refresh/delete/purge.
- `DocumentFormulaResolver` narrows `buildSnapshot()`.
- `DocumentDependencies` combines Rich Text, Formula, resolver, Derived
  Outputs, internal jobs, Logger, and optional trusted attribution.

## Error family and HTTP mapping

`domain/errors.ts` defines not-found, attempt-not-found,
already-exists, revision conflict, idempotency mismatch, compensation conflict,
history-pruned, invalid-cursor, validation, identity-reuse, placement, Style
reference, operation, and stale-attempt errors. Endpoint wiring additionally
maps Derived Output errors. Mappings are: 404 not found, 410 pruned history,
409 revision/idempotency/compensation/existence conflicts, 400 wire/domain
validation, and generic 500 with a non-sensitive message. Purge additionally
maps a live current row to 409 `not_deleted` and missing terminal history to 404
`not_found`.

## Wire families and limits

`valueSchemas.ts` supplies strict decoders for every
nested canonical value plus common primitive/exact-key guards. Wire limits are
1 MiB encoded payload, 256 KiB string, 512-byte identifier, 10,000 collection
items, 1,000 Document operations, 1,000 Rich Text operations, depth 32, and
100,000 visited nodes. Inputs must be finite JSON values, plain objects,
acyclic, and free of unknown fields at decoded boundaries.

## Persistence and projection families

`DocumentTableNames` names project-hashed tables for the stable resource root,
current `documents`, `document_history`, receipts, create receipts, structural
identity ledger, Bases, ChangeSets, `transaction_outbox`, retained output IDs,
attempts, current prompt ownership, and stage receipts. Mapper functions
serialize JSON as UTF-8 Buffers and reconstruct every persisted domain family.

Projection results are `DocumentDependenciesProjection`, outline items,
resolved Block style, and resolved text styling; plain text returns `string`.
