# Findings Implementation Plan

## Goal

Implement Findings as a small project-scoped capability for curated,
reference-grounded claims. Findings owns its two classified relationship lists,
per-reference review flags, lifecycle, and idempotent admission of accepted
claims into Knowledge.

This plan does not add a Source capability, generic relationship graph,
Finding-level staleness field, reference review history, automatic webpage
change detection, content revisions, or a new concurrency framework.

## Dependency order

1. Export the Findings contracts, especially `FindingRelationship`, so the
   Question and Hypothesis runtime projections can import the same type.
2. Implement the Findings store and core service independently of Questions
   and Hypotheses; links are project-local IDs and do not require foreign keys.
3. Add the Knowledge and Context integrations.
4. After all three core capabilities exist, expose Findings read projections to
   the Question and Hypothesis runtime assemblers.

This order avoids circular service construction and stores every relationship
once.

## Files

Add:

```text
apps/backend/src/1-init/create/findings.ts
apps/backend/src/3-capabilities/findings/types.ts
apps/backend/src/3-capabilities/findings/store.ts
apps/backend/src/3-capabilities/findings/sqlite-store.ts
apps/backend/src/3-capabilities/findings/findings.ts
apps/backend/src/3-capabilities/findings/index.ts
apps/backend/src/3-capabilities/findings/docs/README.md
apps/backend/src/3-capabilities/findings/docs/concepts.md
apps/backend/src/3-capabilities/findings/docs/types.md
apps/backend/src/3-capabilities/findings/docs/runtime.md
apps/backend/src/3-capabilities/findings/docs/flows.md
apps/backend/src/3-capabilities/findings/docs/invariants.md
apps/backend/src/4-job-wiring/findings/registerFindingsEndpoints.ts
apps/backend/test/capabilities/findings.test.ts
```

Update the exact composition seams: backend package/TypeScript aliases,
`startBackend.ts`, the runtime resource/Context resolver, and the HTTP smoke
script. Do not modify unrelated capabilities except for those narrow
registrations.

## Phase 1 — Contracts and ingress validation

Create `types.ts` with:

- `Finding`, `FindingStatus`, requests, and typed not-found/input errors;
- the exported `FindingRelationship` union with exactly `supports`, `refutes`,
  `qualifies`, and `contextualizes`;
- `FindingQuestionLink` and `FindingHypothesisLink`, each with optional
  `relationship`;
- the two-branch `FindingReference` union:
  - resource: `resourceKind`, `resourceId`, optional `locator`, and optional
    `resourceRevision: number | string`;
  - URL: `href` and required `observedAt`;
- optional character/line span, note, and `needsReview`; and
- the pure `findingNeedsReview` helper.

Validate only the contract boundary:

- non-empty claim and at least one reference;
- required resource identity or HTTP(S) URL plus valid observation time;
- a native revision for every known resource kind whose owner exposes one,
  while allowing omission for resource kinds that expose no revision;
- safe span bounds and reference indices;
- exact status and relationship values; and
- duplicate target IDs within each Finding link list.

Preserve the owning capability's revision scalar. Do not resolve every resource
or fetch any URL during validation. Do not require references to be Knowledge
sources.

## Phase 2 — Project-scoped store

Implement the prefixed SQLite table described in the design with JSON columns
for references, tags, Question links, and Hypothesis links. Ordinary `get` and
`list` exclude `deleted_at` rows. Add only the active status/update-time and
accepted `knowledge_source_id` indexes.

The store must support:

- insert, get, filtered list, last-write update, and soft delete;
- filtering by `status`, `questionId`, or `hypothesisId`;
- replacing one reference flag under the current serialized aggregate; and
- a conditional acceptance write that succeeds only while the stored claim is
  the claim that was indexed.

The conditional write can compare the current claim in its `WHERE` clause. It
does not require a public Finding revision, a persisted digest, CAS framework,
link table, or JSON index. Add those only if actual measurements later require
them.

## Phase 3 — Core service and review operations

Implement `FindingService` with Store, Knowledge, ID/clock/actor context, and
Logger dependencies.

1. `propose` creates a `proposed` Finding and normalizes omitted collections to
   empty arrays.
2. `update` applies the whole requested aggregate change in serial
   last-write-wins order.
3. `markReferenceForReview` sets one reference's flag by current array index.
4. `clearReferenceReview` clears that flag after validation.
5. `listForQuestion` and `listForHypothesis` return live Findings plus the same
   optional Finding-to-target relationship.
6. `unaccept`, `reject`, and `delete` remove an admitted claim when necessary,
   then persist the requested status or tombstone.

Review operations change no claim, status, or Finding-level stale field. Do not
add automatic owner notifications in the first implementation. An existing
owner may call the mark operation later through a narrow hook when it already
knows content changed.

All operations log structured metadata: operation, Finding ID, status
transition, reference/link counts, review-needed count, Knowledge outcome, and
duration. Do not log claims, reference notes, resource locators, or URLs. Never
call `console`.

## Phase 4 — Concurrent, idempotent acceptance

Implement `accept` as the one concurrent Finding mutation:

1. Read the current non-deleted Finding and hash its claim.
2. Call `knowledge.add` with stable `sourceId = finding:{id}`, label `finding`,
   the claim digest as Knowledge revision, and the claim text.
3. Conditionally set `status = accepted` and `knowledgeSourceId` only if the
   stored claim still matches the indexed claim.
4. If a serial edit won the race, reload and repeat with the current claim. If
   the Finding was deleted, remove the transient Knowledge source best-effort
   and return not found.

Two callers accepting the same claim use the same source ID and revision, so
Knowledge skips duplicate ingestion and both calls converge on the same
accepted state. Put a concise code comment beside this loop explaining the
idempotency and accept/edit race rule.

For an accepted claim edit, call `knowledge.add` with the same source ID and
the new claim digest; Knowledge performs the upsert. Metadata-only edits do not
re-index. `unaccept`, rejection of an accepted Finding, and deletion remove the
stable source.

## Phase 5 — Composition, Context, endpoints, and docs

Construct Findings in `1-init/create/findings.ts`, register its aliases, compose
it after Knowledge, and register its endpoint group in `startBackend.ts`.

Extend the existing runtime resource resolver only enough for a live accepted
`ContextEntry { id, kind: "finding" }` to resolve to
`Finding.knowledgeSourceId`. Proposed, rejected, missing, and deleted Findings
resolve to no Knowledge source.

Register the design's exact static endpoints:

| Endpoint | Queue |
|---|---|
| `POST /findings/propose` | concurrent |
| `POST /findings/accept` | concurrent |
| `POST /findings/update` | serial |
| `POST /findings/unaccept` | serial |
| `POST /findings/reject` | serial |
| `POST /findings/mark-reference-review` | serial |
| `POST /findings/clear-reference-review` | serial |
| `GET /findings/get` | concurrent |
| `GET /findings/list` | concurrent |
| `DELETE /findings/delete` | serial |

Map not-found to 404 and invalid input/operation to 400. Keep IDs in query
strings or bodies because the transport does not implement path parameters.

Create the capability `docs/` set from the settled design. The runtime and
flows documents must include the acceptance race, Knowledge cleanup,
relationship ownership, reverse projection, and derived review behavior.

## Phase 6 — Tests and completion checks

Add focused tests for:

- create, update, get/list, status changes, and soft-delete exclusion;
- resource and URL references, native numeric/string revisions, required
  revisions for known revisioned kinds, and spans;
- unclassified links and all four relationships on both Question and
  Hypothesis links;
- reverse projections preserving Finding-to-target direction;
- mark/clear review and `findingNeedsReview` across multiple references;
- repeated concurrent accepts producing one Knowledge source;
- acceptance racing a claim edit and converging on the current claim;
- accepted claim upsert versus metadata-only update;
- Knowledge removal on unaccept, reject, and delete;
- accepted-only Context resolution;
- rejected unsupported status/relationship/reference inputs; and
- structured logs containing no claim, note, locator, or URL content.

Extend `test/smoke/http-smoke.mjs` to propose a Finding, accept it twice, read
it, mark and clear a reference review flag, filter it by a relationship target,
and delete it.

Run:

```text
pnpm --filter @icarus/backend exec tsx --conditions=development --test test/capabilities/findings.test.ts
pnpm --filter @icarus/backend test
pnpm --filter @icarus/backend typecheck
git diff --check
```

Finally search the new capability and wiring for `console` and confirm every
mutation/read emits the intended Logger event.
