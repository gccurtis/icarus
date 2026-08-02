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
- **Templates performs no Context read or write.** Context references travel
  through adapter `arguments` as opaque pairs and are decoded only by the owning
  resource kind.
- **No internal job intents and no freeze/compute/settle pipeline.** Templates
  delegates the slow, cross-database part to the adapter, which owns its own
  durable attempt (for Document, `DocumentCopyAttempt`). Templates' durability
  obligation is only "do not create two backing resources for one request",
  which the claim table plus a deterministic adapter idempotency key satisfy.
- Activity via a local transactional outbox plus an injected publisher,
  mirroring Document.

### Two deviations from `templates-design.md`

Both are flagged for review. Neither changes the shape of the work; each is a
one-line-to-one-function change if rejected.

**D1 · `POST /templates/command` should be `concurrent`, not `serial`.**

The design table says serial. The codebase's own stated rule
(`02-request-and-job-runtime.md`) is *"Serialisation is used where the store
cannot enforce the invariant on its own"*, and Templates' invariants are all
single-row store invariants: the claim is a `request_id` primary-key insert,
the catalog row is a primary-key plus `UNIQUE (kind, resource_id)` insert, and
deletion is a single-row soft delete. There is no revisioned read-modify-write
anywhere in this capability.

The cost of getting this wrong is real: the serial queue has exactly **one**
active slot, and a registration or instantiation blocks inside an adapter call
that, for Document, will clone Derived Outputs across a second database. Every
Document and Slide command project-wide would queue behind it. The existing
precedent points the same way — `POST /derived-output-refresh`, the slowest
LLM-bearing endpoint in the tree, is already on the **concurrent** queue with
claim-based idempotency.

The one interleaving worth naming: a concurrent `template.delete` racing a
`template.instantiate` of the same template. The adapter freezes its source
revision at the start of the copy, so the loser fails cleanly with a not-found
rather than producing a partial instance. A spurious failure, not corruption.

**D2 · Reserve the catalog row *before* the adapter call, not after.**

The design's registration flow inserts the catalog record at step 5, after the
copy. That means two requests racing on the same `templateId` both pass their
claim, both drive the adapter to create a backing resource, and only the second
catalog insert fails — leaking an orphan backing resource. Ordering it as
reserve → adapter → finalise detects the collision before any external side
effect, and gives crash recovery a row to resume from:

```text
templates.state: 'reserving' -> 'ready'   (plus soft delete via deleted_at)
```

A `reserving` row is invisible to `template.get`/`template.list` and blocks a
second registration of the same ID. This also makes the design's own stated
requirement — *"A crash after the resource copy but before the catalog insert
… must not create a second backing resource"* — enforceable rather than
aspirational.

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

- `TemplateRecord { id, kind, resourceId, state, createdAt, deletedAt? }` with
  `TemplateRecordState = "reserving" | "ready"`.
- `TemplateResourceRef { kind, resourceId }`.
- `TemplateCommandRequest { requestId, command }`.
- `TemplateCommand` — the three-member union `template.register`,
  `template.instantiate`, `template.delete`, exactly as designed. `arguments?:
  unknown` stays type-erased on instantiate.
- `TemplateCommandResult` — `template.registered`, `template.instantiated`,
  `template.deleted`.
- `TemplateQuery` / `TemplateQueryResult` — `template.get`, `template.list`.
- `TemplateCommittedFact` — Templates' own origin vocabulary, translated to
  Activity's in `1-init` (the Document port is the model for this seam).
- `TemplateOptions { maxTemplatesPerProject }`.

`domain/errors.ts` — one class per distinguishable failure:

`TemplateNotFoundError`, `TemplateAlreadyExistsError`,
`TemplateUnsupportedKindError`, `TemplateIdempotencyMismatchError`,
`TemplateResourceMismatchError` (adapter returned a ref that is not
`(kind, templateId)`), `TemplateCatalogLimitError`, `TemplateWireError`,
`TemplateValidationError`.

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
taking a deterministic `idempotencyKey`.

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

`template.register`:

1. Resolve the adapter for `source.kind`; unknown ⇒ `TemplateUnsupportedKindError`
   **before** any write.
2. Enforce `maxTemplatesPerProject` against `countLive()`.
3. `store.reserve({ id: templateId, kind, resourceId: templateId, state: "reserving" })`;
   `false` ⇒ `TemplateAlreadyExistsError`.
4. `adapter.createTemplateCopy({ sourceResourceId, templateId, idempotencyKey })`.
5. Require the returned ref to equal `(kind, templateId)`; otherwise
   `TemplateResourceMismatchError` and abandon the reservation.
6. `markReady` + `template.registered` fact, one transaction.

On an adapter throw, delete the reservation and rethrow, so a failed
registration does not permanently burn the ID.

`template.instantiate`:

1. Load the record; missing, `reserving`, or soft-deleted ⇒
   `TemplateNotFoundError`.
2. Resolve the adapter for `record.kind`.
3. `adapter.instantiateTemplate({ templateId, destinationResourceId, arguments,
   idempotencyKey })` — the adapter strictly decodes `arguments`; Templates
   never inspects or persists them.
4. Return `{ template, resource }`. **No catalog row is written** — the instance
   belongs entirely to the owning capability, and Templates stores no instance
   list.

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

`arguments` is the one field passed through **undecoded** — it is forwarded to
the adapter as `unknown` and is that adapter's responsibility. The decoder still
requires it to be a JSON object when present, and enforces a size cap, so a
hostile payload cannot reach an adapter as a string or array.

All decode failures raise one `TemplateWireError`.

## Phase 6 — Endpoints, startup, configuration

`4-job-wiring/templates/registerTemplateEndpoints.ts` — the two registrations,
plus one `errorResponse` `instanceof` ladder:

```text
TemplateNotFoundError                                  -> 404 not_found
TemplateAlreadyExistsError                             -> 409 already_exists
TemplateIdempotencyMismatchError                       -> 409 idempotency_mismatch
TemplateUnsupportedKindError                           -> 400 unsupported_kind
TemplateResourceMismatchError                          -> 400 resource_mismatch
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
a hand-written `FakeResourceAdapter` (no mocking library) that records its calls
and can be told to throw or to return a mismatched ref.

Catalog and adapter dispatch:

- registering an unsupported kind fails before any row or adapter call;
- a successful registration produces exactly one `ready` record with
  `resourceId === templateId`, and calls the adapter exactly once;
- an adapter that returns a ref other than `(kind, templateId)` fails and leaves
  no catalog row;
- an adapter throw leaves no catalog row and the ID is reusable;
- registering a second template with an in-use ID fails **without** calling the
  adapter (the D2 ordering guarantee);
- `maxTemplatesPerProject` is enforced.

Idempotency:

- an exact retry of each of the three commands replays the stored result and
  calls the adapter exactly once in total;
- the same `requestId` with a different canonical body raises
  `TemplateIdempotencyMismatchError`;
- key ordering in the request body does not change the digest;
- a claim left `pending` (simulating a crash mid-adapter-call) resumes with the
  same adapter idempotency key and does not create a second backing resource.

Instantiation and deletion:

- instantiate returns the adapter's destination ref and writes **no** catalog
  row;
- instantiate against a `reserving`, missing, or deleted template is 404;
- delete soft-deletes the record, calls the adapter once, and leaves prior
  instances untouched;
- a deleted template is absent from `list` and 404s on `get`.

Wire:

- unknown keys on every command and query are rejected;
- `arguments` is forwarded byte-identically to the adapter and is never
  persisted by Templates;
- a non-object `arguments` is rejected at the boundary.

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
- Any Context read or write from Templates.
- Cross-project, user-level, or public templates; template versions; instance
  pinning; categories, thumbnails, or search; propagation from a template into
  existing instances; batch instantiation; pagination.
