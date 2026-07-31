# Document capability — operations and endpoints

## Pure domain functions

The reducer is a pure library: no database, jobs, provider SDKs, HTTP, time, or
random-ID dependency.

```ts
createBlankSnapshot(input): DocumentSnapshot
createSnapshotFromRecipe(recipe, ids): DocumentSnapshot
applyOperations(snapshot, operations): ApplyResult
invertOperations(snapshot, operations): DocumentOperation[]
validateSnapshot(snapshot): ValidationResult
normalizeSnapshot(snapshot): DocumentSnapshot
computeTouchedIds(snapshot, operations): string[]
canRebase(touchedIds, interveningChangeSets): RebaseDecision
resolveTarget(snapshot, target): ResolvedTarget | DocumentError
validateTextRange(snapshot, range): TextRangeResolution
canonicalizeSnapshot(snapshot): Uint8Array
digestSnapshot(snapshot): string
```

`applyOperations` works against a copy. It returns the next normalized snapshot,
canonical forward operations, inverses, touched IDs, and semantic digest. The
application service persists that result atomically.

## Operation vocabulary

Wire DTOs are strict schemas. This is the domain vocabulary.

```ts
type DocumentOperation =
  // Document metadata and global layout
  | { type: "document.rename"; title: string }
  | { type: "document.set-lifecycle"; lifecycle: "active" | "archived" | "trashed" }
  | { type: "document.update-page-layout"; pageLayout: DocumentPageLayout }

  // Styles
  | { type: "style.create"; style: DocumentStyle }
  | { type: "style.update"; styleId: string; patch: DocumentStylePatch }
  | { type: "style.remove"; styleId: string; replaceWithStyleId: string }
  | { type: "block.apply-style"; blockId: string; styleId: string }
  | { type: "style.apply-text-range"; styleId: string; ranges: TextStyleRange[] }
  | { type: "style.remove-text-range"; markIds: string[] }

  // Rows and Blocks
  | { type: "row.insert"; container: RowContainerAddress; row: DocumentRow; afterRowId?: string }
  | { type: "row.move"; rowId: string; to: RowContainerAddress; afterRowId?: string }
  | { type: "row.remove"; rowId: string }
  | { type: "row.update-layout"; rowId: string; layout: RowLayout }
  | { type: "block.insert"; rowId: string; block: DocumentBlock; afterBlockId?: string }
  | { type: "block.move"; blockId: string; toRowId: string; afterBlockId?: string }
  | { type: "block.remove"; blockId: string }

  // Rich text
  | { type: "text.splice"; blockId: string; atomId: string; start: number; end: number; text: string }
  | { type: "text.split-block"; blockId: string; at: TextPosition; newBlockId: string }
  | { type: "text.join-block"; firstBlockId: string; secondBlockId: string }
  | { type: "inline.insert"; blockId: string; atom: InlineAtom; afterAtomId?: string }
  | { type: "inline.remove"; blockId: string; atomId: string }
  | { type: "mark.add"; blockId: string; mark: InlineMark }
  | { type: "mark.remove"; blockId: string; markId: string }

  // Lists
  | { type: "list.insert-item"; listId: string; parentItemId?: string; item: ListItem; afterItemId?: string }
  | { type: "list.move-item"; listId: string; itemId: string; parentItemId?: string; afterItemId?: string }
  | { type: "list.remove-item"; listId: string; itemId: string }
  | { type: "list.set-checked"; listId: string; itemId: string; checked: boolean }

  // Tables
  | { type: "table.insert-row"; tableId: string; row: TableRow; cells: TableCell[]; afterRowId?: string }
  | { type: "table.move-row"; tableId: string; rowId: string; afterRowId?: string }
  | { type: "table.remove-row"; tableId: string; rowId: string }
  | { type: "table.insert-column"; tableId: string; column: TableColumn; cells: TableCell[]; afterColumnId?: string }
  | { type: "table.move-column"; tableId: string; columnId: string; afterColumnId?: string }
  | { type: "table.remove-column"; tableId: string; columnId: string }
  | { type: "table.merge"; tableId: string; merge: TableMerge }
  | { type: "table.unmerge"; tableId: string; mergeId: string }

  // Exact media, prompt refresh, and Formula items
  | { type: "image.set-source"; blockId: string; source: MediaSnapshotRef }
  | { type: "image.set-accessibility"; blockId: string; alt: string; decorative: boolean }
  | { type: "prompt.update-definition"; blockId: string; prompt: PromptDefinition }
  | { type: "prompt.apply-refresh"; blockId: string; patches: PromptTextPatch[]; resolution: PromptResolution }
  | { type: "formula.set-expression"; blockId: string; atomId: string; languageVersion: "formula/v1"; expression: string }
  | { type: "formula.apply-evaluation"; blockId: string; atomId: string; evaluation: FormulaEvaluationSnapshot };

type RowContainerAddress =
  | { kind: "body" }
  | { kind: "callout"; blockId: string }
  | { kind: "list-item"; listId: string; itemId: string }
  | { kind: "table-cell"; tableId: string; cellId: string };

interface TextStyleRange extends BlockTextRange {
  markId: string;
}
```

Row insertion/move uses `afterRowId`; Block insertion/move uses `afterBlockId`.
Absence means prepend. The reducer rejects an anchor outside the target
container. Each Row layout names its sibling Blocks and assigns their relative
widths. Block frames and x/y coordinates are not operations.

`style.apply-text-range` creates `document-style` marks over the supplied
block-local ranges. A browser selection spanning Blocks is normalized to one
range for each Block before submission. `block.apply-style` requires a style
with block properties; text-range application requires text properties.

`text.split-block` creates a following Block at a text position. `text.join-block`
merges two adjacent matching rich-text Blocks; it is the explicit structural
operation behind a backspace-at-start edit. A Prompt Block's text is edited with
ordinary text operations; editing it does not change the Block kind or remove
its prompt definition. A refresh uses that current text as stabilization input
and applies its resulting `PromptTextPatch` operations.

`inline.insert` and `inline.remove` preserve atomic Formula and reference items.
`formula.set-expression` clears the prior evaluation to `pending` and schedules
an evaluation attempt. Only that evaluation path may issue
`formula.apply-evaluation`. The accepted evaluation's
`displayText` is addressable by marks and range styles, but not by
`text.splice`; applying a new evaluation also transforms those ranges against
the new display string.

Table row insertion supplies one fresh Cell per existing Column; column insertion
supplies one fresh Cell per existing Row. Block/list/table deletion includes the
exact removed subtree in generated inverse operations.

## Command and query contracts

`DocumentOperation` is deliberately narrower than the public command contract.
It describes a reversible change inside an existing snapshot. Creating or
duplicating a Document has no prior snapshot to reduce, while requesting Prompt
or Formula work creates an operational attempt rather than immediately changing
content. Those actions are `DocumentCommand` variants.

Transport resolves project scope before invoking the Document runtime, so these
payloads omit `projectId` and `userId`.

```ts
interface DocumentCommandRequest {
  requestId: string;
  origin: "interactive" | "agent" | "automation";
  command: DocumentCommand;
}

type DocumentCommand =
  | {
      type: "document.create";
      title: string;
      recipe?: DocumentCreationRecipe;
    }
  | {
      type: "document.submit";
      documentId: string;
      expectedRevision: number;
      operations: DocumentOperation[];
    }
  | {
      type: "document.duplicate";
      sourceDocumentId: string;
      sourceRevision?: number;
      promptCopyPolicy: "preserve" | "disable-automatic-refresh";
    }
  | {
      type: "document.compensate";
      documentId: string;
      targetChangeSetId: string;
      intent: "undo" | "redo";
      expectedRevision: number;
    }
  | {
      type: "prompt.refresh.request";
      documentId: string;
      promptBlockId: string;
      trigger: "manual" | "automatic";
    }
  | {
      type: "formula.evaluate.request";
      documentId: string;
      formulaAtomId: string;
    };

type DocumentCommandResult =
  | { type: "document.created"; head: DocumentHead }
  | { type: "document.changed"; changeSet: DocumentChangeSet }
  | { type: "prompt.refresh.requested"; attempt: PromptRefreshAttempt }
  | { type: "formula.evaluate.requested"; attempt: FormulaEvaluationAttempt };
```

All public state-changing commands use one serial, inline request type:
`documents.command.v1`. `requestId` is the idempotency key for the complete
command. An identical retry returns the original discriminated result; reusing
the ID with another command digest returns `idempotency_mismatch`.

Read calls share one concurrent, inline query contract:

```ts
interface DocumentQueryRequest {
  requestId: string; // correlation only; queries do not create receipts
  query: DocumentQuery;
}

type DocumentQuery =
  | { type: "document.list"; cursor?: string; lifecycle?: DocumentHead["lifecycle"] }
  | { type: "document.get"; documentId: string }
  | { type: "document.load"; documentId: string; revision?: number }
  | { type: "document.history"; documentId: string; cursor?: string; limit: number }
  | { type: "prompt.refresh.status"; attemptId: string }
  | { type: "formula.evaluate.status"; attemptId: string }
  | { type: "document.source-snapshot"; documentId: string; revision: number }
  | { type: "document.validate-text-range"; anchor: DocumentTextRangeAnchor };

type DocumentQueryResult =
  | { type: "document.list"; page: DocumentSummaryPage }
  | { type: "document.get"; head: DocumentHead }
  | { type: "document.load"; document: LoadedDocument }
  | { type: "document.history"; page: DocumentHistoryPage }
  | { type: "prompt.refresh.status"; attempt: PromptRefreshAttempt }
  | { type: "formula.evaluate.status"; attempt: FormulaEvaluationAttempt }
  | { type: "document.source-snapshot"; snapshot: DocumentSourceSnapshot }
  | { type: "document.validate-text-range"; resolution: TextRangeResolution };
```

The request type is `documents.query.v1`. Its result is a discriminated union
matching `query.type`.

This leaves two public endpoints rather than one endpoint per method:

| Request type | Queue / response | Purpose |
| --- | --- | --- |
| `documents.command.v1` | Serial / inline | all public mutations and deferred-work requests |
| `documents.query.v1` | Concurrent / inline | all bounded reads and status checks |

Queue selection remains static at endpoint registration. We do not put commands
and queries behind one mixed endpoint because the dispatcher could not choose
the queue without decoding capability-owned payloads.

## Internal job requests

Deferred and maintenance stages retain separate internal request types because
their queue and retry behavior differ:

| Internal request | Queue |
| --- | --- |
| `documents.prompt.resolve.v1` | Concurrent |
| `documents.prompt.settle.v1` | Serial |
| `documents.formula.evaluate.v1` | Concurrent |
| `documents.formula.settle.v1` | Serial |
| `documents.compact.v1` | Serial |

Prompt and Formula request commands only create durable attempts. Concurrent
workers compute proposals; serial settlement may append an ordinary ChangeSet.

## Activity and call logging

Every successful canonical mutation emits a durable
`DocumentActivityContribution` in the same transaction:

- creating from blank content or a recipe records `document.create`;
- duplication records `document.create` with `creationKind: "duplicate"` and
  the source Document/revision;
- an accepted ChangeSet records `document.change` plus its normalized
  `DocumentOperation["type"]` values;
- Prompt settlement, Formula settlement, undo, and redo are ChangeSets and
  therefore follow the same path.

Every capability call—not only successful mutations—is also structured-logged
through `DocumentDependencies.logger`. Each public command/query and every internal
stage emits a start entry and exactly one terminal success, rejection, or
failure entry. Logs include operation/query type, request or attempt ID,
Document ID when known, observed/result revision, duration, operation count,
digests, and typed error code. They do not include document text, Prompt
instructions, lattice regions, Formula values, or other content payloads.

```ts
type DocumentInternalOperation =
  | "prompt.resolve"
  | "prompt.settle"
  | "formula.evaluate"
  | "formula.settle"
  | "document.compact";

interface DocumentCallLogData {
  operation: DocumentCommand["type"] | DocumentQuery["type"] | DocumentInternalOperation;
  phase: "start" | "success" | "rejected" | "failed";
  requestId?: string;
  attemptId?: string;
  documentId?: string;
  observedRevision?: number;
  resultRevision?: number;
  durationMs?: number;
  operationTypes?: DocumentOperation["type"][];
  semanticDigest?: string;
  idempotentRetry?: boolean;
  errorCode?: string;
}
```

All entries use the message `document.call`: start is `debug`, success is
`info`, a typed domain rejection is `warn`, and an unexpected failure is
`error`. `withDocumentCallLogging` owns the start/terminal pairing so handlers
cannot accidentally omit the terminal entry.

This separation is intentional. Activity is the durable semantic history used
for a resource timeline and compensation. Structured logs cover reads,
rejections, retries, and failures without turning concurrent queries into
database writes or flooding the undo/redo history.

## Queue behavior and errors

The serial queue makes ordered arrays safe without fractional ranks. An expected
revision names the client snapshot rather than automatically rejecting a stale
edit: the admission service semantically rebases it when the retained
intervening ChangeSets prove it independent. A conflicting or unprovable edit
returns `revision_conflict`.

Typed errors include `not_found`, `wrong_project_runtime`, `revision_conflict`,
`idempotency_mismatch`, `validation_failed`, `target_removed`, `style_in_use`,
`history_pruned`, `prompt_cycle`, `compensation_conflict`,
`stale_refresh_result`, and `limit_exceeded`.
