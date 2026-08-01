# Hypotheses Implementation Plan

## Goal

Implement Hypotheses as a small project-scoped capability for proposed
explanations that may relate to zero, one, or many Questions. The persisted
model owns `questionIds`, statement, rationale, plain assumptions, one of four
statuses, and an optional five-level categorical confidence. Findings owns all
Finding-to-Hypothesis relationships.

This plan does not add nested Question aggregates, Finding IDs, assumption
entities, evidence gates, numeric confidence, automatic assessment, or a
Hypothesis-specific workflow engine.

## Dependency order

1. Implement the Hypothesis contract, store, and core service against plain
   Question IDs; no Question service is needed to persist them.
2. Implement Findings as the owner of Finding-to-Hypothesis links.
3. After Questions and Findings exist, construct
   `HypothesisRuntimeAssembler` with their narrow readers.

This keeps the core independently constructible and prevents bidirectional
relationship writes.

## Files

Add:

```text
apps/backend/src/1-init/create/hypotheses.ts
apps/backend/src/3-capabilities/hypotheses/types.ts
apps/backend/src/3-capabilities/hypotheses/store.ts
apps/backend/src/3-capabilities/hypotheses/sqlite-store.ts
apps/backend/src/3-capabilities/hypotheses/hypotheses.ts
apps/backend/src/3-capabilities/hypotheses/runtime.ts
apps/backend/src/3-capabilities/hypotheses/index.ts
apps/backend/src/3-capabilities/hypotheses/docs/README.md
apps/backend/src/3-capabilities/hypotheses/docs/concepts.md
apps/backend/src/3-capabilities/hypotheses/docs/types.md
apps/backend/src/3-capabilities/hypotheses/docs/runtime.md
apps/backend/src/3-capabilities/hypotheses/docs/flows.md
apps/backend/src/3-capabilities/hypotheses/docs/invariants.md
apps/backend/src/4-job-wiring/hypotheses/registerHypothesisEndpoints.ts
apps/backend/test/capabilities/hypotheses.test.ts
```

Update only backend aliases, `startBackend.ts`, and the smoke test required to
compose and expose the capability.

## Phase 1 — Persisted contract

Create `types.ts` with:

- `HypothesisStatus` containing exactly `proposed`, `accepted`, `refuted`, and
  `inconclusive`;
- `HypothesisConfidenceLevel` containing exactly `strongly_refuted`,
  `weakly_refuted`, `uncertain`, `weakly_supported`, and
  `strongly_supported`;
- persisted `Hypothesis` with `questionIds`, statement, optional rationale,
  assumptions, status, optional `confidenceLevel`, actor/timestamps, and
  `deletedAt`;
- create/update requests and typed not-found/input errors; and
- the non-persisted `RuntimeHypothesis` projection.

Normalize omitted `questionIds` and assumptions to empty arrays. Validate only
necessary shape and closed enums: non-empty statement, string IDs/assumptions,
and supported status/confidence values. De-duplicate Question IDs while
preserving caller order.

Do not require at least one Question or Finding. Do not add assumption IDs,
confidence per assumption, a `testing` state, a `supported` alias, a deleted
state, or numeric `confidenceScore` without a concrete later use.

## Phase 2 — Project-scoped store

Implement the prefixed SQLite table from the design with JSON columns for
`questionIds` and assumptions, exact status/confidence checks, standard actor
and time columns, and `deleted_at`.

The store supports get, list by status/Question ID, insert, last-write update,
and soft delete. Ordinary reads exclude deleted rows and order by `updatedAt`
descending. Initially filter the bounded `question_ids_json` list without a
join table or JSON index; measure before adding either.

Do not store Finding IDs or a reverse link table. No compatibility migration is
needed because the capability is not currently implemented.

## Phase 3 — Core service and assessment

Implement `HypothesisService` with Store, ID/clock/actor context, and Logger:

1. `create` writes a `proposed` Hypothesis with zero or more Question IDs.
2. `update` may replace Question IDs, statement, rationale, assumptions,
   status, or categorical confidence.
3. `get`, `list`, and `delete` follow ordinary soft-delete behavior.

Status and confidence are explicit caller assessments. The service does not
derive either from Finding counts, enforce transition paths, or require an
accepted Finding before accepting/refuting a Hypothesis. It also does not
silently mutate Questions.

Run authored mutations through the serial queue for deterministic
last-write-wins order. Reads remain concurrent.

Log operation, Hypothesis ID, actor ID, prior/next status, confidence level,
Question/assumption counts, outcome, and duration. Do not log statements,
rationales, or assumption text. Never call `console`.

## Phase 4 — Runtime Hypothesis assembly

Implement `HypothesisRuntimeAssembler` in `runtime.ts`. Inject:

- the Hypothesis reader;
- a narrow Question reader; and
- `FindingService.listForHypothesis`.

For a live Hypothesis, return:

- the persisted Hypothesis;
- live Questions resolved from `questionIds`; and
- live related Findings with the optional relationship stored on each
  `FindingHypothesisLink`.

Preserve relationship direction: `supports` means the Finding supports the
Hypothesis. Do not persist the runtime projection or a reverse `findingIds`
array. Omit deleted/unavailable related objects without cascading or rewriting
their owners.

## Phase 5 — Composition, endpoints, and docs

Construct the core service in `1-init/create/hypotheses.ts`. After Questions and
Findings are constructed, create its runtime assembler and pass both into
endpoint wiring. Register package/TypeScript aliases and startup health
logging.

Register:

| Endpoint | Queue |
|---|---|
| `POST /hypotheses/create` | serial |
| `POST /hypotheses/update` | serial |
| `GET /hypotheses/get` | concurrent |
| `GET /hypotheses/list` | concurrent |
| `GET /hypotheses/runtime` | concurrent |
| `DELETE /hypotheses/delete` | serial |

Map not-found to 404 and invalid input to 400. Do not add evidence-attachment,
confidence-calculation, transition, archive, or approval endpoints.

Create the capability `docs/` set from the settled design. The concepts and
runtime documents must explain multi-Question scope, categorical confidence,
Finding-owned relationships, and the persisted/runtime boundary.

## Phase 6 — Tests and completion checks

Add focused tests for:

- create/update/get/list and soft-delete exclusion;
- zero, one, and multiple Question IDs;
- plain-text assumptions and optional rationale;
- every exact status and categorical confidence value;
- absent confidence versus `uncertain`;
- rejection of stale `testing`, `supported`, numeric-only confidence, and
  unsupported values;
- status changes with no Findings attached;
- serial last-write-wins assessment/content edits;
- runtime assembly of live Questions and Finding relationships;
- unclassified Finding links and all four relationship meanings;
- preserved Finding-to-Hypothesis direction in the reverse view;
- deleted related objects omitted without synchronized writes; and
- structured logs containing no statement, rationale, or assumption content.

Extend the HTTP smoke test to create a multi-Question Hypothesis, update its
status/confidence, read the runtime projection after a related Finding exists,
list it by Question ID, and soft-delete it.

Run the focused capability test, complete backend test suite, backend
typecheck, and `git diff --check`. Search the new capability and wiring for a
singular persisted `questionId`, `testing`, `supported`, bare numeric
`confidence`, persisted `findingIds`, deletion statuses, and `console`; none
should remain outside explicit negative-test text.
