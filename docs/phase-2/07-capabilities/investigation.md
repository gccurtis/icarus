# 07 · Investigation

*Verified against source at commit ef6d462, 2026-08-09.*

Investigation is the capability for structured enquiry: it stores **Questions** (what is being
asked), **Hypotheses** (what might be true), and **Findings** (what the evidence says, with
citations), and it manages the lifecycles that move a record between those states — proposing and
confirming a Question's answer, accepting or rejecting a Finding, flagging a citation that needs
re-checking. It is one capability directory holding three record families behind **one** runtime
interface, **one** store port, **one** SQLite connection and **one** database file. There is no
`Investigation` record, no aggregate id, and no lifecycle for the capability itself — the name is a
boundary, not an entity. It is also the only path outside Connector and General Files that writes
into the Knowledge index, and it is the largest HTTP surface in the backend: **26 endpoints**, ten
more than the next-largest capability.

Nothing in the phase-1 archive describes this capability. `grep -rniE "investigation"` over the
archived tree returns thirteen hits in nine files, of which six refer to the built capability and
five of those are one line each; the archived inventory page
([phase-1/claude-notes/07-capability-inventory.md](../../phase-1/claude-notes/07-capability-inventory.md))
omits Investigation from its table entirely. This page is the first description of it.

---

## 1 · At a glance

| Property | Value |
| --- | --- |
| Shape | Layered — `domain/ application/ ports/ persistence/`. **No `wire/` package**; decoding lives in the job-wiring file |
| Endpoints | **26** — 17 POST, 6 GET, 3 DELETE. The largest single-capability HTTP surface in the backend, ten ahead of Structured Data's 16 |
| DB file | `data/investigation.db`, opened cwd-relative as `./data/investigation.db` |
| Tables | **4** — `_questions`, `_hypotheses`, `_findings`, `_history` (the shared revision-history table). **5 indexes** |
| Revision model | Typed current tables plus the shared history table. `revision` starts at 1 and is incremented **by the application layer** (`current.revision + 1`); the store archives the *previous* row as a `snapshot` at the *previous* revision before every write. Logical delete writes `snapshot@N` **and** `deleted@N+1`, then removes the current row |
| Optimistic concurrency | **None on the wire.** No `expectedRevision` field on any request. Serialisation comes from the serial job queue, plus one in-store compare primitive for Finding acceptance |
| Test files | `test/capabilities/investigation.test.ts` — **11 tests**, 781 lines, all passing |
| Source files / lines | **5 files / 2,222 lines** in the capability directory, plus `4-job-wiring/investigation/registerInvestigationEndpoints.ts` (846) and `1-init/create/investigation.ts` (22) |
| Module docs | 6 files, 1,587 lines, at [`src/3-capabilities/investigation/docs/`](../../../apps/backend/src/3-capabilities/investigation/docs/) |
| Status | Complete and wired. One code defect: the startup manifest log reports `count: 23` and omits three purge routes (§9.1) |

Per-file line counts:

| File | Lines |
| --- | ---: |
| [`application/investigationRuntime.ts`](../../../apps/backend/src/3-capabilities/investigation/application/investigationRuntime.ts) | 1,218 |
| [`persistence/sqliteInvestigationStore.ts`](../../../apps/backend/src/3-capabilities/investigation/persistence/sqliteInvestigationStore.ts) | 634 |
| [`domain/model.ts`](../../../apps/backend/src/3-capabilities/investigation/domain/model.ts) | 313 |
| [`ports/investigationStore.ts`](../../../apps/backend/src/3-capabilities/investigation/ports/investigationStore.ts) | 53 |
| [`index.ts`](../../../apps/backend/src/3-capabilities/investigation/index.ts) | 4 |

`index.ts` is four `export *` lines re-exporting `domain/model.js`, `ports/investigationStore.js`,
`persistence/sqliteInvestigationStore.js` and `application/investigationRuntime.js`. The subpath
aliases `#investigation` and `#investigation/*` are declared in both `apps/backend/package.json`
(imports) and `apps/backend/tsconfig.json` (paths).

Investigation has **no** internal job intents, **no** attempts table, **no** Activity outbox, and
**no** command-receipt / idempotency table. It publishes nothing into
[Activity](activity.md).

---

## 2 · Domain model

Everything in this section is from
[`domain/model.ts`](../../../apps/backend/src/3-capabilities/investigation/domain/model.ts).

### 2.1 The five vocabularies

Each is an exported `as const` array plus a derived union type, with a matching type guard.

| Const (line) | Type | Members, in declaration order |
| --- | --- | --- |
| `QUESTION_STATUSES` (`:1`) | `QuestionStatus` | `open`, `proposed`, `answered` |
| `HYPOTHESIS_STATUSES` (`:5`) | `HypothesisStatus` | `proposed`, `accepted`, `refuted`, `inconclusive` |
| `HYPOTHESIS_CONFIDENCE_LEVELS` (`:14`) | `HypothesisConfidenceLevel` | `strongly_refuted`, `weakly_refuted`, `uncertain`, `weakly_supported`, `strongly_supported` |
| `FINDING_STATUSES` (`:25`) | `FindingStatus` | `proposed`, `accepted`, `rejected` |
| `FINDING_RELATIONSHIPS` (`:29`) | `FindingRelationship` | `supports`, `refutes`, `qualifies`, `contextualizes` |

Guards `isQuestionStatus`, `isHypothesisStatus`, `isHypothesisConfidenceLevel`, `isFindingStatus`
and `isFindingRelationship` (`:255-271`) are thin wrappers over one private `isStringMember` helper
(`:250`).

**Deletion appears in no status union.** A deleted record is absence from the current table plus a
terminal `deleted` history row. There is no `trashed`, no `archived`, no soft-delete flag.

Two aliases carry intent without adding validation: `type ActorId = string` (`:38`) and
`type IsoTimestamp = string` (`:39`). `type InvestigationEntity = "question" | "hypothesis" |
"finding"` (`:273`) is the discriminator used for history rows and purge calls.

### 2.2 The three records

All fields are `readonly`.

**`Question`** (`:41`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | UUID from `randomUUID`, or the injected `generateId` |
| `text` | `string` | Required, non-empty after trimming |
| `context?` | `string` | Optional free text. `null` on update clears it |
| `currentAnswer?` | `string` | Set by `proposeQuestionAnswer`, removed by `clearQuestionAnswer` |
| `assumptions` | `readonly string[]` | Plain array — **not** trimmed, **not** deduplicated |
| `status` | `QuestionStatus` | Always `open` at creation |
| `tags` | `readonly string[]` | Trimmed, deduplicated, each non-empty |
| `revision` | `number` | Starts at 1 |
| `createdBy` / `updatedBy` | `ActorId` | Both are the composition-supplied actor |
| `createdAt` / `updatedAt` | `IsoTimestamp` | |

**`Hypothesis`** (`:56`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | |
| `questionIds` | `readonly string[]` | Trimmed, deduplicated, non-empty. **Existence is never checked** — a Hypothesis may name a Question that does not exist |
| `statement` | `string` | Required |
| `rationale?` | `string` | `null` on update clears it |
| `assumptions` | `readonly string[]` | Untrimmed, undeduplicated, as for Question |
| `status` | `HypothesisStatus` | `proposed` at creation; settable directly on update |
| `confidenceLevel?` | `HypothesisConfidenceLevel` | `null` on update clears it |
| `revision`, `createdBy`, `updatedBy`, `createdAt`, `updatedAt` | | as above |

**`Finding`** (`:115`)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | |
| `claim` | `string` | Required. **The only field ever indexed into Knowledge** (§6) |
| `references` | `readonly FindingReference[]` | **At least one is mandatory**, on propose and on every replacement |
| `commentary?` | `string` | `null` on update clears it |
| `status` | `FindingStatus` | `proposed` at creation |
| `tags` | `readonly string[]` | Trimmed, deduplicated, non-empty |
| `questionLinks` | `readonly FindingQuestionLink[]` | Deduplicated by target id |
| `hypothesisLinks` | `readonly FindingHypothesisLink[]` | Deduplicated by target id |
| `knowledgeSourceId?` | `string` | Written only by acceptance; always `finding:<id>` |
| `revision`, `createdBy`, `updatedBy`, `createdAt`, `updatedAt` | | as above |

### 2.3 Links

`FindingQuestionLink` (`:71`) is `{ questionId, relationship? }`; `FindingHypothesisLink` (`:77`)
is `{ hypothesisId, relationship? }`. The optionality is deliberate, and both comments say so
verbatim:

> `/** Omit when the Finding is relevant to the Question but unclassified. */`
> — `domain/model.ts:73`

> `/** Omit when the Finding is relevant to the Hypothesis but unclassified. */`
> — `domain/model.ts:79`

### 2.4 The two discriminated unions, in full

**`FindingReferenceSpan`** (`:83`) — two arms:

```ts
| { readonly kind: "characters"; readonly start: number; readonly end: number }
| { readonly kind: "lines";      readonly startLine: number; readonly endLine: number }
```

**`FindingReference`** (`:95`) — two arms:

```ts
| {
    readonly kind: "resource";
    readonly resourceKind: string;
    readonly resourceId: string;
    readonly locator?: string;
    readonly resourceRevision?: number | string;
    readonly span?: FindingReferenceSpan;
    readonly note?: string;
    readonly needsReview?: boolean;
  }
| {
    readonly kind: "url";
    readonly href: string;
    readonly observedAt: IsoTimestamp;
    readonly span?: FindingReferenceSpan;
    readonly note?: string;
    readonly needsReview?: boolean;
  }
```

Any other `kind` is rejected with `references[i].kind is unsupported`
(`investigationRuntime.ts:249`).

`needsReview` is the per-reference review flag. The only Finding-level review calculation in the
capability is the derived helper at `domain/model.ts:247`:

```ts
export const findingNeedsReview = (finding: Finding): boolean =>
  finding.references.some((reference) => reference.needsReview === true);
```

It is used only to populate the `needsReview` field of log records — it is not persisted, not
indexed and not exposed as a filter.

### 2.5 Request and filter types

| Type | Line | Notes |
| --- | ---: | --- |
| `CreateQuestionRequest` | 132 | `text` required; `context`, `assumptions`, `tags` optional |
| `UpdateQuestionRequest` | 139 | `context?: string \| null` — `undefined` keeps, `null` clears |
| `QuestionFilter` | 146 | `status?`, `tag?` |
| `CreateHypothesisRequest` | 151 | `statement` required |
| `UpdateHypothesisRequest` | 159 | `rationale` and `confidenceLevel` are nullable-to-clear; `status` is settable directly |
| `HypothesisFilter` | 168 | `questionId?`, `status?` |
| `ProposeFindingRequest` | 173 | `claim` and `references` required |
| `UpdateFindingRequest` | 182 | `commentary?: string \| null` |
| `FindingFilter` | 191 | `status?`, `questionId?`, `hypothesisId?` |

`InvestigationRuntimeContext` (`:198`) is the construction context, introduced by its own comment:

> `/** Runtime attribution and deterministic seams used by tests. */`
> — `domain/model.ts:197`

```ts
interface InvestigationRuntimeContext {
  readonly actorId: ActorId;
  readonly now?: () => IsoTimestamp;
  readonly generateId?: () => string;
}
```

Production supplies only `actorId` (`1-init/create/investigation.ts:19-21`); `now` and
`generateId` exist so tests can pin timestamps and ids.

### 2.6 Errors

`InvestigationErrorCode = "not_found" | "invalid_input" | "invalid_operation"` (`:275`). The base
class exists for one stated reason:

> `/** Stable base error used by HTTP and other adapters without matching messages. */`
> — `domain/model.ts:280`

| Class | Line | Code | Message |
| --- | ---: | --- | --- |
| `InvestigationError(code, message)` | 281 | as given | as given |
| `InvestigationNotFoundError(entity, id)` | 291 | `not_found` | `` `${entity} ${id} was not found` `` |
| `InvestigationInvalidInputError(message)` | 301 | `invalid_input` | as given |
| `InvestigationInvalidOperationError(message)` | 308 | `invalid_operation` | as given |

A fifth, private class lives in the wiring layer: `InvestigationIngressError`
(`registerInvestigationEndpoints.ts:46`), thrown by the body/query decoders and mapped to 400. It
is not exported and not part of the capability's public error vocabulary.

---

## 3 · Operations

### 3.1 `InvestigationRuntime` — 28 methods

Declared at `domain/model.ts:205-245`, introduced by:

> `/** The one flat runtime used to manage all three Investigation record types. */`
> — `domain/model.ts:204`

Every method returns a `Promise` even though the SQLite store beneath it is entirely synchronous.

**Question — 9 methods**

| Method | Runtime line | Behaviour |
| --- | ---: | --- |
| `createQuestion(request)` | 426 | Status `open`, revision 1 |
| `updateQuestion(id, request)` | 463 | Field-wise merge; revision +1 |
| `proposeQuestionAnswer(id, currentAnswer)` | 514 | Sets `currentAnswer`, status → `proposed`, revision +1 |
| `confirmQuestionAnswer(id)` | 536 | Requires a non-blank `currentAnswer` else `invalid_operation`; **returns the record unchanged with no revision bump if the status is already `answered`** (`:544`) |
| `clearQuestionAnswer(id)` | 563 | Deletes `currentAnswer`, status → `open`, revision +1 |
| `getQuestion(id)` | 585 | `Question \| null` |
| `listQuestions(filter?)` | 595 | |
| `deleteQuestion(id)` | 614 | Logical delete |
| `purgeQuestion(id)` | 627 | One line: `store.purge("question", validateId(id))`. **Logs nothing** |

**Hypothesis — 6 methods**

| Method | Runtime line |
| --- | ---: |
| `createHypothesis(request)` | 631 |
| `updateHypothesis(id, request)` | 679 |
| `getHypothesis(id)` | 753 |
| `listHypotheses(filter?)` | 763 |
| `deleteHypothesis(id)` | 782 |
| `purgeHypothesis(id)` | 795 |

**Finding — 11 methods**

| Method | Runtime line | Behaviour |
| --- | ---: | --- |
| `proposeFinding(request)` | 799 | Status `proposed`, revision 1, at least one reference. No Knowledge call |
| `updateFinding(id, request)` | 839 | Revision +1. Re-indexes Knowledge only when the claim changed on an accepted Finding (§6.4) |
| `acceptFinding(id)` | 924 | Retry loop; idempotent; status → `accepted`, `knowledgeSourceId` set |
| `unacceptFinding(id)` | 1007 | `rejected` → `invalid_operation`; `accepted` → status `proposed`, `knowledgeSourceId` removed, Knowledge source removed, revision +1; **already `proposed` → no write, no revision bump** |
| `rejectFinding(id)` | 1044 | Status → `rejected`, `knowledgeSourceId` removed, revision +1 |
| `markFindingReferenceForReview(id, referenceIndex)` | 1076 | Sets `needsReview: true` on one reference; revision +1 |
| `clearFindingReferenceReview(id, referenceIndex)` | 1109 | Removes the `needsReview` key entirely; revision +1 |
| `getFinding(id)` | 1144 | |
| `listFindings(filter?)` | 1154 | |
| `deleteFinding(id)` | 1177 | Removes the Knowledge source first if accepted, then logically deletes |
| `purgeFinding(id)` | 1199 | |

**Shared retention — 2 methods**

| Method | Runtime line | Behaviour |
| --- | ---: | --- |
| `pruneHistory(cutoff)` | 1203 | Delegates straight to the store |
| `purgeExpired(cutoff)` | 1207 | Loops `store.expiredDeleted(cutoff)` and purges each; returns the count |

Investigation is bound into the retention sweep at `startBackend.ts:138` as
`bindResourceRetentionPort("investigation", investigation)`, fifth of eleven ports. See
[04-state-and-persistence.md](../04-state-and-persistence.md).

### 3.2 `InvestigationStore` — the port

[`ports/investigationStore.ts`](../../../apps/backend/src/3-capabilities/investigation/ports/investigationStore.ts),
53 lines, entirely synchronous. Header comment, verbatim (`:12-15`):

```ts
/**
 * Project-local persistence for all Investigation record types.
 * Current tables contain only live records; history is retained separately.
 */
```

Five methods per record family — `insert*`, `get*` (returns `| undefined`), `list*`, `update*`,
`delete*(record, deletedAt)` — plus three shared: `purge(resourceKind, id)`,
`pruneHistory(cutoff): number`, `expiredDeleted(cutoff)`.

One specialised primitive, with the comment that explains why it exists (`:42-45`):

```ts
/**
 * Atomically accepts a live Finding only while its persisted claim still
 * matches the text most recently admitted to Knowledge.
 */
acceptFindingIfClaimMatches(
  id, expectedClaim, knowledgeSourceId, updatedBy, updatedAt
): boolean;
```

`SQLiteInvestigationStore` also exposes `close()`
(`persistence/sqliteInvestigationStore.ts:210`), which is **not on the port** and is never called
outside tests — see [11-known-issues.md](../11-known-issues.md).

### 3.3 Validation, with the site that enforces each rule

All in
[`application/investigationRuntime.ts`](../../../apps/backend/src/3-capabilities/investigation/application/investigationRuntime.ts).

| Rule | Site |
| --- | --- |
| Required strings are non-empty **after trimming**, and are stored trimmed | `requiredString`, `:63-68` |
| Optional text: `undefined` keeps the current value, `null` clears it, anything else must be a string | `optionalTextField`, `:95-103` |
| Tags: array of strings, trimmed, deduplicated, each non-empty | `stringList(..., {trim, deduplicate, nonEmpty})` at `:440`, `:492`, `:812`, `:868` |
| Assumptions: a plain string array — **not** trimmed, **not** deduplicated | `:438`, `:655` |
| `questionIds`: trimmed, deduplicated, non-empty; **existence is not checked** | `:648`, `:715` |
| Timestamps must parse to a finite `Date`, and are re-emitted as `toISOString()` | `validateTimestamp`, `:108-115` |
| Character span: safe integers, `start >= 0`, `end > start` | `:126-140` |
| Line span: safe integers, `startLine >= 1`, `endLine >= startLine` | `:141-154` |
| URL references accept only `http:` and `https:` | `:230-240` |
| A `resourceRevision` is a positive safe integer **or** a non-empty string | `validateRevision`, `:164-179` |
| At least one reference is mandatory (`"references must contain at least one reference"`) | `validateReferences`, `:252-257` |
| Duplicate link targets collapse to one entry; the last classification wins | `Map`-based dedupe, `:259-282` and `:284-310` |
| `referenceIndex` must be a safe integer in `[0, references.length)` | `validateReferenceIndex`, `:312-321` |
| `confirmQuestionAnswer` requires a non-blank `currentAnswer` | `:539-543` |
| `unacceptFinding` on a `rejected` Finding is `invalid_operation` | `:1010-1014` |

**The revisioned-resource-kind rule.** `REVISIONED_RESOURCE_KINDS` (`:37-49`) is a hard-coded
`Set`:

```text
collection, connector-item, context, deck, derived-output, document, function,
general-file, slide, structured-data, variable
```

`ownerExposesRevisions` (`:159-162`) also matches the prefixes `connector::` and
`general::file::`. When a `kind: "resource"` reference names one of these, `resourceRevision`
becomes **required** (`:215-219`), with the message
`` `${label}.resourceRevision is required for resource kind ${resourceKind}` ``. Any other
`resourceKind` string is accepted with no revision and no existence check at all.

`deck` and `slide` are in that set and **no live capability can produce either** — see §9.4.

---

## 4 · Endpoints

All 26 are registered by
[`4-job-wiring/investigation/registerInvestigationEndpoints.ts`](../../../apps/backend/src/4-job-wiring/investigation/registerInvestigationEndpoints.ts),
846 lines, introduced by:

> `/** Registers the complete HTTP surface for the unified Investigation capability. */`
> — `registerInvestigationEndpoints.ts:469`

There are **22 `registry.register(` call sites**, three of which sit inside `for (const endpoint
of [...])` loops registering 2, 3 and 2 endpoints (lines 514, 695, 730): 22 − 3 + 7 = **26**.
Investigation is the only wiring file in the backend that wraps `register` in a loop, which is why
the repository-wide totals are **85 call sites but 89 endpoints**.

**Every endpoint is `responseMode: "inline"`.** Investigation registers no deferred jobs and no
internal job intents. Ids travel in the JSON body for POST and in the query string for GET and
DELETE, because the transport supports no path parameters
([02-request-and-job-runtime.md](../02-request-and-job-runtime.md)).

| # | Method | Path | Queue | Response | Job name | Runtime call | Success |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | POST | `/questions/create` | serial | inline | `investigation.questions.create` | `createQuestion` | 201, the Question |
| 2 | POST | `/questions/update` | serial | inline | `investigation.questions.update` | `updateQuestion` | 200 |
| 3 | POST | `/questions/propose-answer` | serial | inline | `investigation.questions.propose-answer` | `proposeQuestionAnswer` | 200 |
| 4 | POST | `/questions/confirm-answer` | serial | inline | `investigation.questions.confirm-answer` | `confirmQuestionAnswer` | 200 |
| 5 | POST | `/questions/clear-answer` | serial | inline | `investigation.questions.clear-answer` | `clearQuestionAnswer` | 200 |
| 6 | GET | `/questions/get?id=` | concurrent | inline | `investigation.questions.get` | `getQuestion` | 200, or an explicit 404 body |
| 7 | GET | `/questions/list?status=&tag=` | concurrent | inline | `investigation.questions.list` | `listQuestions` | 200 `{records}` |
| 8 | DELETE | `/questions/delete?id=` | serial | inline | `investigation.questions.delete` | `deleteQuestion` | 204, body `null` |
| 9 | POST | `/questions/purge` | serial | inline | `investigation.questions.purge` | `purgeQuestion` | 204, body `null` |
| 10 | POST | `/hypotheses/create` | serial | inline | `investigation.hypotheses.create` | `createHypothesis` | 201 |
| 11 | POST | `/hypotheses/update` | serial | inline | `investigation.hypotheses.update` | `updateHypothesis` | 200 |
| 12 | GET | `/hypotheses/get?id=` | concurrent | inline | `investigation.hypotheses.get` | `getHypothesis` | 200, or an explicit 404 body |
| 13 | GET | `/hypotheses/list?questionId=&status=` | concurrent | inline | `investigation.hypotheses.list` | `listHypotheses` | 200 `{records}` |
| 14 | DELETE | `/hypotheses/delete?id=` | serial | inline | `investigation.hypotheses.delete` | `deleteHypothesis` | 204 |
| 15 | POST | `/hypotheses/purge` | serial | inline | `investigation.hypotheses.purge` | `purgeHypothesis` | 204 |
| 16 | POST | `/findings/propose` | **concurrent** | inline | `investigation.findings.propose` | `proposeFinding` | 201 |
| 17 | POST | `/findings/update` | serial | inline | `investigation.findings.update` | `updateFinding` | 200 |
| 18 | POST | `/findings/accept` | **concurrent** | inline | `investigation.findings.accept` | `acceptFinding` | 200 |
| 19 | POST | `/findings/unaccept` | serial | inline | `investigation.findings.unaccept` | `unacceptFinding` | 200 (409 if rejected) |
| 20 | POST | `/findings/reject` | serial | inline | `investigation.findings.reject` | `rejectFinding` | 200 |
| 21 | POST | `/findings/mark-reference-review` | serial | inline | `investigation.findings.mark-reference-review` | `markFindingReferenceForReview` | 200 |
| 22 | POST | `/findings/clear-reference-review` | serial | inline | `investigation.findings.clear-reference-review` | `clearFindingReferenceReview` | 200 |
| 23 | GET | `/findings/get?id=` | concurrent | inline | `investigation.findings.get` | `getFinding` | 200, or an explicit 404 body |
| 24 | GET | `/findings/list?status=&questionId=&hypothesisId=` | concurrent | inline | `investigation.findings.list` | `listFindings` | 200 `{records}` |
| 25 | DELETE | `/findings/delete?id=` | serial | inline | `investigation.findings.delete` | `deleteFinding` | 204 |
| 26 | POST | `/findings/purge` | serial | inline | `investigation.findings.purge` | `purgeFinding` | 204 |

**Two endpoints run concurrent even though they mutate.** `POST /findings/propose` writes a fresh
row with a fresh id, so it contends with nothing. `POST /findings/accept` is concurrent
deliberately, because acceptance can block on a Knowledge embedding call; the safety comes from
`acceptFindingIfClaimMatches` rather than from the queue (§6). Every other mutation is serial. All
reads are concurrent. `investigation.test.ts:646` asserts `registry.listEndpoints().length === 26`
and then asserts all 26 queue policies individually.

Request bodies:

- create/update/propose/answer endpoints take the record fields, with `id` in the body for
  anything addressing an existing record;
- `mark-reference-review` and `clear-reference-review` take `{ id, referenceIndex }`, where
  `referenceIndex` must be a safe integer (`registerInvestigationEndpoints.ts:108-113`);
- the three purge endpoints take `{ id }` in the body;
- GET and DELETE read `?id=`, with list filters as further query parameters.

### 4.1 Error mapping

`errorResponse` (`:410-432`), in evaluation order:

| Error | Status | Body `error` |
| --- | ---: | --- |
| `ResourceNotDeletedError` | 409 | `not_deleted` |
| `ResourceHistoryNotFoundError` | 404 | `not_found` |
| `InvestigationIngressError` (private, wiring-layer) | 400 | `invalid_input` |
| `InvestigationError` with code `not_found` | 404 | `not_found` |
| `InvestigationError` with code `invalid_operation` | **409** | `invalid_operation` |
| `InvestigationError` with code `invalid_input` | 400 | `invalid_input` |
| anything else | 500 | `internal_error`, message fixed at `"Investigation request failed"` |

The first two rungs are the cross-capability contract shared by all ten wiring files that handle
retention errors. The 500 body never echoes the underlying message.

### 4.2 The `execute` wrapper and its logging

Every endpoint body runs inside `execute` (`:434-464`), which logs one record per request:

| Outcome | Level | Event |
| --- | --- | --- |
| No throw | debug | `<event>.completed` |
| Throw mapping to < 500 | warn | `<event>.rejected` |
| Throw mapping to ≥ 500 | error | `<event>.failed` |

Every record carries `requestId`, `statusCode`, `durationMs`, and on failure `errorName`.

Note the consequence for the three `get` endpoints: a missing record is **returned** as a 404
response object rather than thrown (`:550-552`, `:625-627`, `:769-771`), so it travels the success
path and is logged as `<event>.completed` with `statusCode: 404`. Only thrown errors produce
`.rejected` / `.failed`.

The wiring event names are not always the job names: the answer and reference-review endpoints log
with underscores (`investigation.questions.propose_answer`, `…confirm_answer`, `…clear_answer`,
`investigation.findings.mark_reference_review`, `…clear_reference_review`) while the registered job
names use hyphens.

### 4.3 Composition

[`1-init/create/investigation.ts`](../../../apps/backend/src/1-init/create/investigation.ts), 22
lines in full:

```ts
const INVESTIGATION_DB_PATH = "./data/investigation.db";

/** Constructs the one project-scoped runtime that owns all Investigation records. */
export const createInvestigationRuntimeInstance = (config, knowledge, logger) => {
  const store = new SQLiteInvestigationStore(config.projectId, INVESTIGATION_DB_PATH);
  return createInvestigationRuntime(store, knowledge, logger, { actorId: config.userId });
};
```

`startBackend.ts` touches Investigation at exactly six points: the two imports (`:28`, `:44`),
construction (`:71`), registration into the resource registry (`:72`), the retention port (`:138`),
the readiness flag `investigationReady` (`:159`), and endpoint registration (`:184`).

The construction cycle — Knowledge needs a resource resolver, the resolver needs Investigation,
Investigation needs Knowledge — is broken by creating an **initially empty**
`RuntimeResourceRegistry`, injecting it into Knowledge, then back-filling Investigation into it
after construction. See [01-layers-and-boundaries.md](../01-layers-and-boundaries.md).

---

## 5 · Persistence

One connection, one file, four tables:
[`persistence/sqliteInvestigationStore.ts`](../../../apps/backend/src/3-capabilities/investigation/persistence/sqliteInvestigationStore.ts).

> `/** One-connection SQLite persistence for all project-local Investigation data. */`
> — `sqliteInvestigationStore.ts:198`

**Table prefix** (`:34-45`): `` inv_${sha256(projectId).digest("hex").slice(0, 16)} ``. Multiple
projects can share one file without sharing rows; the original project id is never persisted, so a
database cannot say which project owns a prefix.

| Logical table | Physical name | Purpose |
| --- | --- | --- |
| questions | `inv_<16hex>_questions` | Live Questions only |
| hypotheses | `inv_<16hex>_hypotheses` | Live Hypotheses only |
| findings | `inv_<16hex>_findings` | Live Findings only |
| history | `inv_<16hex>_history` | The shared revision-history table, all three kinds |

**Pragmas** (`:114-116`): `journal_mode = WAL`, `busy_timeout = 5000`, `synchronous = NORMAL`.
There is **no `foreign_keys` pragma**, because Investigation declares no foreign keys anywhere. It
is the only store in the backend with exactly this three-pragma set; see
[04-state-and-persistence.md](../04-state-and-persistence.md) for the full census of the thirteen
WAL sites, which disagree with each other in six places.

All four tables are created inside **one** `db.transaction(...)` (`:118-195`) — unlike Slides,
which initialises its schema outside a transaction.

### 5.1 `_questions` (`:120-137`)

| Column | Type | Constraint |
| --- | --- | --- |
| `id` | TEXT | PRIMARY KEY |
| `text` | TEXT | NOT NULL |
| `context` | TEXT | nullable |
| `current_answer` | TEXT | nullable |
| `assumptions_json` | TEXT | NOT NULL DEFAULT `'[]'` |
| `status` | TEXT | NOT NULL `CHECK (status IN ('open','proposed','answered'))` |
| `tags_json` | TEXT | NOT NULL DEFAULT `'[]'` |
| `revision` | INTEGER | NOT NULL `CHECK (revision >= 1)` |
| `created_by`, `updated_by`, `created_at`, `updated_at` | TEXT | NOT NULL |

Index `<t>_recent` on `(status, updated_at DESC)`.

### 5.2 `_hypotheses` (`:139-167`)

Same skeleton, plus `question_ids_json TEXT NOT NULL DEFAULT '[]'`, `statement TEXT NOT NULL`,
`rationale TEXT`, a four-value `status` CHECK, and

```sql
confidence_level TEXT CHECK (
  confidence_level IS NULL OR confidence_level IN (
    'strongly_refuted','weakly_refuted','uncertain','weakly_supported','strongly_supported'))
```

Index `<t>_recent` on `(status, updated_at DESC)`.

### 5.3 `_findings` (`:169-192`)

| Column | Type | Constraint |
| --- | --- | --- |
| `id` | TEXT | PRIMARY KEY |
| `claim` | TEXT | NOT NULL |
| `references_json` | TEXT | NOT NULL — **no default**, mirroring the at-least-one-reference rule |
| `commentary` | TEXT | nullable |
| `status` | TEXT | NOT NULL `CHECK (status IN ('proposed','accepted','rejected'))` |
| `tags_json`, `question_links_json`, `hypothesis_links_json` | TEXT | NOT NULL DEFAULT `'[]'` |
| `knowledge_source_id` | TEXT | nullable |
| `revision` | INTEGER | NOT NULL `CHECK (revision >= 1)` |
| `created_by`, `updated_by`, `created_at`, `updated_at` | TEXT | NOT NULL |

Two indexes: `<t>_recent` on `(status, updated_at DESC)`, and the **partial** index
`<t>_knowledge_source` on `(knowledge_source_id) WHERE status = 'accepted'` — the only partial
index in this capability, and the one that makes "which Finding owns this Knowledge source"
cheap.

### 5.4 `_history`

Created by the shared helper `initializeResourceHistorySchema`
([`0-utils/persistence/resourceHistory.ts:42`](../../../apps/backend/src/0-utils/persistence/resourceHistory.ts)),
identical in every capability that has one:

```sql
resource_kind TEXT NOT NULL,
resource_id   TEXT NOT NULL,
revision      INTEGER NOT NULL CHECK (revision >= 1),
record_type   TEXT NOT NULL CHECK (record_type IN ('snapshot','deleted')),
snapshot_json TEXT,
recorded_at   TEXT NOT NULL,
PRIMARY KEY (resource_kind, resource_id, revision),
CHECK ((record_type='snapshot' AND snapshot_json IS NOT NULL)
    OR (record_type='deleted'  AND snapshot_json IS NULL))
```

plus index `<t>_recorded` on `(recorded_at, resource_kind, resource_id)`. The `resource_kind`
values Investigation writes are exactly `question`, `hypothesis`, `finding` — this is the one
history table in the backend that carries three different kinds.

**Totals: 4 tables, 5 indexes.** No foreign keys, no join tables, no triggers, no FTS index, no
migration framework.

### 5.5 The revision model, spelled out

- `revision` starts at **1** on insert.
- The **application layer** computes the next revision as `current.revision + 1`, in every mutation
  path. The one exception is `acceptFindingIfClaimMatches`, where SQL does it:
  `revision = revision + 1` (`:562`).
- Before every update, the store copies the **previous** row into history as a `snapshot` recorded
  at the **previous** revision — `insertHistorySnapshot(..., revision: previous.revision, ...)` at
  `:277`, `:382`, `:506`, `:553`. The chain is therefore contiguous, and the current table always
  holds the highest revision.
- The `recordedAt` of an archived snapshot is the **new** record's `updatedAt`, not the old one's.
- Logical delete (`deleteCurrent`, `:603-625`) writes **two** history rows in one transaction — a
  `snapshot` at `snapshot.revision` and a `deleted` row at `snapshot.revision + 1` — then `DELETE`s
  the current row.
- `purge` (`:570-578`) refuses while a current row exists (`ResourceNotDeletedError`) and throws
  `ResourceHistoryNotFoundError` when no history remains.
- `pruneHistory` (`:580-589`) delegates to `pruneHistoryBefore` with a liveness predicate that
  looks the id up in the table for its kind.

**A quiet behaviour worth knowing:** `updateQuestion`, `updateHypothesis` and `updateFinding` all
begin `if (!row) return;` (`:275`, `:380`, `:504`). An update against a missing row is a **silent
no-op at the store level**, not an error. The runtime never hits that path because it reads first
through `questionOrThrow` / `hypothesisOrThrow` / `findingOrThrow`, but a direct store caller gets
silence.

### 5.6 Reverse queries traverse only live targets

There are no reverse arrays and no join tables. Every "which Findings belong to this Question"
view is a SQL filter over the **owner's** JSON column, using `json_each` and `json_extract`:

| Query | Site | Predicate |
| --- | --- | --- |
| `listQuestions({tag})` | `:253` | `EXISTS (SELECT 1 FROM json_each(tags_json) AS tag WHERE tag.value = ?)` |
| `listHypotheses({questionId})` | `:348` | live-question `EXISTS`, then `json_each(question_ids_json)` |
| `listFindings({questionId})` | `:456-471` | live-question `EXISTS`, then `json_extract(link.value,'$.questionId') = ?` |
| `listFindings({hypothesisId})` | `:472-487` | live-hypothesis `EXISTS`, then `json_extract(link.value,'$.hypothesisId') = ?` |

The first `EXISTS` in each pair checks the **current** table for a row with that id. So:

> A reverse filter naming a deleted or never-existing target returns `[]`, even when owner rows
> still carry the id in their JSON.

**Deletion never cascades and never rewrites owner arrays.** A Finding that links to a deleted
Question keeps the link in `question_links_json` forever; it simply stops being reachable through
that filter. `investigation.test.ts:228` (*"Hypotheses allow zero or many Questions and filter only
through live targets"*) pins this.

All lists order by `updated_at DESC, id ASC`.

---

## 6 · Finding acceptance and Knowledge

This is the subtlest code in the capability, and arguably in the backend.

### 6.1 The narrowed dependency

```ts
type InvestigationKnowledge = Pick<Knowledge, "add" | "remove">;
```

— `investigationRuntime.ts:35`

Investigation's only cross-capability dependency is the Knowledge platform module, narrowed at the
type level to two methods. `startBackend.ts:71` passes the full `Knowledge` object; the runtime can
only reach `add` and `remove`. It cannot search, retrieve, resolve a scope, or subscribe to source
mutations.

Investigation is one of only three writers into the Knowledge index; the others are
[Connector](connector.md) and [General Files](general-files.md).

### 6.2 The bridge is two constants

```ts
const findingSourceId = (id: string): string => `finding:${id}`;
const claimRevision = (claim: string): string =>
  createHash("sha256").update(claim, "utf8").digest("hex");
```

— `investigationRuntime.ts:51-54`

`addFindingToKnowledge` (`:362-375`) calls:

```ts
knowledge.add({
  sourceId: findingSourceId(finding.id),   // "finding:<id>" — stable for the record's life
  label: "finding",
  revision: claimRevision(finding.claim),  // sha256 of the claim text
  text: finding.claim
})
```

**Only the claim is ever indexed.** Commentary, references, tags, links and status never reach
Knowledge. Because `revision` is `sha256(claim)`, re-adding an unchanged claim is a no-op inside
Knowledge (the result carries `skipped`), and a changed claim is a genuine re-ingest. That is the
whole re-ingest guard: Knowledge treats `sources.revision` as an opaque caller string.

### 6.3 `reconcileFindingKnowledge`

> `/** Reconcile the one stable source against whichever database write won. */`
> — `investigationRuntime.ts:377`

An unbounded `for (;;)` loop (`:378-423`) with four cases:

1. **Row absent** → `knowledge.remove(sourceId)`; return once the absence re-reads as stable.
2. **Row `accepted` but `knowledgeSourceId !== sourceId`** → run `acceptFindingIfClaimMatches` to
   record the id, then continue the loop.
3. **Row `accepted` with the right source** → re-`add`, re-read, and confirm status, claim and
   source all still hold; else continue.
4. **Row not accepted** → `knowledge.remove(sourceId)`, re-read, confirm still non-accepted with
   the same claim.

It has no attempt cap and no backoff. It terminates because each iteration re-reads the database
and only returns when the two sides agree.

### 6.4 `acceptFinding`

`acceptFinding` (`:924-1005`) is a retry loop with an `attempts` counter. Its central comment is
the clearest statement of the design in the capability:

```ts
// A serial edit may win while Knowledge is ingesting. Claim comparison
// makes acceptance retry the new claim without a public revision/CAS type.
```

— `investigationRuntime.ts:973-974`

That is why `POST /findings/accept` can be concurrent while `POST /findings/update` is serial: an
update can commit between acceptance reading the Finding and acceptance writing it, and the claim
comparison inside `acceptFindingIfClaimMatches` detects that and retries against the new claim
rather than overwriting it. `investigation.test.ts:515` (*"an edit that wins while acceptance
ingests is the claim ultimately accepted"*) drives this deterministically with a latched fake
Knowledge that releases the first `add`.

The idempotent path: if the Finding is already `accepted` with the right source and a re-read
confirms nothing moved, it logs `idempotent: true` and returns without writing (`:949-971`). If the
row vanished mid-loop and this was not the first attempt, it best-effort removes the Knowledge
source and logs `investigation.findings.knowledge.cleanup.failed` on error (`:931-943`), then
throws `InvestigationNotFoundError`.

`updateFinding` carries its own optimisation and explains it in place:

```ts
// Accepted metadata-only edits keep the same source and revision, so
// they do not call Knowledge. Claim changes and non-accepted edits still
// reconcile because they may overlap the concurrent accept operation.
```

— `investigationRuntime.ts:900-902`

`markFindingReferenceForReview` and `clearFindingReferenceReview` take the same shortcut for an
already-accepted Finding (`:1094-1097`, `:1127-1130`).

**Compensation.** `updateFinding` (`:892-899`), `unacceptFinding` (`:1025-1030`), `rejectFinding`
(`:1058-1063`) and `deleteFinding` (`:1184-1189`) each wrap the SQLite write in `try/catch` and
re-add the prior accepted claim if the write throws.

**The stated limit, visible in the structure of the code:** Knowledge and `investigation.db` do
**not** share a transaction. There is no outbox, no durable pending state and no startup
reconciler. A crash between the two leaves the index and the database disagreeing until the next
operation on that Finding runs the reconciler.

### 6.5 Accepted Findings as readable resources

`1-init/create/resource-reader.ts` gives accepted Findings a second life as project resources.
`FINDING_SOURCE_PREFIX = "finding:"` (`:19`); `registerInvestigation(runtime)` (`:75`) stores the
runtime. Three consumer paths, **all of which re-check acceptance**:

| Path | Site | Rule |
| --- | --- | --- |
| `resolve(ContextEntry[])` | `:90-94` | A `{id, kind:"finding"}` entry, or a bare `finding:<id>`, resolves to `finding.knowledgeSourceId` only when `status === "accepted"` and the source id is set. Findings are checked immediately after documents, before General Files and Connector |
| `describeSource(sourceId)` | `:122-130` | Returns `{sourceId, resourceId: finding.id, resourceKind: "finding"}` |
| `read(...)` | `:180-190` | Additionally requires `finding.id === descriptor.resourceId` and `descriptor.resourceKind === "finding"`, then returns `sliceLines(finding.claim, startLine, endLine)` and `byteSize = Buffer.byteLength(finding.claim, "utf8")` |

`findFindingBySource` (`:328-341`) returns the Finding only when `status === "accepted"` **and**
`knowledgeSourceId === sourceId`.

**Net effect:** proposed, rejected, deleted and missing Findings are invisible to Context
resolution, Knowledge source description and scoped reads, and the **claim text is the only thing
ever exposed**. `investigation.test.ts:595` pins the whole path.

---

## 7 · Invariants

| Invariant | Enforced at |
| --- | --- |
| A Finding must carry at least one reference, on propose and on any reference replacement | `investigationRuntime.ts:252-257` |
| A reference naming a revisioned resource kind must carry a `resourceRevision` | `investigationRuntime.ts:215-219`, set at `:37-49`, prefixes at `:159-162` |
| A URL reference must be `http:` or `https:` | `investigationRuntime.ts:230-240` |
| Character spans satisfy `start >= 0 && end > start`; line spans satisfy `startLine >= 1 && endLine >= startLine` | `investigationRuntime.ts:126-140`, `:141-154` |
| `referenceIndex` is inside `[0, references.length)` | `investigationRuntime.ts:312-321` |
| A Question cannot be confirmed without a non-blank `currentAnswer` | `investigationRuntime.ts:539-543` |
| A rejected Finding cannot be unaccepted | `investigationRuntime.ts:1010-1014` |
| Question and Finding status is never client-settable — it moves only through the answer and acceptance lifecycles | no `status` field on `UpdateQuestionRequest` (`domain/model.ts:139`) or `UpdateFindingRequest` (`:182`) |
| Hypothesis status *is* client-settable, and is guarded | `investigationRuntime.ts:685-687`, plus the SQL `CHECK` at `sqliteInvestigationStore.ts:145-149` |
| A status used as a list *filter* must be a member of its vocabulary | `investigationRuntime.ts:596`, `:764`, `:1155` |
| Every persisted status is constrained again in SQL | `sqliteInvestigationStore.ts:127`, `:145-149`, `:174-175` |
| `revision >= 1` in every table | `sqliteInvestigationStore.ts:129`, `:159`, `:180`, and the shared history DDL |
| Duplicate question/hypothesis links collapse; the last classification wins | `investigationRuntime.ts:259-282`, `:284-310` |
| Only a Finding's `claim` reaches Knowledge, under source id `finding:<id>` with `revision = sha256(claim)` | `investigationRuntime.ts:51-54`, `:362-368` |
| An accepted Finding's Knowledge source id is always `finding:<its own id>` | `investigationRuntime.ts:947`, re-checked in `reconcileFindingKnowledge` `:390-400` |
| Acceptance only commits while the persisted claim still matches the text sent to Knowledge | `sqliteInvestigationStore.ts:540-568` |
| A reverse filter naming a non-live target returns `[]` | `sqliteInvestigationStore.ts:348-372`, `:456-487` |
| Deletion never cascades to owner records | absence of any cascade — no foreign keys, no triggers, no owner rewrite anywhere in the store |
| Every prior revision is archived before it is overwritten | `sqliteInvestigationStore.ts:277`, `:382`, `:506`, `:553` |
| A logical delete writes both `snapshot@N` and `deleted@N+1` | `sqliteInvestigationStore.ts:603-625` |
| Purge refuses while the record is live, and 404s when there is no history | `sqliteInvestigationStore.ts:570-578` |
| No authored text is ever logged | asserted by `investigation.test.ts:549` |

### 7.1 Logging

Mutations log at `info`, reads at `debug`. The complete event vocabulary emitted by the runtime:

```text
investigation.runtime.created
investigation.questions.{created,updated,read,listed,deleted}
investigation.questions.answer.{proposed,confirmed,cleared}
investigation.hypotheses.{created,updated,read,listed,deleted}
investigation.findings.{proposed,updated,accepted,unaccepted,rejected,read,listed,deleted}
investigation.findings.reference.{review-marked,review-cleared}
investigation.findings.knowledge.add
investigation.findings.knowledge.cleanup.failed
```

plus `investigation.endpoints.registered` from the wiring layer, and the per-request
`<event>.{completed,rejected,failed}` triple from `execute` (§4.2). Note that the three `purge*`
runtime methods log nothing at the runtime level; a purge is visible only through the wiring's
`.completed` record.

Payloads carry ids, `actorId`, `priorStatus`/`status`, counts (`assumptionCount`, `tagCount`,
`referenceCount`, `questionLinkCount`, `hypothesisLinkCount`), `needsReview`, `attempts`,
`idempotent` and `durationMs`. **No claim text, question text, statement, commentary, tag value or
reference note is ever logged.** Investigation does not use the platform `LogDetail` mechanism
described in [06-platform-services.md](../06-platform-services.md) — it has no content-labelled
records because it logs no content at all.

---

## 8 · Design decisions worth preserving

**One runtime for three record families.** The capability deliberately refuses to split into three
services. The comment states the frame:

> `/** The one flat runtime used to manage all three Investigation record types. */`
> — `domain/model.ts:204`

The consequence is one store port, one connection, one schema transaction, and one shared history
table discriminated by `resource_kind` — instead of three of everything.

**The factory comment says where concurrency safety comes from.**

```ts
/**
 * Build the single service-layer object for Questions, Hypotheses, and
 * Findings. HTTP queue policy serializes authored mutations; the runtime also
 * makes Finding acceptance safe when invoked concurrently in-process.
 */
```

— `investigationRuntime.ts:344-348`

Two mechanisms, named explicitly and in order: the serial queue for ordinary edits, and an
in-process guarantee for the one operation that must not be serialised.

**The store port explains the one non-CRUD primitive.**

```ts
/**
 * Atomically accepts a live Finding only while its persisted claim still
 * matches the text most recently admitted to Knowledge.
 */
```

— `ports/investigationStore.ts:42-45`

**Claim comparison replaces a public CAS type.**

```ts
// A serial edit may win while Knowledge is ingesting. Claim comparison
// makes acceptance retry the new claim without a public revision/CAS type.
```

— `investigationRuntime.ts:973-974`

This is the reason Investigation has **no `expectedRevision` anywhere on the wire**. The one place
that genuinely needs compare-and-swap semantics gets them from the value it already has to compare
— the claim text — rather than from a revision number the client would have to carry.

**Metadata edits are cheap on purpose.**

```ts
// Accepted metadata-only edits keep the same source and revision, so
// they do not call Knowledge. Claim changes and non-accepted edits still
// reconcile because they may overlap the concurrent accept operation.
```

— `investigationRuntime.ts:900-902`

**The reconciler's job, in one line.**

> `/** Reconcile the one stable source against whichever database write won. */`
> — `investigationRuntime.ts:377`

"Whichever write won" is the honest framing: the code does not try to order the two databases, it
converges after the fact.

**Unclassified links are a first-class state.**

> `/** Omit when the Finding is relevant to the Question but unclassified. */`
> — `domain/model.ts:73`

**The error base class exists so adapters never match on messages.**

> `/** Stable base error used by HTTP and other adapters without matching messages. */`
> — `domain/model.ts:280`

**Test seams are declared, not smuggled.**

> `/** Runtime attribution and deterministic seams used by tests. */`
> — `domain/model.ts:197`

**The store port states the current/history split.**

```ts
/**
 * Project-local persistence for all Investigation record types.
 * Current tables contain only live records; history is retained separately.
 */
```

— `ports/investigationStore.ts:12-15`

---

## 9 · Known gaps and defects

### 9.1 The startup manifest log under-reports by three routes — a code bug

`registerInvestigationEndpoints.ts:818-845` emits:

```ts
logger.info("investigation.endpoints.registered", {
  count: 23,
  endpoints: [ /* 23 strings */ ]
});
```

The array omits **`POST /questions/purge`**, **`POST /hypotheses/purge`** and
**`POST /findings/purge`** — all three of which *are* registered, at lines 583, 660 and 807
respectively, and all three of which are asserted by `investigation.test.ts:657`, `:663` and
`:674`.

This is not documentation drift; the running service mis-reports its own surface. Anyone auditing
the boot log will count 23 endpoints for a capability that serves 26. The capability's own
`docs/flows.md:281` is correct at 26; two other files in that package (`docs/runtime.md:41`,
`docs/invariants.md:263`) copied the stale `23` out of the code. Recorded in
[11-known-issues.md](../11-known-issues.md).

### 9.2 The wiring layer keeps its own copy of every vocabulary

`domain/model.ts` exports `QUESTION_STATUSES`, `HYPOTHESIS_STATUSES`,
`HYPOTHESIS_CONFIDENCE_LEVELS`, `FINDING_STATUSES` and `FINDING_RELATIONSHIPS`. The wiring file
imports **none** of them — its import block (`registerInvestigationEndpoints.ts:1-10`) pulls in
only `InvestigationError` and `type InvestigationRuntime` — and re-declares all five arrays locally
at `:24-44`. Nothing checks that the two copies agree. Adding a status to the domain without
touching the wiring produces a 400 on a value the runtime accepts.

By contrast the same file derives its *request* types structurally
(`type CreateQuestionRequest = Parameters<InvestigationRuntime["createQuestion"]>[0]`, `:12-20`),
so those cannot drift. The vocabularies are the exception.

### 9.3 Nothing verifies that a linked target exists

- `Hypothesis.questionIds` is validated for shape only; a Hypothesis may name Questions that never
  existed (`investigationRuntime.ts:648`, `:715`).
- `FindingQuestionLink.questionId` and `FindingHypothesisLink.hypothesisId` are likewise
  unchecked (`:259-310`).
- `FindingReference.resourceId` is never resolved against any capability — Investigation does not
  import the resource registry.

The consequence is symmetric with §5.6: dangling links are legal at write time and simply invisible
at read time.

### 9.4 `REVISIONED_RESOURCE_KINDS` requires revisions for resources nothing can produce

The set at `investigationRuntime.ts:37-49` includes **`deck`** and **`slide`**. No live capability
produces either: `3-capabilities/slides/` exists at 6,765 lines and is completely unreachable —
nothing constructs it, it has no `application/`, no `index.ts`, no alias and no wiring (see
[slides.md](slides.md)). A Finding referencing `resourceKind: "deck"` is therefore *required* to
supply a `resourceRevision` for a resource that cannot exist, and one referencing `resourceKind:
"slide"` likewise. Whether these are a forward declaration or a leftover from the deleted singular
`slide/` capability is not recorded anywhere in the source.

`collection` and `function` are in the same position: neither is a resource kind any capability
currently emits.

### 9.5 Knowledge and the database are not transactional together

Stated plainly in §6.4 and repeated here because it is the capability's main durability limit.
There is no outbox table, no pending-work table, and no startup reconciler. `startBackend.ts` runs
recovery drains for Document, Comments and Templates (`:187-195`) and **nothing for
Investigation**. If the process dies between `knowledge.add` and the SQLite write (or the reverse),
the disagreement persists until the next operation on that specific Finding runs
`reconcileFindingKnowledge`. Nothing sweeps for stragglers.

`reconcileFindingKnowledge` itself is an unbounded loop with no attempt ceiling and no backoff. A
Knowledge implementation that failed non-deterministically in the right way would spin.

### 9.6 The store's silent-no-op update path

`updateQuestion`, `updateHypothesis` and `updateFinding` return silently when the row is missing
(`sqliteInvestigationStore.ts:275`, `:380`, `:504`) instead of signalling. The runtime always reads
first, so no production path reaches it — but the port advertises `update*(record): void` with no
success signal at all, which means a future caller cannot tell a write from a no-op.

### 9.7 The connection is never closed

`SQLiteInvestigationStore.close()` exists (`:210`) but is not on the `InvestigationStore` port and
has no caller in `src/`. Shutdown (`startBackend.ts:220-227`) stops the sync timers, awaits the
retention sweep, closes Fastify, flushes the logger and calls `process.exit(0)` with every database
handle open. This is not specific to Investigation — no capability closes its connection — and is
tracked in [11-known-issues.md](../11-known-issues.md).

### 9.8 Coverage

Eleven tests, 781 lines, all passing. They cover schema creation, the three record lifecycles,
validation rejection, acceptance idempotence, the interleaved edit-during-ingest race, log hygiene,
the resource-registry integration, all 26 endpoint queue policies, and one end-to-end flow over a
real listening socket.

What they do not cover:

- **`pruneHistory` and `purgeExpired` are not exercised by `investigation.test.ts`.** The retention
  contract is tested generically in `resource-retention.test.ts`, against the shared helper rather
  than against this store's `tableFor` liveness predicate.
- **The `confirmQuestionAnswer` idempotent branch** (already-`answered` returns unchanged) has no
  named assertion.
- **`purgeQuestion` / `purgeHypothesis` / `purgeFinding` over HTTP** — the three routes the manifest
  log forgets are asserted only for their queue policy, not for their behaviour.
- **Concurrency against a real Knowledge implementation.** The interleaving test uses a latched
  fake; there is no Knowledge test file anywhere in the repository
  ([06-platform-services.md](../06-platform-services.md)).

---

## See also

- [07-capabilities/README.md](README.md) — the capability inventory and the 89-endpoint reconciliation
- [04-state-and-persistence.md](../04-state-and-persistence.md) — the shared history table, the retention sweep, the pragma census
- [02-request-and-job-runtime.md](../02-request-and-job-runtime.md) — queues, response modes, the 404/429/500 split
- [06-platform-services.md](../06-platform-services.md) — Knowledge, and the `LogDetail` mechanism Investigation does not need
- [slides.md](slides.md) — the unreachable capability behind `deck` and `slide` in `REVISIONED_RESOURCE_KINDS`
- [11-known-issues.md](../11-known-issues.md) — the manifest-count bug and the unclosed connections
