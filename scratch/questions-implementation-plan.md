# Questions Implementation Plan

## Goal

Implement Questions as a small project-scoped capability with one mutable
current answer and a non-persisted runtime projection. The implementation must
use `context`, `currentAnswer`, optional plain-text assumptions, and exactly the
`open`, `proposed`, and `answered` statuses.

This plan does not add an Answer entity, answer revisions, approval metadata,
archive state, Question-owned Finding/Hypothesis arrays, or a Question-specific
concurrency system.

## Dependency order

1. Implement the persisted Question contract, store, and core service without
   Findings or Hypotheses dependencies.
2. Implement the Hypothesis and Finding core services, which own their own
   relationship fields.
3. Construct `QuestionRuntimeAssembler` with narrow Findings and Hypotheses
   readers after all three services exist.

Questions therefore remains useful by itself, and runtime composition does not
create circular service constructors.

## Files

Add:

```text
apps/backend/src/1-init/create/questions.ts
apps/backend/src/3-capabilities/questions/types.ts
apps/backend/src/3-capabilities/questions/store.ts
apps/backend/src/3-capabilities/questions/sqlite-store.ts
apps/backend/src/3-capabilities/questions/questions.ts
apps/backend/src/3-capabilities/questions/runtime.ts
apps/backend/src/3-capabilities/questions/index.ts
apps/backend/src/3-capabilities/questions/docs/README.md
apps/backend/src/3-capabilities/questions/docs/concepts.md
apps/backend/src/3-capabilities/questions/docs/types.md
apps/backend/src/3-capabilities/questions/docs/runtime.md
apps/backend/src/3-capabilities/questions/docs/flows.md
apps/backend/src/3-capabilities/questions/docs/invariants.md
apps/backend/src/4-job-wiring/questions/registerQuestionEndpoints.ts
apps/backend/test/capabilities/questions.test.ts
```

Update only the backend aliases, `startBackend.ts`, and smoke test needed to
compose and expose the capability.

## Phase 1 — Persisted contract

Create `types.ts` with:

- `QuestionStatus = "open" | "proposed" | "answered"`;
- persisted `Question` fields `id`, `text`, optional `context`, optional
  `currentAnswer`, `assumptions`, status, tags, actor/timestamps, and
  `deletedAt`;
- create/update requests and typed not-found/input errors; and
- `RuntimeQuestion`, whose related objects are runtime-only.

Normalize omitted assumptions and tags to empty arrays. Limit validation to
the necessary invariants:

- `text` is non-empty;
- an answer proposal is non-empty;
- `open` has no `currentAnswer`;
- `proposed` and `answered` have one; and
- unsupported status/input shapes are rejected.

Do not split `context` into framing/background/constraint fields. Do not add
assumption IDs or validation beyond plain strings. Do not add answer timestamps,
approval fields, or an immutable revision type.

## Phase 2 — Project-scoped store

Implement the prefixed SQLite table from the design with `context`,
`current_answer`, `assumptions_json`, the exact status check, standard actor and
time columns, and `deleted_at`.

The store supports get, list by status/tag, insert, last-write update, and soft
delete. Ordinary reads exclude deleted rows and order lists by `updatedAt`
descending. It must not contain Finding IDs, Hypothesis IDs, answer history,
approval state, or archive state.

No compatibility migration is needed because the capability is not currently
implemented. The design-document names `description` and `answer` are not a
persisted schema to migrate.

## Phase 3 — Core service and answer lifecycle

Implement `QuestionService` with Store, ID/clock/actor context, and Logger:

1. `create` writes an `open` Question without a current answer.
2. `update` edits only text, context, assumptions, and tags.
3. `proposeAnswer` sets/replaces `currentAnswer` and moves to `proposed`.
4. `confirmAnswer` represents explicit human confirmation and moves a Question
   with a current answer to `answered`; repeating it is harmless.
5. `clearAnswer` removes `currentAnswer` and moves to `open`.
6. `get`, `list`, and `delete` follow normal soft-delete behavior.

Run all authored mutations through the serial queue for deterministic
last-write-wins order. Reads remain concurrent. The service does not create a
revision log or infer factual correctness from the `answered` status.

Log operation, Question ID, actor ID, prior/next status, assumption/tag counts,
outcome, and duration. Do not log text, context, assumption text, or answer
content. Never call `console`.

## Phase 4 — Runtime Question assembly

Implement `QuestionRuntimeAssembler` in `runtime.ts`. Inject:

- the Question reader;
- `FindingService.listForQuestion`; and
- `HypothesisService.list({ questionId })` through a narrow reader.

For a live Question, return:

- the persisted Question, including `context`, `currentAnswer`, assumptions,
  and status;
- live related Findings with the optional relationship stored on each
  `FindingQuestionLink`; and
- live Hypotheses whose `questionIds` contain the Question ID.

Preserve the relationship direction: `supports` still means the Finding
supports the Question. Do not persist this projection or write reverse IDs to
the Question. Omit deleted/unavailable related objects without cascading or
rewriting their owning records.

## Phase 5 — Composition, endpoints, and docs

Construct the core service first in `1-init/create/questions.ts`. After
Hypotheses and Findings are constructed, create its runtime assembler and pass
both to endpoint wiring. Register package/TypeScript aliases and startup health
logging.

Register:

| Endpoint | Queue |
|---|---|
| `POST /questions/create` | serial |
| `POST /questions/update` | serial |
| `POST /questions/propose-answer` | serial |
| `POST /questions/confirm-answer` | serial |
| `POST /questions/clear-answer` | serial |
| `GET /questions/get` | concurrent |
| `GET /questions/list` | concurrent |
| `GET /questions/runtime` | concurrent |
| `DELETE /questions/delete` | serial |

Map not-found to 404 and invalid input/operations to 400. Do not expose a
generic arbitrary-status endpoint, archive/reopen endpoint, approval field, or
answer-history endpoint.

Create the capability `docs/` set from the settled design. Its runtime and
flows documents must show the persisted/runtime boundary and the two derived
reverse queries.

## Phase 6 — Tests and completion checks

Add focused tests for:

- create/update/get/list and soft-delete exclusion;
- `context` and `currentAnswer` wire/persistence names;
- zero/multiple plain-text assumptions;
- `open -> proposed -> answered`, revised answer back to `proposed`, and clear
  back to `open`;
- confirmation requiring a current answer and representing the human-approved
  state without another field;
- serial last-write-wins answer/content mutations;
- runtime assembly of related Findings and Hypotheses;
- each optional Finding relationship value plus an unclassified relationship;
- preserved Finding-to-Question direction in the reverse view;
- deleted related objects omitted without relationship rewrites;
- absence of archive/deleted statuses and answer revision structures; and
- structured logs containing no Question or answer content.

Extend the HTTP smoke test to create a Question with context/assumptions,
propose and confirm an answer, fetch the runtime projection after related
objects exist, clear the answer, and soft-delete the Question.

Run the focused capability test, the complete backend test suite, backend
typecheck, and `git diff --check`. Search the new capability and wiring for
`description`, bare persisted `answer`, `archived`, answer revision types, and
`console`; none should remain outside explicit negative-test text.
