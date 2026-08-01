# Slide capability — persistence, history, and durable workflows

## Storage boundary

Slide owns one dedicated SQLite file:

```text
./data/slides.db
```

The trusted project ID is supplied only when the runtime is constructed. The
adapter hashes it with SHA-256, truncates the lowercase hex digest, and derives
all table names from `slide_<projectHash>`. Raw project text never becomes SQL,
and project or user IDs never appear in canonical Deck values.

User ID is optional accepted-fact attribution, not storage scope. A different
project constructs a different trusted table family in the same file. No Slide
endpoint accepts database path, project, table prefix, or user scope.

The SQLite adapter owns SQL, transactions, cursors, canonical blob mapping,
and compare-and-swap. Domain reducers and application workflows depend only on
the `SlideStore` port.

## What is persisted

One Base snapshot contains the complete canonical Deck design state:

```text
DeckSnapshot
  ├─ title, lifecycle, revision, canvas
  ├─ design
  │    ├─ singleton Theme metadata + typed tokens
  │    ├─ exactly one protected Normal Text Style
  │    ├─ Master registry + positioned heterogeneous Elements
  │    └─ Layout registry + positioned Elements + stable slots
  └─ Slides
       ├─ selected live Layout
       ├─ background and Rich Content notes
       └─ positioned heterogeneous Elements + optional slot bindings
```

Theme tokens, the Normal Text Style, Masters, Layouts, slots, Table structure/cell presentation,
Chart labels/data, and every Rich Content value are not normalized into mutable
side tables. They are canonical aggregate state inside Base and ChangeSet
blobs. Historical appearance and composition therefore reconstruct from one
Deck revision without consulting mutable design rows.

Operational tables persist:

- Deck heads and revision-zero/current/cutoff Bases;
- normalized forward/inverse ChangeSets and touched-ID footprints;
- permanent identity claims and tombstones;
- command receipts and delegated Prompt-definition claims;
- Prompt Content and Formula evaluation attempts;
- internal stage receipts;
- dedicated Prompt output ownership state; and
- accepted-fact outbox rows.

## Store port

```ts
interface SlideStore {
  listHeads(
    cursor?: string,
    lifecycle?: SlideLifecycle,
    limit?: number,
  ): Promise<{ items: DeckHead[]; nextCursor?: string }>;

  getHead(deckId: string): Promise<DeckHead | undefined>;
  getBaseAtOrBefore(deckId: string, revision: number): Promise<SlideBase | undefined>;
  getChangeSets(
    deckId: string,
    fromExclusive: number,
    toInclusive: number,
  ): Promise<SlideChangeSet[]>;
  listChangeSets(
    deckId: string,
    cursor?: string,
    limit?: number,
  ): Promise<{ items: SlideChangeSet[]; nextCursor?: string }>;
  getChangeSet(deckId: string, changeSetId: string): Promise<SlideChangeSet | undefined>;

  getSubmission(deckId: string, requestId: string): Promise<SlideSubmissionReceipt | undefined>;
  recordSubmission(receipt: SlideSubmissionReceipt): Promise<void>;

  getDelegatedCommandClaim(
    deckId: string,
    requestId: string,
  ): Promise<SlideDelegatedCommandClaim | undefined>;
  claimDelegatedCommand(
    claim: SlideDelegatedCommandClaim,
  ): Promise<DelegatedCommandClaimResult>;
  completeDelegatedCommand(
    claim: SlideDelegatedCommandClaim,
    receipt: SlideSubmissionReceipt,
  ): Promise<void>;

  getIdentity(deckId: string, identityId: string): Promise<SlideIdentityLedgerEntry | undefined>;
  commitCreation(commit: SlideCreationCommit): Promise<void>;
  commitMutation(commit: SlideMutationCommit): Promise<boolean>;
  commitCompactionIfHead(commit: SlideCompactionCommit): Promise<boolean>;

  getAttempt(deckId: string, attemptId: string): Promise<SlideAttempt | undefined>;
  getAttemptById(attemptId: string): Promise<SlideAttempt | undefined>;
  getAttemptByRequest(
    deckId: string,
    kind: SlideAttempt["kind"],
    requestId: string,
  ): Promise<SlideAttempt | undefined>;
  getPromptCreationAttemptByElement(
    deckId: string,
    elementId: string,
  ): Promise<PromptContentCreationAttempt | undefined>;
  listRecoverableAttempts(): Promise<SlideAttempt[]>;
  createAttempt(attempt: SlideAttempt): Promise<void>;
  createAttemptWithSubmission(
    attempt: SlideAttempt,
    receipt: SlideSubmissionReceipt,
  ): Promise<void>;
  updateAttempt(attempt: SlideAttempt): Promise<void>;

  claimStage(receipt: SlideStageReceipt): Promise<StageClaimResult>;
  completeStage(receipt: SlideStageReceipt): Promise<void>;
  failStage(receipt: SlideStageReceipt): Promise<void>;
  failPromptCreationStage(commit: PromptCreationFailureCommit): Promise<void>;
  recoverInterruptedStages(recoveredAt: string): Promise<number>;

  getPromptOutputOwnership(
    outputId: string,
  ): Promise<PromptContentOutputOwnership | undefined>;
  getPromptOutputOwnershipByElement(
    deckId: string,
    elementId: string,
  ): Promise<PromptContentOutputOwnership | undefined>;
  registerPendingPromptOutput(ownership: PromptContentOutputOwnership): Promise<void>;
  updatePromptOutputOwnership(transition: PromptOwnershipTransition): Promise<void>;

  getCommittedFact(factId: string): Promise<SlideCommittedFact | undefined>;
  listUnpublishedFacts(limit?: number): Promise<SlideCommittedFact[]>;
  markFactPublished(factId: string, publishedAt: string): Promise<void>;
}
```

The port intentionally has no method that deletes a Derived Output and no
historical-output enumeration API. Local ownership records support idempotency,
history, and audit. Derived Outputs alone owns output retention and deletion.

## Atomic commit contracts

```ts
interface SlideCreationCommit {
  head: DeckHead;
  base: SlideBase;
  identities: SlideIdentity[];
  /** FormulaAtoms discovered anywhere in the revision-zero snapshot. */
  attempts?: FormulaEvaluationAttempt[];
  receipt: SlideSubmissionReceipt;
  fact: SlideCommittedFact;
}

interface SlideMutationCommit {
  expectedRevision: number;
  head: DeckHead;
  changeSet: SlideChangeSet;
  receipt: SlideSubmissionReceipt;
  fact: SlideCommittedFact;
  identityTransitions: SlideIdentityTransitions;
  identityReactivation: "forbid" | "same-kind-compensation";
  /** Formula attempts discovered by this accepted mutation. */
  attempts?: SlideAttempt[];
  /** Prompt/Formula attempt settled by this mutation. */
  attemptUpdates?: SlideAttempt[];
  promptOwnershipTransitions?: PromptOwnershipTransition[];
}

interface SlideCompactionCommit {
  deckId: string;
  expectedHeadRevision: number;
  cutoffBase: SlideBase;
  headBase?: SlideBase;
  retention: SlideHistoryRetention;
}
```

`commitCreation` inserts the head, revision-zero Base, every initial identity,
any Formula attempts discovered in initial Rich Content, the command receipt,
and accepted fact in one transaction. Any conflict rolls the whole transaction
back. Initial attempt dispatch occurs only after commit.

`commitMutation` first performs the head compare-and-swap:

```sql
UPDATE decks
SET revision = :nextRevision,
    title = :title,
    lifecycle = :lifecycle,
    semantic_digest = :digest,
    updated_at = :updatedAt
WHERE id = :deckId AND revision = :expectedRevision;
```

If exactly one row is not updated, it returns `false` and writes nothing else.
After successful CAS, the same transaction applies identity transitions,
inserts the ChangeSet, creates automatically discovered Formula attempts,
settles the current Prompt/Formula attempt when applicable, updates Prompt
ownership, writes the receipt, and appends the fact.

`commitCompactionIfHead` is one head-guarded transaction. It validates that the
head is still `expectedHeadRevision`, inserts or verifies both supplied Bases,
updates `base_seq`, and prunes history using that same frozen head. A separate
unguarded `pruneHistory` call is not permitted: a head advance between Base
append and pruning could otherwise delete a ChangeSet needed by the retained
Base and create a replay gap.

## Canonical serialization

Snapshots, operations, results, attempt subtype data, stage results, and
touched-ID arrays use deterministic canonical JSON with sorted object keys.
Semantic digests use SHA-256 over canonical semantic bytes. Operational fields
such as timestamps, outbox publication, retry diagnostics, and SQLite row IDs
do not enter the Deck semantic digest.

Every blob is decoded through capability-owned mappers and then validated
before domain use. Unknown representation versions, malformed operation kinds,
invalid attempt subtypes, and non-canonical Rich Content fail closed.

## Idempotency and delegated commands

```ts
interface SlideSubmissionReceipt {
  deckId: string;
  requestId: string;
  requestDigest: string;
  result: SlideCommandResult;
  createdAt: string;
}

interface SlideDelegatedCommandClaim {
  deckId: string;
  requestId: string;
  requestDigest: string;
  kind: "prompt-content.update-definition";
  targetOutputId: string;
  state: "pending" | "completed";
  createdAt: string;
  updatedAt: string;
}
```

Receipts are keyed by `(deckId, requestId)`. Identical retries compare the
stored command digest and return the exact stored typed result. Divergent reuse
returns `idempotency_mismatch`.

Prompt definition updates cross from `slides.db` into the Derived Outputs
store. Slide first claims the local command identity and freezes its target
output. The upstream update receives a key derived from that stable identity.
`completeDelegatedCommand` atomically writes the local receipt and completes
the claim. Every Slide command preflights the claim namespace so another
command cannot reuse a pending request ID.

Formula evaluation is not a delegated command: its external compute is
represented by a durable Slide attempt and a staged internal Job.

## Permanent identity ledger

```ts
type SlideIdentityKind =
  | "theme-token"
  | "text-style"
  | "master"
  | "layout"
  | "layout-slot"
  | "slide"
  | "element"
  | "table-row"
  | "table-column"
  | "table-merge"
  | "chart-label"
  | "rich-text-atom"
  | "rich-text-mark";

interface SlideIdentityLedgerEntry {
  deckId: string;
  id: string;
  kind: SlideIdentityKind;
  state: "active" | "tombstoned";
  firstRevision: number;
  lastTransitionRevision: number;
  tombstonedRevision?: number;
}
```

Deck-owned stable IDs are unique at Deck scope, including IDs inside Masters,
Layouts, Slides, Tables, Charts, and every Rich Content target. A cell is
addressed by stable row and column IDs and does not need an additional identity.
Every merged-cell region does have a stable merge ID so merge/unmerge and
compensation cannot strand or accidentally reuse merge identity.

Mutation recursively computes additions and removals between the before/after
snapshots. New insertion may claim only an unseen ID. Deletion tombstones its
kind permanently. Only exact compensation may reactivate the same ID with the
same kind. Movement, z-order renumbering, Layout selection, and slot binding do
not replace identity.

The ledger is never pruned with history. External Derived Output IDs and image
snapshot IDs are references, not Deck identities.

The Deck design's protected Normal Text Style is an ordinary ledger identity
with a system role. Domain validation prevents deletion or role reassignment;
the persistence layer does not special-case its presentation properties.

## Durable attempts

```ts
type SlideAttemptState =
  | "requested"
  | "computing"
  | "proposed"
  | "settled"
  | "unchanged"
  | "stale"
  | "failed";

interface SlideAttemptBase {
  id: string;
  deckId: string;
  clientRequestId: string;
  requestDigest: string;
  frozenDeckRevision: number;
  state: SlideAttemptState;
  settledChangeSetId?: string;
  diagnostic?: { code: string; message: string };
  createdAt: string;
  updatedAt: string;
}

interface PromptContentCreationAttempt extends SlideAttemptBase {
  kind: "prompt-content-create";
  slideId: string;
  elementId: string;
  /** Complete frozen positioned shell except its eventual DerivedOutputRef. */
  element: PromptContentElementShell;
  definition: {
    prompt: string;
    contextEntries: ContextEntry[];
    stabilisationText: string;
  };
  candidateOutputId?: string;
  candidateHeadRevision?: number;
}

interface PromptContentRefreshAttempt extends SlideAttemptBase {
  kind: "prompt-content-refresh";
  slideId: string;
  elementId: string;
  outputId: string;
  frozenAppliedRevision: number;
  candidateHeadRevision?: number;
}

interface FormulaEvaluationAttempt extends SlideAttemptBase {
  kind: "formula-evaluation";
  target: RichContentTarget;
  atomId: string;
  originChangeSetId?: string;
  frozenExpression: string;
  frozenExpressionDigest: string;
  resolverSnapshotDigest?: string;
  candidateOperations?: RichTextOperation[];
}

type SlideAttempt =
  | PromptContentCreationAttempt
  | PromptContentRefreshAttempt
  | FormulaEvaluationAttempt;
```

`createAttemptWithSubmission` makes explicit Prompt/Formula admission and its
returned attempt ID atomic. Formula attempts discovered during `deck.submit`
are created inside `commitMutation`, sharing the originating ChangeSet's
durability. Their internal client IDs are deterministically derived from the
ChangeSet, target, and atom identity.

The unique Prompt-creation reservation on `(deckId, elementId)` prevents a
second dedicated workflow from reserving the same Element ID. Admission also
consults the permanent identity ledger and local ownership before any Derived
Output is declared. Ordinary Element insertion consults the same reservation
before claiming the ID.

Formula attempts freeze the complete target address and authored expression,
not a pointer into a mutable object. The resolver snapshot digest records the
immutable name-resolution view used for compute. Candidate operations contain
only Rich Text's bounded Formula settlement operation.

Active attempts are never pruned. Terminal attempts are retained by a separate
bounded count.

## Stage receipts and recovery

```ts
interface SlideStageReceipt {
  attemptId: string;
  stage: "compute" | "settle";
  idempotencyKey: string;
  requestDigest: string;
  state: "running" | "completed" | "failed";
  result?: unknown;
  diagnostic?: { code: string; message: string };
  createdAt: string;
  updatedAt: string;
}

type StageClaimResult = "claimed" | "running" | "completed";
```

`claimStage` is insert-or-compare. The same key and digest replay existing
state; divergent reuse fails. A completed stage never executes again.

The stage effect and authoritative attempt candidate are durable before the
receipt completes. Prompt creation failure may also need to detach already
registered ownership; `failPromptCreationStage` updates ownership, attempt,
and stage receipt atomically.

Startup changes interrupted `running` receipts into claimable failed receipts,
then lists `requested`, `computing`, and `proposed` attempts across all Decks.
It redispatches compute for requested/computing and settle for proposed using
the same stable keys. Small bounded write retries cover stage start, work,
failure recording, and completion.

## Dedicated Prompt output ownership

```ts
interface PromptContentOutputOwnership {
  outputId: string;
  deckId: string;
  slideId: string;
  elementId: string;
  creationAttemptId?: string;
  state: "pending" | "attached" | "historical";
  attachedRevision?: number;
  historicalSinceRevision?: number;
  createdAt: string;
  updatedAt: string;
}
```

Declaration registers `pending` ownership. Successful settlement changes it
to `attached` in the same transaction as the ChangeSet and attempt settlement.
Element/subtree or Slide deletion changes it to `historical` in the same mutation
transaction. Exact compensation may reattach the same output to the same
Element identity.

`outputId` is unique, and `(deckId, elementId)` is unique. This enforces one
dedicated output per Prompt Content Element and prevents output sharing.

Historical ownership is local reachability/audit state only. Slide never asks Derived
Outputs to delete an output and exposes no output-maintenance Job or intent.
This is an ownership boundary, not a deferred Slide subsystem.

## Formula runtime boundary

```ts
interface SlideFormulaResolver {
  buildSnapshot(): Promise<FormulaResolverSnapshot>;
}
```

The application also receives the existing `FormulaEngine`. Concurrent compute
parses and evaluates the frozen expression against one resolver snapshot. The
resolver may expose Structured Data names and other Formula-supported values;
the returned snapshot is immutable for that attempt.

The Slide store persists only frozen expressions, resolver snapshot digests,
candidate Rich Text operations, and accepted FormulaAtom settlement in normal
Deck history. It does not persist or reconstruct a live Formula resolver.

## Accepted-fact outbox

```ts
interface SlideCommittedFact {
  factId: string;
  kind: "slide.created" | "slide.changed" | "slide.compensated";
  deckId: string;
  revision: number;
  changeSetId?: string;
  actorId?: string;
  origin: "interactive" | "agent" | "automation";
  operationTypes: string[];
  semanticDigest: string;
  occurredAt: string;
}
```

One fact is written atomically with Deck creation or mutation. Rejected calls,
identical retries, compute stages, and definition-only Derived Output updates
create no Slide fact. Formula settlement does append an ordinary Slide
ChangeSet and therefore writes a changed fact.

Outbox publication state is operational and excluded from semantic digests.
There is no Activity constructor dependency. An integration-owned publisher
may list unpublished facts and mark them published; Slide does not own feeds,
Presence, or Activity's undo endpoint.

## Logical SQL schema

The adapter substitutes the trusted project-prefixed names for every logical
identifier below.

```sql
CREATE TABLE decks (
  id                TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  lifecycle         TEXT NOT NULL
    CHECK (lifecycle IN ('active', 'archived', 'trashed')),
  revision          INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  base_seq          INTEGER NOT NULL DEFAULT 0 CHECK (base_seq >= 0),
  semantic_digest   TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  CHECK (base_seq <= revision)
);

CREATE INDEX deck_heads_lifecycle_updated
  ON decks(lifecycle, updated_at DESC, id);

CREATE TABLE command_receipts (
  deck_id          TEXT NOT NULL,
  request_id       TEXT NOT NULL,
  request_digest   TEXT NOT NULL,
  result_json      BLOB NOT NULL,
  created_at       TEXT NOT NULL,
  PRIMARY KEY (deck_id, request_id),
  FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
);

CREATE TABLE delegated_command_claims (
  deck_id          TEXT NOT NULL,
  request_id       TEXT NOT NULL,
  request_digest   TEXT NOT NULL,
  command_kind     TEXT NOT NULL
    CHECK (command_kind = 'prompt-content.update-definition'),
  target_output_id TEXT NOT NULL,
  state            TEXT NOT NULL CHECK (state IN ('pending', 'completed')),
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  PRIMARY KEY (deck_id, request_id),
  FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
);

CREATE INDEX delegated_commands_pending
  ON delegated_command_claims(state, updated_at, deck_id, request_id)
  WHERE state = 'pending';

CREATE TABLE identity_ledger (
  deck_id                   TEXT NOT NULL,
  identity_id               TEXT NOT NULL,
  identity_kind             TEXT NOT NULL
    CHECK (identity_kind IN (
      'theme-token', 'text-style', 'master', 'layout', 'layout-slot',
      'slide', 'element', 'table-row', 'table-column', 'table-merge', 'chart-label',
      'rich-text-atom', 'rich-text-mark'
    )),
  state                     TEXT NOT NULL
    CHECK (state IN ('active', 'tombstoned')),
  first_revision            INTEGER NOT NULL CHECK (first_revision >= 0),
  last_transition_revision  INTEGER NOT NULL
    CHECK (last_transition_revision >= first_revision),
  tombstoned_revision       INTEGER CHECK (tombstoned_revision >= 0),
  PRIMARY KEY (deck_id, identity_id),
  CHECK (
    (state = 'active' AND tombstoned_revision IS NULL) OR
    (state = 'tombstoned' AND tombstoned_revision IS NOT NULL)
  ),
  FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
);

CREATE INDEX identity_ledger_state
  ON identity_ledger(deck_id, state, identity_id);

CREATE TABLE bases (
  deck_id                 TEXT NOT NULL,
  base_seq                INTEGER NOT NULL CHECK (base_seq >= 0),
  representation_version  INTEGER NOT NULL CHECK (representation_version = 1),
  snapshot_json           BLOB NOT NULL,
  semantic_digest         TEXT NOT NULL,
  created_at              TEXT NOT NULL,
  PRIMARY KEY (deck_id, base_seq),
  FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
);

CREATE INDEX bases_lookup ON bases(deck_id, base_seq DESC);

CREATE TABLE change_sets (
  id                                 TEXT PRIMARY KEY,
  deck_id                            TEXT NOT NULL,
  client_request_id                  TEXT NOT NULL,
  request_digest                     TEXT NOT NULL,
  authored_revision                  INTEGER NOT NULL CHECK (authored_revision >= 0),
  prior_revision                     INTEGER NOT NULL CHECK (prior_revision >= 0),
  revision                           INTEGER NOT NULL CHECK (revision > 0),
  seq                                INTEGER NOT NULL CHECK (seq > 0),
  origin                             TEXT NOT NULL
    CHECK (origin IN ('interactive', 'agent', 'automation')),
  operations_json                    BLOB NOT NULL,
  inverse_operations_json            BLOB NOT NULL,
  touched_ids_json                   BLOB NOT NULL,
  compensation_intent                TEXT
    CHECK (compensation_intent IN ('undo', 'redo')),
  compensation_target_change_set_id  TEXT,
  semantic_digest                    TEXT NOT NULL,
  created_at                         TEXT NOT NULL,
  UNIQUE (deck_id, seq),
  UNIQUE (deck_id, revision),
  CHECK (seq = revision),
  CHECK (revision = prior_revision + 1),
  FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE,
  FOREIGN KEY (compensation_target_change_set_id) REFERENCES change_sets(id)
);

CREATE INDEX change_sets_recent ON change_sets(deck_id, seq DESC);

CREATE INDEX change_sets_compensation_target
  ON change_sets(compensation_target_change_set_id)
  WHERE compensation_target_change_set_id IS NOT NULL;

CREATE TABLE activity_outbox (
  fact_id          TEXT PRIMARY KEY,
  fact_kind        TEXT NOT NULL
    CHECK (fact_kind IN ('slide.created', 'slide.changed', 'slide.compensated')),
  deck_id          TEXT NOT NULL,
  revision         INTEGER NOT NULL CHECK (revision >= 0),
  change_set_id    TEXT,
  actor_id         TEXT,
  origin           TEXT NOT NULL
    CHECK (origin IN ('interactive', 'agent', 'automation')),
  operation_types  BLOB NOT NULL,
  semantic_digest  TEXT NOT NULL,
  occurred_at      TEXT NOT NULL,
  published_at     TEXT,
  UNIQUE (deck_id, revision),
  FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE,
  FOREIGN KEY (change_set_id) REFERENCES change_sets(id) ON DELETE SET NULL
);

CREATE INDEX activity_outbox_unpublished
  ON activity_outbox(occurred_at, fact_id)
  WHERE published_at IS NULL;

CREATE TABLE attempts (
  id                    TEXT PRIMARY KEY,
  deck_id               TEXT NOT NULL,
  kind                  TEXT NOT NULL
    CHECK (kind IN (
      'prompt-content-create', 'prompt-content-refresh', 'formula-evaluation'
    )),
  client_request_id     TEXT NOT NULL,
  request_digest        TEXT NOT NULL,
  subject_kind          TEXT NOT NULL
    CHECK (subject_kind IN ('prompt-element', 'formula-atom')),
  subject_id            TEXT NOT NULL,
  frozen_deck_revision  INTEGER NOT NULL CHECK (frozen_deck_revision >= 0),
  state                 TEXT NOT NULL
    CHECK (state IN (
      'requested', 'computing', 'proposed', 'settled',
      'unchanged', 'stale', 'failed'
    )),
  frozen_json           BLOB NOT NULL,
  candidate_json        BLOB,
  diagnostic_json       BLOB,
  settled_change_set_id TEXT,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  UNIQUE (deck_id, kind, client_request_id),
  FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE,
  FOREIGN KEY (settled_change_set_id) REFERENCES change_sets(id) ON DELETE SET NULL
);

CREATE INDEX attempts_state ON attempts(kind, state, updated_at, id);
CREATE INDEX attempts_subject ON attempts(deck_id, subject_kind, subject_id, updated_at DESC);

CREATE UNIQUE INDEX attempts_prompt_create_element
  ON attempts(deck_id, subject_id)
  WHERE kind = 'prompt-content-create';

CREATE TABLE prompt_outputs (
  output_id            TEXT PRIMARY KEY,
  deck_id              TEXT NOT NULL,
  slide_id             TEXT NOT NULL,
  element_id           TEXT NOT NULL,
  creation_attempt_id  TEXT UNIQUE,
  state                TEXT NOT NULL CHECK (state IN ('pending', 'attached', 'historical')),
  attached_revision    INTEGER CHECK (attached_revision > 0),
  historical_since_revision INTEGER CHECK (historical_since_revision > 0),
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  UNIQUE (deck_id, element_id),
  CHECK (state != 'attached' OR attached_revision IS NOT NULL),
  CHECK (state != 'historical' OR historical_since_revision IS NOT NULL),
  FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE,
  FOREIGN KEY (creation_attempt_id) REFERENCES attempts(id) ON DELETE SET NULL
);

CREATE TABLE stage_receipts (
  attempt_id       TEXT NOT NULL,
  stage            TEXT NOT NULL CHECK (stage IN ('compute', 'settle')),
  idempotency_key  TEXT NOT NULL UNIQUE,
  request_digest   TEXT NOT NULL,
  state            TEXT NOT NULL CHECK (state IN ('running', 'completed', 'failed')),
  result_json      BLOB,
  diagnostic_json  BLOB,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  PRIMARY KEY (attempt_id, stage),
  FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE
);

CREATE INDEX stage_receipts_state
  ON stage_receipts(state, updated_at, attempt_id);
```

SQLite enables WAL, foreign keys, a bounded busy timeout, and normal
synchronous mode. Every dynamic identifier comes from the adapter's trusted
project-hash function, never a request value.

## Snapshot loading and exact external references

For target revision `R`, the application:

1. loads the Deck head and validates `0 <= R <= head.revision`;
2. selects the newest retained Base at or before `R`;
3. reads ChangeSets `(baseSeq, R]` in ascending revision order;
4. requires exactly one contiguous ChangeSet for every revision;
5. replays normalized operations through the pure reducer; and
6. validates Theme token/Normal Text Style references, Master→Layout→Slide composition,
   parentage, contiguous sibling z-order, slots, Tables, Charts, and every Rich
   Content target.

No Base or any gap returns `history_pruned`. Current head metadata is never
spliced into a historical snapshot.

After reconstruction, `deck.load` requests each live Prompt Content Element's
exact `outputId@appliedRevision` from Derived Outputs. A missing revision is a
typed not-found result for that exact reference. It is never omitted and never
replaced with the output head; the response contains one resolved revision per
live Prompt Content Element.

Formula values are already accepted FormulaAtom settlement inside canonical
Rich Content. Loading never reevaluates them or rebuilds a resolver snapshot.

## Compaction and pruning

Compaction is a typed serial internal Job and does not change logical Deck
revision or semantic digest.

For frozen current revision `H` and retained ChangeSet count `N`:

1. load and validate the exact snapshot at `H`;
2. compute `cutoff = max(0, H - N)`;
3. reconstruct and validate the exact snapshot at `cutoff`;
4. call one `commitCompactionIfHead` with `Base[cutoff]`, optional `Base[H]`,
   `expectedHeadRevision = H`, and the retention policy;
5. in one transaction, require head `H`, insert/verify Bases, update `base_seq`,
   and prune only history proven safe for that same `H`.

An existing byte-equivalent Base is idempotent. A different Base at the same
revision is corruption. If the head advanced, the method returns `false` and
writes nothing; a later threshold check or recovery compacts the new head.

Pruning preserves:

- the cutoff Base and contiguous tail required for retained loads;
- the configured newest Base count;
- ChangeSets still referenced by retained compensation records;
- all permanent identity ledger rows;
- active attempts and configured recent terminal attempts;
- delegated claims and Prompt ownership; and
- unpublished facts.

Admission dispatches compaction after a successful mutation when
`head.revision - head.baseSeq >= retainedChangeSetCount`.

## Contiguous compensation

Compensation first requires `head.revision === expectedRevision`. It loads the
target ChangeSet and every later revision through the current head. Count and
revision numbers must form a complete tail. Missing proof is a compensation
conflict even if a newer Base can reconstruct current state.

If the target footprint intersects any intervening footprint, compensation is
rejected. Otherwise the stored inverse is admitted as a new ChangeSet.
Reactivation is allowed only for tombstoned identities of their original kind.
Theme-token/Normal-Text-Style changes, Master/Layout selection, slot bindings,
Element parent/z positions, Table structure/cell content, Rich Text, Prompt
references, and Formula settlements are restored from exact stored inverses.

## Retention

```ts
interface SlideHistoryRetention {
  retainedBaseCount: number;
  retainedChangeSetCount: number;
  retainedTerminalAttemptCount: number;
}
```

All values are positive bounded integers. Retention applies only to historical
and terminal operational rows. It never weakens permanent identity tombstones,
active workflow recovery, Prompt ownership, or unpublished activity facts.
