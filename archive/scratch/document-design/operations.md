# Document capability — operations, endpoints, and Jobs

## Operation vocabulary

Wire DTOs are strict schemas. Canonical Document operations are closed,
reversible values. The reducer returns exact forward and inverse operations
from before/after state.

```ts
type DocumentOperation =
  // Document metadata and page-layout foundation
  | { type: "document.rename"; title: string }
  | { type: "document.set-lifecycle"; lifecycle: "active" | "archived" | "trashed" }
  | { type: "layout.set-page"; layout: DocumentPageLayout }

  // Reusable Document Styles
  | { type: "style.create"; style: DocumentStyle }
  | { type: "style.update"; styleId: string; style: DocumentStyle }
  | { type: "style.delete"; styleId: string; replacementStyleId: string }
  | { type: "style.set-default"; blockKind: DocumentBlock["kind"]; styleId: string }
  | { type: "style.apply-inline"; blockId: string; styleId: string;
      markId: string; range: TextRange; resolvedProperties: TextStyleProperties }

  // Rows — explicit structural control
  | { type: "row.insert"; row: DocumentRow; afterRowId?: string }
  | { type: "row.move"; rowId: string; afterRowId?: string }
  | { type: "row.delete"; rowId: string }
  | { type: "row.set-layout"; rowId: string; layout: RowLayout }

  // Blocks — convenience placement plus exact replacement/deletion
  | { type: "block.insert"; block: DocumentBlock; placement: BlockPlacement }
  | { type: "block.move"; blockId: string; placement: BlockPlacement }
  | { type: "block.replace"; blockId: string; block: DocumentBlock }
  | { type: "block.delete"; blockId: string }
  | { type: "block.set-style"; blockId: string; styleId: string }
  | { type: "block.set-presentation"; blockId: string;
      presentation?: BlockPresentationOverride }

  // Inline editing, including Formula atoms
  | { type: "rich-text.apply"; blockId: string; operations: RichTextOperation[] }

  // Prompt Block reference adoption — internal settlement only
  | { type: "prompt.apply-derived-output"; blockId: string; output: DerivedOutputRef }

  // Lists
  | { type: "list.insert-item"; listId: string; parentItemId?: string;
      item: ListItem; afterItemId?: string }
  | { type: "list.move-item"; listId: string; itemId: string;
      parentItemId?: string; afterItemId?: string }
  | { type: "list.delete-item"; listId: string; itemId: string }
  | { type: "list.set-checked"; listId: string; itemId: string; checked: boolean }

  // Tables
  | { type: "table.insert-row"; tableId: string; row: TableRow;
      cells: TableCell[]; afterRowId?: string }
  | { type: "table.move-row"; tableId: string; rowId: string; afterRowId?: string }
  | { type: "table.delete-row"; tableId: string; rowId: string }
  | { type: "table.insert-column"; tableId: string; column: TableColumn;
      cells: TableCell[]; afterColumnId?: string }
  | { type: "table.move-column"; tableId: string; columnId: string;
      afterColumnId?: string }
  | { type: "table.delete-column"; tableId: string; columnId: string }
  | { type: "table.merge"; tableId: string; merge: TableMerge }
  | { type: "table.unmerge"; tableId: string; mergeId: string }

  // Visual payloads
  | { type: "image.set-source"; blockId: string; source: MediaSnapshotRef }
  | { type: "image.set-accessibility"; blockId: string;
      alt: string; decorative: boolean }
  | { type: "visual.set-dimensions"; blockId: string;
      dimensions: VisualDimensions };
```

Formula expression insertion, formula expression changes, and accepted formula
results are Rich Text operations. Document deliberately has no parallel
`formula.set-expression` or `formula.apply-evaluation` operation.

External `document.submit` validation rejects `block.insert` or
`block.replace` when it would introduce a Prompt Block with a caller-supplied
Derived Output reference. Prompt Blocks enter the snapshot only through the
dedicated `prompt.create.request` workflow. External callers also cannot submit
`prompt.apply-derived-output`; only serial settlement may emit it, and it may
advance the revision of the same dedicated `outputId` only.

## Block placement

The placement vocabulary supports the simple editor behavior and explicit Row
control without relying on array indexes.

```ts
type BlockPlacement =
  | {
      kind: "after-block";
      afterBlockId: string;
      widthUnits?: number;
    }
  | {
      kind: "between-blocks";
      beforeBlockId: string;
      afterBlockId: string;
      widthUnits?: number;
    }
  | {
      kind: "in-row";
      rowId: string;
      afterBlockId?: string;
      widthUnits?: number;
    }
  | {
      kind: "new-row";
      afterRowId?: string;
      rowId: string;
      layout?: Omit<RowLayout, "tracks">;
      widthUnits?: number;
    };
```

### Placement rules

`after-block` is the default keyboard/editor insertion behavior:

- If the anchor is the only Block in its Row, create a new Row immediately
  after that Row and place the new Block in it.
- If the anchor Row has multiple Blocks, insert the new Block immediately after
  the anchor in that same Row.

`between-blocks` is the drag/drop behavior:

- If both anchors are adjacent Blocks in the same Row, insert between them in
  that Row.
- If the anchors belong to different adjacent Rows, create a new Row between
  those Rows and place the Block in it.
- Any non-adjacent or reversed anchor pair is invalid.

`in-row` and `new-row` are explicit operations used by layout controls,
imports, agents, and deterministic compensation.

For `block.move`, placement is resolved against the pre-move snapshot and then
the source Block is removed. If removal leaves its source Row empty, that Row is
deleted in the same operation. Moving within one Row preserves track order and
width units unless the operation supplies another value. Moving across Rows
carries the prior positive width units by default.

`block.replace` preserves placement and track width and requires
`block.id === blockId`. Changing identity is expressed as delete plus insert.
`block.delete` deletes the containing Row when the Block was its final member.

All automatically created Rows use the supplied `rowId`; clients receive IDs
from the standard ID factory before constructing the operation. This keeps
replay deterministic and avoids server-generated structure hidden inside the
reducer.

## Style operations

`style.update` replaces one complete style value with the same ID. It may
change the name, text properties, Block properties, and inheritance. The
reducer validates the resulting inheritance graph. A protected system role is
preserved exactly; heading level changes by selecting a different protected
heading Style on the Block, not by editing a free-form level.

`style.delete` requires a replacement. The reducer rewrites every Block using
the deleted style, every `basedOnStyleId` reference, and every default-style
mapping to the replacement in one reversible operation. Styles carrying a
`systemRole` cannot be deleted, and their role cannot be removed or changed by
`style.update`. Their name and visual/Block properties remain editable.

`style.apply-inline` is a preset-expansion operation. At admission time the
service resolves the selected style against the authored snapshot and verifies
that `resolvedProperties` exactly match it. The reducer materializes one
ordinary Rich Text style mark:

```ts
{
  type: "add-mark",
  mark: {
    id: markId,
    kind: "style",
    range,
    properties: resolvedProperties
  }
}
```

The resolved properties travel in the operation so replay remains exact even
if the saved style changes later. The style ID is retained as intent/audit
metadata and is included in touched-ID conflict checks.

## Rich Text and `{{ ... }}` formulas

`rich-text.apply` delegates the complete operation batch to the injected Rich
Text runtime. This includes inserting and editing Formula atoms.

For the `{{ ... }}` authoring shortcut:

1. The editor identifies a completed delimited range.
2. Rich Text receives the range and source text.
3. Rich Text returns operations that replace the range with one Formula atom.
4. The client submits those operations in `rich-text.apply`.
5. Document admits the ChangeSet and inspects the Rich Text footprint for a
   created or changed Formula atom.
6. Document creates a durable Formula evaluation attempt and emits a typed
   internal Job intent.

Document never parses the expression between the braces. Formula performs
parse/bind/evaluate; Rich Text owns the atom and atom mutations.

## Pure domain functions

```ts
createBlankSnapshot(input: {
  title: string;
  pageLayout: DocumentPageLayout;
  styles: DocumentStyleRegistry;
}): DocumentSnapshot;

applyOperations(snapshot: DocumentSnapshot, operations: DocumentOperation[]): ApplyResult;
invertOperations(before: DocumentSnapshot, operations: DocumentOperation[], after: DocumentSnapshot): DocumentOperation[];
validateSnapshot(snapshot: DocumentSnapshot): ValidationResult;
computeTouchedIds(snapshot: DocumentSnapshot, operations: DocumentOperation[]): string[];
canRebase(touchedIds: string[], intervening: DocumentChangeSet[]): RebaseDecision;
canonicalizeSnapshot(snapshot: DocumentSnapshot): Uint8Array;
digestSnapshot(snapshot: DocumentSnapshot): string;
```

```ts
interface ApplyResult {
  snapshot: DocumentSnapshot;
  forward: DocumentOperation[];
  inverse: DocumentOperation[];
  touchedIds: string[];
  semanticDigest: string;
}
```

The domain never imports the scheduler or dispatches Jobs. Application
admission commits first, persists any required attempt, and then calls the
injected internal Jobs runtime with a typed intent.

## Command and query contracts

```ts
interface DocumentCommandRequest {
  requestId: string;
  origin: "interactive" | "agent" | "automation";
  command: DocumentCommand;
}

type DocumentCommand =
  | { type: "document.create"; documentId: string; title: string;
      pageLayout?: DocumentPageLayout; styles?: DocumentStyleRegistry }
  | { type: "document.submit"; documentId: string; expectedRevision: number;
      operations: DocumentOperation[] }
  | { type: "document.compensate"; documentId: string;
      targetChangeSetId: string; intent: "undo" | "redo";
      expectedRevision: number }
  | { type: "prompt.create.request"; documentId: string;
      expectedRevision: number; blockId: string; styleId: string;
      presentation?: BlockPresentationOverride; placement: BlockPlacement;
      prompt: string; contextEntries: ContextEntry[]; stabilisationText: string }
  | { type: "prompt.update-definition"; documentId: string;
      promptBlockId: string; expectedDefinitionRevision: number;
      prompt: string; contextEntries: ContextEntry[]; stabilisationText: string }
  | { type: "prompt.refresh.request"; documentId: string;
      promptBlockId: string; expectedRevision: number }
  | { type: "formula.evaluate.request"; documentId: string;
      blockId: string; formulaAtomId: string };

type DocumentCommandResult =
  | { type: "document.created"; head: DocumentHead }
  | { type: "document.changed"; changeSet: DocumentChangeSet }
  | { type: "prompt.create-requested"; attemptId: string }
  | { type: "prompt.definition-updated"; output: DerivedOutput }
  | { type: "prompt.refresh-requested"; attemptId: string }
  | { type: "formula.evaluate-requested"; attemptId: string };

```

`prompt.update-definition` is a Document convenience command. It verifies that
the Block points to the requested output, then delegates to the injected
Derived Outputs runtime. Only Derived Outputs state changes, and Derived
Outputs is the authoritative future producer of any definition-change Activity
fact. Document does not append a ChangeSet until an output revision is adopted.

```ts
interface DocumentQueryRequest {
  requestId: string;
  query: DocumentQuery;
}

type DocumentQuery =
  | { type: "document.list"; cursor?: string;
      lifecycle?: DocumentHead["lifecycle"] }
  | { type: "document.load"; documentId: string; revision?: number }
  | { type: "document.history"; documentId: string;
      cursor?: string; limit: number }
  | { type: "document.attempt"; documentId: string; attemptId: string };
```

There is no pagination query or page-count endpoint in the initial capability.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/documents/command` | Decode and dispatch one strict mutating command union. |
| `POST` | `/documents/query` | Decode and dispatch one strict read query union. |

All direct Document mutations enter the serial queue. Reads enter the
concurrent queue. Queue choice remains fixed in Job wiring and cannot be chosen
by a caller.

## Injected internal Jobs runtime

The HTTP registry creates one Job from one endpoint. Prompt creation, Prompt
refresh, and Formula evaluation need follow-on Jobs after their durable commit.
Document receives an internal Jobs runtime during construction so it can
dispatch typed intents without importing the scheduler or constructing raw
Jobs:

```ts
interface InternalJobsRuntime<TIntent extends { type: string }> {
  dispatch(intent: TIntent): Promise<JobDispatchReceipt>;
}

interface JobDispatchReceipt {
  jobId: string;
  acceptedAt: string;
}
```

Document supplies the intent type and payload. It does **not** supply a queue,
response mode, work closure, or scheduler configuration. Registration under
`4-job-wiring` maps each intent type to a fresh Job and owns the queue choice.

Prompt and Formula flows still use separate internal Jobs:

```text
serial freeze/accept
  → commit attempt and return attemptId
  → Document calls jobs.dispatch(typed intent)
concurrent compute
  → persist candidate/result
  → dispatch typed settlement intent
serial settlement
  → compare frozen preconditions
  → append ChangeSet or mark attempt stale
```

Without this seam, one of two incorrect things happens:

- a serial Job waits through model/retrieval/evaluation work and blocks every
  other canonical write; or
- concurrent work updates the Document head directly and bypasses serial
  revision ordering.

Document application code imports only the injected runtime interface. It
dispatches after the store transaction succeeds:

```ts
type DocumentInternalJobIntent =
  | { type: "document.compact"; documentId: string; idempotencyKey: string }
  | { type: "document.prompt.create.compute"; attemptId: string; idempotencyKey: string }
  | { type: "document.prompt.create.settle"; attemptId: string; idempotencyKey: string }
  | { type: "document.prompt.refresh.compute"; attemptId: string; idempotencyKey: string }
  | { type: "document.prompt.refresh.settle"; attemptId: string; idempotencyKey: string }
  | { type: "document.formula.evaluate.compute"; attemptId: string; idempotencyKey: string }
  | { type: "document.formula.evaluate.settle"; attemptId: string; idempotencyKey: string };
```

`4-job-wiring/document/registerDocumentInternalJobs.ts` registers each intent
type with the Jobs runtime. If dispatch fails after the attempt commit, the
attempt remains in its durable `requested` or `proposed` state and a recovery
scan can dispatch it again using the same idempotency key. Queue-capacity
failures are also redriven in-process with one deduplicated, capped-backoff
timer per intent key; startup recovery covers process interruption. Stage
actions receive a small bounded retry window before a persistent failure is
recorded. Dispatch failure is logged but does not turn an already accepted
command into an unaccepted mutation. These intents are internal messages, not
HTTP endpoints and not Activity records.

## Jobs

| Job | Queue | Effect |
|---|---|---|
| `documents.command.v1` | serial | Create, admit operations, compensate, freeze async attempts, or delegate a small Derived Output definition update. |
| `documents.query.v1` | concurrent | List/load/history/attempt reads. |
| `documents.compact` | serial | Append a Base and prune retained history without changing semantic revision. |
| `documents.prompt.create.compute` | concurrent | Declare and initially refresh a new dedicated Derived Output. |
| `documents.prompt.create.settle` | serial | Insert the Prompt Block with the dedicated output's exact first revision if placement preconditions remain current. |
| `documents.prompt.refresh.compute` | concurrent | Call the injected `derivedOutputs.refresh(outputId)` and persist the returned head/candidate on the attempt. |
| `documents.prompt.refresh.settle` | serial | Confirm the Prompt Block still points to the frozen output/revision, then append `prompt.apply-derived-output` when a newer revision exists. |
| `documents.formula.evaluate.compute` | concurrent | Parse/bind/evaluate the frozen Rich Text Formula atom using one project resolver snapshot. |
| `documents.formula.evaluate.settle` | serial | Confirm atom/expression digest is unchanged, then append `rich-text.apply` with Rich Text's formula-result operation. |

## Prompt creation flow

Every Prompt Block has a dedicated Derived Output. Creation is a durable staged
workflow because the output and Document live in separate databases:

```text
1. Serial freeze:
   - validate target placement, Block ID, Style ID, expected revision, and
     prompt definition;
   - persist a prompt-create attempt containing the desired placement and
     definition;
   - dispatch document.prompt.create.compute and return attemptId.

2. Concurrent compute:
   - idempotently declare a new Derived Output for this attempt;
   - run its first refresh and require a positive immutable head revision;
   - persist outputId and candidate revision on the attempt and register that
     output as `pending` ownership for this Block;
   - dispatch document.prompt.create.settle.

3. Serial settlement:
   - revalidate placement against current Document state;
   - insert one Prompt Block carrying the new dedicated DerivedOutputRef;
   - append the normal Document ChangeSet and mark ownership `attached` in the
     same Document-store transaction;
   - mark the attempt settled.
```

The Derived Outputs declaration accepts the attempt idempotency key, so a crash
cannot create multiple outputs for one Prompt Block. A permanently failed or
stale settlement changes `pending` to `detached`; retained-history reachability
rules govern later cleanup. Generic `block.insert` cannot bypass this workflow.

## Prompt refresh flow

```text
1. Serial freeze:
   - load Prompt Block and exact DerivedOutputRef;
   - persist attempt with frozen Document revision, Block ID, output ID,
     applied revision, and expected revision;
   - return attemptId and dispatch compute intent.

2. Concurrent compute:
   - call injected Derived Outputs runtime `refresh(outputId)`;
   - persist returned head revision/result;
   - dispatch settlement intent.

3. Serial settlement:
   - reload current Document and Prompt Block;
   - require the same output ID and frozen applied revision;
   - if Derived Outputs has no newer head, settle unchanged;
   - if newer, append `prompt.apply-derived-output` through normal admission;
   - if the Block changed or disappeared, mark the attempt stale.
```

Derived Outputs may publish a newer immutable revision even when Document
settlement becomes stale. That is safe: the Prompt Block continues presenting
its prior exact revision until a later explicit adoption.

## Formula evaluation flow

```text
1. A Rich Text operation inserts or edits a Formula atom.
2. Serial admission persists the Document ChangeSet and a Formula attempt.
3. Concurrent compute uses Formula + the project resolver adapter.
4. Serial settlement reloads the atom and compares expression digest.
5. If unchanged, settlement appends a normal `rich-text.apply` operation.
6. If changed or deleted, the attempt becomes stale and canonical content is
   untouched.
```

Formula errors are settled through the Rich Text Formula-atom diagnostic
contract rather than through a Document-specific Formula item type.

## Semantic rebase

When `expectedRevision` is behind the current head:

1. Reconstruct the authored snapshot.
2. Read every intervening ChangeSet.
3. Compute incoming touched IDs against the authored snapshot.
4. Reject if they intersect any intervening touched IDs.
5. Otherwise apply the unchanged canonical operations to current head.

Structural placement anchors and membership-changing parents are touched.
Deleting or replacing a subtree touches every ID in that subtree. Inline style
application touches the target Block, Mark ID, range atoms, and source Style ID.
Independent text edits in different Blocks can rebase.

## Idempotency

The complete command is canonically encoded and hashed. Mutation receipts are
scoped by `(documentId, requestId)`. An identical retry returns the original
typed result; divergent reuse returns `idempotency_mismatch`. Every command
carries its target Document ID explicitly and uses the same receipt rule.

`prompt.update-definition` is the one synchronous command that crosses into a
second capability database. Before that call, Document stores a pending local
claim containing the command digest and frozen output ID. The claim reserves
the request ID against every other Document command. Derived Outputs performs
the update under its own deterministic key; Document then completes the claim
and ordinary receipt in one local transaction. A retry of a pending claim uses
the frozen output directly rather than re-reading current Block placement.

## Compensation

Undo and redo append new ChangeSets; they never remove history. A compensation
operation uses the retained exact inverse of the selected ChangeSet and must
pass current-head conflict validation. That validation requires a continuous
retained ChangeSet range from the selected revision through the current head;
an old target retained only by a compensation reference is not actionable once
any intervening ChangeSet has been pruned. Redo compensates the ChangeSet that
performed the undo.

## Activity semantics

Activity is based on accepted domain facts, not endpoint calls. An endpoint
call may be rejected, may be an identical retry, or may contain several domain
operations, so the HTTP request alone is not an authoritative activity item.

When a Document mutation commits, the same transaction writes an outbox fact:

```ts
interface DocumentCommittedFact {
  factId: string;
  kind: "document.created" | "document.changed" | "document.compensated";
  documentId: string;
  revision: number;
  changeSetId?: string;
  actorId?: string;       // attribution only; never a storage scope
  origin: "interactive" | "agent" | "automation";
  operationTypes: string[];
  semanticDigest: string;
  occurredAt: string;
}
```

A future Activity ingestion runtime consumes these idempotently and builds
feeds. Document does not receive the Activity management capability and
Activity does not receive Document, avoiding a construction cycle.

Until that capability exists, the initial Document implementation stops at the
durable outbox. When Activity is added, integration wiring registers an
idempotent concurrent publisher Job that scans unpublished facts and calls the
Activity ingestion port. This is a one-way data dependency owned outside both
domains; it does not add Activity to `DocumentDependencies`.

The future Activity design is split along the boundary suggested here:

- an Activity ledger/queue owns ingestion, ordering, presence-related feed
  data, and Activity-item reads; it has no dependency on Document; and
- an Activity management endpoint composes that reader with a compensation
  router owned by integration wiring.

Undo from that management endpoint uses:

```ts
interface CompensationTarget {
  ownerKind: "document" | "slides" | "spreadsheet";
  resourceId: string;
  changeSetId: string;
}

interface CompensationRouter {
  dispatch(target: CompensationTarget, request: CompensationRequest): Promise<unknown>;
}
```

An Activity item stores the target address. The management endpoint reads and
validates the item, then calls the router. Document registers a handler that
translates the target into `document.compensate`; Slides and Spreadsheet
register their own handlers. Activity ledger/domain code imports none of those
capabilities, and those capabilities import no Activity code. The only
bidirectional *workflow* is mediated through target data plus the router; there
is no bidirectional constructor or module dependency.

Rejected commands and identical retries create no new fact. The accepted
compensation becomes a new Document fact. Presence remains a separate
ephemeral capability and is not written into Document history.
