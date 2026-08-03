# General updates — backend TODO

Cross-capability work that is agreed but not scheduled. **One file; check here first.**

Consolidates and replaces `resource-id-allocation.md`, `delegated-command-claims.md`,
`context-persona-update.md`, `templates-corrections-plan.md`, and
`templates-review-responses.md`. Nothing here is in progress.

Items 15 and 16 are **Phase C** of the Templates/Document work and are ticked in
[`0-templates-checklist.md`](0-templates-checklist.md), not here.

| # | Item | Status |
|---|---|---|
| 1 | [Delete Slide](#1--delete-slide) | ✅ **DONE 2026-08-01** |
| 2 | [Resource IDs should be allocated, not caller-supplied](#2--resource-ids-should-be-allocated-not-caller-supplied) | ✅ **DONE 2026-08-02** |
| 3 | [Logging architecture doc](#3--logging-architecture-doc) | ✅ **DONE 2026-08-02** |
| 4 | [Logging coverage — measured](#4--logging-coverage--measured) | ✅ **DONE 2026-08-02** |
| 5 | [Persona ↔ Context partial-write gap](#5--persona--context-partial-write-gap) | ✅ **DONE 2026-08-02** |
| 6 | [`ContextValidationError`](#6--contextvalidationerror) | ✅ **DONE 2026-08-02** |
| 7 | [Context bindings belong on the Template record](#7--context-bindings-belong-on-the-template-record) | ✅ **DONE 2026-08-02** |
| 8 | [Remove `maxTemplatesPerProject`](#8--remove-maxtemplatesperproject) | ✅ **DONE 2026-08-02** |
| 9 | [Per-command `origin`](#9--per-command-origin) | ✅ **DONE 2026-08-02** |
| 10 | [Templates dead code and naming](#10--templates-dead-code-and-naming) | ✅ **DONE 2026-08-02** |
| 11 | [Context tombstones reach callers](#11--context-tombstones-reach-callers) | ✅ **DONE 2026-08-02** |
| 12 | [Activity ID allocation — doc drift](#12--activity-id-allocation--doc-drift) | ✅ **DONE 2026-08-02** |
| 13 | [Deletion as a revision, not a flag](#13--deletion-as-a-revision-not-a-flag) | ✅ **DONE 2026-08-02** |
| 14 | [Document deletion](#14--document-deletion) | ✅ **DONE 2026-08-02** |
| 15 | [Live project-scoped Context](#15--live-project-scoped-context) | ✅ **DONE 2026-08-02** — including retiring the implicit empty-scope rule |
| 16 | [Garbage collection for orphaned resources](#16--garbage-collection-for-orphaned-resources) | ✅ **DONE 2026-08-02** — both 16a and 16b |
| ~~17~~ | Remove command claims from Templates | **moved** → [`templates-rework-plan.md`](templates-rework-plan.md) step 1 |
| 18 | [LIKE wildcards are not escaped in text search](#18--like-wildcards-are-not-escaped-in-text-search) | ✅ **DONE 2026-08-02** |
| 19 | [Structured Data revisions should propagate to dependents](#19--structured-data-revisions-should-propagate-to-dependents) | agreed — explore |
| 20 | [Quoted names — decide whether we actually want them](#20--quoted-names--decide-whether-we-actually-want-them) | **decision needed** — default no |
| 21 | [Log content in dev, shape in production, behind a label](#21--log-content-in-dev-shape-in-production-behind-a-label) | ✅ **DONE 2026-08-02** — mechanism landed; migration ongoing |
| 22 | [Audit what we do with caller-supplied strings](#22--audit-what-we-do-with-caller-supplied-strings) | agreed — explore |
| 23 | [Test files are not typechecked](#23--test-files-are-not-typechecked) | agreed — small change, expect a backlog |
| R | [Reference: delegated command claims](#reference--delegated-command-claims-removed-2026-08-02) | ✅ **REMOVED 2026-08-02** |

Items 7–10 correct Templates, which is **already implemented and green** (254 tests). They
are fixes to shipped code, not new build-out.

---

## Accepted risks — things we chose, and must not forget

Not bugs and not TODOs. Each of these is a **known cost accepted in exchange for
something**, recorded here so the trade stays visible instead of being rediscovered as a
surprise. Anything that stops being worth its price belongs in the numbered list above.

### AR-1 · Registration can leak an orphaned backing resource

> ✅ **CLOSED 2026-08-02** — see the bottom of this entry. Kept in full because the trade it
> describes is why the leak existed at all, and that reasoning still governs the sweep.

**What it is.** `template.register` calls `duplicate` → `markAsTemplate` → `applyBindings`
and *then* writes its catalog row. A crash between the copy and the catalog write leaves a
sealed backing resource that no `TemplateRecord.resourceId` points at.

**Why it is worse than it sounds.** The orphan is not merely hidden, it is **unreachable**.
The owning capability refuses every request naming a sealed resource, and `template.list`
only knows catalog rows — which is exactly what this one lacks. No query in the system can
see it. Only a sweep can.

**Why we took it.** The alternative is what Templates used to do: reserve a catalog row
before the external call so the identity survives it. That bought a resumable mid-procedure
crash and cost a `state` column, two lifecycle methods (`markReady`, `deleteReservation`), a
promote/release pair, and a second durable idempotency mechanism alongside the receipt
table. It also leaked in the other direction — a `reserving` row pointing at a copy that may
or may not exist.

**What bounds it.** Only a crash that is *never retried* leaks. A retry re-runs the command,
the resource replays its own copy on the same idempotency key, and the catalog write
completes. So the exposure is "process died mid-command **and** the client gave up", not
"process died mid-command".

**CLOSED 2026-08-02.** `TemplateCapability.collectOrphanedResources` rides the existing
retention scheduler and diffs what each kind reports sealed against what the catalog claims.
The retention cutoff doubles as the grace period, which is what tells an orphan from a
registration in flight. History counts as a claim, so a deleted-but-unpurged template keeps
its copy. One failing purge does not stop the sweep.

The seam that made it possible: `TemplatableResource.listSealedResources()`. **That is not a
template listing** — `template.list` is still the only way anyone asks what templates exist.
It answers "which of your rows did I tell you to seal", which only Templates can ask and only
so it can compare that against its own catalog.

---

## 18 · LIKE wildcards are not escaped in text search

**Agreed — a sweep is needed.** `%` and `_` are LIKE wildcards. A search term containing
either stops being a substring search and silently becomes a pattern: searching for `50%`
matches every row, and `a_b` matches `axb`.

**Fixed in Templates.** `template.list` escapes `\`, `%`, and `_` in the term and passes
`ESCAPE '\'`:

```ts
const escapeLikeTerm = (term: string): string =>
  term.replace(/[\\%_]/g, (character) => `\\${character}`);
```

`\` is escaped first, or it would escape the escapes the replacement adds.

**Fixed in General Files too.** All three name filters escape and declare `ESCAPE`. This was
a live wrong-results bug, not a theoretical one: a filename containing `_` is common.

**The sweep.** Grep for `LIKE` across `src/` and check each site for three things: is the
pattern built from caller-supplied text, is that text escaped, and is `ESCAPE` declared.
A site that builds its pattern from a fixed vocabulary is fine and should be marked so
rather than left ambiguous.

**Resolved as a shared helper**: `0-utils/persistence/likePattern.ts`. This is the one place
the "capabilities own their own storage" rule gives way, and the reason is the history above —
Templates and General Files each grew a name filter and disagreed, so the same query returned
different results depending on which capability answered it. Four copies of a four-line
function is cheap; four copies that disagree is a class of bug nobody goes looking for.

**Still worth a sweep** for any `LIKE` added later: check that the pattern is escaped and that
`ESCAPE` is declared, or that the pattern comes from a fixed vocabulary.

---

## 1 · Delete Slide

✅ **DONE 2026-08-01.** Kept for the record; nothing left to do.

Slide was incomplete and not runnable, and was the sole reason the backend did not typecheck
or boot. `slideService.ts` was never written while `slide/index.ts` re-exported from it — one
missing file producing both `tsc` errors and a module-load failure in `startBackend`, so **no
endpoint was reachable, not just Slide's two**.

**Removed** — 39 files, ~9,100 lines, via `git rm` so it is recoverable:

- `3-capabilities/slide/` and `4-job-wiring/slide/` — whole directories
- `1-init/create/slide.ts`
- `test/capabilities/slide-{domain,wire,persistence}.test.ts`
- `1-init/startBackend.ts` — 4 imports, `slideJobs` runtime, construction,
  `registerSlideInternalJobs`, `registerSlideEndpoints`, `recoverPendingAttempts()`,
  `slideReady`
- No alias to remove — Slide never had one

**Results, measured:**

| | Before | After |
|---|---|---|
| `pnpm typecheck` | 2 errors | **clean, exit 0** |
| module graph import | `ERR_MODULE_NOT_FOUND` | **loads** |
| `pnpm test` | 257 pass | **231 pass**, 0 fail |

The count dropped because Slide's three test files went with it. No other test changed.

**Left in place deliberately** — inert strings, not dependencies:

| File | Reference | Why kept |
|---|---|---|
| `investigation/…/investigationRuntime.ts:41,46` | `"deck"`, `"slide"` in `REVISIONED_RESOURCE_KINDS` | a static kind vocabulary; nothing will ever present these kinds, and a future slides capability would want them back |
| `test/capabilities/comments.test.ts:174` | `resourceKind: "slides"` | opaque test data; Comments does not validate resource kinds |

Two stale code comments naming Slide as live were corrected
(`derived-outputs/domain/model.ts`, `4-job-wiring/templates/registerTemplateEndpoints.ts`).

**Docs updated:** `docs/claude-notes/README.md` (the "does not boot" headline),
`09-verified-status.md` (re-measured throughout), `07-capability-inventory.md` (row + section
now historical), `docs/runtime/build-order.md`.

**Follow-on, also done:** the composition gap this exposed is closed.
`runtime-wiring.test.ts` gained *"the composition root's module graph resolves"* — a dynamic
import of `#init/startBackend.js` asserting `startBackend` is a function. Verified
non-vacuous by deliberately breaking the module graph and confirming it fails.

It catches unresolvable imports of *used* bindings, but not unused or type-only ones —
esbuild elides those before Node resolves them. So **adding `pnpm typecheck` to whatever
gate runs `pnpm test` is still worth doing**, and is now the more valuable half. See
`09-verified-status.md` → "The verification gap".

---

## 2 · Resource IDs should be allocated, not caller-supplied

✅ **DONE 2026-08-02.** `document.create` now allocates its id. Kept for the record and for
the open items at the end, which remain genuinely open.

**The rule, as settled:** when we create something, the caller does not supply the id for the
thing being created. The backend allocates it and returns it. This does **not** apply to
commands that take an id to *address* something that already exists.

**Full review, verified against source.** Every capability's create path:

| Capability | ID origin | Verdict |
|---|---|---|
| ~~document~~ | ~~caller-supplied~~ → **allocated** | **fixed** |
| comments, persona, context, structured-data, derived-outputs, investigation, templates | allocated (`randomUUID`) | already correct |
| general-files | `sha256(content)` | derived — deliberate |
| connector | `sha256(kind::locator)` | derived — deliberate |
| activity | `act_<sha256(idempotencyKey)>` | derived — deliberate |

The derived cases are principled, not violations: identity *is* the input, which is what
makes re-uploading the same bytes or re-registering the same locator idempotent.

**What landed:**

- `document.create` drops `documentId`; the service allocates `randomUUID()`.
  `document.created` already carried `head.id`, so no result-shape change.
- New `doc_<prefix>_create_receipts` table keyed on `request_id` alone, written in the same
  transaction as the document-keyed receipt. The former makes create replayable; the latter
  keeps the request-id reuse guard working for later commands on that document.

  **Corrected while implementing deletion (item 14).** This table originally had no foreign
  key, on the reasoning that a create receipt "must outlive its document, or deleting one
  would let an old request id recreate it." That was backwards. If the receipt survives,
  replaying the original create returns a head for a document that no longer exists and
  every subsequent load 404s — the caller is handed a dangling reference. Recreating is the
  coherent outcome. It now carries `document_id` purely so it can `ON DELETE CASCADE`;
  lookup is still by `request_id` (the primary key), so replay is unaffected.
- `DocumentAlreadyExistsError`, its single throw site, and its `409 already_exists` branch
  were removed — unreachable once the id is a fresh UUID.
- `assertDelegatedRequestReuse` now short-circuits for creates, which name no document.
- 4 new tests; 236 pass, typecheck clean.

**No external consumers.** The smoke script does not exercise documents, and
`apps/frontend`'s only `document` reference is `document.querySelector`. The earlier claim
here that "the smoke script hand-picks document IDs" was wrong.

**Receipt, not claim.** Templates uses a claim that reserves the id *before* the write,
because it then calls an external adapter and a crash mid-call must resume with the same id.
`document.create` has no external side effect — one `commitCreation` — so a crash before
commit writes nothing and a retry allocating a fresh id is harmless. The open item below
asked which shape was right; this is the answer for Document specifically.

<details>
<summary>Original write-up, retained for the reasoning</summary>

### The decision

Document and Slide currently require the caller to supply the identifier of a resource that
does not exist yet. That is wrong and should change: the backend should allocate the ID and
return it, the way Context and Derived Outputs already do.

```ts
// today — apps/backend/src/3-capabilities/document/domain/model.ts
| {
    type: "document.create";
    documentId: string;      // <- caller names something it has never seen
    title: string;
    pageLayout?: DocumentPageLayout;
    styles?: DocumentStyleRegistry;
  }
```

Slide's `deck.create` has the same shape — but see item #1: Slide is being deleted, so
**only Document remains**.

### Why it is wrong

A caller has no basis on which to name a resource that does not exist. Making it do so pushes
identifier generation into every client, invites collisions between clients that generate
badly, and lets a caller choose an ID that collides with an existing resource — which
surfaces as `already_exists` on what the user experienced as "create a new document".

It also makes the platform inconsistent with itself. Three conventions currently coexist:

| Convention | Capabilities | Retry safety comes from |
|---|---|---|
| Caller-supplied | **Document** (~~Slide~~) | Request receipts keyed `(resourceId, requestId)` |
| Allocated internally | Context (`randomUUID`), Derived Outputs, Structured Data, Comments, Templates, Investigation, Persona | A caller-supplied idempotency key or request ID |
| Derived from content | General Files (`sha256(content)`), Connector (`sha256(kind::locator)`) | Identity is a pure function of the input |

The third is principled — identity *is* the content. The second is the normal shape for a
created record. The first is the odd one out.

**Audit confirmation:** every capability added since this was first written — Comments,
Templates, Investigation, Persona — allocates internally. Once Slide is deleted, Document is
the *only* caller-supplied case in the tree.

Templates already follows the second convention: it allocates its Template ID, freezes it on
the command claim before any external call, and returns it. See
[`templates-design.md`](templates-design.md) → "Which identifiers a caller supplies".

### What this touches

- `document.create` command shape and its wire decoder.
- The command result: the allocated ID has to come back. **This already works** —
  `document.created` carries `head`, and `head.id` is the document id, so no result-shape
  change is needed.
- **Idempotency.** Document's receipts are keyed `(document_id, request_id)`. With an
  allocated ID there is no `document_id` at claim time for a create, so create needs a
  request-keyed claim that stores the allocated ID — the
  `template_command_claims.template_id` pattern Templates used at the time.
  (Templates has since dropped claims entirely; see
  [`templates-rework-plan.md`](templates-rework-plan.md) step 1. This item records what was
  compared when the decision was made.) Non-create commands still address an existing
  resource and are unaffected.

  Comments offers a simpler variant worth comparing — receipts keyed on `request_id` alone:

  ```sql
  CREATE TABLE IF NOT EXISTS ${root}_create_receipts (
    request_id     TEXT PRIMARY KEY,
    request_digest TEXT NOT NULL,
    result_json    BLOB NOT NULL,
    created_at     TEXT NOT NULL
  );
  ```

  No foreign key to `documents` — deliberately. The existing receipts table cascades on
  delete; a create receipt must **outlive** its document, or deleting one would let an old
  requestId recreate it.
- Tests and the smoke script, which currently hand-pick document IDs.

### The complication that needs a real answer first

This is not a pure mechanical change, and the reason it was probably built this way in the
first place is worth writing down.

**Structural IDs inside a batch.** `document.submit` takes an array of operations, and those
operations carry caller-supplied structural identifiers — `block.insert` supplies the whole
`DocumentBlock` including its `id`, and `prompt.create.request` supplies `blockId`. This lets
a client compose a batch offline that inserts a block *and then* references it in the same
submission (style it, place it, nest a list item under it). If the server allocated those
IDs, a single batch could no longer reference what it just created without some form of
client-side placeholder that the server rewrites.

So there are really two questions, and they can be answered separately:

1. **Aggregate IDs** (`documentId`) — no batch problem. A create returns one new ID. This is
   the straightforward half and can move first.
2. **Structural IDs** (block, row, style, list, table, atom, mark) — needs a design for
   intra-batch references before anything changes. Options worth considering: client-supplied
   placeholder tokens resolved server-side; a pre-allocation endpoint that vends a block of
   IDs; or leaving structural IDs caller-supplied on the grounds that they are scoped by
   `(documentId, internalId)` and the identity ledger already forbids reuse.

The identity ledger currently mitigates the worst failure mode for (2) —
`DocumentIdentityReuseError` prevents resurrecting a tombstoned ID — but it does not address
a caller inventing an ID that collides with a live one in the same document.

### Suggested sequencing

Do **not** bundle this with Templates. Templates deliberately allocates its own catalog ID
and takes `destinationResourceId` from the caller, which stays correct under either outcome
here — the instantiating caller genuinely is creating the destination and can name it, and if
aggregate allocation lands later, `template.instantiate` drops `destinationResourceId` and
returns the allocated ID like everything else.

Reasonable order:

1. Aggregate IDs for Document.
2. Decide the structural-ID question on its own merits; it may well end with "leave them
   caller-supplied", which is a defensible answer.
3. Revisit `template.instantiate` only after step 1.

~~Blocked behind the Slide application service for anything touching Slide.~~ **Resolved by
item #1** — Slide was deleted rather than finished, so that half of the work disappeared
instead of waiting.

</details>

### Open items — still open after the Document fix

- **Structural IDs stay caller-supplied, by decision.** `block.insert` carries the block's
  own `id`, plus style, row, list, table, atom, and mark ids. These name content *within* an
  aggregate, are scoped by `(documentId, id)`, and the identity ledger already forbids
  reuse. They also enable a real capability: a client composes a batch offline that inserts
  a block and then references it in the same submission. Server allocation breaks that
  without a placeholder-rewriting scheme nobody has designed.

  **This boundary should move into `08-conventions.md`** — "resource/aggregate-root ids are
  allocated; structural ids inside an aggregate are not" — or it will be re-litigated.

- **`template.instantiate`'s `destinationResourceId` — deferred, not resolved.** Excluded
  from this change by decision. Worth confirming when the first `TemplateResourceAdapter` is
  written: the port is documented as *"copies a template-mode resource into a normal
  resource"* and *"can only have produced the resource it was told to produce"*, which reads
  as the adapter **creating** the destination. If it does, the rule applies to it.

  Timing matters. `TemplateResourceAdapter` has **zero implementations today** — nothing
  calls `registry.register()` — and its `Promise<void>` return is justified *by* the
  caller-supplied id. Changing it to return the allocated id is free right now and becomes a
  breaking change the moment an adapter exists.

- **Existing documents keep their caller-supplied ids.** Ids are opaque, so no migration was
  needed. Nothing was found that assumes a format, but that was not exhaustively proven.

---

## 3 · Logging architecture doc

✅ **DONE 2026-08-02.** Kept for the record; nothing left to do.

Landed as a new "Logging practice" section in **`docs/platform/observability.md`**, not a
separate `docs/runtime/logging.md` — decided during implementation that one page beats a
fourth place for this content to drift, since the existing doc already covers the Logger
*component*. The section says so explicitly, to head off any future split.

Content, matching what is proposed below and what the codebase already does:

- **The expectation.** Every capability logs every accepted mutation, every rejected command,
  every query, its construction, and its endpoint registration. Observability is not optional
  polish. **Activity and Comments are the reference implementations.**
- **Event naming** — `dot.separated.lowercase`, `<capability>.<subject>.<outcome>`. Recurring
  vocabulary: `.runtime.created`, `.endpoints.registered`, `.command.completed`,
  `.command.failed`, `.query.completed`, `.read`, `.listed`.
- **Levels** — `debug` per-operation timing and reads; `info` lifecycle and accepted
  mutations; `warn` expected-but-notable; `error` unexpected only. Expected 4xx are **not**
  error-logged; only `>= 500` is.
- **Required fields** — flat object, stable keys, `requestId`/`jobId` for correlation,
  `durationMs` from `performance.now()`, `errorName` + `errorMessage` on errors.
- **Never logged** — user content, prompts, provider bodies, Formula source, persona section
  text, comment bodies. Log **digests, ids, counts, outcomes** instead. This is *why* digests
  are carried.
- **Never `console.*`** — there is a test enforcing it.
- Point at `CapturingLogger` and the `runtime-wiring.test.ts` greps as the way to
  regression-test a logging rule.
- The buffered-writer change (below) is documented in the same section, so "log as much as
  this asks for" and "logging is cheap" are no longer in tension in the reader's mind.

**The checklist is advisory, not enforced.** Decided during implementation: no
source-scanning test gates on these events existing. New capabilities are expected to follow
the practice deliberately rather than because CI demands it.

**The synchronous-writer question is resolved, not just documented.** The original open item
asked whether the doc should merely acknowledge the `appendFileSync`-per-entry cost or whether
buffering was a prerequisite for item 4's denser logging. The decision was to fix it:
`1-init/create/logger.ts` now writes through a per-day `fs.createWriteStream` instead of one
blocking write per entry, `Logger` gained an optional `close(): Promise<void>` for shutdown
draining, and `startBackend.ts` gained a `SIGTERM`/`SIGINT` handler that calls it — none of
which existed before. See `apps/backend/test/capabilities/observability.test.ts` for the
regression coverage (buffered writes still produce one-JSON-object-per-line output; level
filtering; `close()` drains pending writes; a disabled logger's `close()` is a safe no-op).

---

## 4 · Logging coverage — measured

✅ **DONE 2026-08-02.** Persona, Templates, and Document all received the missing events
identified below, in that order (cheapest/safest first, per the original suggested
sequencing). Document's attempt-lifecycle events log at `info` for every state — no
debug/info split — a deliberate simplification decided during implementation over the
original "debug intermediate, info terminal" suggestion.

**Before** (unchanged from the original measurement):

| Capability | Events | Lines | Per 1k lines | |
|---|---:|---:|---:|---|
| activity | 16 | 963 | 16.6 | reference |
| context | 7 | 434 | 16.1 | fine |
| connector | 21 | 1,502 | 14.0 | fine |
| general-files | 12 | 860 | 14.0 | fine |
| investigation | 26 | 2,076 | 12.5 | fine |
| comments | 16 | 1,454 | 11.0 | reference |
| structured-data | 10 | 985 | 10.2 | fine |
| derived-outputs | 17 | 2,730 | 6.2 | acceptable |
| **templates** | **4** | **1,281** | **3.1** | **thin** |
| **persona** | **4** | **1,360** | **2.9** | **thin** |
| **document** | **7** | **8,416** | **0.8** | **worst** |
| slide | 0 | 7,017 | — | being deleted |

**After** (whole-capability-directory counts, same methodology, re-measured 2026-08-02):

| Capability | Events | Lines | Per 1k lines |
|---|---:|---:|---:|
| **persona** | **15** | **1,424** | **10.5** |
| **templates** | **7** | **1,305** | **5.4** |
| **document** | **23** | **8,594** | **2.7** |

Persona moved from the thinnest tier to comfortably mid-pack. Templates more than caught up
with its own prior baseline. Document is still the smallest ratio of the three — expected,
since it is by far the largest and most domain-heavy file — but it went from "invisible
unless failing" (6 of 7 events were failure paths) to a full lifecycle: every query now logs,
and every attempt now logs `requested`, `computing`, `proposed`, `settled`, `unchanged`,
`stale`, and `failed`, plus compaction and recovery counts.

**Activity needed no work**, confirmed again — still one of the best-logged capabilities in
the tree.

### 4a · Document — closed

All previously-missing events now exist in `documentService.ts`:

- `document.query.completed` — wraps all four query branches (`document.list`,
  `document.load`, `document.history`, `document.attempt`).
- `document.attempt.requested` — logged after the attempt row commits, in each of
  `requestPromptCreation`, `requestPromptRefresh`, `requestFormulaEvaluation`.
- `document.attempt.computing` — logged once, at the single "start" transition inside the
  shared `runStage()` helper, covering all three attempt kinds.
- `document.attempt.proposed` — logged in each `compute*` method at its `state: "proposed"`
  transition.
- `document.attempt.unchanged` — logged in `computePromptRefresh`'s no-op branch.
- `document.attempt.settled` — logged once, inside `mutate()`, when a `settleAttempt` commits.
- `document.attempt.stale` — logged once, inside the shared `markStale()` helper.
- `document.attempt.failed` — logged both at `computePromptCreation`'s
  `initial_refresh_failed` branch and at `runStage()`'s generic catch block.
- `document.compaction.completed` / `.skipped` — added to `compact()`.
- `document.recovery.completed` — added to `recoverPendingAttempts()`, in addition to the
  aggregate count `startBackend.ts` already logged at the call site.

Verified end-to-end in `document-application.test.ts` → "the attempt lifecycle is logged
end-to-end for prompt creation and refresh", which asserts the exact event sequence for one
attempt (`requested → computing → proposed → settled`) and confirms query logging fires.

### 4b · Persona — closed, including the wrapper gap

All four previously-missing pieces now exist in `personaService.ts`:

- `persona.runtime.created` — logged once, in the `createPersonaCapability` factory.
- `persona.command` / `persona.query.completed` — dispatch-level logging for every command
  and every query (`get`, `getByName`, `list`, `render`), replacing the prior silence on
  reads.
- `isBuiltIn` field added to the existing `persona.resolve` log, covering
  built-in-vs-named resolution.
- **`persona.wrapper.declared` / `.updated` / `.deleted`** — logged at all three call sites
  (`create`'s initial declare, and `reconcileWrapper`'s declare/update/delete branches, plus
  `delete`'s wrapper teardown). These are the cross-capability Context writes at the centre
  of item #5's failure mode; item #5's actual gap is unchanged, but a partial write is now at
  least observable in the log, which item #5's own open items flagged as the cheapest real
  mitigation available.

`persona/docs/runtime.md` and `scratch/persona-design.md` are both updated to match — the
former's "Reads are not logged at all" line is gone, the latter's three "NOT implemented"
lines are replaced with the shipped shape.

### 4c · Templates — closed

`templateService.ts` gained:

- `templates.query.completed` — both `template.get` and the list branch.
- `templates.command.failed` — wraps the `execute()` call inside `command()`; a thrown error
  is logged with `commandType`/`requestId`/`errorName`/`errorMessage` and rethrown unchanged.

### Resolved open items

- **Events-per-1k-lines as a crude proxy for Document.** Not re-derived against
  application-layer-only line counts — the whole-directory number is reported above for
  consistency with the other two capabilities and with the original table. The qualitative
  finding (happy path was invisible) is what changed, not the ratio's precision.
- **The synchronous-writer dependency** is resolved — see item 3. Document's dense
  attempt-lifecycle logging now writes through the buffered stream, not a blocking
  `appendFileSync` per event.
- **Order of work** — followed as suggested: Persona → Templates → Document.
- **Level gating for the attempt lifecycle** — decided against. Every state logs at `info`.
  The original concern (flooding under load) was judged less important than having a
  uniform, greppable level for the entire lifecycle; revisit if volume becomes a real
  problem.

---

## 5 · Persona ↔ Context partial-write gap

✅ **DONE 2026-08-02.** Solved structurally, not by self-heal-after-the-fact.

Persona writes to `contexts.db` (the private wrapper) and then to `personas.db`, with no
transaction spanning the two. If the first commits and the second does not, the two disagree.
Crash-only today, since all Persona commands run on the serial queue and no in-process caller
mutates Persona.

**What shipped.** An initial `getByName`-based self-heal design was implemented and then
discarded: it detected a stale wrapper pointer after the fact, but didn't actually prevent
`update()`'s CAS race from being lost in the first place. The shipped design instead reorders
each method so a lost race can, at worst, leave one harmless orphaned private wrapper — never a
persona record whose wrapper pointer is stale or missing:

- **`create`** is unchanged: it declares the wrapper, then inserts the row. A failed insert
  orphans the wrapper; there is no row yet to reconcile against, so the caller just retries.
  This gap remains accepted as unfixable at this point in the sequence.
- **`update`** never mutates an existing wrapper in place. When the context reference changes,
  it always `declare()`s a **brand-new** wrapper first — which always starts at revision 1, so
  it can never itself go stale — then CAS-writes the persona row to point at it. If that CAS is
  lost, the freshly declared wrapper is simply abandoned (logged, never repaired); if the CAS
  succeeds, any *previous* wrapper is deleted afterward as best-effort cleanup, whose own
  failure just orphans it without undoing the already-committed update. A new
  `sameContextEntry()` check skips Context entirely when the context is resubmitted unchanged.
- **`delete`** was reordered to CAS soft-delete the persona row **first**, and delete the
  wrapper **after**, as best-effort cleanup — mirroring `update`'s ordering.

`PersonaContextPort` was pared down to exactly `declare()` and `delete()` — no `update()` or
`getByName()`, since nothing reads or mutates a wrapper in place anymore.

Every orphan-on-failure path is logged as `persona.wrapper.orphaned` (`warn`), replacing the
old `persona.wrapper.updated`/`.repaired` events, which no longer apply.

Docs updated: `persona/docs/invariants.md` ("Non-guarantees" section rewritten around the
declare-before/delete-after ordering, including why it's safe under genuine concurrency, not
just crash-only), `persona/docs/runtime.md` (method table, wrapper-reconciliation table, a
renamed "Ordering: declare-before, delete-after" section, and the updated event list),
`persona/docs/types.md` (`PersonaContextPort`'s narrowed shape), and `scratch/persona-design.md`
("The private wrapper can be orphaned by a partial write" bullet rewritten to match).

Tests: `persona.test.ts`'s fake Context port was cut down to `declare`/`delete` plus a
`failNextDelete()` hook; the old `setLive()`-based self-heal tests were removed and replaced
with two tests exercising the new failure modes — a genuine concurrent `Promise.allSettled()`
race losing an `update()` CAS (asserting exactly one `persona.wrapper.orphaned` log and no
thrown-away persona state), and a failed best-effort wrapper delete being logged rather than
thrown. `persona-wiring.test.ts`'s `createNoopContext()` was simplified to `declare`/`delete`
only, and its wrapper-lifecycle assertion updated to count `declared`/`deleted` log events
rather than asserting an `update` call. All 42 tests across both files pass.

### Resolved open items

- **The failure mode is eliminated, not self-healed.** A prior self-heal-based design was
  implemented and discarded in favor of this ordering fix, because self-heal only detects
  drift after the fact while this ordering makes the drift structurally impossible.
- **Revisit trigger.** None remaining for this class of gap — the ordering is safe under
  genuine concurrency (two callers racing the same persona each declare their own wrapper
  independently; only one wins the persona-row CAS), not just crash-only, so the serial-queue
  caveat from the prior design no longer applies.
- **Item 4b overlap.** `persona.wrapper.declared`/`.deleted` were already shipped by item 4;
  this item adds `persona.wrapper.orphaned` alongside them (superseding the `.updated`/
  `.repaired` events from the discarded self-heal design, which never shipped to `main`).

---

## 6 · `ContextValidationError`

✅ **DONE 2026-08-02.**

**Three bare-`Error` sites, not one** — this was previously understated:

| `context.ts` | Throws |
|---|---|
| `declare` line 103 | `Error("Entries exceed maxEntriesPerContext (…)")` |
| `update` line 127 | `Error("Entries exceed maxEntriesPerContext (…)")` |
| `composeNamed` line 214 | `Error("displayName is required")` |

The job-wiring `contextErrorResponse` ladder caught all three only via its generic fallback,
so each became `400 bad_request` with a raw message rather than a typed code.

**What shipped.** One class, `ContextValidationError(field, reason)`, matching the
`PersonaValidationError`/`DataValidationError` precedent — added to `context/types.ts` and
exported from `context/index.ts`. All three throw sites now use it. The job-wiring ladder in
`registerContextEndpoints.ts` gained a `context_invalid` (400) entry ahead of the generic
`bad_request` fallback, carrying the error's `field`.

The real bug the open items flagged — `composeNamed` never checked its *combined* union/difference
result against `maxEntriesPerContext`, only `declare`/`update` checked their input — is also
fixed: `composeNamed` now throws the same typed error if the combined result exceeds the limit.

`maxEntriesPerContext`'s default was bumped from 1,000 to 100,000 ("very large", per the
original note) in both `apps/backend/etc/configuration.yaml` and `loadBackendConfig.ts`'s
`defaults` object.

Docs updated: `context/docs/invariants.md` (limits table, new composeNamed enforcement note),
`context/docs/types.md` (error family table, new default).

Tests added to `context.test.ts`: typed-error assertions (with correct `field`) for
`declare`/`update` over the limit, `composeNamed`'s empty-`displayName` case, the newly
enforced `composeNamed` combined-result-over-limit case, and a wire-level test confirming
`registerContextEndpoints` maps `ContextValidationError` to `400 context_invalid`.

### Resolved open items

- **One class, not two** — `ContextValidationError(field, reason)`, following the
  `PersonaValidationError`/`DataValidationError` precedent.
- **Wire code** — `context_invalid` added; status stays 400.
- **`composeNamed` enforcement gap** — fixed in the same pass, using the same typed error.

---

## 7 · Context bindings belong on the Template record

✅ **DONE 2026-08-02.** Landed with `name`, `template.update`, `template.load`, and the
`entry` → `target` rename. Typecheck clean, **297 tests pass** (baseline 262).

What shipped beyond the original item:

- **`name` on every record** — required at registration, trimmed at ingress, unique per
  `(kind, name)` case-insensitively. Not defaultable: mutating adapter methods return `void`,
  so Templates cannot read the source's title, and the backing copy's title is sealed anyway.
  The index carries no partial predicate — deletion removes the live row, so a name is freed
  by construction — and it covers `reserving` rows so a collision surfaces before the adapter
  call rather than after a backing copy exists.
- **`template.update`** — catalog declaration and backing content in one command, CAS on
  `expectedRevision`, and the first compare-and-swap in this capability. It archives the
  replaced record into history at its old revision, which the revision/history model requires:
  every other transition leaves a record, and skipping it would make `latestSnapshot` report
  pre-update state as current.
- **`template.load`** — reading a backing copy crosses the Templates boundary, because
  registration is designed to seal the owning capability's own read surface. This is the one
  adapter method that does not return `void`; the "nothing to validate on the way back"
  guarantee now holds for the mutating methods only.
- **`template.updated` source transaction**, admitted to the outbox `CHECK`.

**Still open, and it is the enforcement half.** Nothing seals a backing copy yet — Document
has no `isTemplate` flag and refuses nothing, so an ordinary `document.submit` against one
would still succeed and strand the declaration. Specification is in the plan (Part 4) and in
`scratch/document-design/templates-and-context-variables.md`.

---

### The defect, as originally written

**Corrected shipped code.** The headline defect from the Templates review.

`template.register` accepts `contextBindings` and **stores none of them**. A binding is
`{ entry?, description? }` and the wire decoder accepts both. The service forwards them to the
adapter. But Templates has no bindings column, and the adapter's only destination is the
resource's variable state, where `DocumentContextVariable` is `{ id, name, target? }` — no
description field. The addendum even states binding descriptions are "never written into
destination Document state."

So a caller supplies a description, gets a 201, and it is gone: not stored by Templates, not
storable by Document. Accepted at the door, dropped on the floor. `template.get` then returns
a record with no bindings at all, which makes the catalog useless for its main job — telling
a caller what knobs a template exposes.

### The model

**The bindings declared at registration are the template's parameters.** Anything not
declared is not a knob; it is baked-in content. The record is self-sufficient — no adapter
round-trip, no read-through.

```ts
export interface TemplateRecord {
  readonly id: string;
  readonly kind: string;
  readonly resourceId: string;
  readonly description?: string;
  /** The template's declared parameters. */
  readonly contextBindings: TemplateContextBindings;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Store-internal. Never returned. */
export interface StoredTemplateRecord extends TemplateRecord {
  readonly state: TemplateRecordState;
  readonly deletedAt?: string;
}
```

`state` and `deletedAt` come off the public record — they are reservation and filtering
mechanics, and any record a caller can retrieve is by definition ready and live.

`entry` is renamed **`target`** and stays optional, now reading more cleanly: at registration
it means "a declared parameter with no default" rather than the awkward "explicitly unbind".
One rule covers both sites — target omitted → the destination's variable is unbound.

`description` only makes sense at **registration**; at instantiation you supply an argument,
not a declaration. The instantiate decoder therefore uses `exactKeys(["target"])` so a
description there is a 400 rather than silently ignored — the same class of bug this item
fixes.

### What changes

- `templates/domain/model.ts` — the split above.
- `templates/persistence/sqliteSchema.ts` — `context_bindings_json BLOB NOT NULL`, following
  the `mentions_json` precedent in `comments/persistence/sqliteSchema.ts`.
- `sqliteMappers.ts` — encode/decode with the existing `encodeJson`/`decodeJson`.
- `templateService.register` — persist bindings on the reserved row **and** keep forwarding
  them to the adapter. `instantiate` is unchanged: it forwards only the caller's overrides,
  because the backing resource already holds the defaults in its variable state.
- `scratch/templates-design.md` — add `contextBindings` to the record; state that declared
  bindings are the parameters; note `state`/`deletedAt` are storage mechanics.

### Resolved — both former open items, now shipped

Full implementation plan: `.claude/plans/mellow-wandering-shannon.md`.

- **Drift — closed by gating, not accepted.** The earlier note accepted a stale declaration
  for v1. That is no longer the design: `template.update` becomes the *only* path that
  changes a registered template, writing the declaration and forwarding the content edits in
  one command, and the resource capability refuses ordinary edits to a template-mode
  resource. There is then no way to change a template's variables that does not also update
  the declaration.
- **`template.update` — in scope.** Carries `description`, `contextBindings`, and
  `resourceOperations`. Needs `revision` + `updatedAt` on the record (Templates has no
  revision today; records are immutable after `markReady`) and a `updateTemplateCopy` adapter
  method — free right now, since `TemplateResourceAdapter` has zero implementations.
- **Bindings are constitutive.** A template is a resource as a function of its Context
  Variables; the declared bindings are that function's parameter list and part of the
  template's identity. They are persisted and returned, not forwarded. The backing resource
  separately holds each variable's applied target; neither side is derivable from the other,
  and a binding `description` has no home anywhere but the record.
- **`entry` → `target`** inside context bindings, at registration and instantiation.
  `ContextEntry` itself stays: `kind` is load-bearing in three verified places.
- **Activity vocabulary is `transaction`, not `fact`.** Comments already ships the right
  names (`CommentCommittedTransaction`, `source_transaction_id`, `transaction_outbox`);
  Templates and Document still say "fact". Templates renames as part of this work and adds a
  `template.updated` transaction kind. Document's rename is separate — see item 12.

### Still open after this item

- **The sealing half** — Document's `isTemplate` flag and its public-surface refusal. Without
  it, `template.update` is the only *intended* path to a backing copy, not the only possible
  one.
- `template.list` has no pagination contract.
- Registration is deduplicated by `requestId` only, not by source, so two concurrent
  registrations of the same resource produce two templates (with different names).

---

## 8 · Remove `maxTemplatesPerProject`

✅ **DONE 2026-08-02.** Removed the per-capability cap from the model, service, store port and
SQLite adapter, error ladder, configuration type/parser/YAML, and documentation. Command
admission remains serial because a pending claim and external adapter call cannot be one
atomic store operation.

The loader now ignores a legacy `templates:` YAML section; a regression test confirms that
behaviour. Any future catalog-size restriction is deferred to a global resource-quota policy.

---

## 9 · Per-command `origin`

✅ **DONE 2026-08-02.** Every Template command now requires an envelope origin of `user`,
`agent`, `automation`, or `system`; `interactive` is rejected. The origin is deliberately
outside the canonical command digest, so different-origin retries replay normally.

Registration and deletion persist their origin in the local Activity outbox and pass it to
Activity directly. Existing outbox tables migrate with `user`, preserving the historical
hardcode; a regression test seeds and upgrades such a table. Document and Comments retain
their separate origin contracts.

---

## 10 · Templates dead code and naming

✅ **DONE 2026-08-02.** Removed the unthrown `TemplateValidationError`, made
`canonicalize` module-private, and renamed the injected ID factory to `createId`. With the
catalog cap removal, no exported Templates error class lacks a throw site.

The broader zero-throw error-class sweep remains a separate decision for Derived Outputs,
Investigation, and Connector; it is not a reason to delete their classes blindly.

---

## 11 · Context tombstones reach callers

✅ **DONE 2026-08-02.** The tactical `deleted_at IS NULL` predicate was superseded by the
shared current/history model in item 13. Context's typed current table contains live rows
only; update archives the previous revision, and delete archives the last live snapshot,
appends a terminal deletion revision, and removes the current row in one transaction.

Consequently `get`, `getByName`, `list`, `update`, `delete`, `resolve`, union/difference, and
nested composition cannot observe a deleted Context through a forgotten predicate. A second
delete is a normal not-found result because there is no current resource to delete.

Deterministic identity does not require current tombstones. Connector and General Files use
their capability history to allocate the next revision when the same provider/locator or
content hash is registered before purge. That can resemble reactivation, but it is ordinary
deterministic re-registration: deleted resources remain absent from current storage and from
Knowledge.

---

## 12 · Activity ID allocation — doc drift

✅ **DONE 2026-08-02.** Activity owns ledger identity. Producers commit a stable
`sourceTransactionId` with accepted work and pass it as
`ActivityTransactionInput.idempotencyKey`; Activity deterministically derives
`ActivityTransaction.id = act_<sha256(idempotencyKey)>`. Equal retries therefore address the
same ledger row, while changed content under the same source key conflicts.

Producer terminology is consistently transaction-based:

- `DocumentCommittedTransaction`, `TemplateCommittedTransaction`, and
  `CommentCommittedTransaction`;
- `sourceTransactionId` in TypeScript and `source_transaction_id` in SQLite;
- `transaction_outbox` plus transaction-named store, publisher, recovery, mapper, and logging
  methods.

Because backend data is disposable, only the renamed schemas are initialized; there is no
outbox migration or compatibility lookup for source IDs previously used directly as Activity
IDs. Activity remains append-only and is excluded from revision-history retention and purge.

---

## 13 · Deletion as a revision, not a flag

✅ **DONE 2026-08-02.** Every user-facing resource now follows one current/history contract:

- a typed current table contains exactly one live row and its current revision;
- a capability-owned history table contains superseded snapshots and terminal deletion
  records;
- update archives revision `N` and writes current revision `N + 1` atomically;
- logical delete archives revision `N`, appends terminal revision `N + 1`, and removes the
  current row atomically; and
- normal reads query current storage only, with no `deletedAt`, `trashed`, tombstone filters,
  restore, or reactivation path.

Irreversible purge is distinct from logical delete. It rejects live resources, requires a
terminal deletion record, and removes retained history plus capability-owned data without
creating an Activity transaction. A 30-day retention sweep prunes old history for live
resources and invokes purge when a deleted resource's terminal record ages out. It never
prunes Activity, transaction outboxes, receipts, or claims, and it does not run `VACUUM`.

General Files and Connector consult retained history when deterministic re-registration
reuses an ID, so the new current revision continues from the historical maximum. After
physical purge no allocation history remains and the same identity begins again at revision
`1`. Logical deletion removes all Knowledge sources immediately; only history remains.

---

## 14 · Document deletion

✅ **DONE 2026-08-02.**

Documents now use the same current/history model as every other user-facing resource.
`trashed` and `DocumentNotTrashedError` are removed; `active` and `archived` are both live
lifecycle states.

`documents` contains current heads only. `document_resources` is the stable internal root for
retained Bases, Change Sets, identities, history, and owned-output references.
`document_history` stores superseded head envelopes and the terminal deletion revision.

`document.delete { documentId, expectedRevision }` validates the current head, logically
deletes every owned Derived Output, archives head revision `N`, appends deletion revision
`N + 1`, stages a durable `document.deleted` source transaction, and removes the current
Document and current-scoped operational state. It is exactly replayable from the surviving
transaction outbox and returns `{ type: "document.deleted", documentId, revision: N + 1 }`.
Normal list and unqualified load queries read current `documents` only. Revision-qualified
loads can reconstruct retained revisions from the stable root.

`document.purge { documentId }` rejects a live Document, requires terminal deletion history,
purges retained owned Derived Outputs, and then removes `document_resources`, cascading Bases,
Change Sets, identities, retained output references, and Document history. It produces no
Activity transaction. Transaction-outbox rows intentionally survive purge so delivery and
ledger deduplication are not subject to resource-retention policy.

The retention sweep anchors a Base at the earliest retained Document revision before pruning
older Bases, Change Sets, and head envelopes. This preserves reconstruction for every retained
revision of both live and logically deleted Documents.

---

## 15 · Live project-scoped Context

✅ **DONE 2026-08-02.** Shipped. `{ kind: "project" }` expands at resolve time via a `ProjectMembershipPort` that
`1-init` satisfies with the resource registry; `excludes` sits on `ContextRecord` and is
subtracted from that record's own expansion; and `composeNamed` now stores a rule rather
than a snapshot, so a composition tracks its operands instead of freezing them.

The design and the decisions are in [`context-design.md`](context-design.md) and the
capability's own [docs](../apps/backend/src/3-capabilities/context/docs/README.md). Three
things worth recording here because they were judgement calls, not mechanics:

- **Exclusions match on `id` alone, not `kind:id`.** The expansion is spelled by whichever
  capability owns the resource; the exclusion is spelled by whoever typed it. Requiring the
  kinds to agree lets an exclusion silently fail to subtract, which leaks exactly what
  someone asked to withhold. Over-excluding merely narrows a scope.
- **A cycle or depth cut inside an exclusion list withholds the whole record.** On the
  include side a cut branch is a harmless omission. On the exclude side the same rule hands
  back the withheld resources, so it fails the other way and logs at error.
- **No membership port, or an enumeration that throws, expands the project to nothing.** An
  empty result is visible; a silent whole-corpus grounding is not.

The knock-on below is done too. `Knowledge.resolveScope` no longer reads a zero-length array
as the whole project, and `DerivedOutputService.refresh` refuses an output whose definition
names nothing rather than answering it from everything — see the retirement note after the
original text.

### Original statement of the problem

**Needed, not yet possible.** A caller must be able to express *"the whole project, less
these five resources"* and have it stay correct as the project changes. Today
`composeNamed("difference", …)` materialises a static entry set at compose time, so such a
context is stale the moment anything is added to the project.

The blocker is that a `ContextRecord` holds a **set**, not a **rule**. Both halves have to
become resolve-time:

```ts
interface ContextRecord {
  // …existing fields…
  entries: ContextEntry[];      // may include { kind: "project" }
  excludes?: ContextEntry[];    // new
}
```

- whole project → `entries: [{ kind: "project", id: "*" }]`
- whole project less five → the same plus `excludes: [ …five… ]`
- three sources less one → `entries: [ …three… ], excludes: [ …one… ]`

`resolve()` expands `entries` (recursing into contexts, expanding `project` to every current
source), then subtracts the expanded `excludes`. Live by construction, because neither side
is materialised at write time.

Knock-on effects worth deciding with it:

- **Knowledge's implicit rule.** ✅ **Retired 2026-08-02.** `resolveScope` treated a
  zero-length entry array as whole-project retrieval. That was not merely a second spelling —
  it was a trap, because an empty array is what you get by *accident*: `declare()` coerced a
  missing field with `?? []`, both derived-output HTTP handlers coerced any malformed body
  value to `[]`, a Prompt Block whose Context Variable was never bound resolves to `[]`, and
  the `context_entries` column defaults to `'[]'`. Every one of those silently produced a
  confident answer drawn from the whole corpus.

  Now: absent is unscoped, `[]` admits nothing and logs at warn, and the project must be
  named. `refresh` refuses an output whose definition names nothing with
  `DerivedOutputEmptyScopeError` → 400 `empty_scope`, checked before an attempt row exists so
  there is no attempt, no usage, and no failed revision. Both HTTP handlers now validate
  `contextEntries` instead of coercing it.

  `resolveScope` recognises the project entry itself as well as Context expanding it, so the
  sentinel arriving unexpanded — no resolver wired, or a caller going straight to Knowledge —
  still means the project rather than being dropped as an unknown kind and silently becoming
  empty.
- **Blast radius.** Store, wire, `resolve`, `composeNamed`, and every consumer of `entries`
  — Knowledge, Derived Outputs, Persona, and Document's context variables.
- **Cycle safety.** `project` cannot contain itself, but a context excluded from another
  context still needs the existing `seen` guard and depth bound.

Needed by Document's context variables (see
[`document-changes-design.md`](document-changes-design.md)) only for exclusions; direct and
single-context bindings work without it.

---

## 16 · Garbage collection for orphaned resources

✅ **DONE 2026-08-02.** Both leaks are closed. 16a ships as the `templates-orphans` retention port; 16b as
`derived-outputs-orphans`, in [`1-init/create/derivedOutputReaper.ts`](../apps/backend/src/1-init/create/derivedOutputReaper.ts).

**16b turned out narrower and more dangerous than written below.** Two corrections to the
original text:

- *"the cross-check against outputs that were never registered as owned at all"* would be a
  serious bug. `POST /derived-outputs` legitimately creates outputs with no owner, so a diff
  of "every output minus everything claimed" deletes all of them. The reaper never enumerates
  outputs; it asks each claiming capability what it has **released**. That is the defining
  constraint of the design.
- The claim set must be a **list of claimants**, not Document. Slides owns a byte-identical
  `prompt_outputs` table and is not yet wired into `startBackend`; a sweep keyed on "Document
  says so" would have started deleting Slides' outputs silently the day Slides shipped.

The grace period is load-bearing rather than cautious: compensation re-attaches a detached
output by ID, so only rows detached before the cutoff are past the reach of undo. Reaped
outputs are logically deleted, not purged — purge refuses a live output, and deletion leaves
history that the ordinary `derived-outputs` retention port clears on the same schedule.

A failed delete deliberately keeps its ownership row. That row is the only record the output
needs reaping, so dropping it would lose the leak rather than close it.

**A separate defect surfaced while mapping this**, and is fixed: `duplicate` set
`creationAttemptId` to the command's idempotency key, but that column is a real foreign key
into the attempts table. Every copy of a Document containing a Prompt Block failed — *after*
declaring one Derived Output per block. So 16b's leak was not a rare crash window at all; it
was certain, on every template instantiation of a Document with a prompt. The copy path now
omits the field, since a copy has no attempt.

### Original statement of the problem

**Explore.** Two known leaks, both of the same shape: a resource that was created for an
owner that never came into existence, or that outlived it. Neither is reachable by any
query, so neither is currently recoverable.

**16a · Template-mode Documents with no catalog row.** Registration creates the backing
Document first and writes the Templates catalog row second. A crash in between leaves an
`isTemplate` Document that no `TemplateRecord.resourceId` points at. It is **completely
unreachable**: `document.list` excludes template-mode rows, every other Document endpoint
refuses a sealed document, and `template.list` only knows about catalog rows — which is
precisely what this one lacks. Nothing but a sweep can see it.

Created deliberately. The trade and its bounds are [AR-1](#ar-1--registration-can-leak-an-orphaned-backing-resource);
this item is the fix that would close it.

**16b · Derived Outputs with no Prompt Block.** An output declared for a Prompt Block whose
creation then failed, or whose Document was copied and the copy abandoned. Document already
tracks `prompt_outputs` ownership with a `detached` state and has a partial index for it, so
this is partly modelled already — what is missing is the sweep that acts on it, and the
cross-check against outputs that were never registered as owned at all.

Shape, if pursued: an interval job in the style of `ConnectorSyncScheduler` — the one
existing recurring-work precedent — enqueuing an ordinary Job rather than doing work on the
timer. It must be **conservative**: only reap rows older than a grace period, and only when
the owner's absence is positive rather than merely unobserved, since a sweep racing a
half-finished create would delete live state.

Both leaks are benign today (invisible rows, no correctness impact), which is why this is
exploration rather than a fix.

---

## 19 · Structured Data revisions should propagate to dependents

**Explore.** A Structured Data entry's `revision` advances when *that entry* is edited. It
does not advance when something it depends on changes.

```text
Orders          revision 12    ← someone appends rows, now revision 13
Total = SUM(Orders.amount)     ← revision 4, unchanged, value completely different
```

So a derived entry's revision is not a change signal. Anything that caches a value keyed by
revision — a Structured Analytic pull receipt or freshness check, a document snapshot, any
future materialization — reports "unchanged" while the number on screen has moved.

**Why not a digest.** A value digest detects the change but cannot explain it: it says
"different from what you had" without saying what it was, why, or where to look. A revision
is an *address* — a point in that entry's history you can go and inspect — and that property
is only true if revisions move when values do. This is why digests were removed from the
Structured Analytic pull receipt rather than added to it.

**The change.** When an entry's revision advances, advance the revision of every entry
transitively dependent on it, in the same transaction.

The dependency graph mostly exists already. Formula computes symbolic and observed
dependencies (`0-platform/formula/dependencies.ts`), and the resolver tracks which entries
wait on which during its fixpoint passes (`waitingDependencies` in
`1-init/create/formula-name-resolver.ts`). What is missing is persisting that edge set on the
Structured Data side so a write can walk it without a full resolve.

**Consequences to settle before building:**

- **Write amplification.** Editing a widely-referenced table bumps many rows in one
  transaction. Bounded by the graph, but worth measuring.
- **Cycles.** Formula already rejects cyclic bindings (`cycle_error`), so the graph is a
  DAG — but the propagation walk needs its own guard rather than trusting that.
- **History volume.** Every capability now archives a snapshot per revision (item 13). A
  propagated bump writes history for an entry whose *authored* content did not change, which
  is arguably noise. That may argue for separating "authored revision" from "value revision",
  at which point receipts should carry the value revision.
- **It fixes a latent cache bug.** `buildSnapshot()` caches on a signature built from
  `id:revision:displayName:kind`. Today a derived entry's value can change without its
  revision moving, so that signature can miss a real change. Propagation makes the signature
  correct — a second, independent argument for this change.

**Who is waiting on it.** Structured Analytic's `analytic.check` is a reliable *changed*
detector and an imperfect *unchanged* one until this lands. That is a documented limitation
there, not a blocker.

---

## 20 · Quoted names — decide whether we actually want them

**Explore, and the default answer is no.**

Structured Data restricts display names to `FORMULA_IDENTIFIER`
(`^[A-Za-z_][A-Za-z0-9_]*$`), so a table cannot be called `Q3 Orders` at all. Formula in turn
has no syntax for referencing a name that is not a bare identifier.

The Structured Analytic work added the **lexer half** — a backtick form, `` `Q3 Orders`.region ``,
which lexes to an ordinary identifier carrying the decoded text and needs no parser, binder, or
resolver change. It is currently **inert**: nothing can create a name that requires it.

**The open question is the other half, and it is a product question, not a technical one:**
should a project be able to name data anything it likes?

Arguments against, which is why this is parked rather than scheduled:

- Every name becomes something an author may have to quote, and forgetting the backticks is a
  confusing error rather than an obvious one.
- The identifier rule is a useful forcing function: names that are legal identifiers are legal
  everywhere — formulas, compiled analytics, saved entries — with no escaping story.
- Relaxing it is one-way in practice. Once names with spaces exist, tightening the rule breaks
  existing projects.

If the answer stays no, the lexer half should be **removed** rather than left as dead syntax —
it is a handful of lines in `lexer.ts` plus its tests. If the answer becomes yes, relaxing
`FORMULA_IDENTIFIER` is the only remaining change, because the lexer half already landed.

Either way this is a decision to make deliberately, not to discover.

---

## 21 · Log content in dev, shape in production, behind a label

**Agreed, wanted soon.** Today's convention is that logs carry *shape only* —
counts, enums, ids, durations — and never names, titles, field values, or rows.
Several capabilities have regression tests asserting exactly that.

That is the right rule for a production build and the **wrong** rule for the one
we are actually running. While building, content in the log is the fastest way to
see what happened, and it exposes problems earlier and more reliably than tests
do. We should be logging as much as we can, content included.

### The shape of the change

Do not solve this by loosening the existing rule, which would leave nothing to
tighten later. Instead, **label what a record carries** and let configuration
decide which labels are written:

```text
logger.debug("structured-analytic.definition.validated", data, { detail: "shape" })
logger.debug("structured-analytic.definition.source",    data, { detail: "content" })
```

- A `logging.detail` configuration value selects which labels are recorded —
  something like `shape` for production and `content` (meaning everything) for
  development, defaulting to the developer-friendly setting.
- Migration is then mechanical: the switch from dev to production is one config
  value, not an audit of every call site.

Open questions worth settling when this is picked up:

- **What is the label vocabulary?** `shape` and `content` is the minimum. A third
  for identifiers that are sensitive-but-useful (actor ids, project ids) may earn
  its place; more than three probably will not.
- **Where does the label live** — a third argument, a field inside `data`, or a
  distinct method? A third argument keeps `data` clean and stays additive.
- **What happens to the existing no-content tests?** They should assert the
  *production* setting still redacts, rather than being deleted.

### Sequencing

**Additive first, migrate second.** Add the optional label and the config value
without changing any existing call site; every current call keeps its meaning and
defaults to the label it already implies. Capabilities then adopt content logging
one at a time.

Deliberately **not** being done inside the Structured Analytic branch: touching
the shared `Logger` while several capabilities are in flight invites conflicts
for no benefit. That work logs shape only for now and will migrate with everyone
else.

### ✅ Mechanism landed 2026-08-02

The additive half is done, exactly as specified above:

- `LogDetail = "shape" | "content"` and an optional third argument
  `{ detail }` on all four `Logger` methods. The third-argument form won, for
  the reason given above — `data` stays clean and every existing call site keeps
  compiling untouched.
- **Unlabelled means `shape`**, so no existing record changed meaning. Turning
  production on cannot silently start dropping things nobody labelled.
- `logging.detail` in configuration, defaulting to `content`. An unrecognised
  value resolves to `content`, so a typo fails toward *more* logging — the safe
  direction while this is a development setting.
- A content-labelled record in `shape` mode is **dropped whole, not redacted**.
  A half-redacted record is worse than an absent one: it looks complete.
- The label is written into the entry, so a reader can filter after the fact
  rather than only at write time.

Covered by `test/capabilities/logging-detail.test.ts`, which also pins the
production behaviour rather than deleting it.

**Migration is per capability and ongoing.** Templates and Document now log
content — names, descriptions, bindings, prompt text, resolved context entries,
submitted operations, and what a search matched. Everything else still logs shape
only and adopts when it is touched.

---

## Reference · Delegated command claims (removed 2026-08-02)

**Removed, not just declined.** This mechanism existed only for
`prompt.update-definition` and was fully removed after a closer look showed it earned
nothing: the two things it seemed to protect against were both already impossible for
other reasons.

### What it looked like it protected against

A command that has to cause an effect in **another capability's store** cannot be made
atomic — there is no transaction spanning two SQLite files, and no two-phase commit. The
apparent risk was **retargeting**: an exact retry, after resolving the target fresh from
the current snapshot instead of reusing what the original attempt saw, could land on a
*different* Derived Output than the one it originally updated, if the Prompt Block's
output reference had changed in between.

### Why that risk doesn't actually exist

Both halves turned out to already be closed off elsewhere, independent of this mechanism:

- **A Prompt Block's `output.outputId` never changes to a *different* output.** Refresh
  (`settlePromptRefresh`) only ever bumps `appliedRevision` on the same id; nothing else
  writes that field. Traced in `documentService.ts`'s `settlePromptRefresh`.
- **A deleted block's id cannot be reused to attach a different output.** Document's
  identity ledger tombstones every structural id (including block ids) on delete and
  rejects reuse by default (`DocumentIdentityReuseError`); the one exception,
  `document.compensate` (undo), restores the exact prior state, not a different one.

So the target a retry resolves fresh is always the same target the original attempt saw,
or the block is gone entirely. There was no retargeting scenario to guard against.

### What the claim actually bought, once that was clear

Exactly one thing, in exactly one narrow window: **Derived Outputs' `updateDefinition` is
already idempotent on its own** (keyed by the `idempotencyKey` Document passes it,
deterministic from `(documentId, requestId)`), so a retry after a crash between the
external call succeeding and Document's own receipt commit already replays the same
result safely with no claim at all — *unless* the addressing Prompt Block was deleted in
that same window, in which case the retry can no longer resolve `promptBlockId → outputId`
without a frozen copy of it. The claim's only job was making that one specific
crash-then-delete-then-retry sequence resumable instead of erroring.

### What it cost for that

- A table (`delegated_command_claims`), three store methods (`claimDelegatedCommand`,
  `completeDelegatedCommand`, `getDelegatedCommandClaim`), and a result union.
- A read on **every** command, not just this one, for a reuse guard
  (`assertDelegatedRequestReuse`) that only ever mattered for this one command type.
- Two writes per definition update instead of one.
- A **second durable idempotency mechanism** alongside the plain command-receipt table,
  doing an overlapping job for no additional correctness.

### What shipped instead

`updatePromptDefinition` now: checks the plain submission receipt for replay (identical to
every other command), resolves the Prompt Block from the current snapshot, calls
`derivedOutputs.updateDefinition` with the same deterministic idempotency key as before,
and writes the result via the store's existing (previously unused by this path)
`recordSubmission`. No claim, no reuse guard, no second table.

**One accepted, narrower behavior change:** if the process crashes after the external
call commits but before the local receipt does, *and* the Prompt Block is deleted before
the client retries, the retry now fails with `Prompt Block not found` instead of resuming
the completed result. The external update itself is never duplicated or lost either way —
only whether the retry can still be *replayed* changes. This is covered by two tests in
`document-application.test.ts`: "prompt.update-definition survives a crash before its
local receipt commits" (the common case — still fully recoverable) and "prompt.update-
definition fails cleanly if its Prompt Block is deleted during a crash window" (the one
narrowed case, now a plain, well-understood error rather than a resumed result).

### Why the reasoning below still holds for Persona

The "why it was declined for Persona" analysis was written before this mechanism was
reconsidered for Document itself, but the distinction it draws remains correct and is
_why_ Document's own claim turned out to be removable too, not just Persona's:

- **Retargeting** requires some other write path that can point the same address at a
  *different* target between attempts. Document has none for `promptBlockId → outputId`
  (see above); Persona has none for `personaId → wrapperId` either, since the wrapper's
  identity is deterministic from the immutable persona id.
- **A partial write** (the address's own record fails to persist) is a different, real
  risk, and is what item 5's declare-new/CAS/delete-old ordering solves for Persona
  structurally. Document's equivalent gap (crash before `recordSubmission`) is left as an
  accepted, narrow case per above, rather than solved with equivalent ordering machinery,
  because the acceptable fallback (a clear "not found" error on an already-rare compound
  condition) is cheaper than the mechanism would be.

---

## 22 · Audit what we do with caller-supplied strings

**Agreed — explore.** [Item 18](#18--like-wildcards-are-not-escaped-in-text-search) was one
instance of a general shape: a caller-supplied string reaches a place that gives some
character a meaning, and nobody escaped it. That one was `LIKE` wildcards. It is unlikely to
be the only one.

**Why this is worth a pass rather than a fix.** The bug was not "we forgot to escape". It was
that two capabilities each wrote a filter, one escaped and one did not, and nothing compared
them — so the same question returned different answers depending on who answered it. Finding
the next one means looking for the *pattern*, not the symptom.

### What to look at

- **SQL** — `LIKE` is done. Check `GLOB` (a different wildcard vocabulary: `*`, `?`, `[…]`),
  `REGEXP` if it is ever registered, and any `json_extract` path built from input. Table and
  column names are interpolated in this codebase, but only from `projectId` hashes and
  literals; confirm that stays true.
- **Regex construction.** Anywhere a `RegExp` is built from a caller string, an unescaped `.`
  or `(` changes what matches, and a pathological pattern is a denial of service against our
  own worker.
- **Identifier round-tripping.** Names that are trimmed, case-folded, or normalised on the way
  in but compared raw later, or vice versa — the two Context Variable resolvers were nearly
  this bug.
- **Formula and expression text.** Structured Data and Document both accept expressions; those
  have their own parsers, so the question is whether anything *else* re-interprets that text.
- **Path construction.** File names from callers reaching `join()`. General Files stores
  content in SQLite rather than on disk, so this may be empty — worth confirming rather than
  assuming.
- **Log and error messages.** A name containing a newline can forge a log line, since records
  are JSON-per-line. `JSON.stringify` handles it, but only where we actually stringify.

### The output

Not a fix list — a **table of every place caller text acquires meaning**, with what escapes it
and where that escaping lives. Item 18's answer was a shared helper in `0-utils/persistence/`;
some of these will want the same, and some are genuinely local. The value is knowing which is
which.

---

## 23 · Test files are not typechecked

**Status:** agreed — worth doing, small

`apps/backend/tsconfig.json` is `"include": ["src/**/*.ts"]` with `rootDir: "src"`, and
`pnpm test` runs `tsx`, which strips types without checking them. So **nothing under
`test/` is ever typechecked**, by either script.

Found while reviewing Structured Analytic Phase 2, where a test existed solely to
catch drift between the domain limits type and the config section:

```ts
const fromConfig: StructuredAnalyticLimits = DEFAULT_STRUCTURED_ANALYTIC_LIMITS;
assert.equal(typeof fromConfig.maxDescriptionBytes, "number");
```

The annotation is inert. The test could never fail for the reason it was written, and
the comment above it claimed a guarantee it did not provide. It has been replaced with
a runtime key-set assertion, but the general problem stands: every type annotation in
every test file is decoration, and the ones that look like drift detectors are worse
than nothing because they stop anyone from writing a real check.

Two consequences, both real:

- **Assertions that read as compile-time checks silently do nothing.** Test fixtures
  are `Record<string, unknown>` literals, so when a domain type gains a required field,
  no test surfaces it — the fixtures keep compiling because they were never compiled.
- **Test helpers can drift from the code they double.** `CapturingLogger` implements
  `Logger`; when `Logger` gained its third argument, nothing would have told us if the
  double had not been updated by hand.

**The fix is small:** a `tsconfig.test.json` extending the base config with
`include: ["src/**/*.ts", "test/**/*.ts"]` and no `rootDir`, wired into `pnpm typecheck`
as a second `tsc --noEmit` invocation. Nothing about how tests *run* changes.

**Expect a first-run backlog.** Years of unchecked test code will produce errors on the
first pass — implicit `any` in helpers, fixtures that do not satisfy the types they are
annotated with, doubles missing newer members. That backlog is the finding, not an
argument against it. Worth timeboxing the first run before committing to fixing it all
in one go; `skipLibCheck` and a temporarily looser `strict` for `test/**` are both
reasonable staging tactics.

**Open question:** whether the fixtures *should* be typed. Some are deliberately
malformed — the whole point of a validator test is to hand it garbage — so those want
`unknown` and a cast at the call site, not a satisfied interface. The valuable typing is
on helpers, doubles, and expected-value objects, not on hostile inputs.
