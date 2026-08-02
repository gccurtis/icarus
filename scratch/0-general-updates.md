# General updates — backend TODO

Cross-capability work that is agreed but not scheduled. **One file; check here first.**

Consolidates and replaces `resource-id-allocation.md`, `delegated-command-claims.md`,
`context-persona-update.md`, `templates-corrections-plan.md`, and
`templates-review-responses.md`. Nothing here is in progress.

| # | Item | Status |
|---|---|---|
| 1 | [Delete Slide](#1--delete-slide) | ✅ **DONE 2026-08-01** |
| 2 | [Resource IDs should be allocated, not caller-supplied](#2--resource-ids-should-be-allocated-not-caller-supplied) | agreed, not scheduled |
| 3 | [Logging architecture doc](#3--logging-architecture-doc) | agreed |
| 4 | [Logging coverage — measured](#4--logging-coverage--measured) | agreed |
| 5 | [Persona ↔ Context partial-write gap](#5--persona--context-partial-write-gap) | documenting only, not fixing |
| 6 | [`ContextValidationError`](#6--contextvalidationerror) | minor |
| 7 | [Context bindings belong on the Template record](#7--context-bindings-belong-on-the-template-record) | agreed — corrects shipped code |
| 8 | [Remove `maxTemplatesPerProject`](#8--remove-maxtemplatesperproject) | agreed — corrects shipped code |
| 9 | [Per-command `origin`](#9--per-command-origin) | agreed for Templates; open for the rest |
| 10 | [Templates dead code and naming](#10--templates-dead-code-and-naming) | agreed — corrects shipped code |
| 11 | [Context tombstones reach callers](#11--context-tombstones-reach-callers) | agreed |
| 12 | [Activity ID allocation — doc drift](#12--activity-id-allocation--doc-drift) | agreed, docs only |
| 13 | [Deletion as a revision, not a flag](#13--deletion-as-a-revision-not-a-flag) | open question |
| R | [Reference: delegated command claims](#reference--delegated-command-claims) | research, no action |

Items 7–10 correct Templates, which is **already implemented and green** (258 tests). They
are fixes to shipped code, not new build-out.

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

*Raised 2026-08-01 while designing Templates. Audit re-confirmed 2026-08-01.*

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
  request-keyed claim that stores the allocated ID — exactly the
  `template_command_claims.template_id` pattern in
  [`templates-implementation-plan.md`](templates-implementation-plan.md). Non-create commands
  still address an existing resource and are unaffected.

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

### Open items

- **Claim or receipt?** The two candidate shapes are not equivalent and the choice is
  unmade. A `template_command_claims`-style **claim** reserves the allocated ID *before* the
  write, so a crash between allocation and commit is resumable with the same ID. A
  Comments-style `request_id PRIMARY KEY` **receipt** only helps once the write committed —
  a crash before it means the retry allocates a fresh ID and orphans nothing, which may be
  perfectly fine for a create. Decide which failure actually matters here before building.
- **Structural IDs — genuinely unanswered.** See the complication above. It may well end at
  "leave them caller-supplied", which is defensible, but nobody has decided.
- **Existing documents keep their caller-supplied IDs.** IDs are opaque, so no migration is
  needed — but confirm nothing assumes a format.
- **Check the frontend.** `apps/frontend` was never read during this audit. If it generates
  document IDs, this is a breaking client change, not just a backend one.

---

## 3 · Logging architecture doc

New page, `docs/runtime/logging.md`, alongside `dual-queue.md` and
`repository-boundaries.md`; link from `docs/architecture.md`.

Distinct from `docs/platform/observability.md`, which documents the Logger *component*. This
page states the *practice* — and should say so in a line, to avoid becoming a fourth place
for the same content to drift.

Content, drawn from what the codebase already does:

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

### Open items

- **The writer is synchronous, and this doc tells everyone to write more.**
  `1-init/create/logger.ts` does `appendFileSync` per entry — one blocking write per event,
  on the request path. "Log as much as possible" and "every log line is a synchronous disk
  write" are in direct tension, and the doc should not pretend otherwise. Either it says
  buffering is a prerequisite for the denser logging in item 4, or it states the cost
  explicitly. This is already listed as known gap #10 in `09-verified-status.md`; item 4 is
  what turns it from theoretical into load-bearing.
- **Where it lives.** `docs/runtime/logging.md` is proposed on the grounds that it is a
  cross-capability rule, like `dual-queue.md`. The counter-argument is that it belongs beside
  `docs/platform/observability.md`. Pick one and link the other.
- **Enforceable or advisory?** A required-events checklist (`.runtime.created`,
  `.command.completed`, `.command.failed`, …) could be a source-scanning test in the
  `runtime-wiring.test.ts` style. That turns the doc into a gate rather than a suggestion —
  but it also makes every new capability fail CI until it logs. Worth deciding deliberately.

---

## 4 · Logging coverage — measured

Distinct log events vs. source lines, excluding `docs/`:

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

**Activity needs no work** — it was flagged as a candidate, but the numbers say it is one of
the two best-logged capabilities in the tree, with full lifecycle coverage
(`transaction.accepted`, `.read`, `.listed`, `.publish.failed`, the whole presence lifecycle,
`runtime.created`).

### 4a · Document — the real gap

7 events across 8,416 lines, and **6 of the 7 are failure paths**:

```text
document.command                              ← the only happy-path event
document.activity.publish-failed
document.internal-job.dispatch-pending
document.internal-job.dispatch-recovered
document.internal-stage.completion-pending
document.internal-stage.failure-record-pending
document.internal-stage.retrying
```

So the most complex runtime in the codebase — the freeze → compute → settle attempt pipeline
— **is invisible unless it is failing.** Missing: any query logging, the attempt lifecycle
(`requested → computing → proposed → settled`, and the `stale`/`unchanged`/`failed` terminal
branches), compaction, and per-capability recovery counts.

### 4b · Persona

4 events (`create`, `update`, `delete`, `resolve`). Missing: queries (`get`, `getByName`,
`list`, `render`), command/query dispatch, `runtime.created`, built-in-vs-named resolution,
and — most importantly — **`persona.wrapper.declared` / `.updated` / `.deleted`**. Those are
the cross-capability Context writes at the centre of item #5's failure mode, and they are
currently completely invisible.

Also update `persona/docs/runtime.md` (says "Reads are not logged at all") and
`scratch/persona-design.md` (flags three events as NOT implemented) once this lands.

### 4c · Templates

4 events, 3 of them happy-path mutations. No query logging, no failure logging beyond
`activity.publish-failed`.

### Open items

- **Events-per-1k-lines is a crude proxy and Document is the case where it misleads most.**
  Of Document's 8,416 lines, a large share is pure domain — reducer, validation, rebase,
  identities — which *should not* log at all. Re-measuring against application-layer lines
  only would give a fairer picture and might move Document out of last place. The
  qualitative finding stands regardless: 6 of its 7 events are failure paths, so the happy
  path really is invisible.
- **Depends on item 3's synchronous-writer question.** Adding attempt-lifecycle logging to
  Document means several events per attempt, each a blocking `appendFileSync`. Densifying
  the busiest capability is exactly where that cost lands. Sequence accordingly.
- **Order of work.** Persona is smallest and safest and is the one with a known blind spot
  (`wrapper.*`). Document is worst but biggest and riskiest. Templates is small. Suggest
  Persona → Templates → Document, so the pattern is settled on cheap capabilities before
  touching the attempt pipeline.
- **Does the attempt lifecycle need level gating?** `requested → computing → proposed →
  settled` per attempt at `info` could flood the log under load. `debug` may be right for
  the intermediate states with `info` only at terminal ones.

---

## 5 · Persona ↔ Context partial-write gap

**Agreed approach: leave it, document it in comments.** Not scheduled as a fix.

Persona writes to `contexts.db` (the private wrapper) and then to `personas.db`, with no
transaction spanning the two. If the first commits and the second does not, the two disagree.
Crash-only today, since all Persona commands run on the serial queue and no in-process caller
mutates Persona.

Action: comments at the three call sites in `personaService.ts`, and correct the
"Non-guarantees" section of `persona/docs/invariants.md`, which currently describes only the
`create` case.

### Open items

- **The self-heal option was not taken, and should be recorded as such.** The wrapper's name
  is deterministic (`persona:<personaId>`), so a wrapper is always re-derivable — `update`
  could verify it matches the record and repair on read, making any inconsistency transient
  rather than permanent. Cheaper than a durable claim. Declined for now in favour of leaving
  it alone; noted so the option is not rediscovered from scratch.
- **What should trigger revisiting.** A mutating in-process caller that bypasses the serial
  queue. Today the queue is what makes this crash-only, and that is an ambient property of
  the wiring rather than something Persona enforces. The comments should name that trigger
  explicitly, so the next person understands what protection they would be removing.
- **Item 4b overlaps.** `persona.wrapper.declared/.updated/.deleted` would make these writes
  visible for the first time, which is the cheapest real mitigation available — you would at
  least be able to *see* a partial write in the log. Worth doing regardless of this item.

---

## 6 · `ContextValidationError`

**Three bare-`Error` sites, not one** — this was previously understated:

| `context.ts` | Throws |
|---|---|
| `declare` line 103 | `Error("Entries exceed maxEntriesPerContext (…)")` |
| `update` line 127 | `Error("Entries exceed maxEntriesPerContext (…)")` |
| `composeNamed` line 214 | `Error("displayName is required")` |

The job-wiring `contextErrorResponse` ladder catches all three only via its generic fallback,
so each becomes `400 bad_request` with a raw message rather than a typed code.

Every other Context failure (`ContextNotFoundError`, `ContextConflictError`,
`StaleContextError`) is a typed class. Inconsistent with `08-conventions.md` ("one typed class
per distinguishable failure"). One small class plus a ladder entry. Not urgent — the status
code is already correct.

### Open items

- **One class or two?** A blank name and an over-limit entry array are different failures.
  `PersonaValidationError(field, reason)` carries a `field`, which would cover both in one
  class; `DataValidationError` in Structured Data does the same. Following that precedent
  probably beats inventing two classes.
- **Wire code.** The ladder currently emits `bad_request` for these. A typed class invites a
  more specific code (`context_invalid`), which is a **client-visible change** even though
  the status stays 400. Decide whether that matters to any existing caller.
- **`maxEntriesPerContext` is unenforced on `composeNamed`.** `declare` and `update` check
  it; the union/difference path does not, so a composition can produce a context larger than
  either operand was allowed to be. Arguably the real bug in this area, and it is not a
  naming issue at all.

---

## 7 · Context bindings belong on the Template record

**Corrects shipped code.** The headline defect from the Templates review.

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
  readonly createdAt: string;
}

/** Store-internal. Never returned. */
export interface StoredTemplateRecord extends TemplateRecord {
  readonly state: TemplateRecordState;
  readonly deletedAt?: string;
}
```

`state` and `deletedAt` come off the public record — they are reservation and filtering
mechanics, and any record a caller can retrieve is by definition ready and live.

`entry` stays optional and now reads more cleanly: at registration it means "a declared
parameter with no default" rather than the awkward "explicitly unbind". One rule covers both
sites — entry omitted → the destination's variable is unbound.

`description` only makes sense at **registration**; at instantiation you supply an argument,
not a declaration. The instantiate decoder therefore uses `exactKeys(["entry"])` so a
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

### Open items

- **Drift.** The stored declaration goes stale if someone edits the backing template's
  variables directly through the resource capability. Instantiation stays correct — the
  adapter reads live resource state — only the *displayed* declaration is stale. Accepted for
  v1. Fixing it needs either a reconciliation step or a read-through on `get`.
- **No update path.** With no `template.update`, `description` and `contextBindings` are
  immutable after registration. This is the most likely reason to want an update command;
  `updatedAt` was deliberately not added ("I don't want to add anything unnecessary").

---

## 8 · Remove `maxTemplatesPerProject`

**Corrects shipped code.** A config knob invented from one vague design clause.

`templates-design.md` said "The initial catalog is bounded by a configured project limit" —
that clause is in the original commit `c8f32d9`, so it was in the approved design. But the
doc specified no value, no config section, no error class, no status code, and no check
placement. All five were invented, which is the actual mistake: an under-specified line
should have produced a question, not 30 lines of enforcement plus a tuning surface.

Remove it, **and strike the clause** so it cannot regenerate on the next read.

- `domain/model.ts` — drop `TemplateOptions`, `DEFAULT_TEMPLATE_OPTIONS`.
- `templateService.ts` — drop the `options` constructor parameter and the `countLive()`
  check; clock and ID factory shift left.
- `domain/errors.ts` — drop `TemplateCatalogLimitError`.
- `ports/templateStore.ts`, `persistence/sqliteTemplateStore.ts` — drop `countLive()`.
- `registerTemplateEndpoints.ts` — drop the `catalog_limit_exceeded` branch **and** the stale
  reference to the limit in the serial-queue comment.
- `0-utils/config/loadBackendConfig.ts` — drop `TemplateConfig`, the `BackendConfig.templates`
  field, its `DEFAULT_CONFIG` entry, the `parsed.templates` extraction, `parseTemplateConfig`.
- `etc/configuration.yaml`, `etc/README.md`, `1-init/create/templates.ts`.
- `templates-design.md` — strike the clause; add a catalog size cap to Deferred.

**Serial admission is still required.** Claim-then-execute remains a read-then-write across
separate statements, so the queue choice does not change; only the limit half of the
justification goes away. `templates/docs/invariants.md` keeps the claim bullet.

### Open items

- **Removing the config key is safe, but confirm it.** `loadBackendConfig` merges YAML over
  `DEFAULT_CONFIG` field by field, so a leftover `templates:` section in someone's
  `configuration.yaml` should be ignored rather than throw. Worth verifying rather than
  assuming, since the loader's contract is "a missing or malformed key degrades to the
  default" — not explicitly "an unknown section is ignored".
- **Does a catalog cap come back in another form?** The design clause is being struck, but
  "unbounded catalog" is a real if distant concern. If it returns it should probably be a
  global resource quota rather than a per-capability knob — which is an argument for
  removing this one now rather than generalising it.
- **`countLive()` may have a second user later.** Persona has the same method for its own
  `maxPersonas` check. If the limit concept returns, the two should share a shape rather
  than diverge — worth a glance at Persona before deleting Templates' copy.

---

## 9 · Per-command `origin`

Templates hardcodes `origin: "user"` in the `1-init` Activity adapter — a policy decision
sitting in a mapping function. Two patterns already exist:

| Pattern | Capability | Shape |
|---|---|---|
| Construction-fixed | Comments | `CommentDependencies.attribution = { actorId, origin }` |
| Per command | Document | `DocumentCommandRequest.origin`, own vocabulary, mapped in `1-init` |

**Agreed for Templates: the Document pattern.**

```ts
export type TemplateOrigin = "interactive" | "agent" | "automation";

export interface TemplateCommandRequest {
  readonly requestId: string;
  readonly origin: TemplateOrigin;
  readonly command: TemplateCommand;
}
```

`origin` goes on the **envelope, not inside `TemplateCommand`** — it describes who is asking,
not what is asked. Keeping it out of the canonical digest means two callers issuing the same
command from different origins replay identically instead of colliding as an idempotency
mismatch.

- Add `origin` to `TemplateCommittedFact`; thread `request.origin` into `fact()`.
- `attribution` keeps only `actorId`.
- `wire/commandSchemas.ts` — add `"origin"` to the envelope's `exactKeys`; decode against the
  three values; **required**, matching `document.submit`. An absent origin is a client bug and
  defaulting it mislabels history.
- `1-init/create/templates.ts` — replace the hardcode with `activityOrigin(fact.origin)`
  mapping `interactive → user`, mirroring `createDocumentActivityPublisher`.

### Open items

This leaves **Comments** as the only capability on construction-fixed origin. Unifying all of
Document/Comments/Templates on per-command origin is worth doing in one pass so the
vocabulary stays consistent — but it is a separate change and nobody has asked for it yet.

---

## 10 · Templates dead code and naming

**Corrects shipped code.** Measured by counting `throw new` sites.

- `TemplateValidationError` — **zero** throw sites. Delete it, plus its `index.ts` export, its
  branch in the endpoint error ladder, and the test import.
- `canonicalize` in `domain/canonical.ts` — exported but only used by `canonicalDigest` in the
  same file. Make it module-private.
- `DEFAULT_TEMPLATE_OPTIONS` — goes with item 8.
- Rename the `newId` constructor parameter to `createId`, matching
  `createCommentsCapability(store, deps, options, clock, createId)`.

After this, every error class exported from `templates/index.ts` should have at least one
throw site — worth a grep before calling it done.

### Open items

- **This is not a Templates problem.** A sweep for zero-throw-site error classes across all
  capabilities found four, not one:

  | Capability | Class |
  |---|---|
  | templates | `TemplateValidationError` |
  | derived-outputs | `DerivedOutputConflictError` |
  | investigation | `InvestigationError` |
  | connector | `ConnectorAlreadyExistsError` |

  Each needs a decision rather than a blanket delete: an unthrown class may be dead code, or
  may be a real failure mode that was specified and never wired up. `ConnectorAlreadyExistsError`
  in particular looks like the latter — Connector's identity is `sha256(kind::locator)` and
  re-registering is *deliberately* idempotent, so the class may encode a rule that was
  correctly abandoned. Check each before removing.
- **Worth an architectural test?** "Every exported error class has ≥1 throw site" is greppable
  and would fit the `runtime-wiring.test.ts` style. It would have caught all four. The risk is
  false positives for classes thrown only from another capability's adapter.

**On the injected clock/ID factory generally: this is the house pattern, confirmed.** Comments
uses the identical signature; Activity injects `ActivityClock`; Persona exports
`PersonaClock`. Document is the outlier, and `08-conventions.md` already calls that out —
*"Activity instead injects an `ActivityClock`, which is the better pattern for testability."*
Neither is injected anywhere in startup: `createTemplatesInstance` passes three arguments, so
production gets the defaults (`new Date()`, `randomUUID`) and only tests override them.

---

## 11 · Context tombstones reach callers

`ContextStore.get(id)` has no `deleted_at` filter (`context/sqlite-store.ts:63`), while
`getByName` and `list` both do — **and Context's service never filters either**, so a deleted
record reaches callers. One predicate fixes all five call sites; no service code changes,
since `update`, `delete`, `resolve`, and `composeNamed` already branch on a missing record.

```sql
SELECT * FROM ${this.tableName} WHERE id = ? AND deleted_at IS NULL
```

The call site that matters is `resolve()`, which today **expands a deleted context's
entries** — the "bound-but-dangling silently keeps working" hole. After the fix such a
binding resolves to nothing and is caught by the empty-scope rule in
`document-design/templates-and-context-variables.md`, whose closing paragraph then moves from
conditional future ("If Context later tightens `get(id)`…") to present tense.

### The sweep — Context is the only leak

Eight capabilities soft-delete. Three have an unfiltered ID path; only one leaks:

| Capability | Store `get(id)` | Service filters? | Verdict |
|---|---|---|---|
| comments, investigation, persona, structured-data, templates | filtered | — | fine |
| connector | **unfiltered** | **yes** — 6 call sites | correct by design |
| general-files | **unfiltered** | **yes** — 8 call sites | correct by design |
| context | **unfiltered** | **no — zero checks** | **bug** |

**Do not "fix" Connector or General Files.** Neither exposes a restore endpoint. Their
tombstone visibility is not a feature choice — it is forced by deterministic identity:
Connector's ID is `sha256(providerKind::locator)` and General Files' is `sha256(content)`, so
re-registering the same locator or re-uploading the same bytes lands on the same primary key
and **must** revive the row rather than insert. General Files already bumps `revision` when it
does. Removing this breaks re-registration.

The rule worth recording:

> Filter in the **store** when nothing needs to see tombstones. Filter in the **service** when
> restore or reactivation requires visibility.

Context has no restore path, so store-level is right and puts it with the majority.

### Behaviour changes to accept knowingly

- Double-delete stops being idempotent (second call → `ContextNotFoundError`).
- `update` on a deleted record stops producing a revision-bumped zombie.

`context.test.ts` has **no delete or tombstone coverage at all**, so nothing will catch these.
Add: `get`/`update`/`delete`/`composeNamed` operand all reject a deleted ID; `resolve` omits a
deleted nested context instead of expanding it; a deleted context nested in a live one leaves
the live entries intact.

Soft-deleted display names already free up correctly — the unique name index is already
partial on `deleted_at IS NULL`. No change needed.

### Open items

- **Double-delete stops being idempotent — is that acceptable?** Today a second `delete` on
  the same ID succeeds silently; after the fix it raises `ContextNotFoundError` → 404. That
  is arguably *more* correct, but it is a client-visible behaviour change and a caller
  retrying a delete on timeout would now see a 404 on the retry. Decide deliberately rather
  than discovering it.
- **Confirm nothing relies on tombstone visibility.** The claim is that Context's service
  has zero `deleted_at` checks, so nothing can depend on seeing tombstones. Verify by
  reading all five `store.get(id)` call sites before changing the predicate — this is the
  whole safety argument for doing it store-side.
- **The rule in the callout deserves to live somewhere permanent.** "Filter in the store when
  nothing needs tombstones; filter in the service when restore requires visibility" is a real
  convention that currently exists only in this TODO. It belongs in `08-conventions.md`
  alongside the other persistence idioms, or it will be re-derived next time.

---

## 12 · Activity ID allocation — doc drift

The Activity change (producers supply `idempotencyKey`; Activity derives
`act_<sha256(key)>` and owns the ID) is **implemented and typechecks**. All three producers —
Document (`fact.factId`), Comments (`transaction.transactionId`), Templates (`fact.factId`) —
already pass keys. No code work remains. Three docs now assert something false:

- `docs/claude-notes/05-async-attempt-pipeline.md:194–197` — "The `factId` is stable across
  retries, so Activity's `publish()` is naturally idempotent … re-publishing the same ID". The
  producer no longer supplies the ID; the *key* drives derivation.
- `document/docs/types.md:82` — "its `factId` **is the stable Activity transaction ID**" →
  "…the stable idempotency key Activity derives its transaction ID from".
- `templates/docs/{types,flows}.md` — same, so Templates does not repeat it.

Outbox column names (`document.fact_id`, `comments.transaction_id`, `templates.fact_id`) are
now idempotency keys, not Activity IDs. **Leave them** — renaming costs a migration across
three capabilities to fix a naming inaccuracy. Document the meaning instead.

### Open items

- `publish()` returns `StoredActivityTransaction`, and **no producer uses the return value**;
  all three publishers are `async (x) => { await activity.publish(x) }`. Harmless, but worth
  deciding whether the return is part of the intended contract.
- The word "fact" (`DocumentCommittedFact`, `activity_outbox`) was disliked. It is Document's
  existing term and never crosses into Activity, which says "transaction". Renaming is
  cheapest now, while only three producers exist.

---

## 13 · Deletion as a revision, not a flag

**Open question, no agreed answer.** Raised while reviewing item 11.

The concern: soft-delete persists deleted state and then requires every read path to remember
to filter it. The alternative is that deletion is just a new revision whose latest state is
"deleted", so a `get` returns nothing without any filter, and prior versions remain for
history.

Worth noting **General Files already half-does this** — a deleted row keeps its `revision`,
and re-uploading the same content bumps it rather than inserting.

What makes this non-trivial: Connector and General Files still need the tombstone row to exist
for re-registration to work (item 11), so a revision model **reframes** their behaviour rather
than removing it. Any design here has to say what "latest revision is deleted" means for a
content-addressed identity that can be revived.

Scope if pursued: 8 soft-deleting capabilities, their schemas, and their tests. Should be its
own design note before any code moves. Item 11 is the tactical fix and does not depend on
this.

---

## Reference · Delegated command claims

**Research only — no action.** Recorded because Persona's Context-wrapper writes (item #5)
have a similar shape, and the question came up of whether to adopt this mechanism there. The
answer was no; the reasoning is below so the decision can be revisited on facts.

### The problem it solves

A command that has to cause an effect in **another capability's store** cannot be made atomic
— there is no transaction spanning two SQLite files, and no two-phase commit.

The specific failure this guards against is subtler than "the write was lost". It is
**retargeting**:

1. Client sends `prompt.update-definition` with `requestId: R`. The Prompt Block at that
   moment points at Derived Output `A`.
2. Document begins the external call to update `A`.
3. Something fails, or the client times out and retries.
4. Meanwhile the Document has changed — the block now points at Derived Output `B`.
5. The retry of `R` arrives. Without a record of what `R` originally targeted, it resolves the
   target *fresh*, and updates `B` instead.

The retry silently did something different from what it was retrying. The comment on the type
says this plainly:

```ts
/**
 * Durable local half of a command delegated to another capability store.
 * The target is frozen before the external side effect starts so an exact
 * retry never retargets after the canonical Document changes.
 */
```

### The mechanism

`DocumentDelegatedCommandClaim` in
[`document/domain/model.ts`](../apps/backend/src/3-capabilities/document/domain/model.ts):

```ts
interface DocumentDelegatedCommandClaim {
  documentId: string;
  requestId: string;
  requestDigest: string;
  kind: "prompt.update-definition";
  targetOutputId: string;              // frozen before the external call
  state: "pending" | "completed";
  createdAt: string;
  updatedAt: string;
}
```

Persisted in `${root}_delegated_command_claims`, `PRIMARY KEY (document_id, request_id)`.

| Store operation | Does |
|---|---|
| `claimDelegatedCommand(claim)` | Writes the claim `pending`, **or** returns the receipt if this request already completed. Returns a result discriminated on `"claim"` \| `"receipt"`. |
| `completeDelegatedCommand(claim, receipt)` | Marks the claim `completed` and writes the command receipt in one transaction. |
| `getDelegatedCommandClaim(documentId, requestId)` | Read, used by the reuse guard. |

```text
claimDelegatedCommand({ …, targetOutputId: block.output.outputId, state: "pending" })
        │  ← the target is frozen HERE, before anything external happens
        ▼
derivedOutputs.updateDefinition(...)          external side effect
        │
        ▼
completeDelegatedCommand(claim, receipt)      claim + receipt in one transaction
```

There is also `assertDelegatedRequestReuse(request)`, called at the **top of every command**
(`documentService.ts:216`, before the command-type switch). It catches a request id that was
used for a delegated command being reused for a *different* command type — so the guard is
not only about retries of the same command.

### What it costs

- A table, three store methods, and a result union.
- A read on **every** command, not just delegated ones, for the reuse guard.
- Two writes per delegated command instead of one.
- It is a **second durable idempotency mechanism** alongside the command-receipt table, doing
  an overlapping job. Document therefore has receipts, stage receipts, and claims — three
  mechanisms.

### Why it was declined for Persona

Persona's `create` / `update` / `delete` write to Context and then to their own store, with
nothing spanning the two. Same shape — but not the same failure:

- **Document's risk is retargeting** — a retry doing something *different* and wrong, with no
  way to detect it afterwards.
- **Persona's risk is a partial write** — the Context row lands, the persona row does not. The
  wrapper's target is not ambiguous, because the wrapper's identity derives from the persona's
  own immutable id (`persona:<personaId>`). There is nothing to retarget *to*.

Exposure is also narrow: all Persona commands run on the serial queue and there is no
in-process mutating caller, so this is crash-only today.

### Open items

- Three overlapping idempotency mechanisms in one capability is a lot. If a fourth capability
  needs this, it is probably worth asking whether receipts and claims should be **one**
  mechanism rather than copying both.
- The reuse guard costs a read on every command for a case that applies to exactly one command
  type. Whether that is the right trade at higher command volume is untested.
- **What would change the calculus for Persona:** a mutating in-process caller that bypasses
  the serial queue. Agents is the obvious candidate — though as designed it only calls
  `personas.resolve()`, which is read-only. If that ever changes, revisit.
- Agents' design (`agents-design/`) places a related but distinct requirement on targets:
  `lookup(requestDigest)` for recovery reconciliation (decision D7). Document stores
  `request_digest` on both receipts and claims, but **does not currently expose a lookup by
  digest** — the receipt is keyed `(document_id, request_id)`. That gap is tracked with the
  Agents work, not here.
