# Templates Implementation Plan

## Goal

Implement the project-scoped Templates capability defined in
[`templates-design.md`](templates-design.md): one catalog of reusable resource
templates, an injected per-kind adapter registry, exact command replay, and
Activity publication.

**Scope boundary.** This plan delivers the Templates capability *and the
`TemplateResourceAdapter` port it dispatches through*. It does **not** implement
the Document adapter, which requires Document representation v2, context
variables, `isTemplate` persistence, durable copy attempts, and a new
`DerivedOutputs.clone` — the whole of
[`document-design/templates-and-context-variables.md`](document-design/templates-and-context-variables.md).

That work is a separate, larger plan. Here the adapter is a contract, exercised
by a fake in-memory adapter in tests.

### Definition of done

Templates is complete, tested, and wired into startup with an **empty** adapter
registry. `template.get` and `template.list` are fully operational; the three
mutating commands admit, claim, validate, and fail cleanly with
`unsupported_kind` until the first adapter is registered. Registering the
Document adapter later is an additive change to `1-init` only — no change to
the Templates domain, store, wire, or endpoints.

## Preconditions and honest constraints

- **The backend does not currently boot.**
  `3-capabilities/slide/index.ts` re-exports a missing
  `./application/slideService.js`; `tsc --noEmit` reports exactly those two
  errors and `startBackend.ts` cannot load. Verification for this plan is
  therefore `typecheck` (expect the same two pre-existing Slide errors and no
  new ones) plus `test`. A live smoke run against `/templates/*` is blocked
  until Slide lands and is explicitly out of this plan's exit criteria.
- Context is project-scoped only and Templates does not touch it (see
  [Settled architecture](#settled-architecture)). No Context work is required
  here.
- There is still no `context.test.ts`. Not a blocker for Templates, which has
  no Context dependency, but worth knowing it is untested ground nearby.

## Settled architecture

- **Layered shape**, per `03-capability-anatomy.md` ("follow the layered shape"
  for new work). Templates is small, but it is a new capability with a wire
  boundary and a persistence adapter, and the layered shape is the stated
  default.
- One public import `#templates`; the barrel is the only cross-capability entry
  point.
- Two endpoints, `POST /templates/command` and `POST /templates/query`, using
  the discriminated-union command/query envelope.
- Strict `wire/` decoders with `exactKeys`, per Review 001 Tier 3 ("every
  capability added from here should follow Document's `wire/` pattern from the
  start"). No `as any`, no `String(x ?? "")`.
- Own SQLite file `./data/templates.db`, project-hashed table prefix
  `tpl_${sha256(projectId).slice(0, 16)}_`.
- `resourceId === templateId` in v1, enforced by a `CHECK` constraint, not only
  in TypeScript.
- The adapter registry is injected at construction. Templates imports no
  capability; `1-init` owns every adapter and the registry that holds them.
- **Templates performs no Context read or write.** It imports the `ContextEntry`
  type only. Bindings are decoded structurally at the wire boundary, forwarded
  to the adapter, and interpreted only by the owning resource kind.
- **No internal job intents and no freeze/compute/settle pipeline.** Templates
  delegates the slow, cross-database part to the adapter, which owns its own
  durable attempt (for Document, `DocumentCopyAttempt`). Templates' durability
  obligation is only "do not create two backing resources for one request",
  which the claim table plus a deterministic adapter idempotency key satisfy.
- Activity via a local transactional outbox plus an injected publisher,
  mirroring Document.

- **Templates allocates the Template ID and returns it.** `template.register`
  takes no ID. The identifier is minted once and frozen in the command claim
  and a `reserving` catalog row before any adapter call, which is what makes
  retries and resumed claims safe. This follows Derived Outputs, which likewise
  allocates its own output ID inside `declare()` and relies on a caller-supplied
  idempotency key for retry safety — not Document, which takes caller-supplied
  aggregate and structural IDs.
- **Caller-supplied identifiers stay caller-supplied.** The registration
  `source` and the `destinationResourceId` are the caller's to name, exactly as
  `document.create` takes a `documentId`.
- **Bindings are typed pairs, not bare references.**
  `TemplateContextBinding { entry?, description? }`, keyed by variable name.
  Decoded strictly at the wire boundary; no per-kind private argument decoder.
- **Both register and instantiate accept bindings**, and both apply the same
  override rule: absent key inherits, key with `entry` sets, key without
  `entry` unbinds. Registration records defaults; instantiation overrides them.
  There is no clearing pass anywhere.
- **Bindings are normalised to `{}`**, so the domain never branches on
  `undefined`. Templates persists none of them.
- **The catalog row carries an optional `description`.** Set at registration,
  immutable in v1.
- **Adapter methods return `void`.** Templates supplies both `kind` and the
  destination ID, so there is nothing to validate on the way back.

### Resolved: the command endpoint is serial

An earlier draft of this plan argued for `concurrent` on the grounds that every
Templates invariant was a single-row store invariant. **That was wrong on two
counts and the design's original `serial` stands.**

- The catalog limit is not a single-row invariant. `countLive()` and
  `reserve()` are separate statements, so concurrent registrations could each
  observe room under `maxTemplatesPerProject` and then all reserve. Serial
  admission is what prevents the overshoot; the same shape applies to
  claim-then-execute, where two concurrent retries of one `requestId` would
  both observe a pending claim and both drive the adapter.
- The supporting argument — that a concurrent delete racing an instantiate
  fails cleanly because the adapter freezes its source revision — was reasoning
  about designed behaviour in an adapter that does not exist yet.

The throughput concern was real but is the wrong trade: it is the same one
Document and Slide already accept, and correctness under a read-then-write
sequence wins. `test/capabilities/templates-wiring.test.ts` asserts the queue
choice so it cannot drift back silently.

*(A second earlier deviation, reserving the catalog row before the adapter
call, has been folded into the design itself. Templates allocating the ID makes
reserve-first mandatory rather than merely safer: the identifier has to be
durable before the external side effect or a crash leaves nothing to resume
from.)*

## Files

Add:

```text
apps/backend/src/1-init/create/templates.ts

apps/backend/src/3-capabilities/templates/
  index.ts
  domain/
    model.ts
    errors.ts
    canonical.ts
  application/
    templateService.ts
  ports/
    templateStore.ts
    resourceAdapter.ts
    activityPublisher.ts
  persistence/
    sqliteSchema.ts
    sqliteTemplateStore.ts
    sqliteMappers.ts
  wire/
    commandSchemas.ts
    querySchemas.ts
    valueSchemas.ts
  docs/
    README.md concepts.md types.md runtime.md flows.md invariants.md

apps/backend/src/4-job-wiring/templates/
  registerTemplateEndpoints.ts

apps/backend/test/capabilities/templates.test.ts
```

Update only these composition seams:

- `apps/backend/package.json` and `apps/backend/tsconfig.json` — add
  `#templates` and `#templates/*`;
- `apps/backend/test/capabilities/runtime-wiring.test.ts` — extend the existing
  alias-presence assertion to cover `#templates`;
- `apps/backend/src/1-init/startBackend.ts` — one construction and registration
  block;
- `apps/backend/etc/configuration.yaml` and `loadBackendConfig.ts` — one
  `templates` section;
- `apps/backend/etc/README.md` — document that section (Review 001 finding 4b
  asks for this on any config change);
- `apps/backend/test/smoke/http-smoke.mjs` — the two new endpoints.

## Phase 1 — Domain

`domain/model.ts`:

- `TemplateRecord { id, kind, resourceId, description?, state, createdAt,
  deletedAt? }` with `TemplateRecordState = "reserving" | "ready"`.
- `TemplateResourceRef { kind, resourceId }`.
- `TemplateCommandRequest { requestId, command }`.
- `TemplateCommand` — the three-member union. `template.register` carries
  `source` plus optional `description` and `contextBindings`, and **no**
  `templateId`; `template.instantiate` carries `templateId`,
  `destinationResourceId`, and optional `title` / `contextBindings`.
- `TemplateContextBinding { entry?: ContextEntry; description?: string }` and
  `TemplateContextBindings = Readonly<Record<string, TemplateContextBinding>>`,
  plus `TemplateInstantiationInput { title?, contextBindings }` — note
  `contextBindings` is **required** on the internal type and normalised to `{}`
  by the decoder, even though it is optional on the wire.
- `ContextEntry` is a **type-only** import of the `{ id, kind }` atom, matching
  Structured Data and Derived Outputs. No Context runtime, port, read, or write.
- `TemplateCommandResult` — `template.registered` (carries the allocated
  record), `template.instantiated`, `template.deleted`.
- `TemplateQuery` / `TemplateQueryResult` — `template.get`, `template.list`.
- `TemplateCommittedFact` — Templates' own origin vocabulary, translated to
  Activity's in `1-init` (the Document port is the model for this seam).
- `TemplateOptions { maxTemplatesPerProject }`.

`domain/errors.ts` — one class per distinguishable failure:

`TemplateNotFoundError`, `TemplateAlreadyExistsError`,
`TemplateUnsupportedKindError`, `TemplateIdempotencyMismatchError`,
`TemplateCatalogLimitError`, `TemplateWireError`, `TemplateValidationError`.

There is deliberately **no** `TemplateResourceMismatchError`. Adapter methods
return `void`, so there is no returned reference to disagree with what
Templates asked for.

`domain/canonical.ts` — copy Document's `canonicalValue`/`canonicalize`/
`canonicalDigest` shape (sorted keys, `undefined` dropped, SHA-256) so a retry
with reordered JSON keys replays instead of conflicting.

Do not add: display names, descriptions, categories, thumbnails, instance
lists, template versions, or any second copy of resource metadata.

## Phase 2 — Store port and SQLite adapter

`ports/templateStore.ts`. Synchronous, matching the flat capabilities' stated
rationale that SQLite is synchronous — Templates has no non-SQLite future to
keep open.

```ts
interface TemplateStore {
  get(id: string): TemplateRecord | undefined;
  list(kind?: string): TemplateRecord[];          // ready + live only, ordered by createdAt, id
  countLive(): number;

  claimCommand(claim: TemplateCommandClaim): TemplateClaimOutcome;
  /** Freezes the allocated ID on the claim row before any adapter call. */
  bindClaimTemplateId(requestId: string, templateId: string): void;
  completeClaim(requestId: string, result: unknown, at: string): void;

  reserve(record: TemplateRecord): boolean;       // false => (kind, resourceId) or id taken
  markReady(id: string, at: string): void;
  softDelete(id: string, at: string): void;
  deleteReservation(id: string): void;            // abandon a failed reservation

  appendActivityFact(fact: TemplateCommittedFact): void;
  listUnpublishedFacts(limit: number): TemplateCommittedFact[];
  markFactPublished(factId: string, at: string): void;
}
```

`TemplateClaimOutcome` mirrors Derived Outputs' claim shape:
`{ state: "claimed" | "pending" | "completed", requestDigest, result? }`.

`persistence/sqliteSchema.ts` — the four standard pragmas (`journal_mode=WAL`,
`foreign_keys=ON`, `busy_timeout=5000`, `synchronous=NORMAL`), project-hashed
prefix, and DDL that enforces the invariants in the database:

```sql
CREATE TABLE IF NOT EXISTS tpl_<prefix>_templates (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  description TEXT,
  state       TEXT NOT NULL CHECK (state IN ('reserving','ready')),
  created_at  TEXT NOT NULL,
  deleted_at  TEXT,
  UNIQUE (kind, resource_id),
  CHECK (resource_id = id)
);

CREATE TABLE IF NOT EXISTS tpl_<prefix>_command_claims (
  request_id     TEXT PRIMARY KEY,
  request_digest TEXT NOT NULL,
  command_type   TEXT NOT NULL,
  -- Allocated by Templates and frozen here before the adapter call, so a
  -- resumed pending claim reuses the same identity instead of minting one.
  template_id    TEXT,
  state          TEXT NOT NULL CHECK (state IN ('pending','completed')),
  result_json    BLOB,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tpl_<prefix>_activity_outbox (
  fact_id      TEXT PRIMARY KEY,
  template_id  TEXT NOT NULL,
  kind         TEXT NOT NULL,
  occurred_at  TEXT NOT NULL,
  payload_json BLOB NOT NULL,
  published_at TEXT
);

CREATE INDEX IF NOT EXISTS tpl_<prefix>_outbox_pending
  ON tpl_<prefix>_activity_outbox(occurred_at, fact_id) WHERE published_at IS NULL;
```

The outbox row carries a self-contained `payload_json` and **no foreign key**
to the templates table — the same lesson Document's `migrateActivityOutbox`
encodes, so a later catalog change cannot strand a fact Activity has not yet
consumed.

`reserve` and the finalising write each commit in one transaction together with
their outbox fact, so a fact cannot exist without its catalog change.

## Phase 3 — Adapter port and registry

`ports/resourceAdapter.ts` — `TemplateResourceAdapter` and
`TemplateResourceRegistry` exactly as designed. Three methods
(`createTemplateCopy`, `instantiateTemplate`, `deleteTemplateCopy`), each
taking a deterministic `idempotencyKey` and each returning `Promise<void>`.

`createTemplateCopy` receives `contextBindings` (the template's defaults) and
`instantiateTemplate` receives the whole decoded `TemplateInstantiationInput`.
Applying the override rule — set / explicitly unbind / inherit — is the
**adapter's** job in both directions, because only the owning kind knows how its
variables are stored. Templates states the contract and forwards the input; it
does not implement or persist it.

Note there is no bindings table in Phase 2. A template's defaults live in the
backing resource's own variable state, so the catalog can never disagree with
the resource about what a variable points at.

Idempotency keys are minted by Templates from the claimed request, never by the
caller:

```text
templates:register:<requestId>
templates:instantiate:<requestId>
templates:delete:<requestId>
```

This is what makes a resumed pending claim safe: the same request replays the
same adapter key and the adapter, which owns its own durable attempt, returns
its existing result instead of creating a second backing resource.

The registry is a plain `Map<string, TemplateResourceAdapter>` built in
`1-init`. Templates receives only the read face (`get(kind)`).

## Phase 4 — Application service

`application/templateService.ts`, exporting `TemplateCapability`,
`TemplateDependencies`, and `createTemplateCapability(store, dependencies,
options)` — the three-argument idiom, with the class unexported.

Every command follows one shape:

```text
1. decode already happened at the wire boundary
2. digest = canonicalDigest(command)
3. outcome = store.claimCommand({ requestId, digest, commandType })
     completed  -> replay stored result
     pending    -> resume (same adapter key; safe by construction)
     claimed    -> continue
     digest mismatch or different commandType -> TemplateIdempotencyMismatchError
4. command-specific work
5. store.completeClaim(requestId, result)
```

`template.register` — note the command carries **no** `templateId`:

1. Resolve the adapter for `source.kind`; unknown ⇒ `TemplateUnsupportedKindError`
   **before** any write.
2. Enforce `maxTemplatesPerProject` against `countLive()`.
3. Determine the Template ID. On a fresh claim, allocate a `randomUUID()`; on a
   resumed pending claim, read `template_id` off the claim row. Then
   `store.bindClaimTemplateId(requestId, templateId)` and
   `store.reserve({ id: templateId, kind, resourceId: templateId,
   state: "reserving" })`; `false` ⇒ `TemplateAlreadyExistsError`.
4. `adapter.createTemplateCopy({ sourceResourceId, templateId, contextBindings,
   idempotencyKey })`.
5. `markReady` + `template.registered` fact, one transaction. `description` is
   written on the reserved row at step 3 and is immutable thereafter.
6. Complete the claim with the full `TemplateRecord` — this is how the caller
   learns the ID.

Steps 3 and 4 are ordered that way on purpose: allocating an ID that is not yet
durable and then calling out to another database would leave a crash with no
way to find what it had already created. Freezing the ID on the claim row *and*
reserving the catalog row before the adapter call means a resumed claim replays
the same identity and the same adapter key.

On an adapter throw, delete the reservation and rethrow, so a failed
registration does not permanently burn the ID.

`template.instantiate`:

1. Load the record; missing, `reserving`, or soft-deleted ⇒
   `TemplateNotFoundError`.
2. Resolve the adapter for `record.kind`.
3. `adapter.instantiateTemplate({ templateId, destinationResourceId,
   instantiation: { title, contextBindings }, idempotencyKey })`. The input was
   already decoded at the wire boundary; Templates forwards it and persists none
   of it.
4. Return `{ template, resource: { kind, resourceId: destinationResourceId } }`,
   constructed from what Templates already knows. **No catalog row is written**
   — the instance belongs entirely to the owning capability, and Templates
   stores no instance list.

Omitted, empty, and partial `contextBindings` are all valid at both commands and
are passed through unchanged after normalisation to `{}`. Templates never checks
binding completeness and never inspects a binding's `description`; an unbound
variable is legal state on the destination.

`template.delete`:

1. Load the record; missing or already deleted ⇒ `TemplateNotFoundError`.
2. `adapter.deleteTemplateCopy({ templateId, idempotencyKey })`.
3. `softDelete` + `template.deleted` fact, one transaction.

Queries are trivial reads. `template.list` returns ready, live records ordered
by `(createdAt, id)` with an optional `kind` filter, bounded by the configured
limit and with no pagination contract.

`publishPendingActivity()` drains the outbox through the injected publisher and
marks each fact published, exactly as Document does. A publish failure logs and
leaves the row for the next drain; it never changes an accepted command result.

## Phase 5 — Wire

`wire/valueSchemas.ts` — `exactKeys(record, allowed, label)`,
`requireIdentifier`, `requireString`, `requireRecord`, plus
`TEMPLATE_WIRE_LIMITS` applied before structural decoding.

`wire/commandSchemas.ts` — `decodeTemplateCommand`, with a
`COMMAND_KEYS: Record<TemplateCommand["type"], readonly string[]>` table so the
decoder and the union cannot drift.

`wire/querySchemas.ts` — `decodeTemplateQuery`.

`contextBindings` is decoded **fully and strictly**, not passed through as an
opaque blob. It must be a JSON object whose keys are non-empty-after-trim
variable names and whose values are objects with `exactKeys(["entry",
"description"])`. When `entry` is present it must be a `{ id, kind }` pair of
non-empty strings; when absent, the binding means *explicitly unbind*, which is
why `{}` is a valid binding value and must not be rejected as empty. Caps apply
to the number of bindings, key length, and description length.

The decoder normalises an absent `contextBindings` to `{}` so the domain and
the adapters never branch on `undefined`. An absent, `{}`, or partial map is
legal input at both `template.register` and `template.instantiate`.

`template.register` explicitly rejects a `templateId` key rather than ignoring
it, since `exactKeys` already refuses unknown keys; a client that supplies one
is misunderstanding the contract and should be told so with a 400.

All decode failures raise one `TemplateWireError`.

## Phase 6 — Endpoints, startup, configuration

`4-job-wiring/templates/registerTemplateEndpoints.ts` — the two registrations,
plus one `errorResponse` `instanceof` ladder:

```text
TemplateNotFoundError                                  -> 404 not_found
TemplateAlreadyExistsError                             -> 409 already_exists
TemplateIdempotencyMismatchError                       -> 409 idempotency_mismatch
TemplateUnsupportedKindError                           -> 400 unsupported_kind
TemplateCatalogLimitError                              -> 400 catalog_limit_exceeded
TemplateWireError | TemplateValidationError            -> 400 validation_error
(anything else)                                        -> 500 internal_error
```

`commandStatus`: `template.registered` ⇒ 201, `template.instantiated` ⇒ 201,
`template.deleted` ⇒ 200. Only `>= 500` is logged; the 500 branch returns a
fixed generic message and logs the real one.

`1-init/create/templates.ts` — opens `./data/templates.db`, builds the adapter
registry, and adapts `TemplateCommittedFact` to `ActivityTransaction`
(`kind: "template"`, `resourceId: templateId`, `operation: "registered" |
"deleted"`), mirroring `createDocumentActivityPublisher`.

`startBackend.ts` — construct Templates **after** the resource capabilities and
Activity, register the endpoints with the other `register*Endpoints` calls, and
call `templates.publishPendingActivity()` alongside the existing Document
recovery calls. In this plan the registry is constructed empty; the Document
adapter is added here later without touching anything else.

Configuration — one section, defaults in `DEFAULT_CONFIG`:

```yaml
templates:
  maxTemplatesPerProject: 500
```

## Phase 7 — Documentation

The six-file `docs/` package beside the code, following the house tone. The
`README.md` "Status and authority" section must state plainly that **no resource
adapter is registered yet**, so all three mutating commands return
`unsupported_kind` in the current tree, and point at
`document-design/templates-and-context-variables.md` as the design for the first
adapter rather than as implemented behaviour.

## Phase 8 — Tests and verification

`test/capabilities/templates.test.ts`, `node:test` + `node:assert/strict`, using
a hand-written `FakeResourceAdapter` (no mocking library) that records every
call it receives and can be told to throw.

ID allocation — the behaviour that changed most, so cover it directly:

- `template.register` succeeds with no `templateId` in the request, and the
  result carries a freshly allocated one;
- two registrations from different requests receive **different** IDs;
- the allocated ID is written to the claim row and the `reserving` catalog row
  **before** the adapter is called (assert ordering via the fake's recorded
  call sequence against store state);
- a request body containing `templateId` is rejected at the wire boundary.

Catalog and adapter dispatch:

- registering an unsupported kind fails before any row or adapter call;
- a successful registration produces exactly one `ready` record with
  `resourceId === templateId`, and calls the adapter exactly once;
- an adapter throw leaves no catalog row and does not burn the ID;
- `maxTemplatesPerProject` is enforced.

Idempotency:

- an exact retry of each of the three commands replays the stored result and
  calls the adapter exactly once in total;
- an exact retry of `template.register` returns the **same allocated ID**, not a
  second one;
- the same `requestId` with a different canonical body raises
  `TemplateIdempotencyMismatchError`;
- key ordering in the request body does not change the digest;
- a claim left `pending` with a bound `template_id` (simulating a crash
  mid-adapter-call) resumes on that same ID with the same adapter idempotency
  key, and does not reserve a second row or create a second backing resource.

Instantiation and deletion:

- instantiate returns `(kind, destinationResourceId)` and writes **no** catalog
  row;
- instantiate against a `reserving`, missing, or deleted template is 404;
- delete soft-deletes the record, calls the adapter once, and leaves prior
  instances untouched;
- a deleted template is absent from `list` and 404s on `get`.

Bindings and descriptions:

- omitted, `{}`, and partial `contextBindings` all succeed at **both** commands
  and reach the adapter unchanged — Templates never checks completeness;
- an omitted `contextBindings` reaches the adapter as `{}`, never `undefined`;
- a binding of `{}` — meaning *explicitly unbind* — is accepted and forwarded,
  and is **not** confused with an absent key;
- an absent key and a present-but-empty key are distinguishable in what the
  adapter receives (this is the whole override rule, so assert it directly);
- a binding `entry` that is not a `{ id, kind }` pair of non-empty strings is
  rejected at the wire boundary, as is an unknown key inside a binding;
- an empty or whitespace-only variable name is rejected;
- a binding `description` is forwarded verbatim and never inspected;
- bindings are forwarded but never persisted — assert the store holds none
  after a successful register and instantiate;
- `template.register` accepts and stores an optional catalog `description`, and
  `get`/`list` return it;
- omitted `title` reaches the adapter as `undefined`.

Wire:

- unknown keys on every command and query are rejected.

Activity:

- an accepted registration and an accepted deletion each write exactly one
  outbox fact in the same transaction as the catalog change;
- a rejected command and an exact retry write none;
- a publisher failure leaves the fact unpublished and does not change the
  command result;
- `publishPendingActivity()` drains it afterwards.

Also extend `runtime-wiring.test.ts` with the `#templates` alias assertion.

Verification (Node is not on `PATH` outside `nix develop`):

```bash
pnpm --filter @icarus/backend typecheck   # expect: only the 2 pre-existing Slide errors
pnpm --filter @icarus/backend test        # expect: 155 existing + the new Templates tests, all passing
```

An HTTP smoke run is deliberately **not** an exit criterion for this plan — the
process cannot boot until `slide/application/slideService.ts` exists.

## Explicitly out of scope

- The Document adapter and everything it depends on: Document representation
  v2, context variables, `PromptContextSpec`, the v1→v2 migration,
  `prompt-context-sync` attempts, `isTemplate` persistence, `DocumentCopyAttempt`,
  and `DerivedOutputs.clone`.
- **Actually applying the binding override rule to a resource.** Templates
  defines the contract and forwards the input; only the owning kind's adapter
  can carry it out, because only it knows how its variables are stored. The
  fake adapter asserts the contract is *delivered* correctly, not that any real
  resource is rewritten.
- Any Context read or write from Templates.
- Caller-chosen Template IDs.
- Cross-project, user-level, or public templates; template versions; instance
  pinning; categories, thumbnails, or search; propagation from a template into
  existing instances; batch instantiation; pagination.
