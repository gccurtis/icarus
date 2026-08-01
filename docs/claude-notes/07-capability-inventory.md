# 07 · Capability Inventory

Nine directories under `3-capabilities`. Status column reflects what was measured on
2026-08-01 (see [09-verified-status.md](09-verified-status.md)).

| Capability | Shape | Endpoints | DB file | Revision model | Status |
| --- | --- | --- | --- | --- | --- |
| `document` | Layered | 2 | `documents.db` | Base + ChangeSets | Complete, well tested |
| `slide` | Layered | 2 | `slides.db` | Base + ChangeSets | **Missing application service** |
| `activity` | Layered | 2 | `activity.db` | Append-only + TTL leases | Ledger complete; Presence writes 501 |
| `connector` | Layered | 9 | `connector.db` | Atomic revisioned | Complete; filesystem provider only |
| `general-files` | Layered | 5 | `general-files.db` | Content-addressed | Complete |
| `context` | Flat | 21 | `contexts.db` | Atomic revisioned | Complete |
| `structured-data` | Flat | 15 | `structured-data.db` | Atomic revisioned | Complete |
| `derived-outputs` | Hybrid | 6 | `derived-outputs.db` | Attempt + settlement | Complete |
| `built-in` | Functions | 4 | — | Stateless | Complete |

---

## document

The reference implementation and by far the largest capability: 8,416 source lines plus
3,850 lines of tests.

**Aggregate.** `DocumentSnapshot { representationVersion: 1, revision, title, lifecycle,
pageLayout, styles, rows }`. Rows contain Blocks; ten block kinds: `text`, `code`, `quote`,
`prompt`, `divider`, `callout`, `list`, `table`, `image`, `chart`. Callouts, list items, and
table cells contain nested `DocumentRow[]`, so the tree is genuinely recursive (bounded by
`maxNestingDepth: 16`).

**Layout model.** Rows have `tracks: { blockId, widthUnits }[]` and a `blockGapTwips`;
`domain/layout.ts` resolves a block's width from track units after removing gaps. All
measurements are **twips** (1/1440 inch) — page default 12240×15840 (US Letter), margins 1440.
`BlockPlacement` is a 4-variant union (`after-block`, `between-blocks`, `in-row`, `new-row`)
whose optional `newRowId` is required in specific cases, documented inline.

**Styles.** A per-document `DocumentStyleRegistry` with `defaultStyleIdByBlockKind` and named
styles supporting `basedOnStyleId` inheritance and `systemRole: heading-1…6`. Ten defaults are
created by `createDefaultDocumentStyles()`.

**Operations.** 35 operation types across document/layout/style/row/block/rich-text/prompt/
list/table/image/visual families (`OPERATION_KEYS` in `wire/operationSchemas.ts` has a
matching entry for each, so the two cannot drift). Two are internal-only and rejected on `document.submit`:
`prompt.apply-derived-output` ("Derived Output adoption is internal settlement only") and any
operation that `introducesPrompt()` ("Prompt Blocks must be created through
prompt.create.request").

**Commands** (7): `document.create`, `document.submit`, `document.compensate`,
`prompt.create.request`, `prompt.update-definition`, `prompt.refresh.request`,
`formula.evaluate.request`.
**Queries** (4): `document.list`, `document.load`, `document.history`, `document.attempt`.
**Internal job intents** (7): compact, prompt.create.{compute,settle},
prompt.refresh.{compute,settle}, formula.evaluate.{compute,settle}.

**Tables** (10): `documents`, `command_receipts`, `delegated_command_claims`,
`identity_ledger`, `bases`, `change_sets`, `activity_outbox`, `attempts`, `prompt_outputs`,
`stage_receipts`.

**Tests**: `document-domain` (991), `document-application` (1490), `document-persistence`
(878), `document-wire` (491).

---

## slide

Mirrors Document file-for-file — same domain/application/ports/persistence/wire/projections
structure, `DeckSnapshot` instead of `DocumentSnapshot`, plus `domain/geometry.ts` for canvas
positioning and `DEFAULT_SLIDE_CANVAS`.

**`application/slideService.ts` does not exist.** `index.ts` line 1 re-exports
`createSlideCapability` from it. Everything else — domain (867-line reducer, 501-line
validation), persistence (1480-line store), wire (1178-line valueSchemas), projections,
`create/slide.ts`, both wiring files, and the `startBackend` references — is present and
compiles. Its own `docs/README.md` states this in the first heading: *"Implementation status:
incomplete and not runnable."*

Domain, wire, and persistence tests (571 + 567 + 735 lines) pass because they import the
concrete modules directly rather than the barrel.

Slide has five internal intents (no `formula.evaluate.*` pair — Slide does not do formula
settlement) and no Activity publisher wired.

---

## activity

Project-scoped append-only ledger plus a TTL Presence registry.

`ActivityTransaction { id, kind, resourceId?, operation, revision?, changeSetId?, actorId?,
origin, occurredAt, metadata? }`. On publish it is assigned a **monotonic project sequence**
from a singleton `meta` row and stored with an Activity-computed `transaction_digest`.
Re-publishing the same `id` with different content raises `ActivityTransactionConflictError`.

Presence leases (`sessionId`, 30 s default TTL) live in SQLite with an expiry index and are
explicitly *not* history.

**`POST /activity/command` returns 501 by design.** The wiring comment:

> Presence writes are deliberately rejected for now: the HTTP transport only provides
> per-request IDs and untrusted headers/body, not a stable authenticated session identity.

That is a security decision recorded in code rather than a TODO — a transport that can supply
a trusted session can replace the handler.

Document is currently the only wired producer, via the outbox described in
[05](05-async-attempt-pipeline.md). Tests: `activity.test.ts`, `activity-wiring.test.ts`.

---

## connector

Ingests external resources. `ConnectorEntry.id = sha256(providerKind + "::" + locator)` —
deterministic, so re-registering the same locator is idempotent and a soft-deleted connector
can be `restore()`d.

Kinds: `connector::{file,directory}::{text,other}`. Prose-text extensions (`txt md markdown
rst org tex html htm log`) are admitted to Knowledge; everything else is registered but not
indexed.

**Provider port**: `listItems(locator)` + `getReader(locator, itemKey)`, stateless — *"every
call re-connects to the external system"*. Readers are constructed per read with no retained
handles and support `read(range)`, `readAll()`, `readStream()`, `readLines(start, end)`.

Only `filesystemProvider` exists, and its docs mark it clearly as a development adapter:
*"it accepts paths readable by the backend process and is not a production containment or
authorization boundary."* **That is a real security consideration for any deployment.**

`ingestionState: active | pending | failed` plus `markIngestionState(id, state,
trackedKnowledgeSourceIds, at)` provides reconciliation when a Knowledge write and a store
write disagree. `syncing` is a persisted CAS flag; `resetSyncing()` recovers crashed locks.

Scheduled sync intervals: `5min | 30min | 2hr | 12hr`.

---

## general-files

Stores caller-supplied file transport strings. **Identity is `sha256(content)`** — uploading
identical content returns `{ kind: "reused" }` without a new row.

Update is wholesale replacement: `replace(previous, replacement, replacedAt)` atomically
activates the new content-addressed row (possibly reactivating a soft-deleted one) and retires
the old, linking them with `replacesId` / `replacedById`.

Same prose-extension list as Connector — and *deliberately duplicated*, with a comment in
both files: *"Standalone copy owned by this capability. Not imported from any other
capability — lists may intentionally diverge."* This is an explicit rejection of premature
sharing, consistent with the shared-contract rule.

Text-kind files get a `knowledgeSourceId`; other-kind files are stored opaquely (the model
notes content "may, by caller convention, contain base64"). No filesystem read, multipart
parser, or text extractor lives here — decoding is the caller's job.

---

## context

Named sets of typed resource references (`ContextEntry { id, kind }`), with **two scopes**
(`user` and `project`) in the same database file as separate tables.

- Lookups are **project-first with user fallback**.
- `resolve()` recursively expands `kind: "context"` entries into leaves, with a `seen` cycle
  guard and `maxResolveDepth` (10). Missing/deleted IDs are **silently omitted**.
- Pure set algebra: `combine` / `difference`, plus `compose(op, a, b)` which persists the
  result as an *anonymous* context named `~<uuid>` (listing excludes `~`-prefixed records
  unless `includeAnonymous=true`).
- `promote(id)` copies a user context into project scope, erroring on name conflict.

`ContextManager` **structurally satisfies `KnowledgeResourceResolver`**, which is why it can
be injected into Knowledge without either knowing about the other.

21 endpoints — the same 10 operations mirrored across `/user/contexts/*` and
`/project/contexts/*`, plus `POST /user/contexts/promote`.

---

## structured-data

The project's authority for Formula-visible named declarations. Five kinds: `variable`,
`function` (both carry formula source in `body`), and `table` / `record` / `list` (all three
share one `{ schema: FieldDef[], rows: DataRow[] }` storage shape, with `record` = one row and
`list` = one synthetic field).

Cells are `CellLiteral | { formula: string }`, so a collection cell can itself be a formula
resolved against the same snapshot.

Its docs record a removal worth knowing: *"Name Manager has been removed."* Formula language
names (built-ins, lambda locals) belong to Formula; every other project name comes from this
one Structured Data instance through `FormulaNameResolver`.

Display names are matched **case-insensitively** (`normalizeKey` = lowercase), so
`Revenue` and `revenue` collide — there is a test for it, and another asserting Formula
built-ins cannot be shadowed by casing.

15 endpoints, including three that go through Formula: `GET /structured-data/value/entry`,
`GET /structured-data/value/by-name`, and `POST /structured-data/evaluate` (ad-hoc source
against the current bindings). Unresolvable entries return **422 with a typed
`FormulaResolutionIssue`** rather than null.

---

## derived-outputs

Turns *prompt + Context scope* into an immutable, evidence-backed answer revision.

- `DerivedOutput` has a mutable `definition` (`prompt`, `contextEntries`,
  `stabilisationText`, `definitionRevision`) and an immutable revision chain.
- `stabilisationText` is a nice idea: after the first successful revision the answer text
  becomes the stabilisation input for the next refresh, damping drift. Users can hand-edit it.
- `DerivedEvidence` carries `resourceId`, `resourceKind`, `resourceRevision?`, a span
  (`{kind:"characters", start, end}` from lattice retrieval or `{kind:"lines", …}` from `read`
  tool calls), `sourceId?`, `relevanceRank`, and a one-sentence `contribution`. Evidence is
  validated against what was actually retrieved before publication.
- `status`: `ok | insufficient | contradiction` — the model is allowed to say the grounding
  did not support an answer.
- `freshness`: `current | stale | refreshing | failed`, a cached signal invalidated by
  Knowledge mutation events.
- Three idempotency claim tables (declare / refresh / definition-update) and the three-way CAS
  settle described in [05](05-async-attempt-pipeline.md).

`DerivedOutputRef { outputId, appliedRevision }` is the reference other capabilities embed —
Document's `PromptBlock` holds one.

---

## built-in

Four tiny pure functions plus their wiring, serving as operational endpoints *and* as the
worked example of each job mode:

| Endpoint | Queue | Mode | Purpose |
| --- | --- | --- | --- |
| `GET /health` | concurrent | inline | `ApiHealth` from `@icarus/shared` |
| `GET /health/queues` | concurrent | inline | Live `JobSchedulerState` + registered endpoint list |
| `POST /echo` | concurrent | inline | Request echo |
| `POST /audit` | serial | **deferred** | The only deferred job; sleeps 250 ms |

`GET /health/queues` is the practical debugging entry point — it returns serial/concurrent
depth, active counts, worker count, and the full route directory.
