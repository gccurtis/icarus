# Investigation Implementation Plan

## Goal

Implement one project-scoped Investigation capability that defines and manages
Questions, Hypotheses, and Findings through a single `InvestigationRuntime`.
The capability owns one SQLite connection and initializes three tables together
in one database.

This plan replaces the former separate Findings, Questions, and Hypotheses
plans. There will be no standalone services, stores, aliases, startup factories,
endpoint registrars, databases, or runtime projection types for those records.

## Settled architecture

- One public capability import: `#investigation`.
- One flat, entity-prefixed `InvestigationRuntime`.
- One canonical public `Question`, `Hypothesis`, and `Finding` type.
- One `InvestigationStore` and one `SQLiteInvestigationStore` connection.
- Three project-prefixed tables in `./data/investigation.db`.
- One startup factory and one endpoint-registration group.
- Finding owns classified Question/Hypothesis links.
- Hypothesis owns `questionIds`.
- Reverse traversal uses `listFindings` and `listHypotheses` filters.
- No `RuntimeQuestion`, `RuntimeHypothesis`, assemblers, reader ports, recursive
  domain graphs, or mirrored relationships.

No migration is required because none of the three former capability designs
has an implementation in the repository.

## Files

Add:

```text
apps/backend/src/1-init/create/investigation.ts

apps/backend/src/3-capabilities/investigation/
  index.ts
  domain/model.ts
  application/investigationRuntime.ts
  ports/investigationStore.ts
  persistence/sqliteInvestigationStore.ts
  docs/README.md
  docs/concepts.md
  docs/types.md
  docs/runtime.md
  docs/flows.md
  docs/invariants.md

apps/backend/src/4-job-wiring/investigation/
  registerInvestigationEndpoints.ts

apps/backend/test/capabilities/investigation.test.ts
```

Update only the required composition seams:

- `apps/backend/package.json` and `apps/backend/tsconfig.json` for
  `#investigation`;
- `apps/backend/src/1-init/startBackend.ts`;
- the runtime resource/Context resolver for accepted Findings; and
- `apps/backend/test/smoke/http-smoke.mjs`.

Do not add `3-capabilities/findings`, `questions`, or `hypotheses` directories.
Private logic may later be split inside `3-capabilities/investigation/` if file
size materially harms readability.

## Phase 1 — Unified contracts

Create `domain/model.ts` with all shared and record-specific types:

### Questions

- `Question` with `text`, optional `context`, optional `currentAnswer`, plain
  assumptions, tags, actor/timestamps, and `deletedAt`;
- exact status union `open | proposed | answered`;
- create/update requests and filters; and
- answer operations represented on `InvestigationRuntime`.

Do not add answer revisions, approval fields, archived/deleted statuses,
`answeredAt`, `answeredBy`, or reverse relationship arrays.

### Hypotheses

- `Hypothesis` with zero-or-more `questionIds`, statement, optional rationale,
  plain assumptions, actor/timestamps, and `deletedAt`;
- exact status union `proposed | accepted | refuted | inconclusive`;
- optional categorical `confidenceLevel` with exactly
  `strongly_refuted | weakly_refuted | uncertain | weakly_supported |
  strongly_supported`; and
- create/update requests and filters.

Do not add mandatory Question/Finding relationships, evidence gates, assumption
entities, a numeric score, `testing`, `supported`, or deletion status.

### Findings

- `Finding`, exact `proposed | accepted | rejected` status, requests, and
  filters;
- one exported `FindingRelationship` union with exactly `supports`, `refutes`,
  `qualifies`, and `contextualizes`;
- `FindingQuestionLink` and `FindingHypothesisLink` with optional
  `relationship`;
- resource references using `resourceKind`, `resourceId`, optional `locator`,
  and owner-native `resourceRevision: number | string` when the known owner
  exposes revisions;
- URL references with `href` and required `observedAt`;
- optional spans, notes, and `needsReview`; and
- pure `findingNeedsReview`.

Do not add a Source entity, Finding-level stale field, review state machine,
review history, link entity, or automatic webpage-change detector.

### Shared validation and errors

Add only necessary ingress checks:

- required non-empty Question text, Hypothesis statement, Finding claim, and at
  least one Finding reference;
- exact closed status, confidence, and relationship values;
- Question answer/status consistency;
- valid reference identity, URL/observation time, native revision requirement
  for known revisioned resource kinds, span bounds, and reference index;
- de-duplicated Hypothesis Question IDs and Finding target links; and
- normal project/actor context supplied by startup.

Define one small Investigation error family with entity-specific not-found
messages and shared invalid-input/operation errors.

## Phase 2 — One store and three tables

Define one flat `InvestigationStore` port with entity-prefixed methods for:

- Question insert/get/list/update/soft delete;
- Hypothesis insert/get/list/update/soft delete;
- Finding insert/get/list/update/soft delete;
- Finding filters by `questionId` and `hypothesisId`; and
- the conditional Finding acceptance write needed for the Knowledge race.

Do not export generic repositories or three store objects.

Implement `SQLiteInvestigationStore(projectId, "./data/investigation.db")` with
one `better-sqlite3` connection, WAL mode, and one schema initialization that
creates:

```text
inv_${prefix}_questions
inv_${prefix}_hypotheses
inv_${prefix}_findings
```

Apply all three `CREATE TABLE/INDEX IF NOT EXISTS` definitions together,
preferably in one SQLite transaction. Use the exact columns/checks from the
three settled domain designs.

Ordinary reads exclude `deleted_at` and lists order by `updated_at` descending.
Keep relationship arrays as JSON on their authoritative rows:

- Finding `question_links_json` and `hypothesis_links_json`;
- Hypothesis `question_ids_json`; and
- no reverse columns on Question or Hypothesis.

Initial reverse filters may inspect the bounded JSON arrays. Do not add foreign
keys, cascade behavior, join tables, JSON indexes, or an Investigation table
without measured need.

The conditional acceptance store method must write `accepted` and
`knowledge_source_id` only while the stored claim still equals the claim that
was indexed. Comparing the current claim is sufficient; do not add a public
Finding revision, generic CAS system, or persisted digest merely for this.

## Phase 3 — Single Investigation runtime

Implement `createInvestigationRuntime(store, knowledge, logger)` returning one
flat `InvestigationRuntime`.

### Question operations

1. `createQuestion` starts in `open` with no current answer.
2. `updateQuestion` edits text, context, assumptions, and tags.
3. `proposeQuestionAnswer` sets/replaces the answer and sets `proposed`.
4. `confirmQuestionAnswer` requires an answer and sets `answered`; repetition
   for the same answer is harmless.
5. `clearQuestionAnswer` removes the answer and sets `open`.
6. Get/list/delete follow ordinary soft-delete behavior.

### Hypothesis operations

1. `createHypothesis` starts in `proposed` with zero or more Question IDs.
2. `updateHypothesis` may change Question IDs, content, status, or categorical
   confidence.
3. Status/confidence remain explicit caller assessments with no Finding-count
   rule or transition engine.
4. Get/list/delete follow ordinary soft-delete behavior.

### Finding operations

1. `proposeFinding` creates an independent proposed record.
2. `updateFinding` applies the full authored change in serial last-write order.
3. Mark/clear review operations change one current reference flag by index and
   nothing else.
4. `listFindings({ questionId | hypothesisId })` provides reverse traversal
   while returning canonical Findings containing the authoritative links.
5. `unacceptFinding`, `rejectFinding`, and `deleteFinding` perform required
   Knowledge cleanup before persisting the status/tombstone.

All three sets of methods share the same store, actor/clock/ID helpers,
validation helpers, and Logger. They may call private functions across the same
capability; there are no narrow cross-capability ports.

Deleted/missing linked records are treated as absent by ordinary runtime reads.
A reverse filter first requires a live target and otherwise returns an empty
list. Do not cascade deletion or rewrite IDs in surviving authoritative
records.

## Phase 4 — Finding Knowledge and concurrency

Implement `acceptFinding` as the explicit concurrent/idempotent mutation:

1. Read the current live Finding and hash its claim.
2. Call `knowledge.add` with `sourceId = finding:{id}`, label `finding`, claim
   digest as Knowledge revision, and claim text.
3. Conditionally commit accepted state only if the stored claim still matches.
4. If a serial edit won, reload and repeat with the current claim.
5. If deletion won, remove any transient Knowledge source best-effort and
   return not found.

Concurrent callers accepting the same claim use one source ID/revision and
converge without duplicate indexing. Put a concise comment beside the retry
explaining this invariant.

An accepted claim edit calls `knowledge.add` with the same source ID and new
digest. Metadata-only edits do not re-index. Unaccept, rejection of an accepted
Finding, and deletion remove the stable Knowledge source.

Register Investigation with the existing resource/Context resolver so only a
live accepted `{ id, kind: "finding" }` maps to `knowledgeSourceId`.

## Phase 5 — Startup, endpoints, and logging

Add `createInvestigationRuntimeInstance(config, knowledge, logger)`:

1. construct `SQLiteInvestigationStore` once;
2. create `InvestigationRuntime` once; and
3. return that one runtime.

In `startBackend.ts`, construct Investigation after Knowledge, register its
accepted-Finding resolver, emit one `investigationReady` field, and pass the
same runtime to downstream consumers and endpoint wiring.

Implement one `registerInvestigationEndpoints(registry, investigation, logger)`
that registers all existing `/questions/*`, `/hypotheses/*`, and `/findings/*`
paths. Keep those paths; consolidation does not require an HTTP rename.

Remove `/questions/runtime` and `/hypotheses/runtime`. Relationship traversal
uses existing list filters:

- `/findings/list?questionId=...`
- `/findings/list?hypothesisId=...`
- `/hypotheses/list?questionId=...`

Queue policy:

- reads/lists are concurrent;
- authored Question/Hypothesis/Finding edits, status transitions, review
  changes, and deletes are serial;
- `proposeFinding` and `acceptFinding` are concurrent; and
- Finding operations that remove/refresh Knowledge remain serial except for
  the explicitly guarded acceptance flow.

Use one ingress/error mapper. Log under `investigation.questions.*`,
`investigation.hypotheses.*`, and `investigation.findings.*`. Include IDs,
actor, transitions, counts, outcomes, duration, and safe errors. Never log
Question/answer text, Hypothesis content, Finding claims, assumptions, notes,
locators, or URLs. Never call `console`.

## Phase 6 — Capability documentation

Create one `3-capabilities/investigation/docs/` set following repository
conventions:

- `README.md` — map and capability boundary;
- `concepts.md` — Question/Hypothesis/Finding roles and relationship ownership;
- `types.md` — all public types, requests, filters, and errors;
- `runtime.md` — the flat runtime and all methods;
- `flows.md` — creation, answer, assessment, acceptance, review, deletion, and
  reverse-query flows; and
- `invariants.md` — storage, relationships, status, revisions, concurrency,
  deletion, Knowledge, logging, and non-goals.

Do not create separate capability documentation trees for Findings, Questions,
or Hypotheses. The three scratch domain designs remain focused domain chapters;
`investigation-design.md` is authoritative for shared architecture.

## Phase 7 — Tests and verification

Add one `test/capabilities/investigation.test.ts`, organized into Question,
Hypothesis, Finding, and cross-domain sections.

### Question coverage

- create/update/get/list and soft-delete exclusion;
- `context`, `currentAnswer`, assumptions, and exact statuses;
- open/proposed/answered answer flow and serial last-write order;
- no archive, approval, answer revision, or runtime projection types.

### Hypothesis coverage

- zero, one, and multiple Question IDs;
- plain assumptions and optional rationale;
- exact four statuses and five confidence values;
- no Finding prerequisite, numeric confidence, or transition engine;
- list filtering by Question ID and soft-delete exclusion.

### Finding coverage

- resource/URL references, spans, native numeric/string revisions, and required
  revisions for known revisioned kinds;
- all four optional relationship meanings plus unclassified links for both
  target kinds;
- mark/clear review and derived `findingNeedsReview`;
- repeated concurrent acceptance converging on one Knowledge source;
- acceptance racing an edit and converging on the current claim;
- accepted claim upsert versus metadata-only update;
- Knowledge removal on unaccept/reject/delete; and
- accepted-only Context resolution.

### Cross-domain coverage

- `listFindings({ questionId })`, `listFindings({ hypothesisId })`, and
  `listHypotheses({ questionId })` return canonical objects from authoritative
  links;
- relationship direction is preserved and no reverse columns are written;
- deleted targets/related records are absent from ordinary reads without
  cascades;
- one store constructor creates all three tables in one database;
- one runtime and one registrar expose all operations; and
- structured logs contain no protected content.

Extend `test/smoke/http-smoke.mjs` with one coherent Investigation flow:

1. create Questions;
2. create a multi-Question Hypothesis;
3. propose a linked Finding;
4. exercise reverse filters and reference review;
5. accept the Finding twice;
6. propose/confirm a Question answer and assess the Hypothesis; and
7. soft-delete the three records and verify ordinary reads omit them.

Run:

```text
pnpm --filter @icarus/backend exec tsx --conditions=development --test test/capabilities/investigation.test.ts
pnpm --filter @icarus/backend test
pnpm --filter @icarus/backend typecheck
git diff --check
```

Finally search the implementation for:

- `RuntimeQuestion`, `RuntimeHypothesis`, and assembler/reader ports;
- `#findings`, `#questions`, and `#hypotheses` aliases;
- separate capability directories, stores, factories, registrars, or database
  paths;
- mirrored relationship fields; and
- `console`.

None should remain.
