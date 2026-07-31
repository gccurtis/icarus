# Document capability — store and history

## One project runtime, one scoped store

Document follows Knowledge's scoping pattern. The runtime resolves a project once,
then constructs a capability backed by a store already isolated to that project.

```ts
interface DocumentDependencies {
  knowledge: Knowledge;
  intelligence: Intelligence;
  formula: Formula;
  logger: Logger;
}

const store = resolveDocumentStore(projectId, db);
const documents = createDocumentCapability(
  store,
  {
    knowledge,
    intelligence,
    formula,
    logger,
  },
  options,
);
```

`formula` is the public Formula capability. Formula already owns Name Manager
integration and name recognition; Document only supplies formula source and the
Document scope ID. `knowledge`, `intelligence`, `formula`, and `logger` are all
required construction dependencies. Prompt context is stored data, not another
Document dependency: Prompt Blocks own a minimal `{ id, kind }` list and pass it
to Knowledge. That shape can move into a shared library later.

`projectId` and `userId` do not occur in Document domain values, ChangeSets,
repository methods, or endpoint payloads. The project runtime uses the request's
selected project only to locate the correct Document capability instance.

```text
RequestEnvelope(projectId, requestType, payload)
  → ProjectRuntimeResolver
  → Document capability for that project
  → DocumentStore for that project
```

`resolveDocumentStore` owns project-to-storage mapping. For SQLite it derives
safe internal table names or a namespace from the project ID; a raw caller value
never becomes a Document record field or a SQL identifier.

## Base plus ChangeSet history

The `documents` row holds current head metadata and the active `baseSeq`. A Base
is a materialized Document snapshot through one ChangeSet sequence. The current
Document is reconstructed by replaying its contiguous ChangeSet tail over the
active Base. The capability retains a configured number of older Bases so that
recent historical revisions can load from a Base at or before their sequence.

```text
head: revision 42, baseSeq 30

Base[30] ── apply ChangeSets 31…42 ──> snapshot[42]
```

Creation is revision `0`: one initial Base and no ChangeSet. Templates and
imports create their initial content at revision 0 rather than inventing a user
edit at revision 1.

```ts
interface DocumentBase {
  representationVersion: 1;
  documentId: string;
  baseSeq: number;
  snapshot: DocumentSnapshot;
  semanticDigest: string;
}

interface DocumentChangeSet {
  id: string;
  documentId: string;
  clientRequestId: string;
  requestDigest: string;
  authoredRevision: number;
  priorRevision: number;
  revision: number;
  seq: number; // seq === revision
  origin: "interactive" | "agent" | "automation";
  operations: DocumentOperation[];
  inverseOperations: DocumentOperation[];
  touchedIds: string[];
  compensation?: {
    intent: "undo" | "redo";
    targetChangeSetId: string;
  };
  createdAt: string;
}
```

Base contains title/lifecycle as well as content, so one reconstructed revision
does not mix historical content with current metadata. History retention is one
configuration value with two explicit limits:

```ts
interface DocumentHistoryRetention {
  retainedBaseCount: number;
  retainedChangeSetCount: number;
}

const defaultDocumentHistoryRetention: DocumentHistoryRetention = {
  retainedBaseCount: 5,
  retainedChangeSetCount: 1_000,
};
```

A revision loads only when a retained Base exists at or before it and the needed
ChangeSet tail is continuous. Otherwise it returns `history_pruned`. Compaction
never prunes the ChangeSet tail required to reconstruct the current head. It
may prune an older ChangeSet only when a retained later Base makes current-state
replay safe. Activity may offer compensation only while the referenced Document
ChangeSet remains retained.

```ts
interface DocumentCommandReceipt {
  requestId: string;
  requestDigest: string;
  result: DocumentCommandResult;
  createdAt: string;
}

interface DocumentActivityContribution {
  id: string;
  kind: "document-created" | "document-changed";
  documentId: string;
  revision: number;
  semanticDigest: string;
  changeSetId?: string;
  operation: DocumentActivityOperation;
  origin: "interactive" | "agent" | "automation";
  occurredAt: string;
  summary: DocumentChangeSummary;
  compensation?: DocumentChangeSet["compensation"];
}

type DocumentActivityOperation =
  | {
      type: "document.create";
      creationKind: "blank" | "recipe" | "duplicate";
      source?: { documentId: string; revision: number };
    }
  | {
      type: "document.change";
      changeSetId: string;
      operationTypes: DocumentOperation["type"][];
    };

interface DocumentCompensationInput {
  documentId: string;
  targetChangeSetId: string;
  intent: "undo" | "redo";
  expectedRevision: number;
  clientRequestId: string;
}
```

An Activity contribution is an opaque, durable handoff to the Activity
capability. Creation is explicitly an Activity operation even though it is not
a reducer `DocumentOperation`. Change contributions carry normalized operation
type names rather than full content payloads. Document does not try to encode
the global activity order.

## Canonical stores

| Store | Role |
| --- | --- |
| `documents` | current head: title, lifecycle, revision, active Base sequence, semantic digest, timestamps |
| `document_command_receipts` | project-scoped idempotency receipt and discriminated result for every `documents.command.v1` call |
| `document_bases` | materialized Base snapshots; current Base plus configured retained predecessors |
| `document_change_sets` | append-only forward/inverse operations, request receipts, and touched-ID sets |
| `document_activity_outbox` | durable references to accepted creation and ChangeSet events for Activity |
| `document_refresh_attempts` | frozen Prompt Block/target, grounding manifest, patches/proposal/failure, settlement |
| `document_formula_attempts` | frozen Formula item/expression, observed dependency manifest, evaluation/failure, settlement |
| `document_resolution_stages` | idempotent prompt/formula accept, resolve, and settle receipts |

All data is isolated by the scoped store; records use Document ID, revision, and
attempt IDs only.

## Store port

```ts
interface DocumentStore {
  transaction<T>(work: (tx: DocumentTransaction) => Promise<T>): Promise<T>;
}

interface DocumentTransaction {
  getCommandReceipt(requestId: string): Promise<DocumentCommandReceipt | undefined>;
  saveCommandReceipt(receipt: DocumentCommandReceipt): Promise<void>;
  createHead(head: DocumentHead, base: DocumentBase, receipt: DocumentCommandReceipt, activity: DocumentActivityContribution): Promise<void>;

  getHead(documentId: string): Promise<DocumentHead | undefined>;
  listHeads(query: DocumentListQuery): Promise<DocumentSummaryPage>;
  getBaseAtOrBefore(documentId: string, revision: number): Promise<DocumentBase>;
  listChangeSets(documentId: string, fromExclusive: number, throughInclusive?: number): Promise<DocumentChangeSet[]>;
  appendChangeSet(expectedRevision: number, changeSet: DocumentChangeSet, nextHead: DocumentHead, activity: DocumentActivityContribution): Promise<void>;
  appendBase(base: DocumentBase, expectedRevision: number): Promise<void>;
  pruneBases(documentId: string, retain: number): Promise<void>;
  pruneChangeSets(documentId: string, retain: number): Promise<void>;

  getRefreshAttempt(attemptId: string): Promise<PromptRefreshAttempt | undefined>;
  findRefreshByKey(documentId: string, key: string): Promise<PromptRefreshAttempt | undefined>;
  saveRefreshAttempt(attempt: PromptRefreshAttempt): Promise<void>;
  getFormulaAttempt(attemptId: string): Promise<FormulaEvaluationAttempt | undefined>;
  findFormulaByKey(documentId: string, key: string): Promise<FormulaEvaluationAttempt | undefined>;
  saveFormulaAttempt(attempt: FormulaEvaluationAttempt): Promise<void>;
  claimStage(receipt: RefreshStageReceipt): Promise<StageClaim>;
  settleStage(receipt: RefreshStageReceipt): Promise<void>;
}
```

`appendChangeSet` performs revision CAS in SQLite: it succeeds only when the
persisted head equals `expectedRevision`, and appends the ChangeSet/head update
and an Activity contribution inside that same transaction. Creation does the
same with its creation contribution.

## Load and compaction process

```ts
async function loadSnapshot(documentId: string, revision?: number): Promise<DocumentSnapshot> {
  const head = await store.getHead(documentId);
  const target = revision ?? head.revision;
  const base = await store.getBaseAtOrBefore(documentId, target);
  const tail = await store.listChangeSets(documentId, base.baseSeq, target);
  return replay(base.snapshot, tail);
}
```

`replay` uses the pure reducer and rejects a non-contiguous tail. It normalizes
the result and verifies its semantic digest whenever a stored digest exists.

Compaction is a serial internal job:

1. load the exact current head;
2. replay Base plus tail;
3. append a new Base at that revision;
4. advance the active `baseSeq` only if the head did not advance meanwhile;
5. retain the configured numbers of recent Bases and ChangeSets, without
   breaking replay of the current head.

Compaction changes neither logical revision nor semantic digest.

## Capability surface

```ts
interface DocumentCapability {
  command(input: DocumentCommandRequest): Promise<DocumentCommandResult>;
  query(input: DocumentQueryRequest): Promise<DocumentQueryResult>;
}

interface DocumentInternalJobs {
  resolvePromptRefresh(attemptId: string): Promise<void>;
  settlePromptRefresh(attemptId: string): Promise<void>;
  evaluateFormula(attemptId: string): Promise<void>;
  settleFormulaEvaluation(attemptId: string): Promise<void>;
  compact(input: CompactDocumentInput): Promise<CompactionResult>;
}
```

`command` and `query` are thin discriminated-union dispatchers. Their handlers
remain separate application functions—`create`, `submit`, `duplicate`,
`compensate`, `requestPromptRefresh`, `requestFormulaEvaluation`, `list`,
`get`, `load`, `listHistory`, and so on—so one union does not become one large
transaction or reducer.

The capability wraps every public and internal method with structured call
logging. `Logger` is carried inside `DocumentDependencies`; it is not stored in
the domain or passed to pure reducer functions.

`duplicate` loads an exact source revision, remaps every descendant ID, and
creates a fresh revision-0 Document. It copies Prompt Block text, definitions,
and accepted provenance; a caller chooses whether automatic prompt refresh is
enabled on the duplicate.

## Command idempotency, semantic rebase, and Activity-driven undo/redo

The command dispatcher canonicalizes the complete `DocumentCommand` and checks
the project-scoped `document_command_receipts` table before invoking a handler.
The handler writes its receipt in the same transaction as the created head,
attempt, or ChangeSet. This gives create, duplicate, submit, compensate, Prompt
request, and Formula request identical retry behavior.

1. Canonicalize a submission and calculate `requestDigest`.
2. Return the original ChangeSet for an identical client-request retry.
3. Reject the same request ID with another digest as `idempotency_mismatch`.
4. If `expectedRevision` equals the head, load the head and apply normally.
5. If it is stale but retained, reconstruct the authored snapshot and inspect
   every ChangeSet through the current head. Compute the incoming touched-ID set
   and reject if it intersects any intervening ChangeSet's touched-ID set.
6. Apply the resulting operations to the current head, normalize, validate, and
   generate inverses.
7. Append one ChangeSet and advance one revision atomically. The stored
   `authoredRevision` records the client snapshot; `priorRevision` records the
   actual head at admission.

The reducer creates inverse operations; the client does not supply them. Stable
IDs mean an operation batch whose touched IDs are disjoint can be applied
unchanged to the current head. The touched set includes direct mutation targets,
structural insertion/move anchors, and a parent ID only when the operation
changes that parent's child membership, order, or layout. Merely resolving a
target through a parent does not touch that parent, so edits to distinct Atoms
in sibling Blocks remain independent. A delete or wholesale replacement also
touches every ID in the affected subtree. A Document-wide operation touches a
reserved Document ID. There is no arbitrary revision-distance limit: all
intervening ChangeSets must simply remain retained. A CAS race while admitting
retries the same intersection check against the newer head. Every accepted
create, duplicate, submission, Prompt settlement, Formula settlement, and
compensation writes a durable `DocumentActivityContribution` with the same
transaction. It contains the Document ID, ChangeSet ID when one exists,
revision, resulting semantic digest, normalized semantic operation, origin,
timestamp, summary, and compensation reference. It contains no project or user
scope fields.

Activity consumes those contributions to build the one chronological history
across editable Resources. It owns the user-facing undo and redo selection.
When it selects a Document entry, it calls `compensate` with the selected
ChangeSet, an expected current revision, and an `undo` or `redo` intent.
Document applies the target ChangeSet's stored inverse operations as a normal
new ChangeSet and validates them against the current snapshot. A redo therefore
compensates the earlier undo ChangeSet; it does not need to reconstruct a
separate Document-only undo stack.

If later edits make that compensation invalid, Document returns
`compensation_conflict` rather than guessing. A successful compensation records
its target in `compensation`, so Activity can relate it to the entry that it
reversed. Document history remains inspectable, but it is not the source of
truth for the user-facing undo/redo cursor.

`touchedIds` is sorted and deduplicated before persistence. Any shared ID is a
conflict, even when a more sophisticated operation-specific transform might have
worked. This deliberately rejects concurrent edits to the same Atom, Block, Row,
parent container, or anchor while admitting edits to unrelated IDs. A missing
history tail also returns `revision_conflict`.

## Rebuildable backend indexes

Prompt and Formula dependency indexes, prompt-refresh status, outline, style
usage, plain-text search, word count, document summaries, and native-Resource
source-snapshot caches are rebuildable. Deleting them affects performance and
temporary status only; accepted content, history, and provenance remain.
