# 11 · Known Issues

*Verified against source at commit ef6d462, 2026-08-09.*

This is the bug register. It is a **record, not a work order**: nothing in the documentation pass
that produced these pages changed a line of source, including the defects whose fix is one line.
Every entry below is present at `ef6d462`.

Entries have stable IDs (`KI-n`) so other pages can link to a specific defect. Ordering is by
severity:

| Part | What is in it | IDs |
| --- | --- | --- |
| [1](#part-1--correctness-defects) | Wrong behaviour reaches a client | KI-1 … KI-23, KI-75 … KI-78, KI-90 … KI-92 |
| [2](#part-2--silent-failure-and-operational-blindness) | Failures nobody can see | KI-24 … KI-41, KI-79 … KI-81, KI-93 … KI-94 |
| [3](#part-3--unreachable-and-dead-code) | Code no request can reach | KI-42 … KI-55, KI-82 … KI-83 |
| [4](#part-4--hygiene-process-and-performance) | Process gaps and slow paths | KI-56 … KI-74, KI-84 … KI-89, KI-95 … KI-96 |
| [5](#part-5--not-bugs-deliberate-decisions) | Things that look like bugs and are not | — |

IDs are allocated in one sequence and never reused. KI-75 onward were added by the completeness
audit after the first four parts were written, which is why each part's range is not contiguous and
why the ID order does not track severity beyond KI-74 — the alternative was renumbering identifiers
that other pages already link to.

> **Read [KI-90](#ki-90--post-connectorread--reads-any-absolute-path-on-the-host) first.**
> `POST /connector/read-*` returns the contents of **any absolute path on the host**, with the
> backend process's privileges, given any registered connector id. It is the most severe entry on
> the page and it carries a high ID only because of the allocation rule above.

Two facts frame the whole page:

- **444 of 444 tests pass, `tsc --noEmit` exits 0, and the module graph resolves.** Every defect
  here is green in CI-equivalent terms. That is the point — see KI-56, which explains a large
  share of the "why it survived" column.
- **There is no CI** (KI-57), so "the suite is green" is a statement about what a developer last
  chose to run, not about what merged.

Where a defect was reproduced by running code rather than by reading it, the entry says so under
**Verified by**. Names that appear there in the form *reconciliation §…* or
*`capability-<area>.md` §…* refer to the twelve source surveys and the reconciliation written
during the 2026-08-09 pass; **those working documents are not in the repository**, so every
entry also carries the `file:line` in `apps/backend/src` that a reader can check independently.
Status accounting for the tree as a whole is on
[10 · Verified status](10-verified-status.md).

---

## Part 1 · Correctness defects

Defects in this part change what a caller gets back. They are ordered by how much damage a
production caller can do with them.

---

### KI-1 — `template.delete` on any Document-backed template always throws

**Where** — [`3-capabilities/document/application/documentService.ts:777-787`](../../apps/backend/src/3-capabilities/document/application/documentService.ts)
(`DocumentTemplateRuntime.logicalDelete`), against
[`documentService.ts:890-912`](../../apps/backend/src/3-capabilities/document/application/documentService.ts)
(`deleteDocument`), reached from
[`3-capabilities/templates/application/templateService.ts:555-558`](../../apps/backend/src/3-capabilities/templates/application/templateService.ts).

**What happens** — `logicalDelete` builds its command with no `expectedRevision`:

```ts
await this.deleteDocument({
  requestId: internalRequestId("template-delete", input.idempotencyKey),
  origin: "automation",
  command: { type: "document.delete", documentId: input.resourceId }
} as DocumentCommandRequest);
```

`deleteDocument` then evaluates, at `:910-912`:

```ts
if (head.revision !== expectedRevision) {
  throw new RevisionConflictError(documentId, head.revision, expectedRevision);
}
```

With `expectedRevision === undefined`, that comparison is true for every live document —
`head.revision` is at least 1 by construction. `TemplateService.remove` does not catch, so the
throw escapes before the catalog row is removed. Document is the **only** kind registered into
the Templates registry ([`startBackend.ts:119`](../../apps/backend/src/1-init/startBackend.ts),
`templateResources.register(document)`), so **every `template.delete` command in the running
system fails.** The reconciliation reproduced it against a real service and a real SQLite store:

```
created: document.created e022cda5-… rev 1
logicalDelete THREW: RevisionConflictError | Document e022cda5-… revision conflict: expected 1, current undefined
head after: { … revision: 1 … }        ← the document is still there
```

The client sees `409 revision_conflict` from Templates' error ladder — a plausible-looking status
that no amount of retrying will clear.

**What was intended** — a logical delete driven by the Templates catalog, which owns its own
`revision` CAS and does not carry the Document's. `templateService.ts:546-558`'s `remove` takes
the template's revision, not the resource's; the resource-side call is meant to be
unconditional.

**Why it survived** — the test double.
[`test/capabilities/templates.test.ts:163-166`](../../apps/backend/test/capabilities/templates.test.ts)
is a hand-written fake `TemplatableResource` whose `logicalDelete` records the call and returns:

```ts
async logicalDelete(input: { resourceId: string; idempotencyKey: string }): Promise<void> {
  this.calls.push({ method: "logicalDelete", ...input });
  this.guard();
}
```

Two Templates tests assert on that recording (`templates.test.ts:847`, `:892-895`) and both pass.
On the other side, `document-application.test.ts:1727` — *"Document satisfies the Templates
runtime contract end to end"* — exercises `duplicate`, `markAsTemplate`, `applyBindings`,
`submit`, and `load`, and **not** `logicalDelete`, `purge`, or `listSealedResources`. `grep -rn
logicalDelete test/` returns hits in `templates.test.ts` only. The one structural seam that would
have caught it is exactly the seam neither suite crosses.

**Fix size** — one line. Read the head revision inside `logicalDelete` and pass it as
`expectedRevision`, as `submit` already does at `documentService.ts:737-739`. The durable fix is
an integration test that drives the real `DocumentServiceImpl` through the real
`TemplateService`.

**Verified by** — reconciliation §G6 (verified first-hand, with execution output);
`capability-document.md` §19.1; `capability-templates-comments.md`.

---

### KI-2 — The Formula projection pipe silently drops the projected fields

**Where** — [`0-platform/formula/parser.ts:335-347`](../../apps/backend/src/0-platform/formula/parser.ts).

**What happens** — `people.{name, score | score > 80}` parses, binds, evaluates, and returns
filtered rows **with every column**. There is no diagnostic, no warning log, and no error. This
is the only path in the backend that produces a silently wrong answer rather than a failure.
Reproduced against a table `people(name, score, active)`:

```
people.{name, score}                 -> [{"name":"Ada","score":95},{"name":"Bob","score":70}]
people.{score > 80}                  -> [{"name":"Ada","score":95,"active":"yes"}]
people.{name, score | score > 80}    -> [{"name":"Ada","score":95,"active":"yes"}]   <-- WRONG
```

**What was intended** — the developer wrote it down in the source, and the comment is the best
evidence on the page. Verbatim, `parser.ts:335-347`:

```
    // Check for pipe — projection pipe
    if (check(ctx, "pipe")) {
      advance(ctx); // consume |
      const condition = parseConditionQuery(ctx);
      // projection pipe is a condition-query with projected fields noted on the SetOperationNode
      // We encode this as: first project (separate node), then filter
      // For simplicity, encode as condition-query and let the evaluator handle projection+filter
      // Actually, the design says to handle it natively. Let's encode as a combined body.
      // We'll extend SetOperationBody to support both:
      return { kind: "condition-query", condition };
      // NOTE: The projected fields are lost here — this is a simplification.
      // A full implementation would carry both. For now, condition-only.
    }
```

`SetOperationBody` (`ast.ts:154-156`) has exactly two arms — `field-projection` and
`condition-query` — so the "extend to support both" the comment describes never happened.
[phase-1/platform/formula.md](../phase-1/platform/formula.md) documents a third variant,
`projection-query`, that does not exist; the superseded page uses this very expression to motivate
it.

**Why it survived** — there is no parser test, no lexer test, no precedence test, and no
set-operation test anywhere in the tree. Formula is exercised only indirectly, through
`rich-text-formula.test.ts` (4 tests) and `structured-data-formula.test.ts` (18 tests), neither of
which writes a pipe form. The module's own `docs/` are unusually self-critical and still miss
this, because nothing in the module reports it.

**Fix size** — structural. Either add the third `SetOperationBody` arm and teach the evaluator to
project-then-filter, or — much smaller, and honest — emit a diagnostic and reject the pipe form
until it is implemented. A working substitute exists today and should be documented either way:
`people.{name, score}.{name}` chains correctly.

**Verified by** — reconciliation §G8 (verified first-hand, quoted verbatim);
`platform-formula-richtext.md` §3.7 (verified by execution).

---

### KI-3 — Changing a persona's context reference always returns HTTP 500

**Where** — [`3-capabilities/persona/application/personaService.ts:393`](../../apps/backend/src/3-capabilities/persona/application/personaService.ts)
against [`3-capabilities/context/context.ts:115-116`](../../apps/backend/src/3-capabilities/context/context.ts);
error ladder at [`4-job-wiring/persona/registerPersonaEndpoints.ts:20-47`](../../apps/backend/src/4-job-wiring/persona/registerPersonaEndpoints.ts).

**What happens** — a persona owns one private Context wrapper named `persona:<personaId>`. When
an update changes the persona's context reference, `planWrapperChange` declares the *replacement*
wrapper under the same deterministic name while the old one is still live — the old wrapper is
deleted only after the persona CAS commits:

```ts
const wrapper = await this.deps.context.declare(wrapperName(existing.id), [after as ContextEntry], {
  private: true,
  description: `Private scope wrapper for persona ${existing.displayName}`
});
```

`ContextManager.declare` rejects a duplicate live display name:

```ts
const existing = this.store.getByName(displayName);
if (existing) throw new ContextConflictError(displayName);
```

`ContextConflictError` is **not** on Persona's eight-rung error ladder
(`ResourceNotDeletedError`, `ResourceHistoryNotFoundError`, `PersonaNotFoundError`,
`PersonaConflictError`, `StalePersonaRevisionError`, `BuiltInPersonaImmutableError`,
`PersonaValidationError`, `PersonaWireError`). So `POST /personas/command` answers **500
`internal_error` "Persona operation failed"** and logs `persona.command.failed`. The
context-present → different-context-present transition is the only one of the five that fails;
the other four work. No state is corrupted, because the throw precedes the persona CAS.

Reproduced against a real `SQLiteContextStore` + `createContextManager` wired into a real
`SQLitePersonaStore` + `createPersonaCapability`:

```
created wrapperId = 657115fc-0f85-42ab-972d-91f129860b75
SWAP THREW: ContextConflictError - Context 'persona:ebb8c171-…' already exists
```

A caller can work around it in two commands — clear the context (which deletes the wrapper and
frees the name), then set the new one — also verified.

**What was intended** — Persona's `PersonaContextPort` deliberately has no `update` (it was
removed in `1cbe845`), so a swap is modelled as declare-new-then-delete-old. The declare-first
ordering is what makes the persona CAS the commit point; it just collides with Context's
live-name uniqueness.

**Why it survived** — both suites substitute a `PersonaContextPort` double whose `declare` never
checks names: `persona.test.ts:67-75` returns `wrapper-<n>` unconditionally, and
`persona-wiring.test.ts:41` does the same. The module's own
[`persona/docs/invariants.md:161-162`](../../apps/backend/src/3-capabilities/persona/docs/invariants.md)
names the exact gap the bug is sitting in:

> *"Not covered: Persona against a **real** `ContextManager` (the wrapper tests use a double), and
> any consumer integration — there is no consumer yet."*

**Fix size** — small. Either delete the old wrapper before declaring the replacement (which gives
up the CAS-is-the-commit-point property), declare under a temporary name and rename, or add
`ContextConflictError` to the ladder so the client at least gets a 409. The real fix is one test
against a real `ContextManager`.

**Verified by** — reconciliation §G7 (verified first-hand);
`capability-activity-persona.md` §B16 (reproduced empirically).

---

### KI-4 — Sealed-document refusals return HTTP 500 and write a spurious error log

**Where** — [`4-job-wiring/document/registerDocumentEndpoints.ts:33-86`](../../apps/backend/src/4-job-wiring/document/registerDocumentEndpoints.ts)
(the `errorResponse` ladder), against
[`documentService.ts:402-419`](../../apps/backend/src/3-capabilities/document/application/documentService.ts)
(`assertNotSealed`).

**What happens** — `assertNotSealed` throws `DocumentTemplateModeError` when any public command or
query names a Document that has been sealed as a template backing copy. The endpoint ladder has
no branch for it, so it falls through to the terminal rung:

```ts
return { statusCode: 500, body: { error: "internal_error", message: "Document operation failed" } };
```

Both `POST /documents/command` and `POST /documents/query` are affected. Worse, the status makes
the wiring log it as an unexpected failure — `registerDocumentEndpoints.ts:116-117` and
`:133-134` gate on `response.statusCode >= 500`, so every deliberate refusal also emits
`document.command.failed` / `document.query.failed` at **error** level. A correctly-refused
request is indistinguishable in the log from a real fault.

Two more Document errors have the same gap: `DocumentUnboundContextVariableError`
(`domain/errors.ts:116`, thrown at `domain/reducer.ts:103`, reachable synchronously from
`prompt.update-definition` → `resolvePromptContext`) and `DocumentContextVariableNotFoundError`
(`documentService.ts:630`, internal paths only).

**What was intended** — a typed refusal. The service layer already warns deliberately, with a
comment that says as much (`documentService.ts:410-412`):

> *"Warn, not debug. A request reaching a sealed Document means a caller holds an ID it should
> never have been handed, and that is worth seeing without turning debug on."*

The module's own docs describe it as a refusal:
[`document/docs/concepts.md:170`](../../apps/backend/src/3-capabilities/document/docs/concepts.md)
and `document/docs/invariants.md:219`.

**Why it survived** — the refusal *is* tested, at the service layer:
`document-application.test.ts:1823-1838`. Nothing tests the HTTP mapping. There is no
`document-wiring.test.ts` — Document has four test files (`document-application`,
`document-domain`, `document-persistence`, `document-wire`) and none of them constructs the
endpoint registry. Comments, Templates, Persona and Activity all have `*-wiring.test.ts` files;
Document, the largest capability, does not.

**Fix size** — one line per error: three rungs added to the ladder, mapping
`DocumentTemplateModeError` to 409 (or 403) and the two context-variable errors to 400/404.

**Verified by** — reconciliation §5.11 (Document docs row); `capability-document.md` §19.2;
source read at HEAD for this page.

---

### KI-5 — `template.purge` throws a raw `TypeError` once history has been pruned

**Where** — [`3-capabilities/templates/application/templateService.ts:583-604`](../../apps/backend/src/3-capabilities/templates/application/templateService.ts),
against [`0-utils/persistence/resourceHistory.ts:187-213`](../../apps/backend/src/0-utils/persistence/resourceHistory.ts).

**What happens** — `pruneHistoryBefore` deletes every history row older than the cutoff **except**
the terminal `deleted` tombstone (that exception is deliberate and load-bearing — it is what makes
purge-after-prune work at all). A deleted template can therefore end up with a tombstone and no
snapshot. `TemplateService.purge` then runs:

```ts
// Let the store produce the consistent 409 if a live row still exists.
if (this.store.get(command.templateId)) this.store.purge(command.templateId);
const template = this.store.latestSnapshot(command.templateId);
if (!template) this.store.purge(command.templateId);
const retained = template as TemplateRecord;
```

Both guarded calls rely on `store.purge` *throwing*: `ResourceNotDeletedError` (409) with a live
row, `ResourceHistoryNotFoundError` (404) with no history. With a tombstone and no snapshot,
`purgeResourceHistory` **succeeds** — the latest record really is `deleted` — so nothing throws,
`template` stays `undefined`, and `retained.kind` on the next line throws
`TypeError: Cannot read properties of undefined (reading 'kind')` → **500 `internal_error`**.

The backing resource is never purged. `purgeExpired` (`:646-659`) hits the same missing snapshot
and does `continue`, so it skips that template on every subsequent sweep, forever. Reproduced
against a temp SQLite database:

```
pruneHistory removed rows: 1
latestSnapshot after prune: undefined
expiredDeleted after prune: [ 'f030e3fd-…' ]
purgeExpired count: 0
purge threw: TypeError - Cannot read properties of undefined (reading 'kind')
```

**What was intended** — the healthy ordering. Within a sweep `purgeExpired` runs before
`pruneHistory` (`resourceRetentionScheduler.ts:106-132`), so a template is normally purged before
its snapshot can be pruned. The state is reachable only when `purgeExpired` aborts early — see
KI-6.

**Fix size** — small. Replace the `as TemplateRecord` cast with an explicit branch that treats
"tombstone without snapshot" as a purgeable state (Comments already does exactly this:
`SQLiteCommentStore.purge` at `:334-353` only needs the latest record to be `deleted` and never
reads a snapshot).

**Verified by** — `capability-templates-comments.md` §A9 (verified by execution against a temp
database).

---

### KI-6 — `TemplateService.purgeExpired` has no per-template error isolation

**Where** — [`templateService.ts:646-659`](../../apps/backend/src/3-capabilities/templates/application/templateService.ts).

**What happens** — the loop calls `resource.purge(...)` with no `try/catch`. One throwing resource
aborts the entire retention purge for Templates for that sweep. The scheduler counts one failure
and **still runs `pruneHistory` on the same cutoff**, which deletes the snapshots of every
template the aborted loop never reached. From then on those templates are permanently
unpurgeable (KI-5). This is the mechanism that makes KI-5 reachable in production rather than
theoretical.

**What was intended** — the same isolation the sibling sweep already has.
`collectOrphanedResources` (`:696-719`) wraps each purge individually, with a comment stating the
rule:

> *"One failure must not stop the sweep: the rest of the orphans are independent, and a permanent
> failure on one would otherwise wedge collection forever."*

The retention scheduler makes the same argument one level up — each port gets its own
`try/catch`, so a failing capability does not stop later capabilities.

**Why it survived** — `templates.test.ts` has a subtest *"purge removes every history row, updates
included"* which covers only the healthy path. The failing-resource case is tested for
`collectOrphanedResources` (that is what `failPurgeFor` in the test double is for,
`templates.test.ts:168-172`) and not for `purgeExpired`.

**Fix size** — one line: wrap the loop body in `try/catch`, matching `:708-711`.

**Verified by** — `capability-templates-comments.md` §A9 and INCOMPLETE item 3.

---

### KI-7 — The Templates pass-through accepts undecoded Document operations

**Where** — [`documentService.ts:717-759`](../../apps/backend/src/3-capabilities/document/application/documentService.ts)
(`DocumentTemplateRuntime.submit`),
[`3-capabilities/templates/wire/commandSchemas.ts:109-111`](../../apps/backend/src/3-capabilities/templates/wire/commandSchemas.ts),
[`3-capabilities/templates/domain/model.ts:114`](../../apps/backend/src/3-capabilities/templates/domain/model.ts).

**What happens** — `submit` is commented *"Pass-through edit. The operations are the caller's,
decoded by Templates' caller."* Templates' wire decoder does not decode them; it copies the array
through verbatim:

```ts
...(command.resourceOperations !== undefined
  ? { resourceOperations: command.resourceOperations }
  : {})
```

and types the field `readonly resourceOperations?: unknown`. Document's own check is only
`Array.isArray(operations) && operations.length > 0`, after which it casts to
`DocumentOperation[]`. An untyped payload therefore reaches the reducer. Verified against the
real service:

```
unknown op THREW:        TypeError | inverseFor is not a function or its return value is not iterable
bad-typed rename THREW:  TypeError | snapshot.title.trim is not a function
```

An unknown operation type falls through `applyOne`'s non-exhaustive runtime switch (silently
no-oping), `inverseFor` returns `undefined`, and the spread at `reducer.ts:1404` throws a raw
`TypeError`. A structurally wrong payload for a *known* type throws a different raw `TypeError`
from inside the reducer. Neither is a `DocumentWireError`, so neither maps to 400 — both surface
as **500** through `POST /templates/command`.

**What was intended** — the comment is explicit that decoding is the caller's job. The caller does
not do it. Document's public surface has a full wire decoder (`document/wire/`, exercised by
`document-wire.test.ts`, 9 tests) that this path bypasses entirely.

**Why it survived** — `templates.test.ts` uses the fake resource (KI-1), whose `submit` never
reaches a reducer. `document-application.test.ts:1727`'s contract test drives `submit` with
well-formed operations built in TypeScript, so the cast is always sound in the test.

**Fix size** — small, and there are two honest options: run `decodeDocumentOperations` inside
`submit` before the cast, or have Templates' decoder validate against a Document-supplied
schema. Either way the fix is a decoder call, not new machinery — Document already owns one.

**Verified by** — `capability-document.md` §19.3 (verified by execution); source read at HEAD.

---

### KI-8 — `template.update` can submit the internal-only `prompt.apply-derived-output`

**Where** — [`documentService.ts:987-992`](../../apps/backend/src/3-capabilities/document/application/documentService.ts)
(`submitDocument`, where the bans live) versus `documentService.ts:737-746` (`submit`, which calls
`mutate` directly).

**What happens** — the public `document.submit` path refuses two operation families:

```ts
if (request.command.operations.some(introducesPrompt)) {
  throw new DocumentOperationError("Prompt Blocks must be created through prompt.create.request");
}
if (request.command.operations.some((operation) => operation.type === "prompt.apply-derived-output")) {
  throw new DocumentOperationError("Derived Output adoption is internal settlement only");
}
```

Both checks live in `submitDocument` only. The Templates pass-through calls `mutate` with
`allowPromptOperations: true`, which correctly relaxes the *first* ban — a template is fully
editable, prompts included, and the comment at `:743-744` says so. It also, unintentionally,
skips the second, because `mutate` never had that check. `prompt.apply-derived-output` — an
operation the settlement pipeline is supposed to own exclusively — is reachable from the public
`POST /templates/command` surface.

**What was intended** — the comment at `documentService.ts:743-744` scopes the relaxation
narrowly:

> *"A template is fully editable, prompts included. `template.update` is the only path here, so
> the usual public-surface restriction does not apply."*

"The usual public-surface restriction" is the prompt-creation ban. Derived Output adoption is a
different rule with a different reason, and it was not meant to travel with it.

**Why it survived** — the ban is tested where it is written (`document-application.test.ts`
asserts the refusal on the public path). Nothing drives a `prompt.apply-derived-output` through
`template.update`, and KI-7 means such a payload would not be decoded on the way in anyway.

**Fix size** — one line: move the `prompt.apply-derived-output` check into `mutate`, or repeat it
in `submit`.

**Verified by** — `capability-document.md` §19.3 (final paragraph); source read at HEAD.

---

### KI-9 — Four Context endpoints have no error handling at all

**Where** — [`4-job-wiring/context/registerContextEndpoints.ts`](../../apps/backend/src/4-job-wiring/context/registerContextEndpoints.ts):
`GET /contexts` (`:73`), `GET /contexts/entry` (`:84`), `GET /contexts/by-name` (`:96`),
`POST /contexts/resolve` (`:151`).

**What happens** — Context registers 10 endpoints and wraps 6 of them in
`try { … } catch (e) { return contextErrorResponse(e); }`. The other four have no `try` at all.
Any throw from `ctx.list`, `ctx.get`, `ctx.getByName` or `ctx.resolve` escapes the job's `work()`,
propagates through the scheduler, and is rethrown by the transport
(`registerHttpTransport.ts:113-121`) into Fastify's **generic 500 body**. The client gets
Fastify's error shape, not the capability's, so the `{error, message, field}` contract that the
same file defines twenty lines above silently becomes `{statusCode, error, message}`.
`ctx.resolve` is the sharpest of the four: it walks the resource registry, so it can surface a
failure from Investigation, General Files or Connector.

**What was intended** — the six wrapped endpoints show the intended shape. The capability's own
[`context/docs/flows.md:20,26`](../../apps/backend/src/3-capabilities/context/docs/flows.md)
honestly flags the missing handlers, but never says what the client actually receives.

**Why it survived** — `context.test.ts` (11 tests) drives the `ContextManager` directly. There is
no `context-wiring.test.ts`. `registerContextEndpoints` is also the only wiring file in the tree
that takes **no `Logger`** — its signature is `(registry, ctx)` — so nothing on these four paths
produces a log record either.

**Fix size** — one line each: four `try/catch` wrappers.

**Verified by** — `capability-connector-files-context.md` §9.14; reconciliation §3.2 (Context
row); source read at HEAD (10 `registry.register` sites, 6 `try` blocks).

---

### KI-10 — Context's error ladder sends unknown errors to 400, not 500

**Where** — [`registerContextEndpoints.ts:17-18`](../../apps/backend/src/4-job-wiring/context/registerContextEndpoints.ts).

**What happens** — the terminal rung of `contextErrorResponse` is:

```ts
const msg = e instanceof Error ? e.message : String(e);
return { statusCode: 400, body: { error: "bad_request", message: msg } };
```

An unrecognised failure — a SQLite constraint violation, a `TypeError`, a disk error — is
reported to the caller as a client error, **and its raw message is echoed in the response body**.
Every other capability's ladder terminates at 500 with a fixed message and logs the real one
(`"Document operation failed"`, `"Persona operation failed"`, `"Template operation failed"`).
Context is the only one that inverts the default and the only one that leaks internal error text.

**What was intended** — the other ten wiring files are the convention. Persona states it in a
comment at `registerPersonaEndpoints.ts:45`: *"Internal errors never leak detail to the client;
the real message is logged."*

**Why it survived** — no wiring test; every tested failure is a typed one that matches an earlier
rung.

**Fix size** — one line, plus a decision about whether Context's decoder failures (which today
rely on this rung) need their own error type first.

**Verified by** — `capability-connector-files-context.md` §2; source read at HEAD.

---

### KI-11 — `context.declare` accepts an empty `displayName`

**Where** — [`3-capabilities/context/context.ts:107-132`](../../apps/backend/src/3-capabilities/context/context.ts)
and [`registerContextEndpoints.ts:64`](../../apps/backend/src/4-job-wiring/context/registerContextEndpoints.ts).

**What happens** — `declare` checks the entry count and the name conflict and never checks that
the name is non-blank. The endpoint coerces with `String(body.displayName ?? "")`. So
`POST /contexts` with no `displayName` **succeeds with 201**, creating a record named `""`. A
second such request then fails with 409 `conflict` on the unique index — a confusing second-order
symptom of a first-order validation gap. `composeNamed` rejects the same input with 400, so the
two write paths disagree.

**What was intended** — Context has four `ContextValidationError` throw sites (`context.ts:110,
136, 247, 256`); a blank-name check is simply absent from the list. The capability's own
`docs/invariants.md:35` states there are no length limits on `displayName` and is accurate; it
does not mention that there is no *emptiness* check either, and the asymmetry with `composeNamed`
is recorded nowhere.

**Why it survived** — `context.test.ts` never submits a blank name.

**Fix size** — one line in `declare`, matching the check `composeNamed` already performs.

**Verified by** — `capability-connector-files-context.md` §7 and §9.15; source read at HEAD.

---

### KI-12 — Rich Text: `delete-atom`'s inverse cannot be applied

> **Reachability of KI-12 to KI-14 — checked in source, not inferred.** The survey notes did not
> settle this, and the three defects turn out to have three different exposures through the only
> capability that uses Rich Text:
>
> | | Reachable via `POST /documents/command`? | Why |
> | --- | --- | --- |
> | KI-12 (unusable `delete-atom` inverse) | **No** | Document's `inverseFor` never delegates to Rich Text — `reducer.ts:949-953` takes a whole-block pre-image instead |
> | KI-13 (mark offsets not remapped) | **Yes, silently** | a forward-apply defect; the drifted offsets stay *in bounds*, so `validateSnapshot` does not catch them |
> | KI-14 (duplicate atom IDs) | Attempt only | `validation.ts:142-146`'s `claimId` reports `duplicate identity <id>` and `reducer.ts:1407` throws `DocumentValidationError` → **400**, so the mutation is refused rather than persisted |
>
> Slides has no equivalent snapshot validator, so a future Slides service inherits all three.

**Where** — [`0-platform/rich-text/operations.ts:325-335`](../../apps/backend/src/0-platform/rich-text/operations.ts).

**What happens** — deleting an atom emits the inverse
`{type:"insert-atom", at:{atomId:"<the deleted id>", offset:0}, atom:<the deleted atom>}`.
Re-applying it **throws `Atom not found: b`**, because the anchor it names is the atom that was
just removed. The inverse exists, typechecks, and is unusable. Deleting an atom also drops every
mark whose start *or end* references it, while a mark that merely *spans* the deleted atom
survives and now spans a gap.

**What was intended** — exact inverses. Six operations do have them
(`replace-range-with-atom`, `replace-content`, `add-mark`/`remove-mark`, `set-link-targets`,
`set-formula-expression`, `apply-formula-settlement`), and the module's care around
`applyReplaceRangeWithAtom` shows what the standard is. Its comment (`operations.ts:352-356`) is
worth quoting because it explains why the careful ones are careful:

> *"Atomically replace a range in one TextAtom. Keeping this atomic is important: composing
> delete-range and insert-atom cannot assign the split suffix a stable ID or remap marks without
> exposing an invalid midpoint."*

**Why it survived** — **no production path ever replays a Rich Text inverse.** Document *does*
have a live compensation command that replays stored inverses (`documentService.ts:1244`,
`operations: target.inverseOperations`), and its wire decoder admits all thirteen Rich Text
operation types (`document/wire/valueSchemas.ts:621-668`) — but Document's own `inverseFor` never
delegates to Rich Text. At
[`document/domain/reducer.ts:949-953`](../../apps/backend/src/3-capabilities/document/domain/reducer.ts)
it takes a whole-block pre-image instead:

```ts
case "style.apply-inline":
case "rich-text.apply": {
  const block = requireBlock(before, operation.blockId).block;
  return [{ type: "block.replace", blockId: block.id, block: clone(block) }];
}
```

That is the same technique `applyReplaceRangeWithAtom` uses internally, applied one layer up.
Document's own `invertOperations` helper is dead (KI-55), and the only would-be consumer of Rich
Text inverse replay is Slides, which is unreachable (KI-42). Rich Text's own tests apply
operations forward.

**Fix size** — small. Anchor the inverse to the surviving neighbour rather than the deleted atom,
or emit a `replace-content` inverse with a pre-image snapshot, which is the pattern
`replace-range-with-atom` already uses.

**Verified by** — `platform-formula-richtext.md` §4.5 item 4 (verified by execution).

---

### KI-13 — Rich Text: `insert-text` and `delete-range` do not remap mark offsets

**Where** — [`operations.ts`](../../apps/backend/src/0-platform/rich-text/operations.ts) —
`applyInsertText`, `applyDeleteRange` (`:200-237`), `applyReplaceRange` (`:262`).

**What happens** — inserting `"XX"` at offset 0 of a 5-character atom carrying a bold mark
`[0,5]` leaves the mark ending at offset 5 while the atom is now 7 characters long. The mark now
covers the wrong text. Cross-atom `delete-range` flattens surviving text and joins the deleted
fragments into a single `insert-text` inverse, so removed intermediate atoms are not
reconstructible. `replace-range`'s inverse discards the deleted source outright, and the source
says so:

```ts
text: "", // The inverse of replace is another replace — simplified
```

**What was intended** — `applyReplaceRangeWithAtom` remaps mark endpoints properly, through
`mapReplacedTextPosition` (`:489-523`), and is edge-aware. The simpler operations were left
without that treatment.

**Why it survived** — this is the one Rich Text defect that **is** reachable and silent. It is a
forward-apply defect, so Document's block-level inverse (KI-12) does not shield it, and the
drifted offsets remain within the atom's bounds, so `richText.validate` — which reports
`mark-offset-out-of-bounds` but not "mark no longer covers what it covered" — passes it through
`validateSnapshot`. It survives because no Document test submits an `insert-text` that crosses a
mark boundary, and because `normalize`'s mark-remapping pass tidies some of the damage after the
fact. The lossy *inverses* named in this entry are unreachable for the reason given in KI-12.

**Fix size** — small per operation; structural if all four are done consistently. Reuse
`mapReplacedTextPosition`.

**Verified by** — `platform-formula-richtext.md` §4.5 items 1, 3, 7 (verified by execution).

---

### KI-14 — Mid-atom `insert-atom` creates duplicate atom IDs

**Where** — [`operations.ts:286-291`](../../apps/backend/src/0-platform/rich-text/operations.ts).

**What happens** — inserting a hard-break at offset 3 of a text atom `a` containing `"abcdef"`
produces atoms with IDs `a, br, a` — `applyInsertAtom` spreads `{...curr}` twice without
allocating a new ID for the suffix. `validate` will subsequently report `duplicate-atom-id`, but
only if someone calls it; `apply` itself returns successfully. Neither `add-mark` nor
`insert-atom` performs a duplicate-ID check on the way in.

**What was intended** — stable, unique atom identity. This is precisely the failure
`applyReplaceRangeWithAtom` was written to avoid; its `trailingTextAtomId` parameter exists so the
caller supplies an ID for the split suffix, and it is **required exactly when** there is both
leading and trailing text (`:405-411`).

**Why it survived** — Document's editor path routes mid-atom splits through
`replace-range-with-atom`, which requires a `trailingTextAtomId`, and a client that submits a raw
mid-atom `insert-atom` anyway is caught one layer up: `validateSnapshot`'s `claimId`
(`validation.ts:142-146`) reports `duplicate identity <id>` and `reducer.ts:1407` throws
`DocumentValidationError` → 400. So the bug is real inside Rich Text and Document happens to be
immune. No Rich Text test asserts on the resulting atom IDs.

**Fix size** — small. Require a suffix ID on mid-atom insertion, as `replace-range-with-atom`
already does.

**Verified by** — `platform-formula-richtext.md` §4.5 item 2 (verified by execution).

---

### KI-15 — `rebuildCorpusTier` promotes every node, contradicting its own comment

**Where** — [`0-platform/knowledge/knowledge.ts:412-452`](../../apps/backend/src/0-platform/knowledge/knowledge.ts),
comment at `:426`.

**What happens** — for every source other than the one that changed, the rebuild calls
`store.getSourceNodeIds(src.sourceId)`, which is `SELECT id FROM kn_<p>_nodes WHERE source_id = ?`
(`knowledge-store.ts:248-255`) — every node at every level — and pushes all of them into the
corpus frontier, under this comment:

```
          // Only include top-level source-tier nodes (highest level per source)
```

The code does no level filtering. Intermediate nodes enter the corpus tier alongside their
parents, so the corpus lattice is built over a mixed-granularity population and retrieval descends
through duplicated material.

**What was intended** — the comment. Note also that there is **no index on `level`** — the two
indexes on the nodes table are both single-column `(source_id)` — so the filtered query the
comment describes would have no index to use.

**Why it survived** — there is no `knowledge.test.ts`, no lattice test, no windowing test, and no
SQLite-adapter test. Knowledge is 2,118 lines, wired into four capabilities, and has **zero**
direct test coverage. The module's own
[`knowledge/docs/invariants.md:50-62`](../../apps/backend/src/0-platform/knowledge/docs/invariants.md)
does record it — *"Corpus rebuild treats every source node as top-level"* — in a list of ten
self-reported defects, all ten of which the survey independently confirmed.

**Fix size** — small (filter by max level per source) plus an index, or structural if the corpus
tier is redesigned. It needs a test file first.

**Verified by** — `platform-knowledge-intelligence.md` §2.8.

---

### KI-16 — `getWindowIds` cannot rebuild a frontier for a source with no cluster nodes

**Where** — [`knowledge.ts:486-505`](../../apps/backend/src/0-platform/knowledge/knowledge.ts).

**What happens** — when a corpus rebuild is triggered by a *different* source, an unchanged
existing source that has no cluster nodes returns `[]` from `getWindowIds` and drops out of the
corpus frontier. The helper's own doc comment states the shape of the problem verbatim:

> *"Retrieve window IDs for a source. The store has no listWindowsBySource, so we get the source
> record to know the count, then fetch via the source's node member IDs where possible. When the
> node graph exists, its member IDs transitively cover all windows. When no nodes exist, we fall
> back to the node-less path tracked from add()."*

The fallback is `return []` with the comment *"No nodes → source has 0 or 1 window. Return empty
and let the caller handle it."* The caller in the rebuild path does not handle it.

**What was intended** — a `listWindowsBySource` on the store port. It does not exist; the
`KnowledgeStore` port has 17 methods and none of them lists windows by source.

**Why it survived** — no Knowledge test file (KI-63). Self-reported in the module's own
`invariants.md:50-62`.

**Fix size** — small: add `listWindowsBySource` to the port and the SQLite adapter (the
`kn_<p>_windows_source(source_id)` index already exists), and use it.

**Verified by** — `platform-knowledge-intelligence.md` §2.9.

---

### KI-17 — Knowledge invalidation is project-wide; `DerivedEvidence.sourceId` is ignored

**Where** — [`3-capabilities/derived-outputs/derived-outputs.ts:1047-1056`](../../apps/backend/src/3-capabilities/derived-outputs/derived-outputs.ts),
against `derived-outputs/domain/model.ts:86-91`.

**What happens** — `recordKnowledgeSourceMutation` receives a mutation carrying a `sourceId` and
throws it away:

```ts
recordKnowledgeSourceMutation(mutation: KnowledgeSourceMutation): void {
  const start = performance.now();
  const invalidated = this.store.markAllOutputsStaleForKnowledgeChange(now());
  this.logger.info("derived-outputs.knowledge.invalidated", {
    operation: mutation.operation,
    …
```

Editing one file marks **every** derived output in the project stale. On a project with many
outputs and an active Connector sync, that is a great deal of avoidable recomputation, each round
of which spends provider tokens.

**What was intended** — `DerivedEvidence.sourceId`'s own comment says it exists *"so staleness
propagation can cross-reference changed sources against their derived outputs"*
(`model.ts:86-91`). The field is written and never read for that purpose.

**Why it survived** — over-invalidation is never *wrong*, only expensive. `derived-outputs.test.ts`
(17 tests) asserts that outputs become stale, which is exactly what happens.

**Fix size** — small: join through `DerivedEvidence` on `mutation.sourceId` and mark only the
affected outputs, falling back to the project-wide sweep for a mutation with no evidence rows.

**Verified by** — `capability-structured-derived.md` PART E item 20; source read at HEAD.

---

### KI-18 — `PATCH /derived-output-definition` silently clears `contextEntries`

**Where** — [`4-job-wiring/derived-outputs/registerDerivedOutputEndpoints.ts:129-131`](../../apps/backend/src/4-job-wiring/derived-outputs/registerDerivedOutputEndpoints.ts).

**What happens** — the decoder is:

```ts
contextEntries: Array.isArray(body.contextEntries)
  ? (body.contextEntries as Array<{ id: string; kind: string }>)
  : [],
```

A PATCH that omits `contextEntries` — or sends anything that is not an array — sets the
definition's context scope to empty and returns 200. There is no "leave alone" path. The output's
retrieval scope is destroyed by a request that meant to change only the prompt.

**What was intended** — the same `absent means leave alone` semantics Templates spells out in a
comment on its own decoder (`templates/wire/commandSchemas.ts:93-96`):

> *"Each field is optional and means 'leave alone' when absent, so the conditional spread is
> load-bearing rather than cosmetic…"*

Derived Outputs' endpoint has no conditional spread.

**Why it survived** — the endpoint tests always send a full definition body. Derived Outputs has
no wiring test file; `derived-outputs.test.ts` drives the service.

**Fix size** — one line, but it needs a decision: reject a non-array with 400, or make the field
optional and omit it from the update.

**Verified by** — `capability-structured-derived.md` PART E item 23; source read at HEAD.

---

### KI-19 — An Activity outbox row with a reused `sourceTransactionId` is a permanent poison pill

**Where** — Activity's `publish` conflict rule (`activity/application/activityService.ts`), plus
every producer's outbox drain.

**What happens** — Activity's publish is idempotent on `sourceTransactionId`: the same ID with the
same canonical digest replays; the same ID with **different** content throws
`ActivityTransactionConflictError`. That error has no HTTP mapping (it would be a 500) and, more
importantly, no dead-letter path. A producer that reuses an ID with different content writes an
outbox row that fails every drain, forever, with no operator lever to discard it.

**What was intended** — replay safety. The derived-ID convention is deliberate and documented at
`templateService.ts:617-621`:

> *"The source transaction ID is derived from the request rather than freshly generated, so it is
> stable across retries. Paired with the outbox's INSERT OR IGNORE, a request yields at most one
> source transaction per kind even if the command is re-run."*

The failure mode is the other side of that coin, and no doc records it.

**Why it survived** — unreachable in the current tree: all three producers (Document, Comments,
Templates) derive IDs from the request, so a genuine collision requires a fourth producer or a
change to a digest input. It is recorded here because it is a live in-process failure mode with
no recovery, not because it fires today.

**Fix size** — small: a retry counter and a dead-letter state on the outbox row, plus a log at
error level when a row is parked.

**Verified by** — `capability-activity-persona.md` §A14 item 2.

---

### KI-20 — Templates publishes Activity only at startup, and the drain stops at the first failure

**Where** — [`templateService.ts:240-255`](../../apps/backend/src/3-capabilities/templates/application/templateService.ts)
and [`startBackend.ts:194`](../../apps/backend/src/1-init/startBackend.ts).

**What happens** — two defects that compound:

1. `templates.publishPendingActivity()` is called from exactly one place — the startup recovery
   drain. `TemplateService` has **no inline post-commit publish**. Every template registration,
   update and deletion made during a run stays in the outbox until the next backend restart.
   Document (`documentService.ts:801-808`) and Comments (`commentService.ts:207-210`) both publish
   inline.
2. The drain `break`s on the first delivery failure rather than continuing:

```ts
} catch (error) {
  // Source state is already committed. Delivery failures stay in the
  // outbox for the next drain rather than changing an accepted result.
  this.dependencies.logger.warn("templates.activity.publish-failed", { … });
  break;
}
```

Document and Comments `continue` past failures. Combined with (1), one bad row blocks every later
row until the next restart — and then blocks them again.

**What was intended** — the module's own docs claim the opposite.
`activity/docs/concepts.md:111-113` and `activity/docs/invariants.md:98-102` say Templates
"publishes post-commit and retries through recovery". Neither half is true.

**Why it survived** — `templates.test.ts` (107 tests) drives `publishPendingActivity()` directly,
which is what the startup drain does, so the drain-only behaviour looks correct from inside the
test. Nothing asserts that a `template.register` publishes without a restart.

**Fix size** — small for the `break` → `continue` (one word). Adding an inline post-commit publish
is a small-to-structural change depending on whether it must share the mutation's transaction.

**Verified by** — `capability-activity-persona.md` §A14 items 3-4; reconciliation §3.2 (Templates
row); source read at HEAD.

---

### KI-21 — Knowledge mutations are not atomic and have no mutex

**Where** — [`0-platform/knowledge/knowledge.ts`](../../apps/backend/src/0-platform/knowledge/knowledge.ts),
`add` / `remove`.

**What happens** — one `Knowledge.add` performs, in order and as separate store calls:
`getSource` → `getWindows` → `deleteWindowsForSource` → `putWindows` → `deleteNodesForSource` →
`putNodes` → `listSources` → N× `getSourceNodeIds`/`getNodes` → `deleteCorpusNodes` → `putNodes` →
`putFrontier` → `putSource`. There is no mutex, no compare-and-swap, no outer transaction, no
pending/committing state, and no startup reconciliation. Two concurrent `add`/`remove` calls on
different sources interleave their corpus-frontier reads and writes; the last `putFrontier` wins
with whatever it observed. The result is a frontier that references nodes from a partially applied
rebuild.

**What was intended** — the capabilities that call Knowledge each implement their own
reconciliation (Connector's `pending`/`failed` states, General Files' pending/active,
Investigation's `reconcileFindingKnowledge` loop at `investigationRuntime.ts:377`). None of that
can make the Knowledge database mutation itself atomic, and the module's own
`invariants.md` says so plainly: *"Source/window/node/frontier updates are not one transaction."*

**Why it survived** — every current caller happens to run on the **serial** queue or from an
internal job, so genuine concurrency is rare. There is no Knowledge test file to notice.

**Fix size** — structural. Either wrap a mutation in one `better-sqlite3` transaction (the store
is synchronous, so this is more tractable than it looks) or add an in-process mutex at the
`Knowledge` boundary.

**Verified by** — `platform-knowledge-intelligence.md` §2.19; module `invariants.md`.

---

### KI-22 — Structured Data's `maxEntries` is not an atomic quota

**Where** — [`3-capabilities/structured-data/structured-data.ts:194-197`](../../apps/backend/src/3-capabilities/structured-data/structured-data.ts).

**What happens** — the entry-count check is a read followed by an insert with nothing between
them. Two concurrent declares can both observe `count === max - 1` and both insert. Structured
Data's endpoints are **concurrent**-queued, so this is reachable over HTTP. The same file's
conflict precheck (name uniqueness) is racy for the same reason: the typed
`DataNameConflictError` comes from the precheck, and a genuine race surfaces the raw SQLite
`UNIQUE` error instead.

**What was intended** — a quota. The capability's own docs self-report both gaps, which is why
`structured-data/docs/` is the most reliable module package in the tree.

**Why it survived** — a race requires two simultaneous requests; the test suite is sequential.

**Fix size** — small: do the count inside the same `better-sqlite3` transaction as the insert, or
add a `CHECK`-backed counter row.

**Verified by** — `capability-structured-derived.md` PART E item 8; module `docs/`.

---

### KI-23 — A concurrent persona create maps to 500

**Where** — [`personaService.ts`](../../apps/backend/src/3-capabilities/persona/application/personaService.ts)
`create`, plus `registerPersonaEndpoints.ts:20-47`.

**What happens** — the service prechecks with `getByName` and raises the typed
`PersonaConflictError` (409) in the ordinary path. Two genuinely concurrent creates both pass the
precheck and the loser hits the SQLite `UNIQUE` constraint, which no ladder rung matches, so it
becomes **500**.

**What was intended** — a 409. The module's own `docs/invariants.md:61-63` states this explicitly
and accepts it, which is why this entry is low in the list rather than absent: it is a documented
trade, not an unknown. It is still a defect from the client's point of view.

**Why it survived** — accepted, documented, and not exercised by a sequential test suite.

**Fix size** — one line: catch the constraint error and translate it to `PersonaConflictError`.

**Verified by** — `capability-activity-persona.md` §B17 item 6; module `docs/invariants.md`.

---

### KI-75 — Four Structured Data endpoints have no error handling, and the `kind` filter is unvalidated

**Where** — [`4-job-wiring/structured-data/registerStructuredDataEndpoints.ts`](../../apps/backend/src/4-job-wiring/structured-data/registerStructuredDataEndpoints.ts)
— the registrations at `:69` (`GET /structured-data`), `:82` (`GET /structured-data/entry`),
`:96` (`GET /structured-data/by-name`) and `:184` (`POST /structured-data/query`).

**What happens** — this is KI-9's defect in a second capability. Twelve of Structured Data's
sixteen endpoints wrap their work in `try { … } catch (e) { return sdError(e) }`. These four do
not, so an unexpected throw — a SQLite error, a resolver failure, a malformed row — escapes the
job's `work()` and is rethrown by transport into Fastify's generic 500 body
(`{"statusCode":500,"error":"Internal Server Error","message":…}`), which is a different shape
from the capability's `{error, message}` envelope. A client parsing the documented shape gets a
parse failure on top of the original fault.

Separately, `GET /structured-data?kind=` is not validated against the entry kinds. An unknown or
misspelled kind is passed to the store, matches nothing, and returns **200 with `[]`** — the same
answer as "you have no entries of that kind". There is no diagnostic and no log.

**Why it survived** — `structured-data-formula.test.ts` (18 tests) exercises the formula seam, not
the wiring. There is no `structured-data-wiring.test.ts`.

**Fix size** — one `try/catch` per endpoint, plus one membership check on `kind`.

**Verified by** — `capability-structured-derived.md` PART E items 10-11; source read at HEAD (the
four registrations confirmed to contain no `catch`).

---

### KI-76 — Two of Derived Outputs' three idempotency-conflict errors answer 400 instead of 409

**Where** — [`4-job-wiring/derived-outputs/registerDerivedOutputEndpoints.ts:15-29`](../../apps/backend/src/4-job-wiring/derived-outputs/registerDerivedOutputEndpoints.ts)
(`deError`), against `derived-outputs.ts:628, 684, 746`.

**What happens** — the service throws three sibling errors when an idempotency key is reused with
different arguments:

| Error | Thrown at | Mapped? | Client sees |
| --- | --- | --- | --- |
| `DerivedOutputIdempotencyConflictError` | `derived-outputs.ts:628` | yes (`deError:24`) | **409 `idempotency_mismatch`** |
| `DerivedOutputDefinitionUpdateIdempotencyConflictError` | `:684` | **no** | 400 `bad_request` |
| `DerivedOutputRefreshIdempotencyConflictError` | `:746` | **no** | 400 `bad_request` |

`deError`'s terminal rung is `{statusCode: 400, body: {error: "bad_request", message: e.message}}`,
so the two unmapped members fall through to it. A client cannot distinguish "your request was
malformed" from "you replayed a key with different arguments" — the first is not retryable and the
second is a caller bug worth surfacing loudly. All three errors are exported from the barrel
(`derived-outputs/index.ts:37-39`).

`DerivedOutputRefreshIdempotencyConflictError` is unmapped **everywhere in the codebase**, not just
here.

**Why it survived** — no HTTP endpoint forwards an idempotency key at all (KI-82), so neither error
can currently be produced through the transport. The mapping gap is latent until that changes.

**Fix size** — two lines in `deError`.

**Verified by** — `capability-structured-derived.md` PART E item 21; source read at HEAD.

---

### KI-77 — Formula enforces neither `maxIntegerBits` nor a negative `ROUND` place

**Where** — [`0-platform/formula/builtins.ts:209-224`](../../apps/backend/src/0-platform/formula/builtins.ts)
and `limits.ts:14`.

**What happens** — two of Formula's thirteen configured limits do not do what their names promise.

- **`maxIntegerBits` (default 4,096) is never read.** It is declared (`limits.ts:14`), defaulted
  (`loadBackendConfig.ts:214`), parsed (`:534`) and merged (`engine.ts:124`). `grep -rn
  maxIntegerBits src` finds no reader. There is no bound on integer magnitude anywhere in the
  evaluator; the configured value is inert.
- **`maxRoundingPlaces` bounds positive places only.** The guard is `if (places >
  ctx.limits.maxRoundingPlaces)` (`builtins.ts:220`). A negative `places` passes it and reaches
  `roundR`, which raises a `RangeError`. The engine's generic handler converts it into
  `numeric_error: Unexpected evaluation error: undefined must be positive` — an internal message
  with the wrong error class, surfaced to the caller.

**Why it survived** — there is no direct Formula test of any kind (KI-2 records the same absence).
The module's own `docs/invariants.md:56, 61` reports both, but understates the second as *"may
reach low-level arithmetic behavior"*; it throws.

**Fix size** — one line for the `ROUND` guard (`Math.abs(places) > max`, or an explicit negative
rejection with a proper diagnostic). `maxIntegerBits` is a decision: enforce it or delete it.

**Verified by** — `platform-formula-richtext.md` §5 items 15-16 (verified by execution);
source read at HEAD; detail in [06 · Platform services](06-platform-services.md) §Formula limits.

---

### KI-78 — Rich Text: an inverted mark range validates clean, `normalize` drops marks, and two helpers throw where `validate` diagnoses

**Where** — [`0-platform/rich-text/validate.ts`](../../apps/backend/src/0-platform/rich-text/validate.ts),
`normalize.ts:102-157`, `engine.ts:401, 420, 423`.

**What happens** — three defects that sit outside KI-12 to KI-14 (which cover operations and
inverses; these cover the validator, the normaliser and the styling resolver).

1. **`validate` accepts an inverted range.** A mark with `start.offset = 3` and `end.offset = 1` on
   the same atom produces **zero diagnostics**. `validate` has 12 diagnostic codes and never checks
   `start <= end`, global atom ordering of start versus end, integer or finite offsets, offset
   bounds on non-text atoms, or `maxMarkRangeSpan`. Every downstream consumer that assumes ordered
   endpoints is unprotected.
2. **`normalize`'s adjacent-text merge silently destroys marks.** `mergeTextAtoms`
   (`normalize.ts:102-123`) keeps only the first atom's ID; `remapAndFilterMarks` (`:127-157`) then
   discards every mark anchored to the ID that vanished. Given atoms `a("ab")` and `b("cd")` with a
   bold mark on `b`, normalize returns one atom `a("abcd")` and **zero marks**. The function's own
   comment claims idempotence, which holds — of its own already-lossy output.
3. **`resolveStyling` and `comparePositions` throw on an unknown atom reference**
   (`engine.ts:401, 420, 423`: `Error: Mark range references unknown atom: <id>`). That is a
   validation-class problem raised as an exception, directly inconsistent with `validate`'s
   documented non-throwing contract — and `validate` does not detect the condition, so a caller who
   validates first is not protected.

**Why it survived** — Document never calls `normalize` on the merge path that triggers (2), and its
`validateSnapshot` runs before styling resolution, so (3) is shielded in practice. (1) is shielded
only by client behaviour: nothing in the tree constructs an inverted range.

**Fix size** — small each: an ordering check in `validate`, a mark-remap in `mergeTextAtoms`
(the machinery already exists in `mapReplacedTextPosition`), and a diagnostic instead of a throw.

**Verified by** — `platform-formula-richtext.md` §5 Rich Text items 10-11, 13 (verified by
execution); [06 · Platform services](06-platform-services.md) §Rich Text.

---

### KI-90 — `POST /connector/read-*` reads any absolute path on the host

> **This is the most severe entry on the page.** It is numbered last only because IDs are stable
> and were already allocated; read it first.

**Where** — [`3-capabilities/connector/providers/filesystem.ts:172-175`](../../apps/backend/src/3-capabilities/connector/providers/filesystem.ts)
and [`application/connectorService.ts:611-617`](../../apps/backend/src/3-capabilities/connector/application/connectorService.ts)
(`getDirectoryReader().getItemReader`).

**What happens** — the filesystem provider's reader **ignores the locator it is given** and stats
the caller-supplied key directly:

```ts
async getReader(_locator: string, itemKey: string): Promise<ConnectorReader> {
  const st = await stat(itemKey);
  return new FileConnectorReader(itemKey, st.size);
}
```

`getItemReader` passes `itemKey` straight through and **does not check that it is one of the
connector's persisted items** — `store.getItems(id)` is read for `listItems` and never consulted
here. `itemKey` is a resolved absolute path by construction (`fileToItem`, `filesystem.ts:35`,
`key: filePath`).

So `POST /connector/read-all`, `/connector/read-range` and `/connector/read-lines`, given **any**
registered connector id and an arbitrary absolute path as `itemKey`, return the contents of that
path with the backend process's privileges. There is no root confinement, no path normalisation, no
allowlist, no tenant check, and no symlink policy. `/etc/passwd` and the backend's own
`etc/configuration.yaml` — which holds the OpenRouter key unless the environment override is in
play — are both readable through a public HTTP route.

The same read logs `itemKey` at `info` on every call (KI-28), so the absolute path lands in the log
file too.

**What was intended** — a development-only adapter. The capability's docs say the filesystem
provider assumes a trusted local operator. **Nothing in the code enforces that assumption**:
`filesystemProvider` is registered unconditionally at `1-init/create/connector.ts:25` and it is the
only entry in the provider map, so there is no configuration that turns it off and no other
provider to select.

**Why it survived** — `connector.test.ts` (9 tests) reads keys the provider itself produced. No
test supplies a key the connector never listed, which is the entire defect in one sentence.

**Fix size** — small and unambiguous: resolve `itemKey` and require membership in
`store.getItems(id)` before constructing a reader; reject anything else with a 404. The wider
question — whether a filesystem provider belongs in a network-reachable service at all — is a
design decision, and it should not block the membership check.

**Verified by** — `capability-connector-files-context.md`;
[07 · Connector](07-capabilities/connector.md) §8.1; source read at HEAD (both the ignored locator
and the absent membership check confirmed).

---

### KI-91 — `getReader` on a directory connector answers 500 for an ordinary client mistake

**Where** — [`connectorService.ts:596`](../../apps/backend/src/3-capabilities/connector/application/connectorService.ts).

**What happens** — the branch throws `new Error("Use getDirectoryReader for directory
connectors")` — an untyped `Error`, so the endpoint's error ladder finds no rung and falls through
to **500 `internal_error`**. The trigger is a plain client mistake: `POST /connector/read-all`
(or `read-range`, `read-lines`) against a directory-kinded connector with no `itemKey` in the body.
A missing required field is a 400.

**Fix size** — one line: a typed error class and one rung on the ladder.

**Verified by** — [07 · Connector](07-capabilities/connector.md) §8.4; source read at HEAD.

---

### KI-92 — Endpoint bodies are cast, not validated, in three capabilities

**Where** — `4-job-wiring/connector/registerConnectorEndpointMappings.ts`,
`4-job-wiring/context/registerContextEndpoints.ts:118`,
`4-job-wiring/general-files/registerGeneralFileEndpointMappings.ts`.

**What happens** — Document, Templates, Persona and Comments decode their wire input through a
`wire/` package that produces typed errors and 400s. Three capabilities do not, and the
consequences are visible in the status codes:

| Site | What happens | Client sees |
| --- | --- | --- |
| Nine of Connector's ten endpoints destructure `(request.body ?? {}) as { … }`; `register` uses `request.body as any` | a missing `id` reaches the store as `undefined` | **404**, not 400 |
| `PATCH /contexts/entries` does `Number(body.expectedRevision)` (`:118`) | a missing field becomes `NaN`; `existing.revision !== NaN` is always true | **409 `stale_revision`**, message `… expected NaN, current 1` |
| General Files' list filters | an unknown filter `kind` is silently dropped | **200** with an unfiltered list |

None of these rejects unknown keys, and `start`/`end`/`startLine`/`endLine` on the Connector read
routes are validated only inside the filesystem reader. Every one of them turns "you sent a bad
request" into a different, plausible-looking answer.

**What was intended** — the `wire/` decoder pattern, which the repository's own archived notes
name as the intended standard. These three capabilities predate it or skipped it.

**Fix size** — small per endpoint, structural per capability. The pattern already exists four
times over and is documented in [03 · Capability anatomy](03-capability-anatomy.md).

**Verified by** — [07 · Connector](07-capabilities/connector.md) §8.9;
[07 · Context](07-capabilities/context.md) §8.5;
[07 · General Files](07-capabilities/general-files.md) §8.6.

---

## Part 2 · Silent failure and operational blindness

Nothing in this part returns a wrong answer. Everything in it makes a real failure invisible, or
writes something to disk that an operator did not expect.

---

### KI-24 — A startup failure is completely silent

**Where** — [`1-init/startBackend.ts:48-51`](../../apps/backend/src/1-init/startBackend.ts) and
[`src/index.ts:12-14`](../../apps/backend/src/index.ts).

**What happens** — the first two statements of `startBackend` are outside the `try`:

```ts
const config = await createConfig();
const logger = createLogger(config);
const startedAt = performance.now();
try {
```

`loadBackendConfig` throws on a missing file, on malformed YAML, and — because `parse("")` returns
`null` and line 389 does `parsed.server` unguarded — with a raw `TypeError` on an empty or
comment-only config file (KI-37). `createLogger` throws if `mkdirSync` fails. In all of those
cases no logger exists yet, so the `catch` at `:230` (which logs `backend.start.failed`) is never
reached. `src/index.ts` then swallows the error:

```ts
void startBackend().catch(() => {
  process.exitCode = 1;
});
```

and `console.*` is forbidden in that exact file by a source-text regression test
(`runtime-wiring.test.ts:202-210`). **A misconfigured backend exits 1 with no output on stdout, no
output on stderr, and no log file entry.** An operator has no signal at all beyond the exit code.

**What was intended** — the `console.*` ban exists so failures go through the shared Logger rather
than around it. The ban was applied to the file that runs before the Logger exists, which is
precisely where it cannot be satisfied.

**Why it survived** — the test that forbids `console.*` in `src/index.ts` is a *source-text*
assertion; there is no test that boots the process with a bad config and checks for output.

**Fix size** — small. Write the failure to `process.stderr` directly in `index.ts`'s catch (the
regression test's regex matches `console.*` calls, not `process.stderr.write`), or move
`createConfig`/`createLogger` inside a `try` with a bootstrap-stderr fallback.

**Verified by** — reconciliation §G9; `layers-and-composition.md` §11.9; source read at HEAD.

---

### KI-25 — An unrecognised `logging.level` disables level filtering entirely

**Where** — [`0-utils/config/loadBackendConfig.ts:452`](../../apps/backend/src/0-utils/config/loadBackendConfig.ts),
[`1-init/create/logger.ts:66`](../../apps/backend/src/1-init/create/logger.ts),
[`0-platform/observability/logger.ts:88,117`](../../apps/backend/src/0-platform/observability/logger.ts).

**What happens** — the loader accepts any non-empty string (`parseString`), and the factory casts:
`config.logging.level as LogLevel`. `FileLogger`'s constructor then computes
`this.minLevel = LOG_LEVEL_RANK[level]`, which for an unrecognised value is `undefined`. The
filter is:

```ts
if (LOG_LEVEL_RANK[level] < this.minLevel) {
  return;
}
```

`n < undefined` is `false` for every `n`, so **every record at every level is written**. A typo
(`levl: warn` leaves the level at the YAML default `debug`; `level: warning` produces this) yields
maximum verbosity silently, on a sink with no retention (KI-33).

**What was intended** — the sibling field shows the intent. `logging.detail` *is* normalised, with
a comment explaining the fail-open choice (`loadBackendConfig.ts:458-460`):

> *"Anything that is not exactly "shape" means write everything. An unrecognised value therefore
> fails open toward more logging, which is the safe direction while this is a development
> setting."*

That is a deliberate fail-open with a stated reason. `logging.level`'s fail-open is an accident of
a cast.

**Why it survived** — `loadBackendConfig` has essentially no direct test (KI-64); the one
incidental assertion lives in the Templates suite. `observability.test.ts` (3 tests) and
`logging-detail.test.ts` (5 tests) construct `FileLogger` with valid levels.

**Fix size** — one line: validate against the four-value union in the loader, as `detail` already
is.

**Verified by** — reconciliation §G12; `platform-observability-database-web.md` §4.5;
`layers-and-composition.md` §11.8; source read at HEAD.

---

### KI-26 — Content logging is on by default; the switch is absent from the shipped config

**Where** — [`loadBackendConfig.ts:175-181`](../../apps/backend/src/0-utils/config/loadBackendConfig.ts)
and [`apps/backend/etc/configuration.yaml:20-26`](../../apps/backend/etc/configuration.yaml).

**What happens** — `BackendConfig.logging` has four fields. The shipped `logging:` block has
three:

```yaml
logging:
  # Set to false to disable all file logging at runtime (all log calls become no-ops).
  enabled: true
  # Minimum level to record. One of: debug | info | warn | error
  level: debug
  # Directory to write daily log files into, relative to the process working directory.
  directory: logs
```

`grep -n detail etc/configuration.yaml` returns nothing. The default is
`detail: "content"` with the comment *"Developer-friendly by default. Production flips this one
value."* So **the backend writes authored user content into `logs/backend-YYYY-MM-DD.log` by
default**, and the shipped configuration gives an operator no hint that the switch exists. Nine
call sites are labelled `content` today —
`documentService.ts:{491,589,690,704,750}` and `templateService.ts:{215,354,465,523}` — and they
write template names, descriptions, declared bindings, instantiation arguments, what an update
changed, what a search matched, prompt text, resolved context entries, and what a Prompt Block was
rebound to.

Two aggravating facts: the shipped YAML also sets `level: debug` while `DEFAULT_CONFIG` uses
`info`, so all nine `debug` call sites are live in a default checkout; and there is no log
retention (KI-33), so those files accumulate forever.

**What was intended** — the mechanism is deliberate and well-argued. `logger.ts:10-21`:

> *"`content` — names, titles, prompt text, field values, rows. The fastest way to see what
> actually happened, and not something a production build should be writing to disk by default.
> … Labelling the record rather than loosening the rule is the point: the switch from development
> to production becomes one configuration value instead of an audit of every call site, and there
> is still something left to tighten."*

The intent is "one value flips it". Shipping without the key in the file means production is one
*undocumented* edit away. `etc/README.md` does not mention `logging.detail` either.

**Why it survived** — the feature landed in this very commit (`ef6d462`). Nothing in the smoke
path hits a Document or Templates content call site, so a real boot plus the 41-request smoke run
produced **zero** records carrying `"detail":"content"` — the default is invisible until someone
uses the product.

**Fix size** — one line in `etc/configuration.yaml` plus a paragraph in `etc/README.md`. Flipping
the *default* to `shape` is a separate decision with a real cost to developer ergonomics.

**Verified by** — reconciliation §G11 and §6.3; `platform-observability-database-web.md` §4.4;
source read at HEAD (9 `detail: "content"` call sites plus the default).

---

### KI-27 — Slides' reserved `content` key was never migrated to the detail label

**Where** — [`3-capabilities/slides/persistence/sqliteSlidesStore.ts:130-152`](../../apps/backend/src/3-capabilities/slides/persistence/sqliteSlidesStore.ts).

**What happens** — the tree carries **two** mechanisms for keeping authored content out of logs,
and they do not interoperate:

| | Mechanism | Unit | Sink behaviour in `shape` mode |
| --- | --- | --- | --- |
| A | `LogOptions.detail` (`observability/logger.ts:24-27`, dropped at `:122-125`) | the whole record | record dropped entirely |
| B | reserved `content` key in `data` (`sqliteSlidesStore.ts:144`) | the payload | **nothing — the sink never looks at `data`** |

`FileLogger` inspects `options.detail` and nothing else. Slides passes no `options`
(`grep -rn 'detail: "content"' src` returns no Slides hit), so every Slides record defaults to
`shape` and is written **in full, including `data.content`**, even when `logging.detail: "shape"`.
Setting the production value does not suppress Slides' authored deck titles, prompt text, or Rich
Content operation arrays.

**What was intended** — mechanism B's own doc comment predicted mechanism A and stated the
precondition for its own removal, verbatim (`sqliteSlidesStore.ts:130-143`):

> ```
> /**
>  * The reserved log-payload key under which authored content is carried.
>  *
>  * A log payload is `{ ...shape, content?: { ...authored } }`. Shape is safe to
>  * emit anywhere: IDs, counts, revisions, digests, kinds, states. Content is
>  * whatever a person typed.
>  *
>  * This exists so the split is enforced in one place rather than remembered at
>  * every call site, and so a future `logContent: false` sink can strip
>  * `data[CONTENT_KEY]` without knowing anything about Slides. It belongs in
>  * `0-platform/observability` once that flag lands; it is here for now because
>  * Slides is the only capability observing the convention.
>  */
> ```

**The flag landed in this very commit and Slides was not migrated.** The comment's precondition is
satisfied and its guarantee has silently stopped holding.

**Why it survived** — Slides is unreachable (KI-42), so nothing leaks today. The two tests that
pin mechanism B would pass in `shape` mode regardless: `slides-persistence.test.ts:712` *"a commit
logs shape at the top level and authored content under `content`"* and `:739` *"no authored
content appears outside the reserved `content` key"*. The comment on the second is worth quoting
because it describes a different failure than the one that actually occurred:

> *"The half of the split that is easy to break: a title added to a top-level payload would still
> log fine and still read fine, and would quietly defeat the shape-only mode the flag is for."*

**Fix size** — small, and it needs a decision first: either teach `FileLogger` to strip
`data[CONTENT_KEY]` (which honours the comment's promise and works for unlabelled records), or
have Slides pass `{ detail: "content" }` and delete `CONTENT_KEY`. Doing neither leaves two
conventions.

**Verified by** — reconciliation §G10 and open question 3;
`platform-observability-database-web.md` §4.2; `tests-config-and-status.md` §7.8; source read at
HEAD.

---

### KI-28 — Connector, Context and General Files log content with no label

**Where** — [`general-files/application/generalFileService.ts:204-211`](../../apps/backend/src/3-capabilities/general-files/application/generalFileService.ts);
[`context/context.ts:95,130,274`](../../apps/backend/src/3-capabilities/context/context.ts);
[`4-job-wiring/connector/registerConnectorEndpointMappings.ts:133-138,166-173,201-208`](../../apps/backend/src/4-job-wiring/connector/registerConnectorEndpointMappings.ts).

**What happens** — `grep -rn 'detail:'` across those three capabilities returns nothing, yet all
three log values that the logger's own taxonomy classifies as `content` (`logger.ts:13-16`:
*"`content` — names, titles, prompt text, field values, rows"*):

| Event | Field | What it is |
| --- | --- | --- |
| `general-files.upload` | `fileName` | a user-supplied file name |
| `context.declare`, `context.getByName`, `context.composeNamed` | `displayName` | a user-authored name |
| `connector.read-all`, `connector.read-range`, `connector.read-lines` | `itemKey` | for the filesystem provider, **an absolute filesystem path** |

All are written unlabelled, therefore as `shape`, therefore written in every configuration.
Setting `logging.detail: "shape"` does not remove them.

**What was intended** — the taxonomy in `logger.ts` is unambiguous about which category these
fall into. The Connector module's own `docs/runtime.md:112` overstates its log hygiene and does
not mention that `itemKey` is a path.

**Why it survived** — the label mechanism is one commit old and only Document and Templates were
migrated. Nothing enforces the taxonomy — there is no lint, no test, and the standard test double
discards the label anyway (KI-29).

**Fix size** — one line per call site (nine of them), plus the same decision KI-27 needs.

**Verified by** — reconciliation §G10; `capability-connector-files-context.md` §9.16.

---

### KI-29 — `CapturingLogger` silently discards the detail label

**Where** — [`test/helpers/testDoubles.ts:11-28`](../../apps/backend/test/helpers/testDoubles.ts).

**What happens** — the shared logging double declares four **two-parameter** methods:

```ts
export class CapturingLogger implements Logger {
  readonly entries: CapturedLog[] = [];
  debug(message: string, data?: unknown): void {
    this.entries.push({ level: "debug", message, data });
  }
  …
```

The real `Logger` interface gained a third `options?: LogOptions` parameter in this commit.
TypeScript permits an implementation with fewer parameters, so it compiles by erasure — and the
double is not typechecked at all anyway (KI-56). Consequences: no capability test can assert on a
record's `detail` label; every capability test sees content records unconditionally regardless of
configuration; and `logging-detail.test.ts` has to build a raw `FileLogger` with an ad-hoc writer
instead of using the standard double, which is a visible symptom of the same gap.

23 test files use this double.

**Why it survived** — see above: it compiles, and nothing typechecks `test/`.

**Fix size** — one line: add `_options?: LogOptions` to the four methods and record it on
`CapturedLog`. Doing so lets every existing wiring test assert the label.

**Verified by** — reconciliation §G16; `platform-observability-database-web.md` §4.3; source read
at HEAD.

---

### KI-30 — Nothing ever closes a SQLite connection

**Where** — [`startBackend.ts:220-227`](../../apps/backend/src/1-init/startBackend.ts).

**What happens** — the shutdown handler is:

```ts
const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  logger.info("Backend shutting down", { signal });
  syncScheduler.stop();
  await retentionScheduler.stop();
  await app.close();
  await logger.close?.();
  process.exit(0);
};
```

It stops the sync timers, awaits the retention sweep, closes Fastify, flushes the logger, and
exits with **every database handle open**. Six store classes expose `close()` —
`SQLiteActivityStore`, `SQLiteCommentStore`, `SQLiteInvestigationStore`, `SQLiteDocumentStore`,
`SQLiteSlidesStore`, `SQLiteKnowledgeStore` — and none of them is called outside tests.
`SQLiteTemplateStore` has no `close()` at all. Most of the six are not even on their capability's
port, so composition could not call them without a cast. The leftover `-wal`/`-shm` files in
`apps/backend/data/` are the visible consequence.

**What was intended** — the module docs are honest about it: Document's
`docs/runtime.md:170-172` and `docs/invariants.md:215` both admit the capability exposes no
shutdown, and Document's non-goals list includes *"capability-level shutdown/closing of its
store"*. So it is documented as absent — but it is documented per-capability, and the composition
root, which is the only place that could fix it, says nothing.

**Why it survived** — `better-sqlite3` on `process.exit(0)` is generally safe with WAL, and the
tests that do call `close()` do so for their own temp-directory lifecycle. Nothing observes the
production case.

**Fix size** — small: put `close()` on each capability's runtime interface and call them in
`shutdown`, in reverse construction order. Nine interfaces, one loop.

**Verified by** — reconciliation §G13; `layers-and-composition.md` §11.10; source read at HEAD.

---

### KI-31 — Nothing drains the job queues on shutdown, and nothing can cancel a job

**Where** — [`0-utils/jobs/scheduler.ts`](../../apps/backend/src/0-utils/jobs/scheduler.ts);
`startBackend.ts:220-227`.

**What happens** — `JobScheduler` has no `stop()`, no `drain()`, no `cancel()`, and no
`AbortSignal` anywhere in the job runtime. `app.close()` waits for in-flight **HTTP requests**,
but a *deferred* job's follow-up `work()` — which holds its queue slot after the response has
already been sent — is not awaited by anything. A hung job holds its slot forever, and there is no
operator lever to reclaim it: no timeout, no cancel endpoint, no restartable queue.

`POST /audit` is the only deferred endpoint in the tree, so the exposure today is one route.

**What was intended** — [phase-1/runtime/repository-boundaries.md](../phase-1/runtime/repository-boundaries.md)
sketches `JobDefinition.execute(signal?: AbortSignal)`. That signature has never existed in
source; the real `JobDefinition` is a discriminated union on `responseMode` with `work()` or
`deferredWork() + work()`. This is the one place where an archived design page describes something
genuinely worth having.

**Why it survived** — one deferred route, and it does trivial work.

**Fix size** — structural. Adding cancellation means threading a signal through every `work()`
implementation across 89 endpoints. Adding a *drain* is smaller: track in-flight jobs and await
them in `shutdown` behind a timeout.

**Verified by** — reconciliation §G14; `jobs-queues-and-utils.md` §11 items 8-9.

---

### KI-32 — Fastify-level rejections appear in no log sink

**Where** — [`1-init/create/app.ts:3-5`](../../apps/backend/src/1-init/create/app.ts)
(`Fastify({ logger: false })`) and
[`2-transport/registerHttpTransport.ts:39`](../../apps/backend/src/2-transport/registerHttpTransport.ts).

**What happens** — content-type and body-parse failures are decided by Fastify *before* the
wildcard handler runs, and `createApp()` disables Fastify's own logger by design. Measured:

| Request | Response | Logged |
| --- | --- | --- |
| `POST` with `content-type: application/json` and a malformed body | `400 FST_ERR_CTP_INVALID_JSON_BODY` | **nowhere** |
| `POST` with `content-type: text/csv` | `415 FST_ERR_CTP_INVALID_MEDIA_TYPE` | **nowhere** |

An operator debugging a client that sends bad JSON sees a 400 in the client and absolutely nothing
on the server.

**What was intended** — `logger: false` is deliberate: there is one log sink, and Fastify's is not
it. The gap is that nothing replaced the coverage Fastify's logger would have given for
pre-routing failures.

**Why it survived** — the smoke runner sends only well-formed bodies; no test asserts on a 400/415
log record because there is nothing to assert on.

**Fix size** — small: register an `onError` or `setErrorHandler` hook that forwards to the shared
Logger.

**Verified by** — reconciliation §6.5; `layers-and-composition.md` §9.2 and §11.11 (measured
against a live boot).

---

### KI-33 — No log retention, and the filename date and record timestamp use different clocks

**Where** — [`1-init/create/logger.ts`](../../apps/backend/src/1-init/create/logger.ts).

**What happens** — three separate gaps in one file:

1. **No retention.** Nothing deletes, compresses, or caps log files. One file per calendar day,
   forever. `ResourceRetentionScheduler` governs deleted *resources*, not logs. Combined with
   KI-26 (content on by default) and KI-25 (a typo means every level), an unattended deployment
   accumulates authored user content indefinitely.
2. **Two clocks.** The filename date comes from local-time getters; `LogEntry.timestamp` is UTC
   (`new Date().toISOString()`, `logger.ts:128`). In a non-UTC deployment, records near midnight
   land in a file whose name disagrees with their contents.
3. **`close()` is a flush, not a latch.** `closeWriter` clears `stream` but leaves
   `currentFileName` set (`create/logger.ts:55-59`), so a subsequent `logger.info(...)` re-enters
   `streamForToday()` and creates a fresh append stream. Benign today because `close()` is only
   called immediately before `process.exit(0)`.

**What was intended** — the buffered writer itself was a deliberate improvement (commit `bc506b7`
replaced a per-entry `appendFileSync`), and its comment at `create/logger.ts:41-42` states the
goal: *"A sink failure must not throw into a capability call."* Retention and clock consistency
were simply never in scope.

**Why it survived** — `observability.test.ts` (3 tests) and `logging-detail.test.ts` (5 tests) both
run inside a single day in a single process.

**Fix size** — small for (2) and (3) — one getter and one assignment. Structural for (1), because
it needs a policy and a scheduler binding.

**Verified by** — `platform-observability-database-web.md` §4.7-4.8; reconciliation §6.5.

---

### KI-34 — A serialization failure in the log sink unwinds into the caller

**Where** — [`1-init/create/logger.ts:41-51`](../../apps/backend/src/1-init/create/logger.ts).

**What happens** — the stream `error` handler catches asynchronous write and open failures and
degrades to stderr. But `JSON.stringify(entry)` runs **on the caller's stack**, so a circular
reference or a `bigint` anywhere in `data` throws synchronously into whatever capability method
called `logger.info(...)`. `mkdirSync` at `:26` likewise throws out of `createLogger` and aborts
startup (silently — KI-24).

**What was intended** — the comment two lines above says: *"A sink failure must not throw into a
capability call."* That holds for the stream and not for serialization.
[phase-1/platform/observability.md:113](../phase-1/platform/observability.md) states it as an
enforced invariant (*"A sink failure cannot corrupt a capability transaction"*); it is not
enforced anywhere.

**Why it survived** — no call site currently passes a circular structure or a `bigint`. Nothing
prevents one.

**Fix size** — one line: wrap the `JSON.stringify` in a `try/catch` that falls back to a
`{message, serializationFailed: true}` record.

**Verified by** — `platform-observability-database-web.md` §4.6; source read at HEAD.

---

### KI-35 — Investigation's startup manifest under-reports by three routes

**Where** — [`4-job-wiring/investigation/registerInvestigationEndpoints.ts:818-819`](../../apps/backend/src/4-job-wiring/investigation/registerInvestigationEndpoints.ts).

**What happens** — after registering its routes, the file logs:

```ts
logger.info("investigation.endpoints.registered", {
  count: 23,
  endpoints: [ … 23 entries … ]
});
```

Investigation registers **26** endpoints — the largest HTTP surface in the backend. The manifest
omits `POST /questions/purge`, `POST /hypotheses/purge`, and `POST /findings/purge`. The routes
work; only the self-report is wrong. Anyone auditing the startup log for the live route inventory
gets a list that is missing the three most destructive operations in the capability.

The error has already propagated into documentation: the capability's own `runtime.md:41` and
`invariants.md:263` both copied `23`, while its `README.md:29`, `flows.md:6` and `flows.md:281`
correctly say 26.

**What was intended** — an accurate manifest. Every other wiring file's count matches
(`investigation.test.ts:646` independently asserts `registry.listEndpoints().length === 26` at the
registry level, which is why the discrepancy never fails anything).

**Why it survived** — the hard-coded literal is not derived from the registrations. The test
asserts on the registry, not on the log record. Derived Outputs has the same pattern with a
hard-coded `7` that happens to be right.

**Fix size** — one line, and the durable version is smaller than the current code: derive both
fields from `registry.listEndpoints()` rather than maintaining a literal.

**Verified by** — reconciliation §6.1 and open question 1;
`capability-investigation-slides-builtin.md`; source read at HEAD.

---

### KI-36 — Resource-read denials are almost entirely invisible

**Where** — [`1-init/create/resource-reader.ts:163-234`](../../apps/backend/src/1-init/create/resource-reader.ts).

**What happens** — `ResourceRegistry.read` is the **only** enforcement point for scoped-read
authorisation in the backend. It logs exactly one refusal — the manifest-membership failure — and
at `debug`:

```ts
if (!descriptor) {
  this.logger.debug("resources.read.denied", { resourceId, resourceKind });
  return null;
}
```

Every later refusal — wrong revision, connector mismatch, missing content, unknown kind — returns
`null` with **no log record at all**. In a default deployment (`level: debug`) the first is
visible; in the documented production posture (`level: info`) none of them is. Finding reads also
skip the revision check entirely (`:180-192`) and return no `revision` field.

**What was intended** — a denial is a security-relevant event at the one place that enforces
scope. The single `debug` log suggests the intent was diagnostic rather than audit.

**Why it survived** — `read` returning `null` is a normal, expected outcome for the Derived
Outputs tool loop, so the absence of a log looks like the absence of a problem.

**Fix size** — small: one `warn` per refusal branch with the reason. Past the logged one there
are three bare `return null` sites (`:211`, `:213-220`, and the general-file/finding
fall-throughs).

**Verified by** — `capability-structured-derived.md` PART E items 27-28; source read at HEAD.

---

### KI-37 — An empty `configuration.yaml` crashes with a raw `TypeError`

**Where** — [`0-utils/config/loadBackendConfig.ts:387-391`](../../apps/backend/src/0-utils/config/loadBackendConfig.ts).

**What happens** — `parse("")` returns `null`, and line 389 does `parsed.server` unguarded:

```ts
const parsed = parse(source) as Record<string, unknown>;
const server = (parsed.server as Record<string, unknown> | undefined) ?? {};
```

An empty or comment-only config file therefore produces
`TypeError: Cannot read properties of null (reading 'server')` rather than a configuration error —
and, because of KI-24, produces it with no output on any stream. A **missing** file is also fatal:
`DEFAULT_CONFIG` is a per-field fallback, never a whole-file one. A YAML document that is a scalar
or an array is silently accepted and yields all defaults. Unknown sections are silently ignored
(pinned by `templates.test.ts:2164`).

**Fix size** — one line: `const parsed = (parse(source) ?? {}) as Record<string, unknown>`.

**Verified by** — reconciliation §6.4 and §G9; `jobs-queues-and-utils.md` §11 item 11; source read
at HEAD.

---

### KI-38 — No tunable can be 0, and non-integers pass

**Where** — [`loadBackendConfig.ts:263-273`](../../apps/backend/src/0-utils/config/loadBackendConfig.ts)
(`parseNumber`).

**What happens** — `parseNumber` requires `Number.isFinite(v) && v >= 1`. So
`retention.revisionRetentionDays: 0` and `queue.serialMaxSize: 0` are **startup errors, not
configurations** — an operator who wants "retain nothing" or "reject everything" gets a crash. In
the other direction there is no integrality check, so `queue.serialMaxSize: 1.5` loads fine and
produces a fractional queue bound.

Related, and equally undocumented: `routes: []` is accepted; a partially specified route silently
inherits the rest from the default route at the same index; a route table longer than 9 borrows
route 0's defaults; and nothing checks that the strength × speed grid is complete or unique.

**Fix size** — small: split the validator into "positive integer" and "non-negative integer" and
apply each where it belongs.

**Verified by** — reconciliation §6.4; `jobs-queues-and-utils.md` §8.2.

---

### KI-39 — The config path is module-relative while `data/` and `logs/` are cwd-relative

**Where** — `loadBackendConfig.ts` (`defaultConfigPath`) versus the 12 `"./data/*.db"` literals and
`logging.directory: logs`.

**What happens** — `defaultConfigPath` is resolved relative to the module, so the backend always
reads the repo's `apps/backend/etc/configuration.yaml` no matter what directory it is started
from. The database and log paths are resolved relative to the **process working directory**.
Starting the backend from the repo root therefore reads the right config and creates
`<repo>/data/` and `<repo>/logs/` instead of `apps/backend/data/` and `apps/backend/logs/` — a
second, empty database set that looks like data loss. There is no guard and no log line naming the
resolved paths.

**Fix size** — small: log the resolved absolute paths at startup, and/or resolve `data/` and
`logs/` against the same module-relative base.

**Verified by** — reconciliation §6.4.

---

### KI-40 — A 429 carries no `Retry-After`

**Where** — [`registerHttpTransport.ts:96-111`](../../apps/backend/src/2-transport/registerHttpTransport.ts).

**What happens** — queue overflow returns `429` with body `{error, queueType}` and no
`Retry-After` header. A client has no signal about when to try again, and the queue's depth is not
exposed on the response either (it is available on `GET /health/queues`, but only as a separate
request). Capacity bounds **waiting depth** only — a job that has started executing has already
been shifted out of the queue — so the 429 is a statement about backlog, not about load.

**Fix size** — one line, plus a decision about what value to send.

**Verified by** — source read at HEAD; `layers-and-composition.md` §9.3.

---

### KI-41 — No trailing-slash tolerance, no percent-decoding, and `HEAD /health` 404s

**Where** — [`registerHttpTransport.ts:23-31`](../../apps/backend/src/2-transport/registerHttpTransport.ts)
and [`0-utils/jobs/registry.ts`](../../apps/backend/src/0-utils/jobs/registry.ts).

**What happens** — `envelope.path` is `new URL(request.url, "http://backend.local").pathname`. The
query string is stripped; percent escapes are **not** decoded and a trailing slash is **not**
normalised. The registry matches an exact `"<METHOD> <path>"` string with no pattern matching. So:

- `GET /health/` misses the `GET /health` registration and 404s.
- `app.all` covers HEAD and OPTIONS, so `HEAD /health` reaches the handler, misses the key
  `"HEAD /health"`, and returns the 404 body — with a body, on a HEAD request.
- A percent-encoded path never matches.

The 404 body includes `registeredEndpoints: registry.listEndpoints()`, so every miss returns the
full sorted list of all 89 endpoints. That is a genuinely useful route directory and a large
response for a typo.

**What was intended** — exact-match routing is deliberate; the registry is 55 lines and does one
thing. The HEAD case is an accident of `app.all`.

**Fix size** — small: normalise the trailing slash in `buildEnvelope`, and either register HEAD
aliases for GET routes or exclude HEAD from the wildcard.

**Verified by** — `layers-and-composition.md` §9.2 (measured); source read at HEAD.

---

### KI-79 — A permanent purge writes no Activity record, in either capability that publishes

**Where** — [`templates/domain/model.ts:208-212`](../../apps/backend/src/3-capabilities/templates/domain/model.ts)
(`TemplateTransactionKind`) and
[`comments/domain/model.ts:106-111`](../../apps/backend/src/3-capabilities/comments/domain/model.ts)
(`CommentActivityOperation`).

**What happens** — the two vocabularies are closed and neither has a purge member:

```ts
export type TemplateTransactionKind =
  | "template.registered" | "template.updated" | "template.deleted";

export type CommentActivityOperation =
  | "created" | "updated" | "resolved" | "reopened" | "deleted";
```

The outbox `CHECK` constraints enforce the same sets in SQL. **Logical deletion is recorded in the
ledger; permanent destruction is not.** A purge removes the row, removes the history, and leaves
the Activity ledger asserting that the resource was last *deleted* — a recoverable state — with no
record that it is now unrecoverable. The same is true of every retention-driven purge, which runs
unattended on a timer.

**Why it is here and not in Part 5** — the omission is not argued anywhere. `templates/docs` and
`comments/docs` both argue the `instantiate` omission (Part 5) and neither mentions purge. Purge is
also the one operation an auditor is most likely to ask about.

**Fix size** — one member per union, one `CHECK` per outbox table, one publish call per purge path.
It is a schema change, so it is not a one-liner.

**Verified by** — `capability-templates-comments.md` INCOMPLETE item 12; source read at HEAD (both
unions and both `CHECK`s confirmed).

---

### KI-80 — The Activity ledger has no retention, compaction, or cap

**Where** — [`3-capabilities/activity/`](../../apps/backend/src/3-capabilities/activity) and the
retention port list at [`startBackend.ts:123-147`](../../apps/backend/src/1-init/startBackend.ts).

**What happens** — `data/activity.db` grows without bound. Activity is deliberately not a retention
port (Part 5 records why: it is an append-only ledger, and pruning it would defeat its purpose),
but **nothing else prunes, compacts, archives, partitions or caps it either**. There is no
`VACUUM`, no age-based export, no row cap, and no metric. Every Document commit, every Comment
mutation, and every Templates registration appends a row plus a canonical digest, forever.

The `<prefix>_presence` table is bounded only by `removeExpired`, which nothing schedules (KI-43),
so it would also grow without bound if the write path were ever reachable.

**Why it is an issue rather than a decision** — the decision *not to prune* is documented. The
consequence — that the ledger is an unbounded growth surface with no operator lever and no
observability — is documented nowhere, and it is the kind of thing that is discovered by a full
disk.

**Fix size** — none as a repair; it is a design decision that has not been made. The cheapest
honest step is a row-count and byte-size gauge on the existing `GET /health/queues`-style surface,
so the growth is at least visible.

**Verified by** — `capability-activity-persona.md` §A14 item 8; reconciliation §G2 and §4.3
(Activity confirmed absent from the 11 retention ports).

---

### KI-81 — The resource reader skips the revision check for Findings and misreports `byteSize`

**Where** — [`1-init/create/resource-reader.ts:180-192`](../../apps/backend/src/1-init/create/resource-reader.ts).

**What happens** — `ResourceRegistry.read` is the **only** enforcement point for scoped-read
authorisation in the backend (it is what Derived Outputs' `read` tool goes through). Its three
branches are not equally strict:

| Branch | Checks id | Checks kind | Checks revision |
| --- | :-: | :-: | :-: |
| general file | ✓ | ✓ | ✓ `revisionMatches` |
| connector item | ✓ | ✓ | ✓ |
| **finding** | ✓ | ✓ | **— no check** |

The Finding branch returns without calling `revisionMatches`, and the returned `ResourceContent`
carries **no `revision` field**, so a caller cannot tell which version it read. A grounding
manifest that pins a Finding at revision *N* is satisfied by whatever the Finding says now. Because
a Finding's Knowledge revision is `sha256(claim)` (see
[07 · Investigation](07-capabilities/investigation.md)), an edited claim is exactly the case the
check would catch.

Second, and in all three branches: `byteSize` is the byte length of the **whole** resource, not of
the slice actually returned:

```ts
text: sliceLines(finding.claim, startLine, endLine),
byteSize: Buffer.byteLength(finding.claim, "utf8")
```

A caller budgeting tokens from `byteSize` over-counts every partial read.

**Why it survived** — `resource-reader.ts` has no test file of its own; it is exercised indirectly
through `derived-outputs.test.ts`, whose doubles return whole resources.

**Fix size** — one line for the revision check, one for `byteSize`. The `revision` field on the
response is a contract change.

**Verified by** — `capability-structured-derived.md` PART E items 28-29; source read at HEAD.

---

### KI-93 — `GET /health` reports nothing, and `POST /audit` audits nothing

**Where** — [`3-capabilities/built-in/`](../../apps/backend/src/3-capabilities/built-in) — four
files, 47 lines.

**What happens** — two of the four built-in endpoints are named after operational guarantees they
do not provide.

- **`GET /health`** returns `status: "ok"` unconditionally, from a literal type that admits no
  other value. It touches none of the twelve SQLite connections, the scheduler, the logger, the
  configuration, or the retention timer. A backend with every database corrupt, both queues full
  and the log sink failing answers exactly as a healthy one does. It is a liveness probe, and the
  frontend (`apps/frontend/src/main.ts:12`) uses it as one — which is the only correct use.
  `GET /health/queues` is the endpoint that reports real state, and it is the one with **no test
  and no smoke coverage** (KI-63, KI-72).
- **`POST /audit`** sleeps 250 ms and returns an object the scheduler discards. There is no store,
  no logger call, and no side effect other than holding a serial slot for a quarter of a second. It
  is the tree's only deferred job and it exists to exercise the deferred path. Anyone reading the
  89-endpoint inventory and expecting an audit trail finds none; the nearest real thing is the
  Activity ledger.

**Why it is here rather than in Part 5** — the fixture status of `/audit` is arguable and could be
defended. `/health`'s name is not: it is the endpoint an operator and every uptime checker will
reach for first, and it cannot report a fault.

**Fix size** — small for `/health` (probe the stores and the scheduler, and return a degraded
status), or one line of documentation if liveness is genuinely the intent. `/audit` is a naming
decision.

**Verified by** — [07 · Built-in](07-capabilities/built-in.md) §8.3-8.4; source read at HEAD.

---

### KI-94 — No write spans two databases, and only three of the five producers have a recovery drain

**Where** — [`startBackend.ts:187-195`](../../apps/backend/src/1-init/startBackend.ts) and each
capability's outbox.

**What happens** — every capability owns its own `better-sqlite3` connection (12 files), so no
transaction can span two of them. Four seams cross that boundary, and they are protected
unevenly:

| Seam | Durability mechanism | Recovery at startup |
| --- | --- | --- |
| Document → Activity | `doc_<p>_transaction_outbox` | ✓ `startBackend.ts:190` |
| Comments → Activity | `cmt_<p>_transaction_outbox` | ✓ `:192` |
| Templates → Activity | `tpl_<p>_transaction_outbox` | ✓ `:194` — but **startup-drain only**, and it `break`s on the first failure (KI-20) |
| Investigation → Knowledge | **none** — no outbox, no pending table | **✗ nothing** |
| Persona → Context | none; the persona CAS is the commit point | ✗ nothing (and see KI-3) |

Investigation is the gap that matters. If the process dies between `knowledge.add` and the SQLite
write — or the reverse — the two stores disagree until the next operation on **that specific
Finding** happens to run `reconcileFindingKnowledge`. Nothing sweeps for stragglers, and
`reconcileFindingKnowledge` itself is an unbounded loop with no attempt ceiling and no backoff, so
a Knowledge implementation that failed non-deterministically in the right way would spin.

**Why it is an issue rather than a decision** — the outbox pattern *is* a stated decision, argued in
Comments' own `docs/invariants.md:50-51` (*"No cross-database transaction with Activity; the
Comments outbox is recovery authority"*). Investigation having neither an outbox nor a reconciler
entry point is not argued anywhere; it is an omission with the same shape as the three that were
solved.

**Fix size** — structural for Investigation (an outbox plus a startup drain, following Document).
Small for the recorded loop: an attempt ceiling and backoff.

**Verified by** — [07 · Investigation](07-capabilities/investigation.md) §9.5;
[07 · Comments](07-capabilities/comments.md) §9.5; source read at HEAD.

---

## Part 3 · Unreachable and dead code

---

### KI-42 — Slides is built, typechecked, covered by 87 tests, and completely unreachable

**Where** — [`3-capabilities/slides/`](../../apps/backend/src/3-capabilities/slides) — 15 files,
6,765 lines: 11 under `domain/`, 3 under `persistence/`, 1 under `ports/`.

**What happens** — nothing constructs it. There is no `application/` service, no `index.ts`
barrel, no `#slides` alias in either `package.json` `imports` or `tsconfig.json` `paths`, no
`1-init/create/slides.ts`, no `4-job-wiring/slides/`, and no mention in `startBackend.ts`.
`SQLiteSlidesStore` is never instantiated outside `slides-persistence.test.ts:48`, so `slides.db`
is never created — it is not among the 12 database paths the runtime opens. Slides is also the
only one of the 20 module directories under `0-platform` + `3-capabilities` with **no `docs/`
package** (19 of 20 have one).

Outside its own directory, the entire repository references Slides in exactly one place:
`3-capabilities/templates/ports/templatableResource.ts:32-33`, a **comment** citing
`slides::deck` / `slides::slide` as an example of a compound kind.

Meanwhile it is the second-most-tested area in the repo: **87 tests** across `slides-domain.test.ts`
(61) and `slides-persistence.test.ts` (26), 2,580 lines, importing by relative path because there
is no alias. It is inside the `tsc` project, so it is typechecked on every build.

**What was intended** — staged delivery, and the git history is explicit:
`22cc827 feat(slides): Phase 1 — pure domain layer`,
`8073020 feat(slides): Phase 2 — store port and SQLite persistence`,
`a4d4a91 fix(slides): restore Phase 2 and the cycle guard, reverted by a stale index`.
Phase 3 (application + wiring) does not exist on `main`.

**Why it is here rather than in Part 5** — it is deliberate, but it is a live hazard for a reader
and for a maintainer: 6,765 lines that typecheck and pass tests read as working code. It also
carries KI-27 (the unmigrated logging convention) into a directory nobody is watching. And
Phases 3–5 exist on **other branches that are not ancestors of HEAD** (`acfdd81`, `3279cf5`,
`c5fa6d7`, `7a50e68`, `4a76c78`), so a reader who greps the repo's worktrees can easily describe
behaviour that `main` does not have.

**Fix size** — structural, and it is a build task rather than a repair: see
[12 · Build order](12-build-order.md).

**Verified by** — reconciliation §C1, §C12, §6.2; `layers-and-composition.md` §11.2;
`tests-config-and-status.md` §7.1.

---

### KI-43 — The whole Presence write path is unreachable in production

**Where** — [`3-capabilities/activity/`](../../apps/backend/src/3-capabilities/activity) —
`presence.heartbeat`, `presence.leave`, `presence.removeExpired`; the HTTP door is
[`4-job-wiring/activity/registerActivityEndpoints.ts:149-167`](../../apps/backend/src/4-job-wiring/activity/registerActivityEndpoints.ts).

**What happens** — all three methods have **zero** non-test callers. The only HTTP route that
could reach them, `POST /activity/command`, returns 501 unconditionally (a deliberate refusal —
see Part 5). Consequences:

- The `<prefix>_presence` table is created and never written in production.
- Nothing in `startBackend.ts` arms a Presence expiry timer, and Activity is **not** a retention
  port. If a trusted transport is ever added, the cleanup sweep must be scheduled in the same
  change, because there is nowhere it currently lives.

**Why it is a known issue rather than a deliberate decision** — the 501 is deliberate; the
*unscheduled cleanup* is not. No doc anywhere says the Presence subsystem is unreachable, and no
doc records that `removeExpired` has no scheduler.

**Fix size** — none needed today. Whoever adds the transport must add the sweep.

**Verified by** — `capability-activity-persona.md` §A14 item 1.

---

### KI-44 — Nine of Intelligence's eighteen routes are unreachable

**Where** — [`0-platform/intelligence/`](../../apps/backend/src/0-platform/intelligence) (5 files,
914 lines) and the `intelligence.routes` block in
[`etc/configuration.yaml`](../../apps/backend/etc/configuration.yaml).

**What happens** — `Intelligence.infer`, `inferStructured`, `reason` and `reasonWithTools` have
**no production caller**. The only paths with real consumers are `embed` (via `IntelligenceEmbedder`
into Knowledge) and the tool-loop reasoning used by Derived Outputs. The configuration file
declares nine `general` strength × speed routes for inference and nine for reasoning; the
inference nine are loaded, validated, and never selected. `OpenRouterProvider.infer` is
transitively unreached.

The module has **no test file**. The only test touching it is one negative assertion in
`runtime-wiring.test.ts` (*"provider HTTP failures do not leak response bodies into diagnostics"*).

**Fix size** — none as a repair. This is inventory, and it matters because a reader of
`configuration.yaml` reasonably assumes the routes are live.

**Verified by** — `platform-knowledge-intelligence.md` §3.13; reconciliation §3.2.

---

### KI-45 — Knowledge's level-index feature is entirely dead

**Where** — port [`0-platform/knowledge/store.ts:41-43`](../../apps/backend/src/0-platform/knowledge/store.ts),
implementation `knowledge-store.ts:289-311`, builder `lattice/knn.ts:198`.

**What happens** — `getLevelIndex`, `putLevelIndex` and `deleteLevelIndex` are declared and
implemented; `buildLevelIndex` exists. None is ever called by `Knowledge`. The
`kn_<p>_level_indices` table is created on every boot and is **never written and never read**.
`KNNConfig.repairMaxDrift` is never read either, including inside the repair helper it names.

The database platform's own docs get half of this right and half wrong:
`0-platform/database/docs/concepts.md:39` says level indices are *"currently persisted but not
used"* — they are not persisted either.

**Fix size** — one deletion (three port methods, one table, one builder) or one implementation.
Either is defensible; leaving an empty table on every deployment is the option that misleads.

**Verified by** — `platform-knowledge-intelligence.md` §2.18; reconciliation §5.11.

---

### KI-46 — `StreamWindower` and `repairCorpus` are imported and never called

**Where** — [`0-platform/knowledge/windowing/stream.ts`](../../apps/backend/src/0-platform/knowledge/windowing/stream.ts)
(178 lines) and [`lattice/repair.ts`](../../apps/backend/src/0-platform/knowledge/lattice/repair.ts)
(100 lines); both imported at `knowledge.ts:26` and `:36`.

**What happens** — stream ingestion buffers the whole source instead. `repairCorpus` is never
invoked, so every source change triggers a **full** corpus rebuild. `repair.ts` is dead code that
contains its own dead code — `:80` reads
`const srcWindows = await store.getWindows([]); void srcWindows;` with the comment
`// can't list by source; handled below`, which calls a store method with an empty array purely to
discard the result. Its `RepairResult.rebuilt` flag is also inverted relative to intuition:
`rebuilt: false` means "local repair was not viable, caller must do a full rebuild".

Two comments in that file read as unfinished-work markers, verbatim (`repair.ts:64-66`):

```
  // We can't distinguish per-source entries in the frontier without re-querying all sources,
  // so we always rebuild the frontier from scratch below.
  void existingFrontier;
```

**Fix size** — deletion, or completion. Both files are self-contained.

**Verified by** — `platform-knowledge-intelligence.md` §2.18; module `invariants.md:50-62`.

---

### KI-47 — Structured Data's `contextEntries` is write-never, so `DataQuery.scope` can never match

**Where** — [`3-capabilities/structured-data/structured-data.ts:209,234`](../../apps/backend/src/3-capabilities/structured-data/structured-data.ts)
and `:168-173`.

**What happens** — `declare` hard-codes `contextEntries: []` at both construction sites and
nothing ever mutates the field. The scope filter at `:171`
(`e.contextEntries.some((ce) => scopeKeys.has(...))`) therefore matches nothing, ever. A caller
supplying `DataQuery.scope` gets an empty result and no diagnostic. The whole feature is dead
while remaining fully typed and queryable.

**Fix size** — either populate the field on declare/update, or remove `scope` from `DataQuery` so
callers stop asking a question the store cannot answer.

**Verified by** — `capability-structured-derived.md` PART E item 1; source read at HEAD.

---

### KI-48 — `ConnectorAlreadyExistsError` is never thrown

**Where** — defined `connector/domain/errors.ts:10`, exported `connector/index.ts:24`, mapped to
409 at [`4-job-wiring/connector/registerConnectorEndpointMappings.ts:21-24`](../../apps/backend/src/4-job-wiring/connector/registerConnectorEndpointMappings.ts).

**What happens** — `register` returns `{status: "already_exists"}` with **HTTP 200** instead of
throwing. The 409 branch is unreachable in practice, so a client that codes against the documented
409 never sees it. The capability's own docs self-report this.

**Fix size** — one line, and it requires a decision about which contract is right. Do not "fix" it
by deleting the error class without checking whether the 200-with-status shape is intentional (it
reads as though it is).

**Verified by** — `capability-connector-files-context.md` §9.2.

---

### KI-49 — `ConnectorSyncScheduler.register` / `.unregister` are dead

**Where** — [`1-init/create/connectorSyncScheduler.ts:23-34`](../../apps/backend/src/1-init/create/connectorSyncScheduler.ts).

**What happens** — both mutate the in-memory entry map and log
(`connector.sync.scheduler.registered` / `.unregistered`). Neither is called from anywhere.
`startBackend.ts` calls only `start()` (`:214`) and `stop()` (`:222`), and `refreshEntries()`
overwrites the map from the store on **every tick** — so even an external `register()` call would
be erased within one interval.

**Fix size** — deletion (two methods, two log messages).

**Verified by** — `layers-and-composition.md` §11.4; `jobs-queues-and-utils.md` §11 item 7;
`capability-connector-files-context.md` §9.4.

---

### KI-50 — The internal endpoint-mapping fan-out is vestigial, and two comments describe it as real

**Where** — [`4-job-wiring/internal/registerEndpointMappings.ts:9-10`](../../apps/backend/src/4-job-wiring/internal/registerEndpointMappings.ts)
and [`1-init/create/registry.ts:6`](../../apps/backend/src/1-init/create/registry.ts).

**What happens** — the file's own comment says:

```ts
// Keep initialization stable: it calls this one function while this file
// fans out to each endpoint-registration group added under job wiring.
```

and `createRegistry`'s says *"Build one process-wide endpoint registry, then load every job-wiring
group."* Neither is true. `registerEndpointMappings` calls **exactly one** thing —
`registerBuiltInEndpointMappings(registry, scheduler)`. All 11 capability endpoint groups are
registered directly from `startBackend.ts:176-186`, bypassing the fan-out point entirely.

This is a code-vs-comment contradiction inside the module, not documentation drift.
`3-capabilities/built-in/docs/runtime.md:8-10` is the only page in the tree that describes the real
arrangement.

**Fix size** — one line (update both comments) or small (actually move the 11 registrations behind
the fan-out, which would also shrink `startBackend.ts`).

**Verified by** — `layers-and-composition.md` §11.1; reconciliation §6.10.

---

### KI-51 — There is no Document content reader

**Where** — [`1-init/create/resource-reader.ts:163-234`](../../apps/backend/src/1-init/create/resource-reader.ts).

**What happens** — `read` has branches for findings, general files and connector items. There is
no branch for `kind === "document"`, so `read` on a document-kinded resource always returns
`null`. Lattice *retrieval* over documents still works (Document content reaches Knowledge through
its own indexing path), but the `read` tool that the Derived Outputs loop uses cannot open a
Document — the most content-rich resource in the system. Combined with KI-36, the refusal is also
unlogged.

**Fix size** — small: a `document` branch that projects the snapshot to text. It needs a decision
about what "lines" mean for a block-structured document.

**Verified by** — `capability-structured-derived.md` PART E item 26; source read at HEAD.

---

### KI-52 — Two empty, untracked job-wiring directories

**Where** — `src/4-job-wiring/formula/` and `src/4-job-wiring/name-manager/`.

**What happens** — both contain zero files. Git does not track empty directories, so **they will
not exist in a fresh clone** — but anyone reading a local directory listing concludes there is
Formula job wiring (there is none; Formula is a `0-platform` service with no endpoints) and a
"name-manager" capability (nothing of that name exists anywhere in the tree).

**Fix size** — `rmdir`.

**Verified by** — `tests-config-and-status.md` §7.2; `jobs-queues-and-utils.md` §11 item 5;
`platform-formula-richtext.md` §5 item 19.

---

### KI-53 — `#capabilities/*` reaches only `built-in/`, and nine wildcard aliases have no usages

**Where** — [`apps/backend/package.json`](../../apps/backend/package.json) `imports` and
[`apps/backend/tsconfig.json`](../../apps/backend/tsconfig.json) `paths` (32 entries each,
verified identical).

**What happens** — `#capabilities/*`, the layer alias for the largest layer in the codebase
(32,246 lines), is used by exactly four import statements, all pointing at
`3-capabilities/built-in/`. Every other capability is reached through its own bare alias. Nine
wildcard module aliases have **zero** usages: `#derived-outputs/*`, `#activity/*`, `#persona/*`,
`#comments/*`, `#templates/*`, `#document/*`, `#general-files/*`, `#connector/*`,
`#investigation/*`. Five of them are nevertheless asserted to exist by tests, so they cannot be
removed without also editing tests.

Nothing is broken. The alias just does not mean what its name suggests, and a reader trying to
learn the import conventions from the alias table will infer the wrong ones.

**Fix size** — deletion of the nine unused wildcards plus the test edits, or nothing.

**Verified by** — `layers-and-composition.md` §11.5-11.6.

---

### KI-54 — Formula's `BuiltinFunction` construction path is never taken

**Where** — [`0-platform/formula/builtins.ts`](../../apps/backend/src/0-platform/formula/builtins.ts)
and `evaluator.ts:306-308, 370-373`.

**What happens** — `BuiltinFunction` **values** are never constructed in production code. That
makes three code paths unreachable: `applyFunction`'s builtin branch (`evaluator.ts:370-373`),
`fnEqual`'s builtin branch (`:306-308`), and `callBuiltin`'s `case "IF"` (`builtins.ts:88-94`).
`BuiltinCallContext.evalArg` — commented *"Lazy evaluation callback for IF branches"* — is supplied
at both call sites and never invoked inside `callBuiltin`. `BUILTIN_IMPLEMENTATION_VERSION` is
imported at `evaluator.ts:24` and unused.

The binder reserves built-in names in every position, so a bare `SUM` is `unknown_identifier` —
which is what keeps the value path unreachable.

**Fix size** — deletion of the unreachable branches, or a test that reaches them.

**Verified by** — `platform-formula-richtext.md` §5 items 7-9.

---

### KI-55 — The dead-export register

Exported (or implemented) and used by nothing in `src/`. Collected once so readers stop
rediscovering it. Symbols reached only from test files are marked **(tests only)** — they are not
dead, but they have no production caller.

| Module | Symbol | Note |
| --- | --- | --- |
| `0-utils/persistence/likePattern.ts` | `LIKE_ESCAPE_CHARACTER` | every call site hard-codes `ESCAPE '\'` |
| `0-utils/jobs/registry.ts:55` | type re-export of `Job`, `JobFactory`, `JobExecutionResult`, `QueueType` | no importer uses it |
| `0-utils/jobs`, `0-utils/persistence` | `ResponseMode`, `JobAdmissionReceipt`, `JobSchedulerLogger`, `InternalJobIntent`, `ResourceHistoryRecordType`, `ResourceRetentionClock`, `ResourceRetentionTarget`, `ResourceRetentionSweepResult` | type-level only, no consumer outside `0-utils` |
| `0-utils/jobs` | `toIdPrefix` duplicated verbatim in `registry.ts:50-52` and `internalRuntime.ts:58-59` | two copies |
| `0-platform/observability` | `FileLogger.directory`, `FileLogger.level` | parameter properties, never read (`this.minLevel` is derived from the *parameter*) |
| `0-platform/observability` | `LogOptions`, `LogDetail` | exported; every call site uses an inline object literal instead |
| `0-platform/formula` | `mergeLimit`, `unknownFunction`, `explain`, `fromWire`, `toDecimalString`, `EMPTY_TABLE`, `TRUE_VALUE`, `FALSE_VALUE`, `ProjectScope` | `explain` is on the public interface and has no caller anywhere |
| `0-platform/formula` | `FormulaDiagnostic.path`; codes `invalid_resolver_snapshot`, `cycle_error`; `ObservedDependency.access` variants `field`/`index`/`slice`/`set-operation` | declared, never populated or emitted |
| `0-platform/formula/parser.ts` | `mkNode`'s `start` parameter; `isSliceToken`/`afterSliceStart` (`:490-494`); the `op` locals at `:141,152` | written, never read |
| `0-platform/rich-text` | `createRichTextIdFactory`, `mergeStyleProperties`, `maxMarkRangeSpan`, `RichTextDiagnostic.position`/`.range`, `DEFAULT_LIMITS`/`DEFAULT_CONFIG` | `DEFAULT_*` are used by tests only |
| `0-platform/knowledge` | `index.ts` and `lattice/index.ts` barrels | imported by nothing |
| `0-platform/knowledge` | `StreamWindower`, `repairCorpus`, `buildLevelIndex`, `getLevelIndex`/`putLevelIndex`/`deleteLevelIndex`, `KnowledgeRetrievalOptions.topK`, `KnowledgeOptions.defaultTopK`, `KNNConfig.repairMaxDrift`, `searchTool()`, `listSources()`, `close()` | see KI-45, KI-46 |
| `0-platform/knowledge/lattice/cluster.ts` | imports `cosineSim`, `normalize`, `projectVector`; local `inClique` | imported/written, never referenced |
| `0-platform/intelligence` | `infer`, `inferStructured`, `reason`, `reasonWithTools`, `ToolExecutionResponse`, import `ToolCall`, `.gitkeep` | see KI-44 |
| `document` | `invertOperations` (`domain/inverses.ts`, on the barrel), `decodeRichContent`, `decodeContextEntries` | Slides has its own copy of the first |
| `document` | `createAttempt`, `getIdentity`, `getPromptOutputOwnership` (by-output), `getCommittedTransaction`, `getCommittedTransactionByChangeSet`, `listDetachedPromptOutputs` | **(tests only)** — all on the `DocumentStore` port |
| `document` | `SQLiteDocumentStore.close()` | not on the port; see KI-30 |
| `comments` | `canonicalizeJsonObject` (`domain/canonical.ts:15`), `normalizeSubTarget` (barrel export) | the first has no reference anywhere, not even the barrel |
| `comments` | `SQLiteCommentStore.close()` | **(tests only)**; not on the port |
| `comments` | `CommentQueryResult.comment?` | unreachable-optional: the service throws `CommentNotFoundError` first |
| `connector` | `updateSyncTimestamp`, `ConnectorAlreadyExistsError`, `SyncConnectorJobDefinition`, `ConnectorReader.readStream`, `ConnectorStore.history` **(tests only)**, unused import `ConnectorSyncConfig` (`ports/repository.ts:4`), unused local `entry` (`registerConnectorEndpointMappings.ts:126`), `ConnectorHistorySnapshot` **not exported** from `index.ts` despite appearing in the exported `ConnectorStore` signature | see KI-48, KI-49 |
| `general-files` | `GeneralFilesListRequest`, `GeneralFileStore.history` **(tests only)** | |
| `context` | `ContextStore.history` **(tests only)**; `ContextWriteOptions` not exported despite appearing in two public signatures | |
| `structured-data` | `validateDataKind`, `normalizeDisplayNameKey`, `DataStore.history` **(tests only)**, `DataBindingView.id`/`.viewRevision`/`.createdAt`, the `409 unresolved` branch (`registerStructuredDataEndpoints.ts:300,352`) | the 409 is a defensive dead branch |
| `derived-outputs` | `DerivedOutputChangeOperation` (7-variant union, zero consumers), `DerivedOutputStore.getHeadRevision`, `DerivedOutputConflictError` (exported and HTTP-mapped, never thrown), `DerivedByteSpan`, `DerivedOutputStore.close()` | |
| `persona` | `normalizeDisplayNameKey`, `PersonaRecord.contextWrapperRevision` (written and read, compared by nothing) | `resolve()` and `render()` have no production consumer |
| `activity` | `SQLiteActivityStore.close()` **(tests only)**; the `id` tiebreaker in `ORDER BY sequence DESC, id ASC` | `sequence` is `UNIQUE`, so the tiebreaker can never fire |
| `slides` | `detachedFrameFor` (imported by the reducer, never used), `applyWithoutValidation`, `siteAsRichContentTarget`, `framesIntersect`, `isFrameWithinCanvas`, `translateFrame`, `locateElement`, `forEachElement`, `compactSiblings`, `groupDepth`, `containerRootElements`, `DeckSnapshot.revision`, and 7 of its 14 error classes | the whole module is unreachable (KI-42) |

`noUnusedLocals` and `noUnusedParameters` are **not** enabled in `tsconfig.base.json`, which is why
several of these compile clean.

**Verified by** — reconciliation §6.10 (the consolidated list), cross-checked against each
surveyor's own `incompleteOrDead` section.

---

### KI-82 — Derived Outputs' three idempotency-claim tables are unreachable over HTTP

**Where** — [`3-capabilities/derived-outputs/`](../../apps/backend/src/3-capabilities/derived-outputs)
— the `_declarations`, `_refresh_claims` and `_definition_update_claims` tables (three of the
capability's nine), against
[`4-job-wiring/derived-outputs/registerDerivedOutputEndpoints.ts`](../../apps/backend/src/4-job-wiring/derived-outputs/registerDerivedOutputEndpoints.ts).

**What happens** — the service accepts an idempotency key on `declare`, on the definition update
and on `refresh`, and claims it in a dedicated table so a retry returns the first result instead of
doing the work twice. **No HTTP endpoint decodes or forwards one.** The three tables are therefore
written only by Document's in-process calls. A purely HTTP-driven caller — the only kind an
external integrator can be — gets no replay safety at all: a retried `POST /derived-outputs` after
a timeout declares a second output, and a retried `POST /derived-output-refresh` runs a second
model call and bills for it.

This is also why KI-76's two unmapped errors cannot currently be produced through the transport.

**What was intended** — the module's own `docs/types.md:82` says so plainly: *"Current HTTP
mappings do not accept/forward idempotency options."* Accurate, and it reads as a gap rather than a
decision.

**Fix size** — small: one optional field per request decoder, threaded to the existing service
options. The tables and the claim logic already exist and are tested.

**Verified by** — `capability-structured-derived.md` PART E item 18; module `docs/types.md:82`.

---

### KI-83 — `REVISIONED_RESOURCE_KINDS` names `deck` and `slide`, which nothing can produce

**Where** — [`3-capabilities/investigation/application/investigationRuntime.ts:37-49`](../../apps/backend/src/3-capabilities/investigation/application/investigationRuntime.ts),
enforced at `:160`.

**What happens** — the set is the list of resource kinds for which a Finding reference **must**
supply a `resourceRevision`. It contains eleven kinds, two of which no live capability can create:

```ts
const REVISIONED_RESOURCE_KINDS = new Set([
  "collection", "connector-item", "context", "deck", "derived-output",
  "document", "function", "general-file", "slide", "structured-data", "variable"
]);
```

`deck` and `slide` belong to Slides, which is unreachable (KI-42) and creates no rows. A caller who
proposes a Finding against `resourceKind: "deck"` is required to supply a revision for a resource
that cannot exist — the validation fires correctly and the referent never does. `collection`,
`function` and `variable` have no producing capability either, but they at least have no
counterpart directory pending.

**Why it matters** — it is the only place in the running backend where Slides' vocabulary is
enforced, and a reader encountering it reasonably concludes Slides is live. It is either a forward
declaration or a leftover, and nothing in source or docs says which. Whoever wires Slides must
check that the two entries mean what they say.

**Fix size** — one line either way; the decision is the work.

**Verified by** — reconciliation §6.1 and open question 8; source read at HEAD.

---

## Part 4 · Hygiene, process, and performance

---

### KI-56 — The test tree is never typechecked, and two drifts are already in it

**Where** — [`apps/backend/tsconfig.json`](../../apps/backend/tsconfig.json), last line:
`"include": ["src/**/*.ts"]`.

**What happens** — `pnpm typecheck` runs `tsc --noEmit -p tsconfig.json`, whose `include` is
exactly `src/**/*.ts`. `test/` — 28 files, 16,502 lines — is outside the project. `tsx` strips
types at run time, so the suite is green regardless of what `tsc` would say. Two drifts are
already present:

| File | Drift | Consequence |
| --- | --- | --- |
| `test/helpers/testDoubles.ts:11-28` | `CapturingLogger` implements the stale **two-parameter** `Logger`; the real interface gained `options?: LogOptions` in this commit | silently discards every `detail` label (KI-29) |
| `test/capabilities/templates-wiring.test.ts:23-34` | `createTemplatesDouble` is annotated `: TemplateCapability` and omits `collectOrphanedResources` | `tsc` reports **TS2741** if pointed at the file; the suite passes |

The second is the more instructive: the missing method is the orphan sweep added in `eebc1d6`, one
of the most consequential additions to Templates. A typechecked test tree would have flagged the
double the day the method landed.

**What was intended** — the repository's own archived status page already calls this out:
[phase-1/claude-notes/09-verified-status.md:70-71](../phase-1/claude-notes/09-verified-status.md)
says *"Add `pnpm typecheck` to whatever gate runs `pnpm test`"* and marks it **still open**. It is
still open, and there is no gate to add it to (KI-57).

**Fix size** — small: a second `tsconfig.test.json` extending the base with
`"include": ["src/**/*.ts", "test/**/*.ts"]` and a `typecheck:test` script. Both drifts above must
be fixed at the same time or the new script fails on arrival.

**Verified by** — reconciliation §G16 and open question 6; source read at HEAD (both drifts
confirmed).

---

### KI-57 — There is no CI configuration anywhere

**Where** — the repository root. There is no `.github/`, no pipeline file of any kind.

**What happens** — nothing enforces `pnpm test`, nothing enforces `pnpm typecheck`, nothing
enforces that `dist/` is rebuilt. "444/444 pass and typecheck is clean" is a measurement someone
took by hand on 2026-08-09, not a property of the branch.

Every "why it survived" entry on this page is downstream of this one to some degree.

**Fix size** — small to set up, and it should land together with KI-56 so the gate covers the test
tree from the start.

**Verified by** — reconciliation §G15; `tests-config-and-status.md`; confirmed at HEAD
(`ls -a` at the root shows no `.github`).

---

### KI-58 — `.gitignore` reserves `.env.example`; no such file exists

**Where** — [`.gitignore`](../../.gitignore) line 6: `!.env.example`.

**What happens** — the negation exists specifically so a committed example file survives the
`.env.*` ignore rule. There is no `.env.example`. `OPENROUTER_API_KEY` is the single environment
variable the backend reads for configuration, and nothing tells a new contributor that it exists,
what it is for, or the one rule that governs it: **it wins only over the literal placeholder
`"replace-with-openrouter-api-key"`**. A real key written into `configuration.yaml` cannot be
overridden from the environment.

The root `README.md` is otherwise accurate — structure list, `nix develop` instructions, and all
five `pnpm` commands verified correct — and mentions neither the variable nor `.env`.

**Fix size** — one file.

**Verified by** — reconciliation §G15 and §6.4; confirmed at HEAD.

---

### KI-59 — No CORS plugin, and the frontend fetches cross-origin

**Where** — the backend registers a catch-all `app.all("/*")` and no CORS plugin anywhere;
`apps/frontend/vite.config.ts` sets only `server.port: 3000` and configures no proxy.

**What happens** — `apps/frontend/src/main.ts` (24 lines, the entire application) fetches
`http://localhost:4000/health` from an origin on `:3000`. That is a cross-origin request against a
server that sends no `Access-Control-Allow-Origin`. Nothing in the repository tests this path, and
no doc mentions it.

**Fix size** — small: `@fastify/cors` with an allowlist, or a Vite proxy. The choice is an
architectural one (does the backend admit browser origins at all?) and should be made
deliberately.

**Verified by** — reconciliation §G15; `tests-config-and-status.md` §7.5; confirmed at HEAD
(`grep -rn cors apps/backend/src apps/backend/package.json` → no matches).

---

### KI-60 — `dist/` is stale and `pnpm start` runs it

**Where** — `apps/backend/package.json`: `"start": "node dist/index.js"` — no `--conditions`.

**What happens** — the alias map is a three-way conditional in declaration order
`development` → `types` → `default`. Plain `node` takes `default`, which is `./dist/**`. In this
checkout `dist/index.js` is dated 2026-08-02 with **63 source files newer than it**, and
`dist/3-capabilities` contains no `slides`. `pnpm start` therefore runs week-old code, silently.
`dist/` is gitignored, so this is a local hazard rather than a shipped one.

**What was intended** — `runtime-wiring.test.ts:33` (*"the backend dev command selects TypeScript
source imports instead of stale dist files"*) exists precisely because this failure mode is easy
to hit. Note it guards **only** the `dev` script, not `start` and not `test`.

**Fix size** — one line: make `start` depend on `build`, or fail loudly when `dist/` is older than
`src/`.

**Verified by** — reconciliation §6.6; `tests-config-and-status.md` §7.4.

---

### KI-61 — `--test-concurrency=1`'s documented rationale is false, and it costs 3.4× wall clock

**Where** — `apps/backend/package.json`:
`"test": "tsx --conditions=development --test --test-concurrency=1 test/capabilities/*.test.ts"`.

**What happens** — the flag is justified in
[phase-1/claude-notes/00-orientation.md:75-77](../phase-1/claude-notes/00-orientation.md) and
[phase-1/claude-notes/08-conventions.md:144](../phase-1/claude-notes/08-conventions.md) by "shared
SQLite files under `data/`". **No test opens anything under `data/`.** `grep -rn '/data/' test/`
returns nothing; 15 test files use `mkdtempSync` under `os.tmpdir()` and
`resource-retention.test.ts:26` uses `Database(":memory:")`. The suite was run eight times without
the flag (default concurrency and `--test-concurrency=16`), 444 pass / 0 fail every time, at
≈1.5 s versus ≈5.1 s with the flag.

**What was intended** — isolation. A *defensible replacement* rationale exists — determinism for
the several tests that use real timers and assert on `durationMs` — but that is a different claim
and it is unverified. Do not restate it as fact.

**Fix size** — one flag, and one measurement to decide.

**Verified by** — reconciliation §C4 and §C11; `tests-config-and-status.md`.

---

### KI-62 — `retentionScheduler.start()` is not covered by the ordering assertion

**Where** — [`test/capabilities/runtime-wiring.test.ts:212-222`](../../apps/backend/test/capabilities/runtime-wiring.test.ts).

**What happens** — the ordering regression test reads `startBackend.ts` as text and asserts one
thing:

```ts
const listenAt = source.indexOf("await app.listen");
const schedulerAt = source.indexOf("syncScheduler.start()");
assert.ok(schedulerAt > listenAt, "sync timers can survive a failed listener bind");
```

`retentionScheduler.start()` sits on the line immediately above `syncScheduler.start()`
(`startBackend.ts:213-214`) and is covered by no assertion. Moving it above `app.listen` — which
would recreate exactly the failure the test exists to prevent, since the retention timer would
then keep a failed startup process alive — would fail nothing.

The comment the test is protecting is at `startBackend.ts:210-212`: *"Start recurring work only
after the transport has bound successfully. Otherwise a listen failure would leave interval timers
keeping the failed startup process alive."*

**Fix size** — three lines in the test.

**Verified by** — reconciliation §6.7; source read at HEAD.

---

### KI-63 — Five areas have no test file

**Where** — `test/capabilities/` (26 `*.test.ts` files, 444 tests).

**What happens** — the following have **no direct test file at all**:

| Area | Size | Status |
| --- | --- | --- |
| `0-platform/knowledge` | 15 files, 2,118 lines | **wired and load-bearing** — injected into four capabilities |
| `0-platform/intelligence` | 5 files, 914 lines | wired; one negative test in `runtime-wiring.test.ts` |
| `0-platform/database` | 1 file, 389 lines | the Knowledge SQLite adapter |
| `3-capabilities/built-in` | 4 files, 47 lines | covered indirectly by `internal-jobs`, `runtime-wiring`, smoke |
| the transport's **429** mapping | — | `grep -rn 429 test/` returns nothing. `QueueCapacityError` itself is exercised (`internal-jobs.test.ts:120`, `document-application.test.ts:106`), but no test drives it through `registerHttpTransport.ts:96-111` to assert the status code |

Knowledge is the serious one: 2,118 lines, four consumers, ten self-reported defects (KI-15,
KI-16, KI-21, KI-45, KI-46 among them), and zero direct coverage. The archived status page already
said so ([phase-1/claude-notes/09-verified-status.md:143-144](../phase-1/claude-notes/09-verified-status.md),
*"Knowledge behaviour is only exercised indirectly"*) and it is still true.

**Fix size** — structural (a `knowledge.test.ts` worth having is not small), but the 429 path is a
single test.

**Verified by** — `platform-knowledge-intelligence.md` §4; `tests-config-and-status.md` §2.10 and
§7.7.

---

### KI-64 — `loadBackendConfig` is essentially untested

**Where** — `0-utils/config/loadBackendConfig.ts` (the largest file in `0-utils`).

**What happens** — there is no config test file. The only coverage is one incidental assertion
inside the Templates suite (`templates.test.ts:2164`, which pins that unknown sections are
ignored). Every sharp edge in KI-25, KI-37, KI-38 and KI-39 lives in this file, and each of them
would be a three-line test.

**Fix size** — small, and unusually high value per line.

**Verified by** — `jobs-queues-and-utils.md` §11 item 12.

---

### KI-65 — Two services identify errors by `error.name`

**Where** — [`documentService.ts:976`](../../apps/backend/src/3-capabilities/document/application/documentService.ts)
and [`personaService.ts:441,466`](../../apps/backend/src/3-capabilities/persona/application/personaService.ts).

**What happens** — both match `error.name === "ContextNotFoundError"` /
`"ResourceHistoryNotFoundError"` rather than `instanceof`, deliberately, to avoid importing
another capability's error classes across the layer-3 boundary. The cost is that **renaming either
class silently breaks the tolerate-on-retry paths** — no compiler error, no test failure, just a
retry that stops tolerating.

**What was intended** — the layer rule. Every cross-capability import inside layer 3 is
`import type`, and these two sites are what that discipline costs.

**Fix size** — small: export a `const NAME` from the error module and import the type-erased
constant, or add a test that asserts the two string literals match the classes' `name` fields.

**Verified by** — reconciliation §G4; `capability-activity-persona.md` §B17 item 5.

---

### KI-66 — Quadratic scans in Document's read paths

**Where** — [`documentService.ts:350-365`](../../apps/backend/src/3-capabilities/document/application/documentService.ts)
and [`persistence/sqliteDocumentStore.ts:1054-1064`](../../apps/backend/src/3-capabilities/document/persistence/sqliteDocumentStore.ts).

**What happens** — two separate inefficiencies on the `document.load` path:

1. `documentService.ts:350-365` iterates `refs.values()` and, for each output id, re-scans
   `[...refs.entries()]` to find the block that owns it. It is correct only because validation
   forbids two live blocks sharing one output — and if the map ever did contain a duplicate, the
   same revision would be pushed twice. A direct iteration over `refs.entries()` is equivalent and
   linear.
2. `getHistoricalHead` calls `getResourceHistory(...)`, which `SELECT *`s **every** history row for
   the resource, then `.find`s the target revision in memory. There is no revision-scoped query.

Neither is a correctness defect today. Both scale with document age.

**Fix size** — one line for (1); small for (2) — one extra prepared statement.

**Verified by** — `capability-document.md` §19 items 8-9.

---

### KI-67 — O(n²) digesting in the Formula name resolver

**Where** — [`1-init/create/formula-name-resolver.ts:264,317`](../../apps/backend/src/1-init/create/formula-name-resolver.ts).

**What happens** — `makeSnapshotFromBindings` — which performs a full `digestSnapshot` sha256 and
a `randomUUID()` — is called once per entry per pass. Nothing caps it. `digestSnapshot` also
re-normalises an already-normalised key at `:46` (harmless redundancy).

**Fix size** — small: hoist the snapshot construction out of the loop.

**Verified by** — `capability-structured-derived.md` PART E items 30-31.

---

### KI-68 — A latent internal-job ID collision

**Where** — [`0-utils/jobs/internalRuntime.ts`](../../apps/backend/src/0-utils/jobs/internalRuntime.ts).

**What happens** — `SchedulerInternalJobsRuntime` derives job IDs from the intent type. Today
Document is the only capability with an internal-jobs runtime (7 intents, all Document). If a
second capability gets its own runtime and registers an identically-named intent type, the two
would collide. Nothing prevents it and nothing would report it.

**Fix size** — one line: prefix the id with the runtime's owner.

**Verified by** — `jobs-queues-and-utils.md` §7.2 and §11 item 13.

---

### KI-69 — `ConnectorItem.byteSize` documents `-1`; the table forbids it

**Where** — [`connector/domain/provider.ts:10-11`](../../apps/backend/src/3-capabilities/connector/domain/provider.ts)
versus `persistence/sqliteConnectorRepository.ts:75-76` (`CHECK (byte_size >= 0)`).

**What happens** — the provider contract documents `-1` for "unknown size". The item table rejects
it. The filesystem provider always supplies `st.size`, so the conflict is latent — a future
provider that honours the documented contract fails the insert with a constraint error mapped to
500. The capability's own `docs/types.md:67` flags it.

**Fix size** — one line: either drop the `CHECK`'s lower bound or change the contract to `null`.

**Verified by** — `capability-connector-files-context.md` §9.12.

---

### KI-70 — Structured Data duplicates Formula's reserved-name list

**Where** — [`structured-data/validation.ts:11-16`](../../apps/backend/src/3-capabilities/structured-data/validation.ts)
versus [`0-platform/formula/builtins.ts:23-27`](../../apps/backend/src/0-platform/formula/builtins.ts).

**What happens** — the two lists agree today. Nothing keeps them in sync. If Formula gains a
built-in, Structured Data will accept an entry name that Formula's binder then reserves, and the
entry becomes unreferenceable — a silent, delayed failure.

**Note the contrast with a *deliberate* duplication.** The prose-text extension lists in Connector
and General Files are also duplicated, but each carries a comment saying the divergence is
intentional (see Part 5). This one carries no such comment, and Structured Data legitimately
imports from `#formula` already (`isBuiltinName` is on the public barrel).

**Fix size** — one line: import `isBuiltinName`.

**Verified by** — `capability-structured-derived.md` PART E item 9.

---

### KI-71 — General Files and Connector split lines differently behind the same tool

**Where** — General Files' reader splits on `/\r?\n/u`; the Connector reader splits on **LF only**.

**What happens** — the Derived Outputs `read` tool addresses both resource families with the same
line-range arguments. A CRLF file uploaded through General Files and the same file read through a
filesystem connector produce **different line numbering** — the Connector version leaves a
trailing `\r` on every line and counts the same. A citation taken from one is not valid against
the other.

`general-files/docs/concepts.md:104-105` describes the CRLF/LF behaviour and presents it as the
rule for both.

**Fix size** — one line, in whichever reader is chosen as canonical.

**Verified by** — reconciliation §5.11 (general-files row);
`capability-connector-files-context.md`.

---

### KI-72 — The smoke runner carries a stale comment

**Where** — [`test/smoke/http-smoke.mjs:361-362`](../../apps/backend/test/smoke/http-smoke.mjs).

**What happens** — the comment says no Templates resource adapter is registered. One is —
`startBackend.ts:115-120`, `templateResources.register(document)`. The 400 the assertion expects
now comes from pointing at a document id that does not exist, which is a different reason for the
same status code. The test still passes for the wrong reason.

Also worth stating about the smoke runner generally: it is **not** part of `pnpm test`. `test:smoke`
is a separate plain-`node` script (no `tsx`, no `node:test`) that requires an already-listening
backend, makes 41 requests, asserts exact status codes, and **cleans up nothing**. Its own
`README.md:54-57` claims it "exercises these routes" for the four built-ins; it touches only
`/health` and a deliberate 404 — `/health/queues`, `/echo` and `/audit` have no smoke coverage.

**Fix size** — one comment, plus three requests if the built-in coverage matters.

**Verified by** — `tests-config-and-status.md` §7.9 and §2.9; reconciliation §5.11 (built-in row).

---

### KI-73 — `derived-outputs.ts` is 1,342 lines

**Where** — [`3-capabilities/derived-outputs/derived-outputs.ts`](../../apps/backend/src/3-capabilities/derived-outputs/derived-outputs.ts).

**What happens** — one file holds the ports (`46-69`), the inline prompts (`98-172`), the JSON
schemas (`174-278`), the helpers and validators (`280-574`), the service class (`576-1322`), four
tool builders (`1078-1321`) and the factory (`1324-1342`). It is the largest single non-store file
in the tree. It also carries an unfinished decision comment in `declare` (`:646-647`): *"or we run
it synchronously here. For now the endpoint will call refresh separately."*

The archived review already proposed a split
([phase-1/claude-notes/review/001-consistency-and-doc-drift.md:101-111](../phase-1/claude-notes/review/001-consistency-and-doc-drift.md)),
but **only its first line range (`46-69`, the ports) is still correct** — the file has moved since.
The ranges above are current at `ef6d462`.

**Fix size** — small, mechanical, and not urgent. Prompts and schemas are the obvious first
extraction.

**Verified by** — reconciliation §5.4 (review/001 row); `capability-structured-derived.md` PART E
item 25.

---

### KI-74 — Module docs link into `scratch/` and into paths that do not exist

**Where** — 18 of the 19 module `docs/` packages (every one except `built-in`), plus one `.ts`
comment.

**What happens** — three classes of bad link ship inside `src/`. Classes 2 and 3 together are
**every** reference from `src/` into the repository-root `docs/` tree — 19 markdown links plus two
bare path mentions, in 17 files. Not one of them resolves.

1. **Links into `scratch/`** — the owner's private design drafts, explicitly ahead of the code and
   carrying uncommitted edits. **27 references across 13 files, in 11 of the 12 capability
   `docs/` packages** (every one except `built-in`):
   `activity/docs/README.md:67`, `comments/docs/README.md:39`,
   `connector/docs/README.md:51-52`, `context/docs/README.md:49`,
   `derived-outputs/docs/README.md:54-57`, `document/docs/README.md:71`,
   `general-files/docs/README.md:56-57`, `investigation/docs/README.md:89-93` (five links),
   `persona/docs/README.md:33` (a prose path, not a link),
   `structured-data/docs/README.md:54-55` and `:57`,
   and Templates in three separate files — `templates/docs/README.md:22, 29, 31`,
   `templates/docs/flows.md:60`, `templates/docs/invariants.md:152, 166`. Documentation that
   ships should not cite drafts as authority.
2. **Links to `docs/capabilities/`, a directory that has not existed since 2026-08-01.** `7926df1`
   renamed it to `docs/capabilities-old/` and these were never updated, so they have been broken
   for the entire remainder of the project's committed history — they are **not** fallout from the
   phase-1 move. Six of them: `0-platform/web-retrieval/docs/README.md:25` and `:26`,
   `0-platform/rich-text/docs/README.md:9`, `3-capabilities/document/docs/README.md:69`,
   `3-capabilities/context/docs/README.md:50`, and — the one that is a code comment rather than a
   doc link — `0-platform/formula/parser.ts:2` (*"Implements the grammar from
   docs/capabilities/formula.md"*). The intended target is the archive now at
   `docs/phase-1/capabilities-old/`.
3. **Links to `docs/platform/`, broken by the phase-1 move itself.** These resolved until the
   root `docs/` tree was moved under `docs/phase-1/`; each now needs one extra `phase-1/` segment.
   Fourteen links in 13 files: `database/docs/README.md:7`, `formula/docs/README.md:55`,
   `intelligence/docs/README.md:7`, `knowledge/docs/README.md:7`,
   `observability/docs/README.md:7`, `web-retrieval/docs/README.md:7` and `:24`,
   `web-retrieval/docs/concepts.md:15`, `web-retrieval/docs/types.md:11`,
   `connector/docs/README.md:53`, `context/docs/README.md:51`,
   `derived-outputs/docs/README.md:58`, `general-files/docs/README.md:58`,
   `structured-data/docs/README.md:56`. One prose path is broken the same way and by the same
   move: `persona/docs/README.md:27` cites `docs/capabilities-old/persona.md`, now
   `docs/phase-1/capabilities-old/persona.md`.

Three further `.ts` comments name a bare `docs/invariants.md`
(`persona/application/personaService.ts:217` and `:372`,
`persona/ports/personaContext.ts:14`). These are **not** broken: read relative to the module they
sit in they mean `persona/docs/invariants.md`, which exists. They are ambiguous, not wrong.

**Fix size** — small, and it is a later pass's work: `src/**/docs/` is explicitly out of scope for
this rewrite. Class 3 is mechanical (insert `phase-1/`); class 2 needs both the rename and the
move applied.

**Verified by** — reconciliation §5.9 and §5.11; every capability surveyor independently; and a
repo-wide re-extraction of every `docs/` path reference outside `docs/` at publication time.

---

### KI-84 — Knowledge builds unbounded SQL `IN` lists

**Where** — [`0-platform/database/knowledge-store.ts:146-160`](../../apps/backend/src/0-platform/database/knowledge-store.ts)
(`getWindows`) and `:195-210` (`getNodes`).

**What happens** — both build one `?` placeholder per requested id with no chunking:

```ts
const placeholders = ids.map(() => "?").join(",");
const rows = this.db
  .prepare<string[], RawWindow>(`SELECT * FROM kn_${this.p}_windows WHERE id IN (${placeholders})`)
  .all(...ids);
```

SQLite bounds bound-parameter count per statement (`SQLITE_MAX_VARIABLE_NUMBER`; 32,766 on modern
builds, 999 on older ones). Both callers are corpus-wide: `rebuildCorpusTier` collects
`getSourceNodeIds` across **every** source and passes the whole array (KI-15 makes that array
larger than intended, since it promotes every node at every level rather than the top tier). A
sufficiently large corpus fails the whole rebuild with a driver-level error, on a path that has no
test file at all (KI-63).

**Fix size** — small: chunk both queries at a fixed batch size, as any general-purpose repository
does.

**Verified by** — `platform-observability-database-web.md` §2.8 item 5; source read at HEAD.

---

### KI-85 — Derived Outputs accepts an unvalidated, unbounded prompt

**Where** — [`3-capabilities/derived-outputs/derived-outputs.ts:596-650`](../../apps/backend/src/3-capabilities/derived-outputs/derived-outputs.ts)
(`declare`).

**What happens** — `declare` copies `request.prompt` into the definition without a single check.
An empty string is accepted and declared; there is no length bound, no non-blank check, and no
byte cap — even though the prompt is concatenated into every model call the output ever makes
(`:813`, `:925`) and `promptLength` is logged at `:642`, which shows the value was in hand.
Structured Data bounds its display names to 256 bytes and Templates bounds its descriptions; this
field is the one that reaches a paid provider and it is bounded by nothing.

Related, and in the same file: the synthesis prompt instructs the model to produce *"exactly one
sentence"* per contribution, and the code checks only that the returned text is non-blank. A
multi-paragraph contribution is accepted and persisted as evidence.

**Fix size** — one guard for the empty/oversized prompt; the one-sentence check is a decision about
whether the instruction is a requirement or a hint.

**Verified by** — `capability-structured-derived.md` PART E items 22 and 24; source read at HEAD.

---

### KI-86 — Structured Data has no pagination and reports `totalCount` as the page length

**Where** — [`3-capabilities/structured-data/structured-data.ts:183`](../../apps/backend/src/3-capabilities/structured-data/structured-data.ts).

**What happens** — `query` returns `{ entries, totalCount: entries.length }`. There is no `limit`,
no `offset`, no cursor, and no server-side cap anywhere in the capability; `totalCount` is a
restatement of the array length, not a count of matching rows. A client that reads it as "how many
matched" reads a tautology, and there is no protocol for retrieving a second page because there is
never a second page — every matching entry is materialised into one response.

`maxEntries` (KI-22) bounds how many entries may *exist*, which is what currently keeps the
response finite. That is a quota, not a page size, and it is not enforced atomically.

**Fix size** — small, and it is a wire contract change: add `limit`/`offset` and make `totalCount`
a real `COUNT(*)`. Comments and Activity already carry cursors; this is the outlier.

**Verified by** — `capability-structured-derived.md` PART E item 12; source read at HEAD.

---

### KI-87 — Persona and Templates have no configuration surface, and Comments' is unused

**Where** — `0-utils/config/loadBackendConfig.ts` (no `persona` and no `templates` section),
`templates/index.ts:29` (`TEMPLATE_WIRE_LIMITS`), `commentService.ts:72, 471`
(`options: Partial<CommentLimits>`).

**What happens** — nine capabilities' limits are configurable; three are not, in three different
ways:

| Capability | Limits live in | Reachable from config? |
| --- | --- | --- |
| Persona | `DEFAULT_PERSONA_LIMITS`, a module constant | **No** — `grep -n persona loadBackendConfig.ts` returns nothing |
| Templates | `TEMPLATE_WIRE_LIMITS`, a module constant with no injection point | **No** |
| Comments | `CommentLimits`, with a real `options: Partial<CommentLimits>` override | **No** — the hook exists and composition never passes anything |

Changing a Persona section byte cap or a Templates description cap is a source edit and a redeploy.
Comments is the sharper case: the seam was built, is on the constructor, and is dead — the kind of
thing that reads as configurable to anyone who greps the signature.

**Fix size** — small and mechanical per capability, following the nine that already do it. The
question worth answering first is whether these three limits *should* be operator-tunable at all;
if not, delete the Comments hook.

**Verified by** — `capability-activity-persona.md` §B17 item 10;
`capability-templates-comments.md` INCOMPLETE item 10; source read at HEAD.

---

### KI-88 — Activity's `publish` reads the row it is about to write

**Where** — [`3-capabilities/activity/application/activityService.ts:260-272`](../../apps/backend/src/3-capabilities/activity/application/activityService.ts).

**What happens** — every publish issues an extra `getTransaction(generatedId)` before writing:

```ts
const generatedId = activityTransactionId(idempotencyKey);
const existing = await store.getTransaction(generatedId);
const accepted: ActivityTransaction = { id: existing?.id ?? generatedId, ...fields };
```

`generatedId` is a pure function of the idempotency key, and the stored id is that same value, so
`existing?.id ?? generatedId` **can never differ from `generatedId`**. The read exists only to
populate the `replayed:` field of the success log. One extra `SELECT` per ledger append, on the
hottest write path in the system — Document, Comments and Templates all publish through it.

**Fix size** — one line, if the `replayed` log field can be derived from `store.publish`'s own
result (it already distinguishes an insert from a replay). Otherwise it is a deliberate trade and
should say so in a comment.

**Verified by** — `capability-activity-persona.md` §A14 item 5; source read at HEAD.

---

### KI-89 — Two more in-source comments describe code that no longer exists

**Where** — [`3-capabilities/structured-data/sqlite-store.ts:2`](../../apps/backend/src/3-capabilities/structured-data/sqlite-store.ts)
and [`1-init/create/connectorSyncScheduler.ts:1-3`](../../apps/backend/src/1-init/create/connectorSyncScheduler.ts).

**What happens** — two file headers assert arrangements that were removed and never revisited. They
are listed here because a reader who trusts a file header is being misled at the top of the file,
before any code:

| Comment | Reality |
| --- | --- |
| `sqlite-store.ts:2` — *"Two store instances are used per backend: one for user scope, one for project scope."* | **One** instance exists. It hashes `ownerId`, which is `config.projectId` at the single construction site. The user-scoped store was removed along with `data/structured-data-user.db` |
| `connectorSyncScheduler.ts:1-3` — *"…enqueues SYNC_CONNECTOR Jobs through the JobScheduler."* | `SyncConnectorJobDefinition` (`connector/domain/model.ts:103-107`) is never constructed and is not on the barrel (KI-55). The scheduler builds a plain `JobDefinition` named `connector.sync.scheduled` at `:85-98` |

The capability's own `structured-data/docs/runtime.md:5` already reports the first, which makes it
a documented-but-unfixed comment rather than an undiscovered one. This entry completes the set
begun by KI-50 (the vestigial fan-out comments) and KI-72 (the stale smoke comment); those three
entries together are every known comment-versus-code contradiction in `src/`.

**Fix size** — two comments.

**Verified by** — `capability-structured-derived.md` PART E item 7;
`capability-connector-files-context.md` §9.3; source read at HEAD.

---

### KI-95 — Resource-exhaustion surfaces with no bound

**Where** — General Files' upload path and Knowledge's ingestion.

**What happens** — three unbounded inputs, none of which has a cap at the wire, in the service, or
in SQL.

- **General Files accepts a body of any size.** The whole `content` string is held in memory for
  hashing, for the SQLite bind, for the `get` response body, and for Knowledge admission — **four
  full copies of the payload in flight for one upload**. Contrast Connector, whose reader caps a
  single full read at 16 MiB. The module's own `docs/invariants.md:60` states the absence.
- **Derived Outputs accepts a prompt of any size** (KI-85), and that prompt is concatenated into
  every model call the output ever makes.
- **The Activity ledger has no cap** (KI-80).

Combined with the serial queue's single slot and the absence of any job timeout (KI-31), one large
upload is enough to hold the serial queue while four copies of it sit in the heap.

**Fix size** — one configured byte cap per entry point, checked at the wire. Every other size bound
in the tree is already configuration-driven; these three are the gaps.

**Verified by** — [07 · General Files](07-capabilities/general-files.md) §8.2; module
`docs/invariants.md:60`; source read at HEAD.

---

### KI-96 — Smaller defects, recorded once

Each of these is stated in full on the capability page cited. They are collected here so the
register is complete: an entry that exists only on a capability page is an entry a reader of this
page will not find.

| # | Defect | Where it is stated in full |
| --- | --- | --- |
| a | **A valid Activity `limit` above 200 is silently clamped.** `boundedLimit` throws for an *invalid* limit and `Math.min`s a valid one. `{limit: 500}` returns 200 items with a `nextCursor` and no field saying the limit was reduced; the caller cannot tell. The module's `docs/invariants.md:68-69` describes only the throwing half | [activity.md](07-capabilities/activity.md) §10.6 |
| b | **`GeneralFileEncodingError` is the only rejection channel.** A blank `fileName` or a non-string `content` arrives as `400 encoding_error` with a message about a field name. A client cannot tell "your JSON was wrong" from "your text was not UTF-8" by status or code | [general-files.md](07-capabilities/general-files.md) §8.3 |
| c | **A General File cannot be renamed.** The first upload's `fileName` wins permanently and the content-hash reuse path returns the existing row; `update` takes only `content`. Changing a displayed name requires delete **and** purge, because a delete alone leaves the identity resumable at the same hash with the same stored name | [general-files.md](07-capabilities/general-files.md) §8.7 |
| d | **`gf_<p>_files.replaced_by_id` is never written on a live row.** The backward link is recorded on the archived snapshot by design, but the live schema advertises a relationship the live table never carries, and no module doc says so | [general-files.md](07-capabilities/general-files.md) §8.9 |
| e | **Investigation verifies no link target.** `Hypothesis.questionIds`, `FindingQuestionLink.questionId`, `FindingHypothesisLink.hypothesisId` are shape-checked only, and `FindingReference.resourceId` is never resolved against any capability. Dangling links are legal at write time and invisible at read time | [investigation.md](07-capabilities/investigation.md) §9.3 |
| f | **Investigation's store update methods return silently when the row is missing.** `updateQuestion`/`updateHypothesis`/`updateFinding` are `void` with no success signal. The runtime always reads first, so no production path reaches it — but a future caller cannot distinguish a write from a no-op | [investigation.md](07-capabilities/investigation.md) §9.6 |
| g | **The Investigation wiring layer keeps its own copy of every vocabulary**, with nothing keeping the two in sync — the same shape as KI-70 | [investigation.md](07-capabilities/investigation.md) §9.2 |
| h | **Context's `resolve` depth limit is untested and its truncation is order-dependent.** A context first reached *at* the depth limit is permanently marked `seen`, so a later shallower reference is skipped. `context.test.ts:164` covers the cycle guard only | [context.md](07-capabilities/context.md) §8.8 |
| i | **Context's wiring receives no `Logger` at all** — the only capability with none, so nothing it does is observable | [context.md](07-capabilities/context.md) §8.3 |
| j | **Derived Outputs' registration manifest logs a hard-coded `7`**, not a derived count, so it can drift from reality silently | [derived-outputs.md](07-capabilities/derived-outputs.md) §10.7 |
| k | **`promptSiteKey` is implemented twice in Slides** — `domain/elements.ts:450` and `persistence/sqliteMappers.ts:151` — by two independent code paths, producing identical strings today with **no shared source and no test asserting they agree**. If they diverge, a touched-ID conflict check and a SQL uniqueness constraint stop referring to the same thing | [slides.md](07-capabilities/slides.md) §9.4 |
| l | **`SlideLimits` has no configuration source.** Ten limits are enforced by `validateSnapshot` and nothing in `src/` constructs a `SlideLimits`; there is no `slides` section anywhere in the config chain. Whoever writes the application layer inherits the config surface too | [slides.md](07-capabilities/slides.md) §9.5 |
| m | **Slides' schema initialisation is not transactional** — twelve `CREATE TABLE` and twelve `CREATE INDEX` statements in one un-wrapped `db.exec`, where Investigation wraps the equivalent work. `IF NOT EXISTS` makes a partial failure recoverable rather than corrupting, so this is an asymmetry rather than a fault | [slides.md](07-capabilities/slides.md) §9.7 |
| n | **`1-init/create/persona.ts:12-16` describes a port that no longer exists** — *"Persona uses only declare/update/delete"*. `PersonaContextPort` has no `update`; it was removed in `1cbe845` and `purge` added in the same commit. The comment is the stale mirror image of the fix it should describe | [persona.md](07-capabilities/persona.md) §9.5 |

**Fix size** — small each; (k) and (l) are prerequisites for wiring Slides rather than repairs.

**Verified by** — the capability pages cited, each of which carries the `file:line` evidence; every
row re-checked against the surveyor slice that found it.

---

## Part 5 · Not bugs: deliberate decisions

Each of these looks like a defect from the outside. Each has a stated reason in source or in a
module doc. **Do not "fix" them without reading the reason first.**

| Thing | Why it is deliberate |
| --- | --- |
| **`POST /activity/command` always returns 501** (`registerActivityEndpoints.ts:149-167`) | Presence commands need an actor identity that HTTP does not supply. The refusal is explicit and typed: `{"error": "presence_transport_unsupported", "message": "Presence commands require a trusted session-aware transport; HTTP does not provide one yet."}`, logged at warn with `reason: "trusted_session_context_unavailable"`. The route is registered so it 501s rather than 404s — a deliberate difference between "not supported" and "not a route". (The *unscheduled* Presence lease cleanup is a real gap — KI-43.) |
| **Duplicated prose-text extension lists** in Connector and General Files | Each carries a comment saying so. `connector/domain/model.ts:1-4`: *"Prose-text extensions — standalone copy owned by this capability. Not imported from any other capability. Lists may intentionally diverge."* General Files' comment says the same. The lists are identical today; the point is that either capability may change its own classification without renegotiating with the other. Contrast KI-70, which is the same shape **without** a stated reason. |
| **No restore / un-delete API anywhere** | Listed as an explicit non-goal in `document/docs/invariants.md:209` (*"restore or resource reactivation after logical deletion"*). Deletion removes the current row and writes a terminal history record; there is no `trashed` lifecycle state anywhere in the tree. Reconstruction from history is possible and is not offered. |
| **No migration runner; fresh schemas instead** | Every capability executes its DDL on construction with `CREATE TABLE IF NOT EXISTS`. There is no `schema_migrations`, no checksum, no version table. This is a stated policy — [phase-1/claude-notes/04-state-and-persistence.md:145-147, 227-232](../phase-1/claude-notes/04-state-and-persistence.md) is the **only** statement of it anywhere, and it appears in no code comment (`grep -rn -i "no migration\|not migrate\|no legacy" src` → 0 hits). Preserve it. |
| **`pruneHistoryBefore` never removes the terminal tombstone of a still-deleted resource** (`resourceHistory.ts:192-204`) | This is the one clause that makes purge-after-prune work at all. It looks like an oversight in the `DELETE`; it is the invariant. (KI-5 is a *consumer* of this rule getting it wrong, not a problem with the rule.) |
| **The strict `<` retention cutoff** | A record recorded exactly at the cutoff survives. Pinned by `resource-retention.test.ts:25`. |
| **`ContextManager` satisfies `PersonaContextPort` structurally, with no adapter** | And `DocumentCapability` satisfies `TemplatableResource` the same way. `1-init/create/templates.ts:16-26`: *"`register` takes a capability's runtime object directly — there is no adapter to write. This is the only place that sees both sides, which is what keeps Templates and the resource capabilities from importing each other."* Both seams currently harbour a defect (KI-1, KI-3) precisely because the tests double the port — the pattern is sound, the test strategy around it is not. |
| **`logging.detail` fails open toward more logging** (`loadBackendConfig.ts:458-460`) | *"Anything that is not exactly "shape" means write everything. An unrecognised value therefore fails open toward more logging, which is the safe direction while this is a development setting."* Deliberate, and stated. Contrast KI-25, where `logging.level` fails open by accident. |
| **A `content`-labelled record is dropped whole, never redacted** (`logger.ts:80-86`) | *"…drops content-labelled records entirely rather than redacting their fields, because a half-redacted record is worse than an absent one — it looks complete."* |
| **`Fastify({ logger: false })`** | There is one log sink and Fastify's is not it. (The unobservable 400/415 responses this creates are KI-32; the decision itself is sound.) |
| **`likePattern.ts` lives in `0-utils`, breaking "capabilities own their own storage"** | The header comment is the codebase's clearest statement of the rule and its single exception: *"…The reason is history: Templates and General Files each grew a name filter independently, and they disagreed — one escaped and one did not, so the same query returned different results depending on which capability answered it. Four copies of a four-line function is cheap; four copies that disagree is a class of bug nobody goes looking for."* |
| **Comments has no client-facing `expectedRevision`** | Concurrency is resolved by the serial queue plus an internal CAS; the loser gets a 404 rather than a 409. Recorded in the module's docs as a design choice, not an omission. |
| **Persona has no command receipts, no Activity publication, and no project default pointer** | All three are argued in `persona/docs/README.md:36-52`. On the default pointer: *"A mutable global pointer would silently change the behaviour of every future task — the action-at-a-distance the freeze model exists to prevent, reintroduced one layer up."* |
| **`persona.getByName("Default")` returns 404 while `get("builtin:default")` works** | Deliberate, documented in `persona/docs/runtime.md`. The built-in is addressable by id, not by name. |
| **`template.instantiate` publishes no Activity** | `templates/docs/flows.md:201-204`, and the code matches: *"the owning resource capability publishes its own creation transaction, and a second item for the same resource would be duplicate history."* |
| **Detached Derived Output garbage collection is unwired** | `document/docs/flows.md:168` states it plainly (*"an unwired maintenance seam"*) and `invariants.md:211` lists automatic deletion as a non-goal. A detached output is not reclaimed until the whole document is deleted or purged. `listDetachedPromptOutputs` is implemented and indexed, ready for the sweep that has not been written. |
| **Activity and Knowledge have no revision-history table, and are not retention ports** | Activity is an append-only ledger; Knowledge is a rebuildable derived index. Every other capability uses the shared DDL. The retention port list at `startBackend.ts:123-147` omits both deliberately. |
| **The retention port order is load-bearing** | `startBackend.ts:121-122`: *"Parent resources precede their owned resources so retention can cascade through ownership before a generic child sweep sees the same history."* Reordering the list is a behaviour change, not a cleanup. |
| **`templates-orphans` rides the retention sweep instead of owning a timer** | `startBackend.ts:129-133`: *"…it is the same shape of work — conservative, cutoff-driven, reaping what nothing references — and a second scheduler would be a second thing to configure, observe, and shut down. The retention cutoff doubles as the grace period that tells an orphan from a registration in flight."* |
| **Four `setInterval` timers run whenever the Connector scheduler starts, even with zero connectors** | `connector/domain/model.ts:17-20`: *"Allowed sync intervals. Fixed multiples of each other so the scheduler can batch connectors that share a cadence."* One timer per cadence is the design. (They are not `unref()`ed, unlike the retention timer — that asymmetry is undocumented but harmless while the process runs.) |
| **`parsePrivate` accepts only a literal `true`** (`registerContextEndpoints.ts:46-49`) | *"Strict on purpose: only a literal boolean true counts. Anything else, including missing, null, or a truthy-looking string, is treated as 'not private'."* |
| **No DI container, no service locator** | Everything is wired by hand in a 238-line `startBackend.ts`. This is a stated convention, and the composition-root smoke test (`runtime-wiring.test.ts:40-55`) exists to protect it. |
| **`packages/shared` holds exactly one 5-line interface** | A type stays capability-owned until two or more consumers need it. Nothing else has met that bar. |
| **Architectural regression tests that read source files as text** | Three of `runtime-wiring.test.ts`'s eight assertions do this (the alias check, the `console.*` ban, the listen-order check), as does `connector.test.ts:51`. They are deliberate and they catch real regressions; the composition-root test's own comment explains the technique and its **known limit** — esbuild elides unused and type-only imports, so it is not a substitute for `tsc`. |

---

## Cross-references

- Status accounting, test counts and the measured endpoint inventory: [10 · Verified status](10-verified-status.md)
- What to build next, and in what order: [12 · Build order](12-build-order.md)
- Per-capability detail for any defect above: [07 · Capabilities](07-capabilities/README.md)
- The logging mechanism KI-26 through KI-29 all touch: [06 · Platform services](06-platform-services.md)
- The configuration loader KI-25 and KI-37 through KI-39 live in: [09 · Configuration](09-configuration.md)
- The read path KI-90 exploits, in full, with the provider source: [07 · Connector](07-capabilities/connector.md) §8.1
- Every entry in KI-96 is stated in full on the capability page named in its row
