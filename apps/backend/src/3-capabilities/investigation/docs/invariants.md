# Investigation invariants, guarantees, and limits

## Preconditions to outcomes

| Preconditions | Guaranteed outcome when the method completes | Boundary |
|---|---|---|
| Valid Question creation request and successful insert | One live `open` Question with actor/timestamps and no current answer | Runtime/store |
| A nonblank answer is proposed for a live Question | `currentAnswer` is replaced and status is `proposed` | Runtime/store |
| A live Question has a nonblank current answer and confirmation succeeds | Status is `answered`; repeated confirmation returns the same accepted state | Runtime/store |
| A valid Hypothesis creation request and successful insert | One live `proposed` Hypothesis with zero or more deduplicated Question IDs | Runtime/store |
| A supported Hypothesis status/confidence update succeeds | Supplied values are stored directly; no Finding gate is imposed | Runtime/store |
| Valid Finding proposal with at least one reference succeeds | One live `proposed` Finding exists and Knowledge is unchanged | Runtime/store |
| Finding acceptance returns successfully | The returned live row is accepted, names `finding:{id}`, and reconciliation observed the same current claim in Knowledge | Runtime/Knowledge/store |
| A serial claim edit wins during acceptance | Conditional acceptance of the old claim fails and acceptance retries the current claim | Store fence/runtime loop |
| An accepted Finding claim update returns successfully | The stable source is reconciled to the returned current claim digest/text | Runtime/Knowledge/store |
| Accepted Finding unaccept/reject/delete returns successfully | The returned/nondeleted state no longer exposes a Knowledge source; delete is absent from normal reads | Runtime/Knowledge/store |
| One reference is marked or cleared successfully | Only that current array element's review flag changes; overall review need remains derived | Runtime/store |
| A reverse filter names a live target | Results are live owner rows whose authoritative JSON array contains that target ID | SQLite store |
| A reverse filter names an unavailable/deleted target | The result is empty even if an owner retained the target ID | SQLite store |
| Any soft-delete method completes | `deletedAt` is set and the record is absent from ordinary get/list operations | SQLite store |

These are completion guarantees, not a distributed transaction guarantee.
Investigation SQLite and Knowledge are independent stores; process termination
inside a cross-store operation can interrupt reconciliation.

## Capability and representation invariants

- Investigation has no persisted aggregate, ID, status, or fourth table.
- One `InvestigationRuntime` manages all three record families.
- One `InvestigationStore` port and one `SQLiteInvestigationStore` connection
  persist all three families for a project.
- `Question`, `Hypothesis`, and `Finding` are the only public representations of
  their records.
- There are no `RuntimeQuestion`, `RuntimeHypothesis`, assemblers, or persisted
  runtime-only graphs.
- Domain objects contain IDs for relationships rather than recursively
  embedding complete related records.
- The runtime's optional clock and ID factory are test seams, not additional
  durable identity/time models.

## Relationship invariants

- `Finding.questionLinks` alone owns Finding-to-Question relationships.
- `Finding.hypothesisLinks` alone owns Finding-to-Hypothesis relationships.
- `Hypothesis.questionIds` alone owns Hypothesis-to-Question associations.
- Question has no reverse relationship arrays; Hypothesis has no Finding array.
- Reverse traversal is always a list filter over the owning rows.
- The relationship value is optional and, when present, exactly `supports`,
  `refutes`, `qualifies`, or `contextualizes`.
- Reverse traversal does not invert meaning; values are always interpreted from
  the Finding toward the Question/Hypothesis.
- Duplicate link target IDs in one request collapse to one authoritative entry;
  duplicate Hypothesis Question IDs collapse to one ID.
- Relationship target existence is not required at write time.
- Target deletion does not cascade, mutate owner arrays, or create a broken-link
  status. It only makes target-filtered reverse access empty.

This avoids bidirectional synchronization and permits records to be prepared
before every related record is present.

## Question invariants

- `text` is nonblank after trimming.
- Creation always starts `open` without `currentAnswer`.
- `proposeQuestionAnswer` requires a nonblank answer and sets `proposed`.
- `confirmQuestionAnswer` requires a current answer; `answered` is the
  human-confirmed signal, so no approval field is needed.
- `clearQuestionAnswer` removes the answer and sets `open`.
- `currentAnswer` is mutable and has no Investigation-specific revision history.
- `context` is one optional text field for framing, constraints, background,
  and research detail.
- Assumptions are plain strings without IDs/status/approval/confidence.
- Tags are nonblank, trimmed, and deduplicated on runtime write.

`answered` records approval, not objective factual truth.

## Hypothesis invariants

- `statement` is nonblank after trimming.
- A Hypothesis may relate to zero, one, or many Questions.
- Question IDs are nonblank, trimmed, and deduplicated, but not existence-
  checked when written.
- Creation starts `proposed`.
- Status is exactly `proposed`, `accepted`, `refuted`, or `inconclusive`.
- The runtime permits direct updates among supported statuses and does not
  require an accepted Finding.
- Optional categorical confidence is exactly one of the five ordered semantic
  levels from strongly refuted through strongly supported.
- No numeric confidence score is currently stored.
- Rationale is optional and assumptions are plain text.

## Finding content and reference invariants

- `claim` is nonblank after trimming.
- At least one reference is required on proposal and on any reference
  replacement.
- References are discriminated as `resource` or `url`; there is no generic
  Source record.
- Resource kind/ID are nonblank. A supplied numeric revision is a positive safe
  integer; a supplied string revision is nonblank.
- Known revisioned kinds `collection`, `connector-item`, `context`, `deck`,
  `derived-output`, `document`, `function`, `general-file`, `slide`,
  `structured-data`, and `variable`, plus `connector::` and
  `general::file::` prefixes, require `resourceRevision`; owners without
  revisions may omit it.
- URL references accept only HTTP(S), require a valid `observedAt`, and do not
  imply future change detection.
- Character spans use safe nonnegative `[start,end)` bounds with `end > start`.
- Line spans use safe one-based inclusive bounds with `endLine >= startLine`.
- Notes, locators, and commentary remain optional text; they are not logged.
- Status is exactly `proposed`, `accepted`, or `rejected`; deletion is separate.

The runtime validates locator/reference syntax but does not open each reference
or verify that the cited span actually entails the claim.

## Source-review invariants

- Review state lives only as optional `needsReview: true` on an individual
  reference.
- Clearing review removes the property.
- The derived `findingNeedsReview(finding)` is true if and only if at least one
  reference has the flag.
- No Finding-level stale Boolean/status is persisted.
- Mark/clear uses the current zero-based reference index and rejects an index
  outside the current array.
- Review operations do not change Finding status, claim, or relationship
  classification.
- No automatic external webpage monitoring or source-change detector exists.

## Knowledge and resource invariants

- Stable accepted source identity is `finding:{findingId}`.
- Knowledge revision is the SHA-256 hex digest of the current claim.
- Knowledge label is `finding`, and indexed text is the claim only.
- Conditional acceptance records accepted/source identity only while the
  persisted claim equals the claim just supplied to Knowledge.
- Repeated acceptance uses the same source/revision and converges on one
  accepted row; it does not guarantee a single `Knowledge.add` invocation.
- An accepted claim edit keeps the same source ID and changes its digest.
- Accepted metadata-only and reference-review edits do not call Knowledge.
- Unaccept, reject from accepted, and delete remove the stable source.
- `knowledgeSourceId` is integration identity, not a Finding reference or
  first-class Source object.
- Resource registry resolution, description, and read require a live accepted
  Finding whose `knowledgeSourceId` exactly matches the source.
- Proposed, rejected, missing, and deleted Findings are unavailable through
  accepted-Finding resource integration.
- Scoped Finding reads require a matching descriptor in the supplied manifest
  and return only a line slice of the claim.

Finding resource descriptors currently omit a public numeric resource
revision. Knowledge retains the internal claim digest on its own SourceRecord.

## Deletion invariants

- Deletion is represented by `deletedAt`, never by a Question/Hypothesis/
  Finding status.
- Ordinary store get/list methods always filter `deleted_at IS NULL`.
- The public runtime has no include-deleted or restore operation.
- Question/Hypothesis deletion does not cascade or rewrite owner links.
- Finding soft deletion clears `knowledge_source_id` in the SQL row.
- Accepted Finding deletion attempts Knowledge removal before soft deletion and
  reconciliation afterward.
- IDs and historical rows remain in SQLite; normal capability behavior treats
  them as absent.

## Concurrency and atomicity

HTTP queue policy is part of the guarantee:

- Question and Hypothesis authored mutations are serial.
- Finding edit, review, unaccept, reject, and delete are serial.
- get/list, Finding proposal, and acceptance are concurrent.
- Serial authored mutations use deterministic queue order and last-write-wins
  semantics; they do not add record versions or merge logic.

SQLite single statements are atomic, and the three-table schema is initialized
inside one transaction. The claim-matching acceptance update is one atomic SQL
statement. The runtime does not wrap multiple runtime/store operations in a
general transaction or hold SQLite transactions during Knowledge embedding.

Acceptance correctness comes from stable source identity, claim digest,
conditional SQL update, and reconciliation. There is no distributed lock,
jobs-runtime graph, lease, generalized CAS field, or conflict-resolution
framework.

Direct in-process callers bypass the HTTP scheduler. Except for Finding
acceptance's explicit protocol, they must arrange authored mutation order if
they require the same serial semantics.

## Cross-store failure boundary

Knowledge and `investigation.db` cannot commit atomically. Current runtime
behavior reduces ordinary failure windows by:

- retrying acceptance after a claim mismatch;
- re-reading state while reconciling;
- restoring a prior accepted claim when a later SQLite update throws; and
- cleaning up the stable source when acceptance discovers deletion.

These are in-process convergence/compensation rules. There is no durable
pending/active/failed ingestion state, outbox, startup scan, or background
reconciliation loop. A process crash between Knowledge and SQLite steps may
require a later lifecycle operation or operational repair.

## SQLite invariants and limits

- Table names use `inv_${sha256(projectId).slice(0,16)}` and three fixed
  suffixes.
- One concrete store owns one connection to `./data/investigation.db`.
- WAL, five-second busy timeout, and `synchronous=NORMAL` are enabled.
- Status/confidence columns have SQL checks; arrays/links/references are JSON.
- All lists sort by `updated_at DESC, id ASC`.
- Reverse JSON filters additionally require a live target row.
- No foreign keys, join tables, cascade triggers, full-text indexes, or schema
  migration framework are introduced.
- There are no capability-specific maximum lengths/counts for text, arrays, or
  link/reference lists. Transport, SQLite, and Knowledge/provider limits still
  apply.

The service validates JSON content before its own writes. The concrete store
port assumes canonical records from the runtime and does not independently
validate arbitrary handcrafted JSON values.

## Error and logging invariants

- Adapter-safe domain errors use stable codes `not_found`, `invalid_input`, and
  `invalid_operation`.
- HTTP maps them to 404, 400, and 409 respectively; unknown exceptions map to a
  generic 500 response.
- Runtime and endpoint code use the shared Logger and do not call `console`.
- Runtime logs expose IDs, actor, states, counts, Knowledge outcomes, attempts,
  and durations needed for smoke/performance diagnosis.
- Logs do not include Question text/Context/answer, Hypothesis statement/
  rationale, Finding claim, assumptions, notes, resource locators, or URLs.
- Endpoint failure telemetry records error class rather than echoing request
  content; unknown responses do not disclose internal messages.

## Scope and authorization boundary

Accepted-only registry checks prevent a known proposed/rejected/deleted Finding
ID from becoming a scoped resource. Frozen scope enforcement in Knowledge/
Derived Outputs further constrains reads to descriptors already in the
manifest.

This is resource-state and retrieval containment, not end-user authorization.
The capability uses one configured actor for attribution and does not implement
per-record ACLs. Authentication/authorization must be enforced by transport or
an owning platform boundary.

## Regression coverage

[`investigation.test.ts`](../../../../test/capabilities/investigation.test.ts)
is the focused capability suite. It covers three-table initialization;
Question answer/filter/deletion behavior; multi-Question Hypotheses and live
reverse filtering; Finding references, all four relationship values, review,
and derived reverse views; invalid input/operation errors; idempotent
acceptance, metadata-only no-op behavior, claim refresh/removal, and an
accept-versus-edit race; log redaction; accepted-only registry resolution/read;
all 23 endpoint queue policies and ingress rejection; and a linked
Question/Hypothesis/Finding create-list-delete flow over a real HTTP listener.

Knowledge-dependent lifecycle tests use a controlled fake so correctness does
not depend on external embedding/provider availability. The HTTP-listener test
uses real job/transport wiring with that same local runtime/store harness.

## Non-goals

Current non-goals include a persisted Investigation aggregate; independent
Question/Hypothesis/Finding services or databases; runtime projection objects;
a generic Source entity; immutable answer or Finding revisions; relationship
entities/mirrored arrays; cascading relationship cleanup; evidence gates on
Hypothesis status; calibrated probability claims; automatic webpage change
detection; detailed review history; record restore/archive states; a general
mutation conflict system; durable cross-store workflow orchestration; automatic
Research/Derived Output promotion; and end-user authorization.
