# Investigation Implementation Report

## Outcome

The Investigation design is implemented as one project-scoped capability. It
owns Questions, Hypotheses, and Findings through one public
`InvestigationRuntime`, one `InvestigationStore`, and one SQLite connection that
creates all three project-prefixed tables together.

There are no standalone Findings, Questions, or Hypotheses capabilities,
aliases, services, databases, runtime projection types, or relationship
assemblers.

## What changed

### Capability

`apps/backend/src/3-capabilities/investigation/` now contains:

- the canonical `Question`, `Hypothesis`, and `Finding` types, request/filter
  types, exact enums, review derivation, and the small shared error family;
- one flat `InvestigationRuntime` with every Question, Hypothesis, and Finding
  operation;
- one synchronous store port;
- one WAL-enabled `better-sqlite3` store that initializes the Questions,
  Hypotheses, and Findings tables in one transaction; and
- a structured capability documentation set.

Questions use `open`, `proposed`, and `answered`, with one mutable
`currentAnswer`. Hypotheses use `proposed`, `accepted`, `refuted`, and
`inconclusive`, plus the optional five-value `confidenceLevel`. Findings use
`proposed`, `accepted`, and `rejected`.

Finding links are authoritative. A Finding owns `questionLinks` and
`hypothesisLinks`; a Hypothesis owns `questionIds`. Reverse traversal is a
filtered query and does not maintain mirrored arrays. Deleting a target makes a
reverse filter return an empty list without cascading or rewriting the owning
record.

### Finding references and Knowledge

Findings store lightweight resource or URL references rather than a generic
Source entity. URL references require an observation timestamp. Known
revisioned resource kinds require the owning resource's numeric or string
revision. Reference review remains one optional `needsReview` flag per
reference, and Finding staleness is derived with `findingNeedsReview`.

Accepted Findings use the stable Knowledge source ID `finding:{findingId}` and
a SHA-256 claim digest as the Knowledge revision. Acceptance is concurrent and
idempotent. Its conditional SQLite write compares the claim that was indexed;
if an edit wins during ingestion, acceptance reloads and admits the newer
claim. Finding mutations reconcile the stable source against the final live
record so a concurrent acceptance cannot leave the database and Knowledge in
different states.

An accepted claim edit refreshes the existing source. Accepted metadata-only
edits do not call Knowledge. Unaccept, rejection, and deletion remove the
source. These rules are implemented without a Finding revision, lock manager,
or additional lifecycle state.

### Composition and HTTP

Startup now constructs one Investigation runtime after Knowledge, registers it
with the existing runtime resource registry, reports `investigationReady`, and
registers one endpoint group.

The registrar exposes 23 routes under the existing `/questions/*`,
`/hypotheses/*`, and `/findings/*` paths. Reads use the concurrent queue;
authored mutations use the serial queue; independent Finding proposal and the
claim-guarded acceptance operation use the concurrent queue.

Only live accepted Findings resolve as `{ id, kind: "finding" }`. Scoped
resource listing and reading can describe that resource and read its claim;
proposed, rejected, and deleted Findings do not resolve.

### Validation and logging

The shared endpoint registrar decodes all transport input and maps stable
Investigation errors. The runtime repeats the necessary domain checks for
in-process callers: required core text, exact enums, reference identity and
bounds, HTTP(S) URLs and observation times, required owner revisions, and valid
review indices. Relationship and Question ID lists are de-duplicated.

Runtime and endpoint events use the injected Logger under
`investigation.questions.*`, `investigation.hypotheses.*`, and
`investigation.findings.*`. Logs contain identifiers, actor, status changes,
counts, outcomes, timing, and safe error metadata. Tests verify that authored
question/answer text, hypotheses, claims, assumptions, commentary, notes, and
URLs do not appear in those logs. Investigation code does not call `console`.

## Verification

The focused Investigation suite contains 11 tests and passed in 403 ms. It
covers schema creation, all three domain flows, filters and deleted-target
behavior, validation, review derivation, Knowledge idempotency and cleanup, an
accept/edit race, log redaction, every endpoint queue policy, and a real HTTP
listener smoke flow. The HTTP flow itself completed in about 83 ms in that run.

The complete backend suite also passed: 166 tests in 4.10 seconds.

Focused TypeScript compilation of the capability, startup factory, resource
registry integration, and endpoint registrar passes. The repository-wide
typecheck remains blocked by an unrelated baseline issue:
`3-capabilities/slide/index.ts` imports the absent
`application/slideService.js`. No Investigation TypeScript errors remain when
the affected files are compiled directly.

`apps/backend/test/smoke/http-smoke.mjs` now includes a longer service-level
Investigation scenario: two Questions, a multi-Question Hypothesis, a linked
Finding, reverse traversal, reference review, repeated acceptance, Question
answer confirmation, Hypothesis assessment, and soft-deletion checks. The
focused suite's ephemeral HTTP test validates the same transport/wiring path
without depending on the unrelated full-startup Slide module.

## Deliberate non-goals

- No Investigation aggregate record or fourth table.
- No `RuntimeQuestion` or `RuntimeHypothesis` projection.
- No generic Source, answer revision, numeric confidence, relationship entity,
  mirrored reverse relationship, or automatic webpage-change detector.
- No migration from hypothetical separate capabilities; none existed.
- No Finding-specific lock, job graph, or conflict-resolution framework.
