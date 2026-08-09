# Document

*Verified against source at commit ef6d462, 2026-08-09.*

Document is the project-scoped, revisioned aggregate for long-form authored content. Its canonical
state is a `DocumentSnapshot`; every mutation is a list of typed operations reduced against a clone
of that snapshot, recursively validated, and appended atomically as a `DocumentChangeSet` plus a
new head revision. It carries the text, the layout, the styles, the tables and lists, the embedded
Prompt Blocks that ask Derived Outputs a question, and the Context Variables that make a Document
parameterisable — and therefore templatable. It is also the reference capability: the largest
(28 files, 9,721 lines), the best-tested (76 tests across four files), and the one whose `wire/`
decoder layout, `ports/`+`persistence/` split and pure `domain/` other capabilities are meant to
copy.

---

## 1 · At a glance

| | |
| --- | --- |
| **Shape** | Layered, with both optional packages: `domain/ application/ ports/ persistence/ wire/ projections/` |
| **Endpoints** | **2** — `POST /documents/command`, `POST /documents/query` |
| **DB file** | `./data/documents.db`, opened at [`1-init/create/document.ts:22`](../../../apps/backend/src/1-init/create/document.ts) |
| **Tables** | **13** (12 declared in `sqliteSchema.ts` + the shared revision-history table), all prefixed `doc_<sha256(projectId)[0:16]>_` |
| **Revision model** | Base snapshot + forward ChangeSets; `seq = revision = priorRevision + 1`, enforced in SQL and re-checked in JS; head compare-and-swap; conservative disjoint-footprint rebase; undo/redo as a *forward* compensating ChangeSet |
| **Commands / queries / internal intents / operations** | 9 / 4 / 7 / **39** |
| **Test files (tests)** | `document-application.test.ts` 1,912 lines (26), `document-domain.test.ts` 1,230 (34), `document-persistence.test.ts` 897 (7), `document-wire.test.ts` 500 (9) — **4 files, 4,539 lines, 76 tests, 76 pass** |
| **Source files / lines** | **28 / 9,721** for `3-capabilities/document/`. **33 / 10,020** for everything Document owns, adding `4-job-wiring/document/` (4 files, 224 lines) and `1-init/create/document.ts` (75 lines) |
| **Status** | Complete and wired. Two real defects: `logicalDelete` always throws (KI-1), and sealed-document refusals surface as HTTP 500 (KI-4). Both are in §8 |

Document is the only capability with `projections/` and one of four with a `wire/` package. **All
seven internal, non-HTTP job intents in the backend are Document's.** (Slides declares a
`SlideInternalJobIntent` union with seven arms at `slides/domain/model.ts:864`, but nothing
registers or dispatches them — see [slides.md](slides.md).)

---

## 2 · Domain model

Everything in this section is from [`domain/model.ts`](../../../apps/backend/src/3-capabilities/document/domain/model.ts)
(775 lines) unless another file is named.

### 2.1 The aggregate

```ts
interface DocumentSnapshot {
  revision: number;
  title: string;
  lifecycle: DocumentLifecycle;       // "active" | "archived"
  pageLayout: DocumentPageLayout;
  styles: DocumentStyleRegistry;
  contextVariables: DocumentContextVariable[];
  rows: DocumentRow[];
}
```

Seven fields, `model.ts:49-63`. Two things to get right, because published documentation has been
wrong about both:

- **There is no `representationVersion` field.** No version field of any name exists on the
  snapshot. The decision is recorded in the module's own
  `docs/invariants.md:40-43`: *"There is no representation version: the shape is whatever the code
  says, and the database is deleted when it changes, so a version field only ever named a version
  that never coexisted with another."* The module's `types.md:15` and `runtime.md:126` still cite
  one; they are wrong.
- **`contextVariables` is a snapshot field**, not a side table and not an omission. `model.ts:56-60`
  says why, verbatim:

  > In the snapshot rather than a side table, deliberately: a side table would
  > be state that history could not reconstruct, so a Base rewind would restore
  > old Blocks against current variables.

`DocumentLifecycle = "active" | "archived"` (`model.ts:14`). **There is no `trashed` state.**
`grep -rn -i "trashed"` over `3-capabilities/document` returns zero hits, and the SQL CHECK is
`lifecycle IN ('active','archived')` (`persistence/sqliteSchema.ts:63-64`). Deletion is not a
lifecycle value — it is the removal of the `documents` row plus a terminal history record.

`DocumentOrigin = "interactive" | "agent" | "automation"` (`model.ts:15`). Document keeps its own
origin vocabulary; the Activity adapter in `1-init` remaps `interactive → "user"`.

### 2.2 `DocumentHead` — the live record

`model.ts:17-32`: `{ id, title, lifecycle, isTemplate, revision, baseSeq, semanticDigest,
createdAt, updatedAt }`. On `isTemplate` (`model.ts:21-25`), verbatim:

> Set once by `markAsTemplate` and never cleared. On the head rather than the
> snapshot because mode does not vary by revision — a Document is a template
> or it is not, and rewinding history must not un-seal it.

### 2.3 Units and page layout

**Everything is twips** (1/1440 inch). `DocumentPageLayout` (`model.ts:65-81`) is
`{ page: { widthTwips, heightTwips, orientation: "portrait"|"landscape" },
margins: { topTwips, rightTwips, bottomTwips, leftTwips },
pageNumber: { start, format: "decimal"|"roman-lower"|"roman-upper" } }`.

Defaults ([`application/createService.ts:9-25`](../../../apps/backend/src/3-capabilities/document/application/createService.ts)):
12,240 × 15,840 twips (US Letter), portrait, 1,440-twip margins on all four sides, decimal page
numbers starting at 1.

`domain/layout.ts` (63 lines) has three pure helpers. `computeUsablePageWidth` and
`computeUsablePageHeight` subtract the margins. `computeAssignedBlockWidth(row, blockId,
usableContainerWidthTwips)` removes `blockGapTwips × (blocks.length − 1)` and then divides the
remainder by the block's share of the total track units. It **throws `RangeError`** rather than
returning a misleading number, on any of: non-positive or non-finite container width; block not in
the row; track order mismatch; non-positive-integer track widths; a non-safe total; a negative or
non-integer gap; total gap ≥ container width. `layout.ts:16-22`:

> Row gaps are removed before the positive track units divide the remaining
> width. The function expects a structurally valid Row and rejects impossible
> geometry rather than returning a misleading negative or non-finite width.

### 2.4 Rows and tracks

```ts
interface DocumentRow  { id: string; blocks: DocumentBlock[]; layout: RowLayout }
interface RowLayout    { blockGapTwips; marginBeforeTwips; marginAfterTwips; tracks: RowTrack[] }
interface RowTrack     { blockId: string; widthUnits: number }
```

A Row is a **horizontal** container. `tracks` is a parallel array to `blocks`: index-for-index,
`tracks[i].blockId === blocks[i].id`. `widthUnits` is a **positive integer proportion**, never a
measurement; a width in twips is resolved only at projection or validation time, from the container
width. Enforced at `domain/validation.ts:364-372` and `domain/reducer.ts:200-205`.

Row nesting is genuine: `CalloutBlock.rows`, `ListItem.rows` and `TableCell.rows` are all
`DocumentRow[]`, and `domain/tree.ts:21-41` (`visitBlockRows`) walks all three.

### 2.5 Block kinds — exactly 10, closed union

`DocumentBlock` (`model.ts:217-227`). All ten extend `BlockBase { id, styleId,
presentation?: BlockPresentationOverride }`.

| Kind | Extra payload |
| --- | --- |
| `text` | `content: RichContent` |
| `code` | `language?: string`, `content: RichContent` |
| `quote` | `content: RichContent` |
| `prompt` | `output: DerivedOutputRef`, `context: PromptContext` |
| `divider` | none |
| `callout` | `tone: "info"\|"success"\|"warning"\|"danger"\|"neutral"`, `rows: DocumentRow[]` |
| `list` | `list: DocumentList` |
| `table` | `table: DocumentTable` |
| `image` | `image: ImageBlockData` |
| `chart` | `chart: ChartBlockData` |

Supporting shapes:

| Type | Definition |
| --- | --- |
| `DocumentList` | `{ id, listKind: "bulleted"\|"numbered"\|"checklist", start?, items: ListItem[] }` |
| `ListItem` | `{ id, checked?, rows: DocumentRow[], children: ListItem[] }` |
| `DocumentTable` | `{ id, columns: TableColumn[], rows: TableRow[], cells: TableCell[], merges: TableMerge[] }` |
| `TableColumn` | `{ id, width: {kind:"auto"} \| {kind:"fixed", twips} }` |
| `TableRow` | `{ id, minHeightTwips?, header }` |
| `TableCell` | `{ id, rowId, columnId, rows: DocumentRow[], verticalAlign: "top"\|"middle"\|"bottom" }` |
| `TableMerge` | `{ id, rootCellId, coveredCellIds[] }` |
| `VisualDimensions` | `{ widthTwips?, heightTwips, lockAspectRatio, horizontalAlign: "left"\|"center"\|"right"\|"stretch" }` |
| `MediaSnapshotRef` | `{ fileId, version, digest, mimeType }` — an immutable pin, not a live file handle |
| `ImageBlockData` | `{ source: MediaSnapshotRef, dimensions, alt, decorative, crop?, fit: "contain"\|"cover"\|"stretch" }` |
| `ChartBlockData` | `{ source: "literal"\|"formula"\|"analysis-result"\|"structured-data", specification: Record<string, unknown>, dimensions, snapshotDigest?, alt }` |

A chart's `specification` is **opaque to Document**. Nothing in the backend executes, interprets or
validates it beyond requiring positive dimensions (`validation.ts`).

### 2.6 `BlockPlacement` — 4 variants

`model.ts:309-332`.

| Variant | Fields | Inline requirement, quoted from the type |
| --- | --- | --- |
| `after-block` | `afterBlockId`, `newRowId?`, `widthUnits?` | `newRowId` is *"Required when the anchor is the only Block in its Row"* |
| `between-blocks` | `beforeBlockId`, `afterBlockId`, `newRowId?`, `widthUnits?` | `newRowId` is *"Required when the anchors are in different Rows"* |
| `in-row` | `rowId`, `afterBlockId?`, `widthUnits?` | — |
| `new-row` | `afterRowId?`, `rowId`, `layout?`, `widthUnits?` | — |

Enforced by `placeBlock` (`reducer.ts:246-283`) and `resolveMovePlacement` (`reducer.ts:285-376`),
which raise `DocumentPlacementError` with messages including `"after-block requires newRowId for a
sole-Block Row"`, `"between-blocks anchors must be adjacent"`, `"between-blocks Rows must be
adjacent siblings"`, `"A Block cannot move after itself"`, `"A moved Block cannot be one of its
placement anchors"`, `"A sole Block has no distinct in-Row anchor"` and `"Moving a sole first
nested Row requires an explicit surviving Row anchor"`.

`block.move` resolves the destination **before** removing the source (`reducer.ts:645-662`), which
is what makes an in-place width-only move a no-op that still applies `widthUnits`.

### 2.7 Styles

```ts
interface DocumentStyleRegistry {
  defaultStyleIdByBlockKind: Record<DocumentBlockKind, string>;  // all 10 kinds, required
  styles: DocumentStyle[];
}
interface DocumentStyle {
  id; name; basedOnStyleId?;
  text: TextStyleProperties;
  block: BlockStyleProperties;
  systemRole?: DocumentSystemStyleRole;
}
```

The registry is **embedded in the snapshot** — per Document, not global.
`DocumentSystemStyleRole` has exactly six values, `heading-1` … `heading-6` (`model.ts:83-89`).
`BlockStyleProperties` is `alignment`, `wrapping`, `spacingBeforeTwips`, `spacingAfterTwips`,
`lineHeight`, `indentation {leftTwips, rightTwips, firstLineTwips}`, `keepWithNext`, `keepTogether`;
`BlockPresentationOverride` extends it with an identical shape, per block.

Inheritance is resolved by `resolveDocumentStyle` (`reducer.ts:161-185`): walk `basedOnStyleId`
upward, `unshift` each style so the chain is root-first, then `Object.assign` `text` and `block` in
that order — **nearest style wins**. A cycle throws `DocumentStyleReferenceError(styleId, "Style
inheritance cycle")` at `reducer.ts:169`; a missing base throws from `requireStyle`.
`validateSnapshot` independently detects both as diagnostics rather than throws
(`validation.ts:84-100`).

The default registry (`createService.ts:41-101`) is 10 styles: `document-style-normal`,
`-code`, `-quote`, `-visual`, and `document-style-heading-1` … `-6` with descending font sizes
(2 / 1.6 / 1.35 / 1.2 / 1.1 / 1) and `keepWithNext: true`. The kind→default map is declared with
`satisfies Record<DocumentBlockKind, string>`, so adding an eleventh block kind is a compile error
in this file.

### 2.8 Context Variables

```ts
interface DocumentContextVariable { id: string; name: string; target?: ContextEntry }
```

`ContextEntry` is `{ id: string; kind: string }`, declared in
`0-platform/knowledge/types.ts:85-88` and re-exported through `#context`. Field comments
(`model.ts:34-41`), verbatim:

> A named, stable handle a Prompt Block points at instead of a literal context.
> This is what makes a Document parameterisable, and therefore templatable.
>
> The ID/name split is what makes a rename cosmetic: Prompt Blocks reference
> `id`, while users and template bindings work in `name`. Renaming a variable
> therefore cannot break a Block, and copying a Document preserves both.

`target?` is documented inline as *"Omitted means unbound — legal only while the Document is a
template."*, and `name` as *"Trimmed, non-empty, and case-insensitively unique within the
Document."* Normalisation is `name.trim().toLocaleLowerCase()` (`reducer.ts:76-77`), with the
reason given: *"Case-insensitively, because a template binding addresses variables **by name** and
the person typing that binding has no way to know which casing the author used. Two variables
differing only in case would make a binding ambiguous."*

### 2.9 `PromptContext` — exactly one target, and it is required

```ts
type PromptContext =
  | { kind: "direct";   target: ContextEntry }
  | { kind: "variable"; variableId: string };
```

Two arms, `model.ts:171-173`. `PromptBlock` carries **both** `output: DerivedOutputRef` **and**
`context: PromptContext`, and the context is not optional (`model.ts:175-185`). The module's own
`types.md:44` describes the prompt payload as the `DerivedOutputRef` alone; that is incomplete.

`model.ts:162-170`, verbatim:

> What a Prompt Block is grounded on. **One target, not a list.**
>
> A list can only union. There is no way to say "these sources except those" in
> an array of entries, and exclusion is a thing people want. A Context *can* say
> it, so a Prompt Block that points at one Context inherits every composition
> Context can express — now and as Context grows. The caller composes first and
> points second.

And on the field being required (`model.ts:178-183`), verbatim:

> Required. A Prompt Block always has a context, which is what makes the old
> empty-scope guard unnecessary rather than merely removed: with exactly one
> target, a scope can never collapse to the zero-length array that
> `Knowledge.resolveScope` reads as whole-project retrieval.

### 2.10 The Derived Outputs embed

```ts
interface DerivedOutputRef { readonly outputId: string; readonly appliedRevision: number }
```

Imported from `#derived-outputs` (`derived-outputs/domain/model.ts:142-145`). That is the *entire*
coupling inside the snapshot: an output id and the revision this Document has adopted. The content
lives in Derived Outputs.

**`appliedRevision: 0` is legal and means "declared, never answered."** `validation.ts:210-216`,
verbatim:

> Non-negative, not positive: 0 means *declared, never answered*. A
> Prompt Block acquires its output from `declare`, which returns
> headRevision 0, and only a later refresh moves it to 1. Requiring a
> positive revision here made "a prompt that has not run yet"
> unrepresentable — which is exactly what every block in a freshly
> duplicated document is.

The *operation* `prompt.apply-derived-output` nevertheless requires a positive revision
(`reducer.ts:701`) and refuses to change output identity (`reducer.ts:698-700`, *"A Prompt Block
cannot adopt a different Derived Output identity"*). The wire layer mirrors the split exactly:
`valueSchemas.ts:830-833` accepts `>= 0` on a block, `operationSchemas.ts:202-204` requires `> 0`
on the operation.

### 2.11 Attempts — 3 kinds, 7 states

`DocumentAttemptState = requested | computing | proposed | settled | unchanged | stale | failed`
(`model.ts:523-530`). The terminal set is `["settled","unchanged","stale","failed"]`, used by the
service at `application/documentService.ts:1783` and by the store for pruning at
`persistence/sqliteDocumentStore.ts:147`.

`AttemptBase` is `{ id, documentId, clientRequestId, requestDigest, blockId,
frozenDocumentRevision, state, settledChangeSetId?, diagnostic?, createdAt, updatedAt }`.

| Kind | Frozen fields | Candidate fields |
| --- | --- | --- |
| `prompt-create` | `styleId`, `presentation?`, `placement`, `definition { prompt, context, stabilisationText }` | `candidateOutputId`, `candidateHeadRevision` |
| `prompt-refresh` | `promptBlockId`, `outputId`, `frozenAppliedRevision` | `candidateHeadRevision` |
| `formula-evaluation` | `atomId`, `originChangeSetId?`, `frozenExpression`, `frozenExpressionDigest` | `resolverSnapshotDigest`, `candidateOperations` |

### 2.12 Error classes — 16

[`domain/errors.ts`](../../../apps/backend/src/3-capabilities/document/domain/errors.ts) (162
lines): `DocumentNotFoundError`, `DocumentAttemptNotFoundError`, `RevisionConflictError`,
`IdempotencyMismatchError`, `CompensationConflictError`, `HistoryPrunedError`,
`InvalidDocumentCursorError`, `DocumentValidationError`, `DocumentIdentityReuseError`,
`DocumentPlacementError`, `DocumentStyleReferenceError`, `DocumentOperationError`,
`DocumentStaleAttemptError`, `DocumentUnboundContextVariableError`, `DocumentTemplateModeError`,
`DocumentContextVariableNotFoundError`.

Three of those sixteen have no branch in the HTTP error ladder and therefore reach clients as
500 — see §8, KI-4.

---

## 3 · Operations, commands, queries, intents

### 3.1 The 39 operations

Counted two ways, both 39: `grep -cE '^\s+"[a-z.-]+": \[' wire/operationSchemas.ts` → `39`, and
the distinct `type` literals in the `DocumentOperation` union (`model.ts:334-429`) → 39. The
module's own `types.md:57` says 35 and omits four; so does the archived
`phase-1/claude-notes/07-capability-inventory.md:21`. **The four omitted everywhere are
`prompt.set-context`, `context-variable.create`, `context-variable.update` and
`context-variable.delete`, and all four are publicly submittable.**

Field lists below are the exact `OPERATION_KEYS` entries from
[`wire/operationSchemas.ts:50-90`](../../../apps/backend/src/3-capabilities/document/wire/operationSchemas.ts).

| # | Operation | Wire fields |
| ---: | --- | --- |
| 1 | `document.rename` | type, title |
| 2 | `document.set-lifecycle` | type, lifecycle |
| 3 | `layout.set-page` | type, layout |
| 4 | `style.create` | type, style |
| 5 | `style.update` | type, styleId, style |
| 6 | `style.delete` | type, styleId, replacementStyleId |
| 7 | `style.set-default` | type, blockKind, styleId |
| 8 | `prompt.set-context` | type, blockId, context |
| 9 | `context-variable.create` | type, variable |
| 10 | `context-variable.update` | type, variable |
| 11 | `context-variable.delete` | type, variableId |
| 12 | `style.apply-inline` | type, blockId, styleId, markId, range, resolvedProperties |
| 13 | `row.insert` | type, row, afterRowId |
| 14 | `row.move` | type, rowId, afterRowId |
| 15 | `row.delete` | type, rowId |
| 16 | `row.set-layout` | type, rowId, layout |
| 17 | `block.insert` | type, block, placement |
| 18 | `block.move` | type, blockId, placement |
| 19 | `block.replace` | type, blockId, block |
| 20 | `block.delete` | type, blockId |
| 21 | `block.set-style` | type, blockId, styleId |
| 22 | `block.set-presentation` | type, blockId, presentation |
| 23 | `rich-text.apply` | type, blockId, operations |
| 24 | `prompt.apply-derived-output` | type, blockId, output |
| 25 | `list.insert-item` | type, listId, parentItemId, item, afterItemId |
| 26 | `list.move-item` | type, listId, itemId, parentItemId, afterItemId |
| 27 | `list.delete-item` | type, listId, itemId |
| 28 | `list.set-checked` | type, listId, itemId, checked |
| 29 | `table.insert-row` | type, tableId, row, cells, afterRowId |
| 30 | `table.move-row` | type, tableId, rowId, afterRowId |
| 31 | `table.delete-row` | type, tableId, rowId |
| 32 | `table.insert-column` | type, tableId, column, cells, afterColumnId |
| 33 | `table.move-column` | type, tableId, columnId, afterColumnId |
| 34 | `table.delete-column` | type, tableId, columnId |
| 35 | `table.merge` | type, tableId, merge |
| 36 | `table.unmerge` | type, tableId, mergeId |
| 37 | `image.set-source` | type, blockId, source |
| 38 | `image.set-accessibility` | type, blockId, alt, decorative |
| 39 | `visual.set-dimensions` | type, blockId, dimensions |

**Two operations are internal-only**, refused on the public submit surface
(`documentService.ts:987-992`):

| Operation | Refusal | Why |
| --- | --- | --- |
| any operation that *introduces* a prompt block | `DocumentOperationError("Prompt Blocks must be created through prompt.create.request")` | A Prompt Block owns a dedicated Derived Output. Creating one by hand would produce a block with no output, or one sharing another block's output — both states `validateSnapshot` forbids. Creation therefore runs the request → compute → settle pipeline |
| `prompt.apply-derived-output` | `DocumentOperationError("Derived Output adoption is internal settlement only")` | Adoption is the settlement half of a refresh attempt. Accepting it from a client would let a caller claim an answer the pipeline never computed |

`introducesPrompt` (`documentService.ts:179-197`) inspects `block.insert`, `block.replace`,
`row.insert`, `list.insert-item`, `table.insert-row` and `table.insert-column`, recursing through
callout rows, list-item rows and children, and table-cell rows via `blockContainsPrompt`
(`:162-177`) — so a prompt block buried in a nested structure is caught too.

`mutate` re-checks the first rule whenever `allowPromptOperations === false`
(`documentService.ts:1046-1048`). It does **not** re-check the second; see §8.

`allowPromptOperations: true` is passed by exactly five internal call sites: `compensate` (`:1248`),
`settlePromptCreation` (`:1598`), `settlePromptRefresh` (`:1667`), `settleFormulaEvaluation`
(`:1744`), and the Templates pass-through `submit` (`:745`), which carries the comment *"A template
is fully editable, prompts included. `template.update` is the only path here, so the usual
public-surface restriction does not apply."*

### 3.2 Inverses

`applyOperations` computes an exact inverse per operation and **prepends** it —
`inverse = [...inverseFor(before, op, after), ...inverse]` at `reducer.ts:1404` — so replaying the
inverse list in order undoes the batch. Notable strategies (`reducer.ts:858-1197`):

| Operation | Inverse strategy |
| --- | --- |
| `rich-text.apply`, `style.apply-inline` | A whole-block `block.replace` with the prior block (`:949-953`). Document does not invert Rich Text operation by operation |
| Deleting a Row or Block that empties a nested container | Restore the *outermost owning block* wholesale (`restoreBlocks`, `findOutermostBlockForRows`), because a nested row array cannot be addressed by `row.insert` |
| `style.delete` | `style.create` **plus** a diff-derived set of `style.update`, `style.set-default` and `block.set-style` that put every re-pointed reference back |
| `context-variable.update` | The whole prior variable (`:883-893`) — *"A field-level inverse would have to know which fields changed, and 'rename' and 'rebind' are the same operation here."* |
| `context-variable.delete` | `context-variable.create` **plus** one `prompt.set-context` per block the cascade re-pointed |
| `table.delete-row`, `table.delete-column` | Re-insert the row/column, its cells, **and** every merge the deletion dropped |

`domain/inverses.ts` (18 lines) wraps `applyOperations(...).inverse` as a standalone entry point —
*"Kept as a separate domain entry point so callers never synthesize inverses."* It has **no caller**
anywhere in `src/` or in any Document test (§8).

### 3.3 Touched-ID footprints and rebase

`computeTouchedIds` (`reducer.ts:1199-1390`) collects every string field named `id` or `*Id` from
an operation, plus operation-specific expansions, plus synthetic sentinels for state that has no
ID of its own:

| Sentinel | Emitted for |
| --- | --- |
| `$document:title` | `document.rename` |
| `$document:lifecycle` | `document.set-lifecycle` |
| `$document:page-layout` | `layout.set-page` |
| `$document:default-style:<blockKind>` | `style.set-default` |
| `$document:context-variable-name:<normalized name>` | `context-variable.create`, `context-variable.update` |
| `$document:rows` (`ROOT_ROWS_SENTINEL`, `:1220`) | any operation that adds, removes or reorders a **root** row |

`domain/rebase.ts` (23 lines) is pure set intersection: `canRebase(touchedIds, intervening)` allows
an edit only if its footprint is **disjoint** from every intervening ChangeSet's `touchedIds`, and
otherwise returns the sorted conflicting IDs. There is no operational transformation anywhere in
Document — only a disjointness proof.

### 3.4 Commands — 9

Envelope: `exactKeys(envelope, ["requestId","origin","command"])`. `DocumentCommandRequest` also
declares `actorId` in the domain type, but the wire decoder does not admit it, and
`attributedActor()` (`documentService.ts:288-290`) prefers the construction-scope actor
(`config.userId`) over any request value. Client-controlled attribution is therefore unreachable
from HTTP, though the field still exists in the type.

| Command | Wire fields | Result |
| --- | --- | --- |
| `document.create` | type, title, pageLayout?, styles? — **no documentId** | `document.created { head }` |
| `document.submit` | type, documentId, expectedRevision, operations | `document.changed { changeSet }` |
| `document.compensate` | type, documentId, targetChangeSetId, intent (`undo`\|`redo`), expectedRevision | `document.changed { changeSet }` |
| `document.delete` | type, documentId, expectedRevision | `document.deleted { documentId, revision }` |
| `document.purge` | type, documentId | `document.purged { documentId }` |
| `prompt.create.request` | type, documentId, expectedRevision, blockId, styleId, presentation?, placement, prompt, context, stabilisationText | `prompt.create-requested { attemptId }` |
| `prompt.update-definition` | type, documentId, promptBlockId, expectedDefinitionRevision, prompt, stabilisationText | `prompt.definition-updated { output }` |
| `prompt.refresh.request` | type, documentId, promptBlockId, expectedRevision | `prompt.refresh-requested { attemptId }` |
| `formula.evaluate.request` | type, documentId, blockId, formulaAtomId | `formula.evaluate-requested { attemptId }` |

Two field-level decisions are recorded verbatim in
[`wire/commandSchemas.ts`](../../../apps/backend/src/3-capabilities/document/wire/commandSchemas.ts):

- `:36-37` — *"No documentId: the service allocates it. Supplying one is an unknown key and
  therefore a 400, rather than a value that looks accepted and is not."*
- `:99-100` — *"No contextEntries: the Block already carries its context, and accepting entries
  here gave two answers to 'what is this grounded on'."*

### 3.5 Queries — 4

| Query | Fields | Result |
| --- | --- | --- |
| `document.list` | type, cursor?, lifecycle? | `document.listed { items, nextCursor? }` |
| `document.load` | type, documentId, revision? | `document.loaded { head, snapshot, promptRevisions }` |
| `document.history` | type, documentId, cursor?, limit (1–1000) | `document.history { items, nextCursor? }` |
| `document.attempt` | type, documentId, attemptId | `document.attempt { attempt }` |

`document.list` is called with a service page size of 100 (`documentService.ts:337-342`) while the
store's own bounds are default 50 / max 200. `document.history`'s wire limit accepts 1–1000
(`querySchemas.ts:49`) but the store still caps a page at 200 — a request for 1,000 returns 200.

### 3.6 Internal job intents — 7 (all of the backend's)

`model.ts:719-754`. `document.compact` carries `(documentId, idempotencyKey)`; the other six carry
`(attemptId, idempotencyKey)`. `4-job-wiring/document/createDocumentJobs.ts` maps each to a job
with a **total switch and no `default`**, so a new intent is a compile error until it is wired.

| Intent | Job name | Queue |
| --- | --- | --- |
| `document.compact` | `documents.compact` | serial |
| `document.prompt.create.compute` | `documents.prompt.create.compute` | concurrent |
| `document.prompt.create.settle` | `documents.prompt.create.settle` | serial |
| `document.prompt.refresh.compute` | `documents.prompt.refresh.compute` | concurrent |
| `document.prompt.refresh.settle` | `documents.prompt.refresh.settle` | serial |
| `document.formula.evaluate.compute` | `documents.formula.evaluate.compute` | concurrent |
| `document.formula.evaluate.settle` | `documents.formula.evaluate.settle` | serial |

Stage idempotency keys are `` `document:${attempt.id}:${stage}` `` (`documentService.ts:248`);
the compaction key is `` `document:compact:${head.id}:${head.revision}` `` (`:254`).
`registerDocumentInternalJobs.ts:5-13` registers all seven from a hand-maintained
`TYPES: DocumentInternalJobIntent["type"][]` array — typed, so a wrong string is a compile error,
but a **missing** entry is not.

---

## 4 · Endpoints

Two routes, registered in
[`4-job-wiring/document/registerDocumentEndpoints.ts`](../../../apps/backend/src/4-job-wiring/document/registerDocumentEndpoints.ts)
(145 lines).

| Method + path | Job name | Queue | Response mode | What it does |
| --- | --- | --- | --- | --- |
| `POST /documents/command` | `documents.command.v1` | **serial** | inline | Decodes with `decodeDocumentCommand`, then `document.command(request)`. Every mutation, plus the three async requests and both deletion commands |
| `POST /documents/query` | `documents.query.v1` | **concurrent** | inline | Decodes with `decodeDocumentQuery`, then `document.query(request)`. List, load, history, attempt |

Commands are serial because the service reads-then-writes across several store calls that no single
SQLite statement can make atomic. The SQLite compare-and-swap remains the correctness authority;
the queue only reduces contention.

**Success status** (`:88-92`): `document.created` → **201**; any result type ending in `requested`
→ **202**; otherwise **200**. Queries are always 200.

**Error ladder** (`errorResponse`, `:33-86`), in evaluation order:

| Error | Status | Body `error` |
| --- | ---: | --- |
| `ResourceNotDeletedError` | 409 | `not_deleted` |
| `ResourceHistoryNotFoundError` | 404 | `not_found` |
| `DocumentNotFoundError`, `DocumentAttemptNotFoundError` | 404 | `not_found` |
| `DerivedOutputNotFoundError` | 404 | `derived_output_not_found` |
| `HistoryPrunedError` | 410 | `history_pruned` |
| `InvalidDocumentCursorError` | 400 | `invalid_cursor` |
| `RevisionConflictError` | 409 | `revision_conflict` |
| `StaleDefinitionRevisionError` | 409 | `definition_revision_conflict` |
| `IdempotencyMismatchError`, `DerivedOutputDefinitionUpdateIdempotencyConflictError` | 409 | `idempotency_mismatch` |
| `CompensationConflictError` | 409 | `compensation_conflict` |
| `DocumentPlacementError` | 400 | `invalid_placement` |
| `DocumentStyleReferenceError` | 400 | `invalid_style` |
| `DocumentIdentityReuseError` | 400 | `identity_reuse` |
| `DocumentWireError`, `DocumentValidationError`, `DocumentOperationError`, `DocumentStaleAttemptError` | 400 | `validation_error` |
| anything else | **500** | `internal_error`, fixed message `"Document operation failed"` |

Only responses ≥ 500 are logged, and only the error **name** (`logUnexpected`, `:94-99`) — messages
never leak to the client. Three declared error classes fall off the end of this ladder; see §8.

---

## 5 · Persistence

Adapter: `SQLiteDocumentStore(projectId, dbPath)`, 1,681 lines. DB file `./data/documents.db`.
Pragmas at init (`persistence/sqliteSchema.ts:49-52`): `journal_mode = WAL`, `foreign_keys = ON`,
`busy_timeout = 5000`, `synchronous = NORMAL` — Document is one of the seven stores that set all
four.

Table names are project-scoped: the prefix is `doc_` plus the first 16 hex characters of
`sha256(projectId)` (`sqliteSchema.ts:21-27`), so two projects sharing one file get disjoint tables.

### 5.1 The 13 tables

Twelve `CREATE TABLE` statements in `sqliteSchema.ts` plus one call to
`initializeResourceHistorySchema` at `:317`.

| Logical name | Actual name | Purpose | Key columns and constraints |
| --- | --- | --- | --- |
| `resources` | `doc_<p>_resources` | **Stable resource root.** Survives logical deletion; every retained-body table foreign-keys to it | PK `id`; `created_at` |
| `documents` | `doc_<p>_documents` | **Live heads only.** Absence means not current | PK `id` (FK→`resources` ON DELETE CASCADE); `lifecycle CHECK IN ('active','archived')`; `is_template INTEGER CHECK IN (0,1)`; `revision >= 1`; `base_seq >= 1`; `CHECK (base_seq <= revision)`; `semantic_digest`; timestamps |
| `history` | `doc_<p>_history` | Superseded head snapshots and terminal deletion rows. Shared DDL from `#utils/persistence/resourceHistory.js` | PK `(resource_kind, resource_id, revision)`; `record_type CHECK IN ('snapshot','deleted')`; CHECK that snapshot rows carry JSON and deleted rows do not |
| `receipts` | `doc_<p>_command_receipts` | Per-document command replay | PK `(document_id, request_id)`; `request_digest`; `result_json BLOB`; FK→`documents` CASCADE |
| `createReceipts` | `doc_<p>_create_receipts` | Replay for `document.create`, keyed by request id alone | PK `request_id`; `document_id` FK→`documents` CASCADE |
| `identityLedger` | `doc_<p>_identity_ledger` | Non-reuse ledger for every governed local ID | PK `(document_id, identity_id)`; `identity_kind CHECK IN (13 kinds)`; `state CHECK IN ('active','tombstoned')`; `first_revision >= 1`; `last_transition_revision >= first_revision`; CHECK tombstoned ⇔ `tombstoned_revision IS NOT NULL`; FK→**`resources`** CASCADE |
| `bases` | `doc_<p>_bases` | Full snapshots at chosen revisions | PK `(document_id, base_seq)`; `snapshot_json BLOB`; `semantic_digest`; FK→`resources` CASCADE |
| `changeSets` | `doc_<p>_change_sets` | One accepted mutation each | PK `id`; `UNIQUE(document_id, seq)`; `UNIQUE(document_id, revision)`; `CHECK(seq = revision)`; `CHECK(revision = prior_revision + 1)`; `origin CHECK IN (3)`; `compensation_intent CHECK IN ('undo','redo')`; self-FK `compensation_target_change_set_id → change_sets(id) ON DELETE SET NULL`; FK→`resources` CASCADE |
| `transactionOutbox` | `doc_<p>_transaction_outbox` | Activity source transactions awaiting delivery | PK `source_transaction_id`; `UNIQUE(document_id, revision)`; `transaction_kind CHECK IN ('document.created','document.changed','document.compensated','document.deleted')`; `resource_root_id` FK→`resources` **ON DELETE SET NULL**; `change_set_id` FK→`change_sets` **ON DELETE SET NULL**; `source_change_set_id` as a plain copy with no FK; nullable `published_at` |
| `retainedOutputs` | `doc_<p>_retained_outputs` | Output IDs owned by a logically-deleted document, kept so purge can reach them | PK `(document_id, output_id)`; FK→`resources` CASCADE |
| `attempts` | `doc_<p>_attempts` | Durable async workflow records | PK `id`; `kind CHECK IN ('prompt-create','prompt-refresh','formula-evaluation')`; `state CHECK IN (7 states)`; `frozen_json`, `candidate_json`, `diagnostic_json`; `UNIQUE(document_id, kind, client_request_id)`; FK→**`documents`** CASCADE; `settled_change_set_id` FK→`change_sets` SET NULL |
| `promptOutputs` | `doc_<p>_prompt_outputs` | One block's ownership of one dedicated Derived Output | PK `output_id`; `creation_attempt_id TEXT UNIQUE` FK→`attempts` SET NULL; `state CHECK IN ('pending','attached','detached')`; `UNIQUE(document_id, block_id)`; `CHECK(state != 'attached' OR attached_revision IS NOT NULL)`; FK→`documents` CASCADE |
| `stageReceipts` | `doc_<p>_stage_receipts` | One compute/settle claim per attempt stage | PK `(attempt_id, stage)`; `idempotency_key TEXT NOT NULL UNIQUE`; `stage CHECK IN ('compute','settle')`; `state CHECK IN ('running','completed','failed')`; FK→`attempts` CASCADE |

Note which parent each table hangs from. Tables FK'd to `documents` disappear on logical deletion
(receipts, create-receipts, attempts, prompt-outputs, stage-receipts). Tables FK'd to `resources`
survive it (bases, change sets, identity ledger, retained outputs) and disappear only on purge.

### 5.2 Indexes

Thirteen in the Document schema, plus one from the shared history schema:

`documents_lifecycle_updated (lifecycle, updated_at DESC, id)`;
`identity_ledger_state (document_id, state, identity_id)`;
`bases_lookup (document_id, base_seq DESC)`;
`change_sets_recent (document_id, seq DESC)`;
`change_sets_compensation_target (compensation_target_change_set_id) WHERE NOT NULL`;
`transaction_outbox_unpublished (occurred_at, source_transaction_id) WHERE published_at IS NULL`;
`transaction_outbox_source_request (document_id, source_request_id)`;
`transaction_outbox_source_change_set (document_id, source_change_set_id) WHERE NOT NULL`;
`attempts_state (kind, state, updated_at, id)`;
`attempts_block (document_id, block_id, updated_at DESC)`;
**UNIQUE** `attempts_prompt_create_block (document_id, block_id) WHERE kind = 'prompt-create'`;
`prompt_outputs_detached (state, updated_at, output_id) WHERE state = 'detached'`;
`stage_receipts_state (state, updated_at, attempt_id)`;
plus `history_recorded (recorded_at, resource_kind, resource_id)` from `resourceHistory.ts:62-63`.

### 5.3 The revision model, spelled out

Two record families:

- `DocumentBase { documentId, baseSeq, snapshot, semanticDigest, createdAt }` — a **full snapshot**
  at a chosen revision.
- `DocumentChangeSet { id, documentId, clientRequestId, requestDigest, authoredRevision,
  priorRevision, revision, seq, origin, operations, inverseOperations, touchedIds, compensation?,
  semanticDigest, createdAt }` — one accepted mutation.

The rules, and where each is enforced:

| Rule | Enforcement |
| --- | --- |
| Creation writes head revision **1** and Base **1** | `sqliteDocumentStore.ts:379-381` throws `"Document creation must commit revision-one head and Base"`. The SQL CHECK is `revision >= 1` |
| Every accepted mutation advances the head by exactly one | SQL CHECKs `seq = revision` and `revision = prior_revision + 1` (`sqliteSchema.ts:171-172`), plus `UNIQUE(document_id, seq)` and `UNIQUE(document_id, revision)` |
| The same arithmetic is re-checked before the transaction opens | `sqliteDocumentStore.ts:417-423`, `"Document mutation revisions are inconsistent"` |
| Head update is a compare-and-swap | `UPDATE … WHERE id = ? AND revision = ?`; `changes !== 1` returns `false`, which the service turns into `RevisionConflictError` (`documentService.ts:1152-1154`) |
| The prior head is archived inside the same transaction | `insertHistorySnapshot`, `sqliteDocumentStore.ts:438-444` |

**Reconstruction** (`loadSnapshot`, `documentService.ts:2064-2098`): take the newest Base at or
before the target revision, replay the contiguous forward ChangeSet tail with
`applyWithoutValidation`, set `snapshot.revision` per change, then run `validateSnapshot` **once**
at the end. Any gap — `changeSet.revision !== expected`, or `expected !== target + 1` — raises
`HistoryPrunedError` (HTTP 410). If the head is absent *and* the resource root is absent, the error
is `DocumentNotFoundError` instead.

**Rebase on submit** (`mutate`, `documentService.ts:1027-1044`): `expectedRevision > head.revision`
is an immediate `RevisionConflictError`. `expectedRevision < head.revision` loads the authored
revision, computes `touchedIds` against **that** snapshot, fetches the intervening ChangeSets and
runs `canRebase`; a conflict is a `RevisionConflictError`. On success the operations are applied to
the **current** snapshot, not the authored one.

**Compensation** (`compensate`, `documentService.ts:1206-1252`) requires `expectedRevision ===
head.revision`, the target ChangeSet still retained, and the intervening sequence complete and
contiguous — otherwise `CompensationConflictError("ChangeSet cannot be compensated because
intervening history has been pruned")` — plus `canRebase(target.touchedIds, intervening)`. It then
applies `target.inverseOperations` as a **new forward ChangeSet** carrying
`compensation: { intent: "undo"|"redo", targetChangeSetId }`. **There is no history rewind.**
Compensation is also the only path allowed to reactivate a tombstoned identity:
`identityReactivation` is `"same-kind-compensation"` for a compensating mutation and `"forbid"`
everywhere else (`documentService.ts:1118-1120`).

**Compaction** (`compact`, `documentService.ts:1978-2030`) is triggered from `mutate` when
`head.revision − head.baseSeq >= options.history.retainedChangeSetCount` (`:1165-1170`) and runs as
a serial `document.compact` intent. It writes a Base at `max(1, head.revision −
retainedChangeSetCount)` and, if different, a Base at the current head — both through
`appendBaseIfHead`, a CAS on the head revision that additionally verifies any pre-existing Base at
that `baseSeq` is byte-identical (`"A different Document Base already exists at this revision"`,
`sqliteDocumentStore.ts:537`). Only if both land does it call `pruneHistory`.

`pruneHistory` (`sqliteDocumentStore.ts:553-655`) deletes Bases outside the retained window,
deletes ChangeSets at or below the cutoff **except any that is a live compensation target**
(`id NOT IN (SELECT compensation_target_change_set_id …)`), deletes head-history snapshots below
the cutoff — `:621-624`, verbatim:

> A retained head envelope must always have enough Base/Change Set
> data to reconstruct it. Count-based compaction makes revisions below
> the anchor unavailable, so remove those envelopes in the same
> transaction instead of leaving misleading retained history behind.

— and prunes terminal attempts beyond `retainedTerminalAttemptCount`.

### 5.4 Serialization and pagination

`encodeJson` is `Buffer.from(canonicalize(value))` (`persistence/sqliteMappers.ts:20-21`): every
BLOB is **canonical** JSON, recursively key-sorted with `undefined` dropped. That is what makes a
byte comparison of two Bases a meaningful equality test, used at `sqliteDocumentStore.ts:535` and
`:1149`.

Cursors are opaque base64url JSON — `{kind:"document-head", updatedAt, id}` and
`{kind:"document-change", seq}` (`sqliteDocumentStore.ts:71-132`). Any malformed cursor raises
`InvalidDocumentCursorError` → 400. Page sizes: `DEFAULT_PAGE_SIZE 50`, `MAX_PAGE_SIZE 200`,
`DEFAULT_MAINTENANCE_BATCH_SIZE 100`, `MAX_MAINTENANCE_BATCH_SIZE 1000` (`:66-69`).

### 5.5 Deletion, purge and the outbox

`document.delete` is **logical**. `deleteDocument` (`documentService.ts:889-957`):

1. If there is no head, try replay through `getCommittedTransactionByRequest`; a `document.deleted`
   row returns that result, otherwise `DocumentNotFoundError`.
2. `head.revision !== expectedRevision` → `RevisionConflictError` (`:910`).
3. Delete owned Derived Outputs **first**. `DerivedOutputNotFoundError`, matched by name, is
   swallowed as *"the expected outcome on a retry after a partial run."*
4. `store.deleteDocument(...)` — one SQLite transaction that archives the current head as a history
   snapshot at revision `N`, writes a history **deletion** row at `N + 1`, copies every
   `prompt_outputs.output_id` into `retained_outputs`, inserts the `document.deleted` outbox row,
   and deletes the `documents` row. The FK cascade then removes command receipts, create receipts,
   attempts, prompt outputs and stage receipts. The result revision is `N + 1`.

After that, `document.load` without a revision returns 404 while `document.history` still works,
because it checks `hasResource` (`documentService.ts:369-371`).

`document.purge` is irreversible and guarded. `purgeRetainedDocument` (`:971-982`) purges every id
in `retained_outputs` through `derivedOutputs.purge`, swallowing `ResourceHistoryNotFoundError` by
name, then calls `store.purgeDocument`. The store guard (`sqliteDocumentStore.ts:1038-1046`): a
live head raises `ResourceNotDeletedError` (409 `not_deleted`); a `purgeResourceHistory` that
returns false — no history, or a latest record that is not a deletion — raises
`ResourceHistoryNotFoundError` (404 `not_found`). Otherwise the `resources` row is deleted and
everything FK'd to it cascades. Purge writes **no** outbox row and emits no Activity transaction,
and it does **not** delete previously committed outbox rows: those keep a NULL `resource_root_id`
(ON DELETE SET NULL) and remain publishable.

The transaction outbox ID is `` `document:${documentId}:${sourceRequestId}:${kind}` ``
(`documentService.ts:2110-2118`). `publishActivityTransaction` (`:2120-2144`) runs **after** the DB
transaction commits; on success it marks `published_at`, on failure it logs
`document.activity.publish-failed` at warn and returns false.
`publishPendingActivity(limit?)` is invoked **once, at startup** (`startBackend.ts:190`); there is
no periodic retry loop. The Activity adapter lives outside the capability, in
`1-init/create/document.ts:24-52`.

Retention: `pruneHistory(cutoff)` (`documentService.ts:2032-2056`) computes a retention anchor per
document — the earliest retained snapshot revision, for live *and* deleted documents — writes an
anchor Base, deletes everything below it via `compactRetentionHistory` (CAS-guarded on
`currentRevision` for live documents and on *absence* for deleted ones), then calls
`pruneRevisionHistory(cutoff)`. `purgeExpired(cutoff)` lists terminally-deleted documents older
than the cutoff and runs the same path as `document.purge`. Document is bound **first** in the
retention port list (`startBackend.ts:126`), per the ordering comment at `:121-122`.

---

## 6 · Invariants

### 6.1 Identity: 13 governed kinds, never reused

`DocumentIdentityKind` (`domain/identities.ts:8-21`) — verified against source, all thirteen:
`style`, `row`, `block`, `list`, `list-item`, `table`, `table-row`, `table-column`, `table-cell`,
`table-merge`, `rich-text-atom`, `rich-text-mark`, **`context-variable`**. The SQL CHECK lists the
same thirteen (`sqliteSchema.ts:113-117`). The module's own `types.md:92-93` lists twelve and omits
`context-variable`.

`identities.ts:59-63`, verbatim:

> Collect every identity governed by Document's retained-history non-reuse
> rule. References to external resources (for example Derived Output and media
> IDs) are deliberately excluded.

Enforcement is in `sqliteDocumentStore.ts:1290-1411`, inside the mutation transaction, so a reuse
attempt rolls the whole commit back:

| Path | Behaviour |
| --- | --- |
| `claimInitialIdentities` | Inserts every identity at revision 1; a duplicate id within one snapshot raises `DocumentIdentityReuseError` |
| `applyIdentityTransitions` — removals | Tombstones; the row must currently be `active` and the same kind, else a hard `Error` |
| `applyIdentityTransitions` — additions | Inserts if unseen; **reactivates** only when `reactivation === "same-kind-compensation"` **and** the row is tombstoned **and** the kind matches; otherwise `DocumentIdentityReuseError` |

Uniqueness *within* a snapshot is separately enforced by `claimId` in `validateSnapshot`
(`validation.ts:142-146`) across styles, context variables, rows, blocks, lists and list items,
tables and their rows/columns/cells/merges, and rich-text atoms and marks. The module's
`invariants.md:78-79` omits Context Variables from that list; `validation.ts:152-153` includes them.

### 6.2 Structural validation

`validateSnapshot(snapshot, richText, limits)` (`domain/validation.ts`, 398 lines) returns
`{ok, diagnostics: string[]}`; the reducer converts a non-ok result into `DocumentValidationError`
(`reducer.ts:1406-1407`).

| Level | Enforced |
| --- | --- |
| Document | Revision is a non-negative safe integer; title non-blank; style count ≤ `maxStylesPerDocument`; total row count ≤ `maxRowsPerDocument` |
| Page | Positive integer dimensions; non-negative margins; horizontal margins leave positive usable width; vertical margins leave positive usable height; portrait requires height ≥ width and landscape requires width ≥ height; positive `pageNumber.start` |
| Styles | Non-empty IDs; no duplicates; non-blank names; **exactly one** style per heading role 1–6 (`validation.ts:80-83`); every one of the 10 block kinds has a `defaultStyleIdByBlockKind` entry that resolves; style IDs claimed into the global identity namespace |
| Context variables | ID claimed as an identity; non-blank name; case-insensitively unique |
| Rows | Depth ≤ `maxNestingDepth` (exceeding it emits a diagnostic and stops descending); non-empty; blocks ≤ `maxBlocksPerRow`; non-negative integer spacing; gaps leave positive container width where one is known; `tracks.length === blocks.length`; each track matches block order with a positive integer width |
| Blocks (all) | ID claimed; `styleId` resolves |
| text / code / quote | Atoms ≤ `maxAtomsPerBlockContent`; `richText.validate(content)` diagnostics forwarded prefixed with the block id; every atom id and mark id claimed as an identity |
| prompt | `outputId` non-empty; `appliedRevision` a non-negative integer; the output is **not shared with another live prompt block** (`:220-223`) |
| callout | **No nesting** — `` `nested Callout Block is not allowed: ${id}` `` |
| list | List id claimed; only `numbered` may carry `start`, and it must be positive; checklist items require `checked: boolean`; non-checklist items must not carry `checked`; every item contains at least one Row |
| table | Rows ≤ `maxTableRows`; columns ≤ `maxTableColumns`; positive `minHeightTwips` and fixed widths; every cell references an existing row and column; no duplicate `(rowId, columnId)`; **every** coordinate has a cell; cells stored in **row-major order**; merges cover ≥ 2 cells, contain no duplicates, reference existing cells, do not overlap, and form **one complete rectangle** |
| image | Positive dimensions; `source.fileId`, `version` and `digest` all present |
| chart | Positive dimensions only — the `specification` is not inspected |

Configured limit defaults (`0-utils/config/loadBackendConfig.ts:238-253`): `maxRowsPerDocument`
10,000 · `maxBlocksPerRow` 32 · `maxStylesPerDocument` 256 · `maxNestingDepth` 16 ·
`maxAtomsPerBlockContent` 10,000 · `maxTableRows` 1,000 · `maxTableColumns` 256 ·
`history.retainedBaseCount` 5 · `history.retainedChangeSetCount` 1,000 ·
`history.retainedTerminalAttemptCount` 1,000.

### 6.3 Operation-level style rules

`reducer.ts:548-592`: `style.update` cannot change style identity (`"style.update cannot change
Style identity"`) and cannot change or assign `systemRole` (`"A protected heading role cannot be
changed or reassigned"`, `:562`). `style.delete` refuses a `systemRole` style (`"A protected
heading Style cannot be deleted"`) and refuses `styleId === replacementStyleId`; on success it
removes the style and re-points every `basedOnStyleId`, every `defaultStyleIdByBlockKind` entry and
every block's `styleId` (`:574-587`).

### 6.4 Context Variable resolution

Two resolvers, deliberately different.

| Function | Behaviour | Callers |
| --- | --- | --- |
| `resolvePromptContext` (`reducer.ts:92-106`) | **Strict.** A missing variable is a `DocumentOperationError`; an unbound variable **throws** `DocumentUnboundContextVariableError` | everywhere except copying |
| `resolvePromptContextIfBound` (`reducer.ts:119-127`) | **Lenient.** Returns `[]` for an unbound variable | `duplicate` (`documentService.ts:478`, `:490`) and `applyBindings` (`:678`) only |

Cascade delete (`reducer.ts:517-547`): deleting a **bound** referenced variable rewrites every
referencing prompt block to `{ kind: "direct", target: <the variable's target> }` and then removes
the variable; deleting an **unbound** referenced variable throws
`` `Context Variable ${id} is unbound and referenced by Prompt Blocks: ${blockIds}` ``; deleting an
unreferenced variable removes it with no cascade. All four cases are covered by subtests at
`document-domain.test.ts:1046`.

`prompt.set-context` refuses a `variable` context whose variable does not exist
(`reducer.ts:493-496`).

### 6.5 Template mode — the seal

- `markAsTemplate` sets `is_template = 1`. **No method anywhere clears it.**
  `ports/documentStore.ts:111-115`: *"Seals a Document. One-way: there is no method that clears the
  flag, and the absence is the point rather than an oversight."*
- `assertNotSealed` (`documentService.ts:402-419`) runs at the top of **both** `command()` and
  `query()`, keyed off `addressedDocumentId` (`:265-270`), which is a **structural** check
  (`"documentId" in operation`) rather than a per-command list. `document.create` and
  `document.list` are the two commands that name no document and therefore cannot reach a sealed
  one.
- Refusal logs at **warn**, event `document.template-mode.refused`, and throws
  `DocumentTemplateModeError`.
- `listHeads` excludes sealed rows entirely (`sqliteDocumentStore.ts:185-188`).

The service-layer refusal is tested at `document-application.test.ts:1823-1838`. The **HTTP**
mapping is missing; see §8, KI-4.

### 6.6 The `wire/` decoder pattern

Four files, four responsibilities, dependency direction strictly one-way
(`command`/`query` → `operation` → `value`):

| File | Lines | Owns |
| --- | ---: | --- |
| `wire/valueSchemas.ts` | 870 | Primitives, budgets, and every nested canonical value |
| `wire/operationSchemas.ts` | 291 | `OPERATION_KEYS` + `decodeDocumentOperation(s)` |
| `wire/commandSchemas.ts` | 138 | The command envelope and the 9 command shapes |
| `wire/querySchemas.ts` | 63 | The query envelope and the 4 query shapes |

Seven mechanics make up the pattern:

1. **One budget scan first.** `assertDocumentWireInput(value, label)` (`valueSchemas.ts:61-125`)
   walks the payload once and rejects: more than 100,000 nodes; depth over 32; strings over
   256 KiB; non-finite numbers; non-JSON types (functions, symbols, bigint); cycles, via a
   `WeakSet`; arrays over 10,000 items; non-plain objects, by prototype check; symbol keys; more
   than 10,000 own fields; non-serializable values; and an encoded payload over 1 MiB.
2. **`requireRecord`** rejects arrays and anything whose prototype is not `Object.prototype` or
   `null`.
3. **`exactKeys(value, allowed, label)`** — an unknown field is an error, never ignored. Applied at
   every nested boundary: page, margins, page number, style, registry, placement, row layout,
   tracks, list, list item, table, column, row, cell, merge, image, crop, chart, dimensions, media
   ref, rich-text atom/mark/operation, formula wire value, formula diagnostic, link target, prompt
   context, context variable, and prompt output ref.
4. **Typed primitive guards**: `requireText`, `requireString`, `requireIdentifier`,
   `requireBoolean`, `requireFiniteNumber`, `requireInteger`, `requireNonNegativeInteger`,
   `requirePositiveInteger`, `requireEnum`, `requireArray(value, label, max)`.
5. **A `Record<Union["type"], readonly string[]>` key table** per operation family. Used twice:
   `OPERATION_KEYS` for the 39 Document operations and `RICH_TEXT_OPERATION_KEYS`
   (`valueSchemas.ts:598-612`) for the 13 rich-text operation types.
6. **`structuredClone` on the way out.** Every decoder returns a defensive copy, so a caller can
   never hold a reference into the request body.
7. **One error class**, `DocumentWireError` (`valueSchemas.ts:38-43`), mapped to
   `400 validation_error`. Every message is path-qualified as `` `${label}.field` ``.

`DOCUMENT_WIRE_LIMITS` (`valueSchemas.ts:45-56`): `maxPayloadBytes` 1,048,576 ·
`maxStringBytes` 262,144 · `maxIdentifierBytes` 512 · `maxVariableNameBytes` 512 ·
`maxCollectionItems` 10,000 · `maxOperations` 1,000 · `maxRichTextOperations` 1,000 ·
`maxDepth` 32 · `maxNodes` 100,000.

**What the `OPERATION_KEYS` parity guarantee is, precisely.** Because the object is typed
`Record<DocumentOperation["type"], readonly string[]>`, TypeScript requires an entry for every
union member and rejects any key that is not one. Adding a 40th operation to `domain/model.ts`
without adding a decoder entry is a compile error, and vice versa. It does **not** verify that the
listed field names match the union member's actual fields — those lists are hand-maintained and
unchecked. Nor is the `switch` inside `decodeDocumentOperation` exhaustiveness-checked, because
`type` was cast: a variant with an `OPERATION_KEYS` entry but no `case` would pass `exactKeys` and
be admitted with no per-field validation.

### 6.7 The attempt pipeline

`runStage` (`documentService.ts:1774-1918`) is the shared driver for all six stage intents:

1. Load the attempt. Not found → `DocumentAttemptNotFoundError`; wrong kind →
   `DocumentOperationError`; already terminal → **silent return**.
2. `claimStage(receipt)` returns `"claimed" | "running" | "completed"`. Anything but `claimed`
   returns immediately, so duplicate dispatch is a no-op. A *failed* receipt is re-claimable after
   digest equality checks (`sqliteDocumentStore.ts:776-789`). Reusing an idempotency key across a
   different `(attemptId, stage)` throws `"Document stage idempotency key was reused"`.
3. On compute with state `requested`, flip the attempt to `computing`.
4. Run the work.
5. On throw, record `{code:"stage_failed", message}` — for `prompt-create` through the atomic
   `failPromptCreationStage`, which updates the attempt, the receipt and the pending-ownership
   detach in one transaction — then rethrow.
6. On success, `completeStage`. If *that* fails, the attempt is deliberately left non-terminal.

`retryStageAction` retries each phase (`start | work | record-failure | complete`) with
`STAGE_RETRY_DELAYS_MS = [10, 50]` — two retries, then rethrow (`:1920-1946`).

Formula attempts are created **automatically** by `mutate` for every new or changed formula atom
the reducer reports (`documentService.ts:1086-1106`), so a plain `document.submit` can spawn
compute jobs on its own. `settleFormulaEvaluation` refuses to settle unless the atom still exists,
is still a formula, its `digestFormulaExpression` still equals the frozen digest, **and** no
intervening ChangeSet's `touchedIds` contains the atom id (`:1729-1737`); otherwise it marks the
attempt `stale`.

Ownership of a prompt block's Derived Output moves `pending → attached | detached`.
`updatePromptOutputOwnershipRow` only ever **UPDATEs** (`sqliteDocumentStore.ts:1584-1630`): an
attach for an unregistered output id throws inside the commit transaction, and a transition that
changes owner throws `"Prompt-output ownership transition changed its owner"`.

Recovery: `recoverPendingAttempts` (`:1966-1976`) flips every `running` stage receipt to `failed`
with `{code:"process_interrupted", message:"The prior process stopped before this stage
completed"}`, then lists attempts in `requested|computing|proposed` and redispatches — `proposed`
to settle, otherwise to compute. It is called once from `startBackend.ts:188`.

Back-pressure: only **retryable admission errors** (queue capacity) are rescheduled, with
`DISPATCH_RETRY_INITIAL_DELAY_MS = 25` doubling to `DISPATCH_RETRY_MAX_DELAY_MS = 2000` on an
`unref()`ed timer keyed by idempotency key (`:2146-2208`). Non-retryable admission failures are
logged as `document.internal-job.dispatch-pending` and dropped; the durable attempt row remains the
recovery authority.

---

## 7 · Design decisions worth preserving

The comments below are quoted verbatim. They are the clearest statements of intent in the
capability, and several of them answer questions the types alone cannot.

### On the seal being structural rather than enumerated

`domain/errors.ts:126-137`:

> Every public command and query naming a template-mode Document is refused
> with this, reads included.
>
> Checked **once, on the document**, rather than enumerated per command — that
> is the entire value of the rule. A command or query added later is sealed by
> default instead of by someone remembering to add it to a list.
>
> A backing copy is not a Document a user owns any more. It exists so
> instantiation has something to copy, and Templates reaches it by holding
> Document's runtime object rather than going through this surface.

`documentService.ts:396-401`:

> One indexed lookup per addressed command, which is the price of "sealed by
> default". Templates does not pay it: it holds this runtime object and calls
> `duplicate`/`submit`/`load` directly, which is the internal path rather than
> the public one.

`documentService.ts:410-412`, on the log level:

> Warn, not debug. A request reaching a sealed Document means a caller holds
> an ID it should never have been handed, and that is worth seeing without
> turning debug on.

### On Document's half of the Templates seam

`documentService.ts:90-101`:

> Document's half of Templates' `TemplatableResource`.
>
> Declared here, not imported from Templates: neither capability imports the
> other, and `1-init` is the only place that sees both. The shapes match
> structurally, which is what makes `templateResources.register(document)`
> typecheck with no wrapper.
>
> Every method here is the **internal** path. None goes through `command` or
> `query`, so none is subject to the template-mode seal — that is precisely how
> Templates reaches a sealed Document when nothing else can.

`documentService.ts:421-424`, the section header that states the division of authority in two
sentences:

> Templates runtime
>
> Document does not know what a template is for. It knows how to copy itself,
> how to go private, and how to bind its own variables. Templates decides when.

### On copying, and why a copy asks its questions again

`documentService.ts:469-502` — one Derived Output per Prompt Block, declared fresh at
`appliedRevision: 0`:

> One new Derived Output per Prompt Block. Not optional: one live Prompt Block
> owns one dedicated output, so the copy cannot point at the source's.

> The prompt text carries over; the answer does not. A copy inherits what to
> ask, and asks it fresh.

> A copy is an ordinary Document. Sealing is a separate instruction, and
> instantiation never gives it — which is the only difference between the two
> procedures.

### On write ordering across a capability boundary

`applyBindings` (`documentService.ts:592-715`) commits the variable change before re-pointing the
Derived Output definition:

> Two writes rather than one, and in this order, because they live in two
> capabilities: the variable is Document's state and the grounding is Derived
> Outputs'. Committing the variable first means a crash in between leaves the
> declaration correct and an output stale — which the next refresh corrects —
> rather than an output grounded on a target the Document does not hold.

And in `deleteDocument` (`:913-916`), the same principle applied to deletion:

> Derived Outputs live in another capability's store, so the cascade cannot
> reach them — it only clears the ownership rows that point at them. They
> are removed first, before anything is destroyed, so a failure here leaves
> the document intact and the command retryable.

### On resolving a Prompt Block's context

`reducer.ts:79-91`:

> The whole of context resolution. There is no algorithm here on purpose —
> one target in, one target out — which is what replacing the entry *list* with
> a single `PromptContext` bought.
>
> An unbound variable **throws** rather than resolving to nothing. Resolving to
> `[]` would hand `Knowledge.resolveScope` the zero-length array it reads as
> whole-project retrieval, so a prompt nobody finished configuring would
> silently ground itself on everything — a wrong answer instead of a refused
> one. Unbound variables only exist on template-mode Documents, because
> instantiation must bind every declared parameter, so on an ordinary Document
> this cannot fire.

`reducer.ts:108-118`, on the lenient twin:

> The lenient form, used **only** while copying.
>
> A template legitimately holds unbound parameters, and a copy has to declare a
> Derived Output for every Prompt Block regardless — one live Block owns one
> dedicated output, so there is no "skip this one" option. Declaring with no
> entries is safe here precisely because nothing refreshes it in that state:
> registration seals the copy, and instantiation calls `applyBindings` before
> the instance is usable. The strict resolver guards the moment work would
> actually be grounded.

### On deleting a Context Variable

`reducer.ts:517-547`:

> **Cascade, and it changes nothing.** A referencing Block is re-pointed
> at the variable's *current target* — the same thing it already resolved
> to — so deleting a variable removes a level of indirection rather than
> the grounding underneath it. Refusing instead would push the caller into
> doing exactly this by hand, one `prompt.set-context` at a time.

and on the single refused case:

> The one case with nothing to substitute. Only reachable on a
> template, where an unbound variable is a declared parameter, and
> there deletion really would strand the Blocks with no grounding.

The inverse has to restore both halves (`reducer.ts:900-904`):

> The variable comes back first, then every Block the cascade re-pointed
> goes back to referencing it. Without the second half the inverse would
> restore the variable and leave the Blocks pointing at a literal target —
> the same grounding, but no longer a parameter, which is a different
> Document.

### On the name being part of a conflict footprint

`reducer.ts:1278-1282`:

> The *name* is a conflict footprint, not just the ID. Two concurrent
> edits claiming one name touch disjoint IDs, so without this they would
> both rebase cleanly and the loser would fail at apply time — a conflict
> reported as a validation error, one layer too late.

### On the create-receipt table

`persistence/sqliteSchema.ts:90-98` — the longest design comment in the schema:

> Replay record for document.create. Keyed by request id alone, because the
> document id does not exist until the service allocates one and a retry has
> nothing else to look up with.
>
> It still carries document_id, purely so it can CASCADE. A receipt records
> "this request produced that document"; once the document is deleted the
> record is meaningless, and replaying it would hand the caller a head for a
> document that no longer exists — every subsequent load would 404. Letting
> an old request id create a fresh document is the coherent outcome.

### On matching an error by name instead of `instanceof`

`documentService.ts:220-229`:

> Matched by name rather than `instanceof` on purpose.
>
> Document's dependency on Derived Outputs is types-only — `ports/derivedOutputs.ts`
> imports nothing at runtime. Importing the concrete error class to identify it
> would make this the one place Document links against another capability's
> implementation, for a check that only needs to answer "already gone?".

This is worth knowing operationally: **renaming `DerivedOutputNotFoundError` would silently break
this path**, because there is no compile-time link to break.

### On outbox durability

Four field comments on `DocumentCommittedTransaction` (`model.ts:460-493`):

> The stable Activity transaction ID. It is allocated with the accepted
> Document mutation and is reused for every outbox delivery attempt.

> A copied source ChangeSet ID, deliberately independent of the historical
> ChangeSet foreign key. Document compaction must not make an outbox row
> incomplete before Activity has consumed it.

> Document keeps its own origin vocabulary; the integration adapter maps it.

> The Document snapshot digest, not the Activity transaction digest.

### On ownership at birth for a copy

`sqliteDocumentStore.ts:932-937`:

> Raw insert, used by `commitCreation` for a copy's freshly declared outputs.
> They are `attached` from birth rather than `pending`: the Block and the
> output land in the same commit, so there is no window in which one exists
> without the other.

### On style projection

`projections/styling.ts:55-62`:

> The resolved kind and selected Document Styles become one authoritative,
> ephemeral full-range mark, while persisted inline marks remain supplementary.
> Block presentation is returned alongside the resolved Rich Text ranges and is
> never written into content.

### On the seal timestamp

`sqliteDocumentStore.ts:348-351`:

> `updated_at` rather than a dedicated sealed_at column: markAsTemplate is the
> last thing that touches a backing copy before the catalog row is written …
> and an orphan by definition never got edited afterwards.

---

## 8 · Known gaps and defects

Ordered by severity. The first three were verified by running code, not inferred.

### KI-1 — `logicalDelete` always throws, so a Document-backed template cannot be deleted

`DocumentTemplateRuntime.logicalDelete` (`documentService.ts:777-787`) builds

```ts
command: { type: "document.delete", documentId: input.resourceId }
```

with **no `expectedRevision`**, and casts the envelope `as DocumentCommandRequest` (`:786`).
`deleteDocument` then evaluates `if (head.revision !== expectedRevision)` at `:910` with
`expectedRevision === undefined`, which is true for every live document.

Verified by running the real service against a real SQLite store:

```text
created: document.created e022cda5-… rev 1
logicalDelete THREW: RevisionConflictError | Document e022cda5-… revision conflict: expected 1, current undefined
head after: { … revision: 1 … }        ← the document is still there
```

`templates/application/templateService.ts:555` calls `resource.logicalDelete(...)` and does not
catch, so `template.delete` on a Document-backed template throws before the catalog row is removed.
Document is the only kind registered into the Templates registry (`startBackend.ts:119`), so this
is every template. No test covers it: `templates.test.ts` uses a hand-written fake
`TemplatableResource`, and the end-to-end contract test at `document-application.test.ts:1727-1912`
exercises `duplicate`, `markAsTemplate`, `applyBindings`, `submit` and `load` — but not
`logicalDelete`, `purge` or `listSealedResources`.

Tracked as **KI-1** in [11-known-issues.md](../11-known-issues.md). Also described from the other
side in [templates.md](templates.md).

### KI-4 — sealed-document refusals surface as HTTP 500

`registerDocumentEndpoints.ts:33-86` has no branch for `DocumentTemplateModeError`, so every public
command or query naming a sealed Document falls through to
`{ statusCode: 500, body: { error: "internal_error", message: "Document operation failed" } }`.
The same is true of `DocumentUnboundContextVariableError` — reachable synchronously from
`prompt.update-definition` through `resolvePromptContext` — and of
`DocumentContextVariableNotFoundError`, which is internal-path only and therefore lower impact.

The refusal itself works correctly at the service layer and is tested
(`document-application.test.ts:1823-1838`). Only the HTTP mapping is missing. The module's own
`concepts.md:170` and `invariants.md:219` describe the seal as a typed refusal, which is true of
the service and false of the wire.

Tracked as **KI-4** in [11-known-issues.md](../11-known-issues.md).

### KI-7 — the Templates pass-through accepts undecoded operations

`DocumentService.submit` (`documentService.ts:717-759`) is commented *"Pass-through edit. The
operations are the caller's, decoded by Templates' caller."* Templates' wire decoder does **not**
decode them: `templates/wire/commandSchemas.ts:109-111` copies `resourceOperations` through
verbatim, and `templates/domain/model.ts:114` types it `readonly resourceOperations?: unknown`.
Document's own check is only `Array.isArray(operations) && operations.length > 0` (`:723-724`).

Verified against the real service:

```text
unknown op THREW:         TypeError | inverseFor is not a function or its return value is not iterable
bad-typed rename THREW:   TypeError | snapshot.title.trim is not a function
```

An unknown operation type reaches `applyOne`'s non-exhaustive runtime switch, silently no-ops,
then `inverseFor` returns `undefined` and the spread at `reducer.ts:1404` throws a raw `TypeError`.
A structurally wrong payload for a *known* type throws a different raw `TypeError` from inside the
reducer. Neither is a `DocumentWireError`, so neither maps to 400 — both are 500.

Additionally, `mutate` does not re-check the `prompt.apply-derived-output` ban (that check exists
only in `submitDocument`, `:990-992`), so the internal-only operation is reachable through
`template.update` on the public Templates surface.

Tracked as **KI-7** and **KI-8** in [11-known-issues.md](../11-known-issues.md).

### Detached-output garbage collection is an unwired seam

`DocumentStore.listDetachedPromptOutputs` is implemented (`sqliteDocumentStore.ts:965-982`) and has
a dedicated partial index (`prompt_outputs_detached`), and it has **no production caller**. `grep`
finds it in the store, the port, `document-persistence.test.ts:598`, and Slides' own copy. The
module's `docs/flows.md:168` states it plainly: *"Detached Derived Output garbage collection
remains an unwired maintenance seam."* The consequence a reader needs: **a detached Derived Output
is never reclaimed until the whole document is deleted or purged.**

### `invertOperations` has no caller

`domain/inverses.ts` (18 lines) is exported from `index.ts:21` and used nowhere in `src/` and in no
Document test. Slides has its own copy, which Slides' tests exercise
(`slides-domain.test.ts:1446`). Document's is dead code today.

### Store methods reachable only from tests

`createAttempt`, `getIdentity`, the by-output variant of `getPromptOutputOwnership`,
`getCommittedTransaction`, `getCommittedTransactionByChangeSet`, and `listDetachedPromptOutputs`
are all on the `DocumentStore` port and all exercised by `document-persistence.test.ts`, and the
service calls none of them. (`getCommittedTransactionByRequest` **is** used — deletion replay.)

### `SQLiteDocumentStore.close()` is never called

`sqliteDocumentStore.ts:160-162`. It is not on the `DocumentStore` port and `DocumentCapability`
exposes no shutdown method, so the connection stays open for the life of the process. Nothing in
the backend closes any SQLite connection; the `-wal` and `-shm` files under `apps/backend/data/`
are the visible consequence.

### Two inefficiencies worth knowing before changing the code

| Where | Detail |
| --- | --- |
| `documentService.ts:350-365` | `document.load`'s prompt-revision lookup iterates `refs.values()` and, for each output id, re-scans `[...refs.entries()]` to find the owning block — quadratic. It is correct only because validation forbids two live blocks sharing one output; if the map ever did hold a duplicate, the same revision would be pushed twice. A direct iteration over `refs.entries()` would be equivalent and linear |
| `sqliteDocumentStore.ts:1054-1064` | `getHistoricalHead` calls `getResourceHistory(...)`, which `SELECT *`s **every** history row for the resource, then `.find`s the target revision in memory. There is no revision-scoped query |

### Exported but unused

`decodeRichContent` and `decodeContextEntries` are `export const` in `wire/valueSchemas.ts` with no
importer anywhere in `src/` or `test/`. (`decodeRichContent` is used internally by
`decodeRichTextOperation`'s `replace-content` case; the *export* is what is unused.)

### The two reducer switches are runtime-non-exhaustive

Both `switch (operation.type)` statements in `reducer.ts` have no `default`. TypeScript proves
exhaustiveness for well-typed input, so this is safe on the decoded path. It is the mechanism
behind the raw `TypeError`s in the Templates pass-through defect above.

### Where the module's own `docs/` package is wrong

`3-capabilities/document/docs/` is 6 files, 1,050 lines, and mostly accurate. A later pass owns
those files; the contradictions are recorded here so a reader of both is not misled.

| File | Claim | Reality |
| --- | --- | --- |
| `types.md:57` | `DocumentOperation` has 35 variants | **39.** The four missing are `prompt.set-context` and the three `context-variable.*` |
| `types.md:15`, `runtime.md:126` | A "Representation v1" field on the snapshot | **No such field.** `contextVariables` is also missing from both lists |
| `types.md:44` | The prompt block payload is the exact `DerivedOutputRef` | It is `DerivedOutputRef` **and** a required `PromptContext` |
| `types.md:92-93` | 12 identity kinds | **13** — `context-variable` is missing |
| `runtime.md:78-79` | `create` performs an existence check | There is none; the id is freshly allocated. `flows.md:36` is the correct version |
| `runtime.md:96-99`, `flows.md:42`, `invariants.md:128-129` | `updatePromptDefinition` "freezes the target output in a local claim" | There is **no** local claim. `runtime.md:98-99` is the version that matches the code and contradicts `invariants.md:128` |
| `invariants.md:78-79` | The identity-uniqueness list | Omits Context Variables |
| `concepts.md:170`, `invariants.md:219` | A sealed Document is "refused with `DocumentTemplateModeError`" | True at the service layer; the HTTP client sees 500 (KI-4) |
| `concepts.md:1-3` | — | The file **begins with three orphaned table rows glued onto its H1** and carries two competing "Prompt Block" definitions |
| `README.md:8` | Five test files including a job-wiring file | Four. Job-wiring assertions live inside `document-application.test.ts` |
| `README.md:69` | Links to `docs/capabilities/document.md` | That path does not exist |

---

## 9 · Where to look for what

| Concern | File |
| --- | --- |
| The aggregate and every union | [`domain/model.ts`](../../../apps/backend/src/3-capabilities/document/domain/model.ts) |
| Structural rules | [`domain/validation.ts`](../../../apps/backend/src/3-capabilities/document/domain/validation.ts) |
| Operation semantics and inverses | [`domain/reducer.ts`](../../../apps/backend/src/3-capabilities/document/domain/reducer.ts) |
| Untrusted input | [`wire/valueSchemas.ts`](../../../apps/backend/src/3-capabilities/document/wire/valueSchemas.ts), [`wire/operationSchemas.ts`](../../../apps/backend/src/3-capabilities/document/wire/operationSchemas.ts) |
| Storage shape | [`persistence/sqliteSchema.ts`](../../../apps/backend/src/3-capabilities/document/persistence/sqliteSchema.ts) |
| Orchestration | [`application/documentService.ts`](../../../apps/backend/src/3-capabilities/document/application/documentService.ts) |
| HTTP | [`4-job-wiring/document/registerDocumentEndpoints.ts`](../../../apps/backend/src/4-job-wiring/document/registerDocumentEndpoints.ts) |
| Construction | [`1-init/create/document.ts`](../../../apps/backend/src/1-init/create/document.ts) |

Related pages: [05-async-attempt-pipeline.md](../05-async-attempt-pipeline.md) for the attempt and
stage machinery in general, [04-state-and-persistence.md](../04-state-and-persistence.md) for the
shared history table and the retention sweep, and [templates.md](templates.md) for the other side
of the templating seam.
