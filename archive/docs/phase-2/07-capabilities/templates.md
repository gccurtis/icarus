# Templates

*Verified against source at commit ef6d462, 2026-08-09.*

Templates is a catalog of reusable resources. It owns no content of its own: a template is a flat
catalog row naming a *kind*, a backing resource the owning capability allocated and then sealed,
a case-insensitively unique catalog label, and a declared parameter list. Registration drives
another capability's runtime object through four calls — copy, seal, bind, record — and
instantiation is the same procedure one call shorter. The interesting part of Templates is not the
catalog; it is the seam. Since commit `18ab0e8` (2026-08-02) that seam is **inverted**: Templates
receives a resource capability's own runtime object and drives it, and the resource capability
satisfies the port structurally with no adapter anywhere. Exactly one kind is registered today —
`document`.

---

## 1 · At a glance

| | |
| --- | --- |
| **Shape** | Layered, with `wire/`: `domain/ application/ ports/ persistence/ wire/` |
| **Endpoints** | **2** — `POST /templates/command`, `POST /templates/query` |
| **DB file** | `./data/templates.db`, opened at [`1-init/create/templates.ts:14`](../../../apps/backend/src/1-init/create/templates.ts) |
| **Tables** | **4** — catalog, command receipts, transaction outbox, shared history. Prefix `tpl_<sha256(projectId)[0:16]>_` |
| **Revision model** | Catalog row with a `revision` column, `CHECK (revision >= 1)`. Registration writes 1; `template.update` is the only command that advances a live record and is a CAS on `expectedRevision`; `template.delete` archives the record then writes a terminal `deleted` record at `revision + 1` — in the design; it always throws before reaching the store (§8, KI-1) |
| **Commands / queries** | 5 / 3 |
| **Registered kinds** | **1** (`document`), registered by one line at `startBackend.ts:119` |
| **Test files (tests)** | `templates.test.ts` 2,248 lines (107), `templates-wiring.test.ts` 163 lines (7) — **2 files, 2,411 lines, 114 tests, 114 pass** |
| **Source files / lines** | **14 / 2,436** for `3-capabilities/templates/`, plus `4-job-wiring/templates/registerTemplateEndpoints.ts` (135) and `1-init/create/templates.ts` (79) |
| **Status** | Wired. Register, update, instantiate and query work. **`template.delete` fails for every template in the running system** — the only registered kind is `document`, and the Document runtime's `logicalDelete` always throws (KI-1). `template.purge` throws a raw `TypeError` and strands the backing copy once history has been pruned (KI-5). Activity delivery is **startup-drain only** and `break`s on first failure (KI-20). Its own `docs/` package is the worst-drifted in the tree |

Templates imports no capability. Its single cross-capability import is
`import type { ContextEntry } from "#context"` — a type-only import of the `{id, kind}` atom, with
no Context port, read or write (`domain/model.ts:1-10`).

---

## 2 · Domain model

From [`domain/model.ts`](../../../apps/backend/src/3-capabilities/templates/domain/model.ts)
(224 lines).

### 2.1 `TemplateRecord`

```ts
interface TemplateRecord {
  readonly id: string;                          // allocated by Templates, never by a caller
  readonly kind: string;
  readonly resourceId: string;                  // allocated by the OWNING capability
  readonly name: string;                        // catalog label, unique per kind (case-insensitive)
  readonly description?: string;
  readonly contextBindings: TemplateContextBindings;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}
```

**There is no `state` column.** Every row in the catalog is a live, usable template; deletion
removes the row. `resourceId !== id` always — the old `CHECK (resource_id = id)` was removed in
`18ab0e8`. `persistence/sqliteSchema.ts:47-50`, verbatim:

> One template per backing resource. No CHECK tying resource_id to id: the
> capability that stores a resource allocates its ID, so Templates names the
> catalog row and the owning capability names the resource.

On `name` (`model.ts:21-26`), verbatim:

> Catalog label, unique per kind. The only thing `template.update` renames:
> the backing resource is sealed and its title is unreachable, so the catalog
> cannot borrow it.

`TemplateResourceRef { kind, resourceId }` (`model.ts:41-49`) is a **result shape only** —
*"registration names its source with flat `kind` + `resourceId`, and instantiation names no
destination at all."*

### 2.2 Context bindings — the parameter list

```ts
interface TemplateContextBinding {
  readonly target?: ContextEntry;   // omitted means "explicitly unbind"
  readonly description?: string;    // declaration only, registration-time only
}
type TemplateContextBindings = Readonly<Record<string, TemplateContextBinding>>;
```

Keys are Context Variable **names**, not IDs — which is exactly why Document normalises variable
names case-insensitively. `model.ts:29-35`, verbatim:

> The template's declared parameters. A template is a resource as a function
> of its Context Variables, and this is that function's parameter list — part
> of the record's identity, not a cache of resource state. The backing
> resource separately holds each variable's applied target.

And `model.ts:51-63`:

> What this parameter points at. Omitted means "explicitly unbind", not "leave
> alone" — a binding key absent from the record inherits the source's target
> instead.
> …
> Declaration only, and meaningful only at registration. The record is the one
> place it can live: the backing resource has no field for it.

The three-row override rule, implemented by the owning kind
(`document/application/documentService.ts:602-715`):

| Binding for a variable | Effect on the resource |
| --- | --- |
| key absent from the record | keeps whatever it currently holds |
| key present with `target` | that target becomes its target |
| key present, `target` omitted | explicitly unbound |

### 2.3 Command and query unions

`TemplateCommand` has five arms (`model.ts:88-150`), `TemplateCommandResult` five
(`model.ts:154-163`), `TemplateQuery` three (`model.ts:185-192`) and `TemplateQueryResult` three
(`model.ts:194-208`). All are enumerated with their fields in §3.

`TemplateTransactionKind` has **three** values — `template.registered`, `template.updated`,
`template.deleted` (`model.ts:211-214`). Instantiation and purge write no Activity transaction.

`TemplateOrigin` is the four-value vocabulary `user | agent | automation | system`, supplied by the
caller on the command envelope.

### 2.4 The `TemplatableResource` port — nine members

[`ports/templatableResource.ts`](../../../apps/backend/src/3-capabilities/templates/ports/templatableResource.ts)
(127 lines). This is the whole of what a resource capability must provide.

| Member | Templates supplies | Returns | Notes |
| --- | --- | --- | --- |
| `kind` (property) | — | `string` | The registry key. `:31-36` notes a kind may be compound — *"`slides::deck` and `slides::slide` are two kinds satisfied by one runtime, following Connector's `connector::file::text` convention"* — and nothing compound exists today |
| `duplicate({sourceResourceId, name?, idempotencyKey})` | source id, optional name, key | `{resourceId}` — **the ID the resource allocated** | *"A pure copy: new ID, same content. It knows nothing about templates and applies no bindings"* (`:38-43`) |
| `markAsTemplate({resourceId})` | the copy's id | `void` | *"Seals the resource: private, unreachable through its own endpoints. One-way."* (`:58`) |
| `applyBindings({resourceId, contextBindings, idempotencyKey})` | Templates' own binding vocabulary | `void` | Typed, not folded into `submit` — see §7 |
| `submit({resourceId, operations, idempotencyKey})` | caller-authored `unknown` | `void` | The operations are **not decoded by Templates**; see §8 |
| `load({resourceId})` | the copy's id | `unknown` | The only route to sealed content |
| `logicalDelete({resourceId, idempotencyKey})` | the copy's id, key | `void` | Broken for Document — KI-1 |
| `purge({resourceId, idempotencyKey})` | the copy's id, key | `void` | |
| `listSealedResources()` | — | `Array<{resourceId, sealedAt}>` | Added by `eebc1d6`. Its only caller is `collectOrphanedResources` |

`TemplatableResourceRegistry` (`:119-127`) has **two** methods, `get(kind)` and `kinds()`. On
`kinds()`:

> Every registered kind. Needed only by the orphan sweep, which has to ask each
> kind what it has sealed — there is no other way to enumerate resources
> Templates may have lost track of.

The module's own `types.md:191-194` says the registry "exposes only `get(kind)`". That is false.

### 2.5 Error classes — 9

[`domain/errors.ts`](../../../apps/backend/src/3-capabilities/templates/domain/errors.ts)
(98 lines): `TemplateWireError`, `TemplateNotFoundError`, `TemplateAlreadyExistsError`,
`TemplateUnsupportedKindError`, `TemplateNameConflictError`, `TemplateBindingMismatchError`,
`StaleTemplateRevisionError`, `InvalidTemplateCursorError`, `TemplateIdempotencyMismatchError`.

Every one of the nine has a branch in the HTTP error ladder (§4), so no Templates error reaches a
client as a 500. An error thrown by the *resource* is a different matter: the ladder knows only
these nine plus the two shared retention errors, so anything a `TemplatableResource` throws lands
in the fall-through 500 — which is exactly what KI-1 produces.

`TemplateBindingMismatchError` carries `missing` and `unexpected` as arrays (`errors.ts:44-71`),
and the reason both directions are rejected is stated there:

> Missing keys are rejected because a partial instantiation would produce a
> resource with an unbound variable — a prompt grounded on nothing, which fails
> later and further from the cause. Unexpected keys are rejected for the
> converse reason: a variable the template did not declare is not a parameter,
> it is baked-in content, and binding it would edit the instance rather than
> configure it.

---

## 3 · Commands and queries

### 3.1 The command envelope

Exactly `{requestId, origin, command}` (`wire/commandSchemas.ts:141-153`). `origin` is validated
against the four values and is **excluded from the command digest** — the digest is taken over
`command` alone (`templateService.ts:127`), so an exact retry from a different origin replays
instead of conflicting.

Allowed keys per command are a table keyed by type (`commandSchemas.ts:26-47`):

> Keyed by command type so the decoder and the union cannot drift. Note
> `template.register` has no `templateId`: Templates allocates it. A client that
> sends one gets a 400 from exactKeys rather than silent acceptance.

### 3.2 The five commands

| Command | Required | Optional | Result | HTTP |
| --- | --- | --- | --- | ---: |
| `template.register` | `kind`, `resourceId`, `name`, `contextBindings` (normalised to `{}` when absent) | `description` | `template.registered { template }` | **201** |
| `template.update` | `templateId`, `expectedRevision` | `name`, `description`, `contextBindings`, `resourceOperations` | `template.updated { template }` | 200 |
| `template.instantiate` | `templateId`, `contextBindings` (each argument **must** carry `target`) | `name` (the instance's) | `template.instantiated { template, resource: {kind, resourceId} }` | 200 |
| `template.delete` | `templateId` | — | `template.deleted { templateId, revision }` | 200 in the design; **409 `revision_conflict` in the running system, always** — see §8 KI-1 |
| `template.purge` | `templateId` | — | `template.purged { templateId }` | 200 |

**register** (`templateService.ts:289-369`) runs, in order: `requireResource(kind)` → `nameTaken`
→ `duplicate` → `markAsTemplate` → `applyBindings` (skipped when the binding record is empty) →
allocate `templateId` → `store.create`, which writes the row, its receipt and its Activity
transaction in one SQLite transaction. Registration **never** passes a `name` to `duplicate`: the
backing copy inherits the source's title and is sealed with it.

**update** (`:380-480`) is the only path that changes a registered template: load → revision CAS
pre-check → name-conflict pre-check → `applyBindings` if supplied → `submit` if supplied →
`store.update`. Field semantics are wholesale replacement, never a patch.

**instantiate** (`:488-544`): load → require resource → `assertBindingsMatchDeclaration` →
`duplicate` (with the optional instance name) → `applyBindings`. **No `markAsTemplate`, no catalog
row** — *"the instance belongs entirely to its owning capability, and Templates keeps no instance
list"* (`:537-538`).

**delete** (`remove`, `:546-581`): `resource.logicalDelete` then `store.delete`, which archives a
snapshot at the current revision, writes a `deleted` record at `revision + 1`, writes the receipt
and the transaction, and removes the live row — all atomically. The result revision is
`template.revision + 1`.

**purge** (`:583-604`): read `latestSnapshot`, call `resource.purge`, then `store.purge`. It writes
**no** Activity transaction, because `template.purged` is not a `TemplateTransactionKind`. Its
receipt comes from the service's generic post-command path. It carries a defect — §8.

### 3.3 Binding rules at instantiation

`assertBindingsMatchDeclaration` (`templateService.ts:79-101`) requires an **exact** match against
the declaration: every declared key supplied, and nothing else. `:69-78`, verbatim:

> A template is a resource as a function of its declared parameters, so an
> instantiation is a call to that function: every parameter is supplied, and
> nothing else is.
>
> A declared `target` is the default the *template* was built with, not a
> fallback for an omitted argument. Instantiation never falls back to it, which
> is what makes "no instance holds an unbound variable" true by construction
> rather than by hoping the declaration had defaults.

The two decoders are deliberately asymmetric (`wire/valueSchemas.ts:117-152`):

| Decoder | Accepts | Used at |
| --- | --- | --- |
| `decodeDeclaredBinding` | `["target","description"]`, **both optional** | registration and update |
| `decodeBindingArgument` | `["target"]` only, and `target` is **required** | instantiation |

`:133-144`, verbatim:

> Instantiation: supplies an argument, not a declaration. Two differences from
> the declared form, both deliberate.
>
> A `description` is rejected rather than ignored — silently dropping an
> accepted field is the class of bug this split exists to remove.
>
> A `target` is **required**. At registration an omitted target declares a
> parameter with no default; here it would leave the instance holding an unbound
> variable, which is the state the whole binding rule exists to prevent. An
> instantiator names every parameter and says what each one points at.

`decodeTarget` (`:107-115`): *"An omitted `target` is meaningful: it says 'explicitly unbind'. So
`{}` is a valid binding and must not be rejected as empty."* An absent `contextBindings` normalises
to `{}` (`:179-186`) so nothing downstream branches on `undefined`, and the DB column is `NOT NULL`
for the same reason.

### 3.4 The three queries

Envelope is exactly `{query}` (`wire/querySchemas.ts:86-90`).

| Query | Fields | Result | Touches the resource? |
| --- | --- | --- | --- |
| `template.get` | `templateId` | `template.record { template }` | **no** |
| `template.list` | `kinds?`, `search?`, `limit?`, `cursor?` | `template.records { templates, nextCursor? }` | **no** |
| `template.load` | `templateId` | `template.content { template, content: unknown }` | yes — `resource.load` |

`template.load` exists because registration seals the owning capability's own read surface
(`templateService.ts:191-194`):

> Deliberately not folded into template.get: a catalog listing is a single store
> read and must not pay for a round trip to the resource. This query exists
> because registration seals the owning capability's own read surface, leaving
> Templates as the only way to the content.

Listing rules:

| Rule | Detail |
| --- | --- |
| `kinds` | Any-of. An explicit `[]` returns `{items: []}` immediately (`sqliteTemplateStore.ts:117-124`) — *"a caller that filtered everything out should see nothing, not the whole catalog"* |
| `search` | `LIKE … ESCAPE '\' COLLATE NOCASE` over `name` and `description`, escaped through the shared `#utils/persistence/likePattern.js` — *"without ESCAPE a search for '50%' or 'a_b' would silently become a wildcard and match far too much"* |
| whitespace-only `search` | Dropped at the wire (`querySchemas.ts:65-69`) — *"a search of only whitespace is a search for nothing and should list everything rather than nothing"* |
| pagination | Keyset over `(created_at, id)` ascending, `LIMIT pageSize + 1`. Default page 50, max 200 |
| cursor | base64url JSON tagged `kind: "template-catalog"` — *"The `kind` tag is what makes a cursor from another capability's listing fail loudly here instead of decoding into a plausible-looking position."* |

### 3.5 Idempotency keys

Seven shapes are minted (`templateService.ts:66-67`, `:653`, `:700`):

```text
templates:register:<requestId>
templates:update:<requestId>
templates:instantiate:<requestId>
templates:delete:<requestId>
templates:purge:<requestId>
templates:retention-purge:<templateId>
templates:orphan-purge:<resourceId>
```

`templateService.ts:55-65`, verbatim:

> Deterministic per request, so a retry presents the resource the same key and
> replays its own completed attempt rather than performing a second one. This is
> the whole of the idempotency story on the far side of the boundary: nothing is
> claimed or frozen here, so the key has to carry it.
>
> One key per command, shared by every call the command makes. A command's calls
> are steps in one procedure, not independent operations, so they replay together
> or not at all — and a resource that keys `duplicate` off its own create receipt
> gets the same key on the retry that produced the copy.

### 3.6 Wire limits

`TEMPLATE_WIRE_LIMITS` (`wire/valueSchemas.ts:8-19`): `maxIdentifierBytes` 512 · `maxNameBytes` 512
· `maxDescriptionBytes` 4,096 · `maxBindings` 256 · `maxBindingNameBytes` 512 · `maxSearchBytes`
512 · `maxCursorBytes` 1,024 · `maxKinds` 64 — *"Filtering by more kinds than exist is a malformed
request, not a broad one."* — · `maxPageLimit` 200.

Three decoder rules with their reasons:

- `requireName` (`:74-78`): *"Trimmed at ingress so trailing whitespace cannot produce two catalog
  entries that read identically. The command digest is taken over the decoded value, so it sees the
  trimmed form and an exact retry still replays."*
- `requireIdentifierList` (`:193-197`): *"Duplicates are rejected rather than de-duplicated, on the
  same principle as `exactKeys`: a request that asks for the same kind twice means something the
  caller did not intend, and silently tidying it hides that."*
- `requireRevision` (`:238-241`): *"Strict rather than `Number(...)`: an absent field would
  otherwise coerce to NaN and fail a revision comparison as a misleading conflict instead of a
  400."* It accepts any non-negative safe integer, so `expectedRevision: 0` decodes cleanly and
  simply never matches a live record.

---

## 4 · Endpoints

Registered in
[`4-job-wiring/templates/registerTemplateEndpoints.ts`](../../../apps/backend/src/4-job-wiring/templates/registerTemplateEndpoints.ts)
(135 lines), which logs `templates.endpoints.registered {count: 2, endpoints: [...]}`.

| Method + path | Job name | Queue | Response mode | What it does |
| --- | --- | --- | --- | --- |
| `POST /templates/command` | `templates.command.v1` | **serial** | inline | `decodeTemplateCommand` then `templates.command(request)` |
| `POST /templates/query` | `templates.query.v1` | **concurrent** | inline | `decodeTemplateQuery` then `templates.query(request)` |

The serial choice is justified in the wiring file itself (`:88-95`), verbatim:

> Serial: this endpoint mutates, and the service reads-then-writes across several
> store calls that no single statement can make atomic. Claim-then-execute has
> the same shape: two concurrent retries of one requestId would both see a
> pending claim and both drive the adapter.
>
> This is the same reason Document commands are serial, and it is what the house
> rule means by serialising where the store cannot enforce the invariant on its
> own.

That comment still says "claim", vocabulary from before the receipts rewrite; the mechanism is now
a receipt, and the reasoning is unaffected.

**Success status**: 201 for `template.registered`, 200 otherwise (`:68-69`).

**Error ladder** (`:23-66`), in evaluation order:

| Error | Status | Body `error` |
| --- | ---: | --- |
| `ResourceNotDeletedError` | 409 | `not_deleted` |
| `ResourceHistoryNotFoundError` | 404 | `not_found` |
| `TemplateNotFoundError` | 404 | `not_found` |
| `TemplateAlreadyExistsError` | 409 | `already_exists` |
| `TemplateNameConflictError` | 409 | `name_conflict` |
| `StaleTemplateRevisionError` | 409 | `revision_conflict` |
| `TemplateIdempotencyMismatchError` | 409 | `idempotency_mismatch` |
| `TemplateBindingMismatchError` | 400 | `binding_mismatch`, plus `missing[]` and `unexpected[]` |
| `TemplateUnsupportedKindError` | 400 | `unsupported_kind` |
| `InvalidTemplateCursorError` | 400 | `invalid_cursor` |
| `TemplateWireError` | 400 | `validation_error` |
| anything else | **500** | `internal_error`, fixed message `"Template operation failed"` |

Only responses ≥ 500 are error-logged (`:105-108`, `:122-125`). A 4xx is logged at warn as
`templates.command.failed` from the service, not from the wiring.

---

## 5 · Persistence

DB file `./data/templates.db`. Prefix `tpl_` plus the first 16 hex characters of
`sha256(projectId)` (`persistence/sqliteSchema.ts:12-23`). For `projectId = "demo-project"` the
four tables are `tpl_c333b9667097f729_{templates, command_receipts, transaction_outbox, history}`.
Pragmas at init (`:29-32`): `journal_mode = WAL`, `foreign_keys = ON`, `busy_timeout = 5000`,
`synchronous = NORMAL`.

### 5.1 `<prefix>_templates` — the catalog, live rows only

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT PRIMARY KEY | Allocated by Templates (`randomUUID` by default) |
| `kind` | TEXT NOT NULL | The registry key |
| `resource_id` | TEXT NOT NULL | The owning capability's ID |
| `name` | TEXT NOT NULL | |
| `description` | TEXT | Nullable |
| `context_bindings_json` | BLOB NOT NULL | Canonical JSON of the declared parameters |
| `revision` | INTEGER NOT NULL `CHECK (revision >= 1)` | |
| `created_at`, `updated_at` | TEXT NOT NULL | ISO-8601 |
| — | `UNIQUE (kind, resource_id)` | One template per backing resource |

Two indexes:

- `<prefix>_templates_catalog` on `(kind, created_at, id)` — *"Every row is a live, usable
  template; there is no state to filter on."*
- `<prefix>_templates_name_nocase`, **UNIQUE**, on `(kind, name COLLATE NOCASE)` — *"Per kind, so a
  Document and a Spreadsheet template may share a name. No partial predicate: deletion removes the
  live row rather than flagging it, so a name is freed by construction rather than by a
  predicate."*

### 5.2 `<prefix>_command_receipts` — idempotency without reservation

`request_id TEXT PRIMARY KEY`, `request_digest TEXT NOT NULL`, `command_type TEXT NOT NULL`,
`result_json BLOB NOT NULL`, `created_at TEXT NOT NULL`. Schema comment (`:63-65`):

> Idempotency without reservation: a completed command records what it returned,
> and an exact retry replays it. Nothing is claimed ahead of the work, so there
> is no pending state and no identity to freeze.

### 5.3 `<prefix>_transaction_outbox` — the Activity source outbox

`source_transaction_id TEXT PRIMARY KEY`, `transaction_kind TEXT NOT NULL CHECK (IN
('template.registered','template.updated','template.deleted'))`, `template_id`, `resource_kind`,
`resource_id`, nullable `actor_id`, `origin TEXT NOT NULL CHECK (IN
('user','agent','automation','system'))`, `occurred_at`, nullable `published_at`. Partial index
`<prefix>_transaction_outbox_unpublished` on `(occurred_at, source_transaction_id) WHERE
published_at IS NULL`. Schema comment (`:74-75`): *"No foreign key to current templates: accepted
source transactions remain publishable after logical deletion."*

Source transaction IDs are **derived**, not random (`templateService.ts:616-621`):

> The source transaction ID is derived from the request rather than freshly
> generated, so it is stable across retries. Paired with the outbox's
> INSERT OR IGNORE, a request yields at most one source transaction per kind even
> if the command is re-run.

Format `` `${requestId}:${kind.slice("template.".length)}` `` — e.g. `req-1:registered`.

### 5.4 `<prefix>_history` — the shared generic history table

Created by `initializeResourceHistorySchema`
([`0-utils/persistence/resourceHistory.ts:43-65`](../../../apps/backend/src/0-utils/persistence/resourceHistory.ts)):
`(resource_kind, resource_id, revision, record_type, snapshot_json, recorded_at)`, primary key
`(resource_kind, resource_id, revision)`, `record_type ∈ {snapshot, deleted}` with a CHECK that a
snapshot carries JSON and a deletion does not, plus an index on `(recorded_at, resource_kind,
resource_id)`. Templates writes `resource_kind = 'template'`.

### 5.5 The revision model, spelled out

| Transition | What is written |
| --- | --- |
| `template.register` | A catalog row at `revision: 1`, its receipt, and its outbox transaction — in **one** SQLite transaction |
| `template.update` | The record it replaces is archived as a `snapshot` **at the revision it held**, then the replacement is written at `revision + 1`, CAS-guarded on `expectedRevision` (`sqliteTemplateStore.ts:244-284`) |
| `template.delete` | The current record is archived as a `snapshot` at its revision, a `deleted` record is written at `revision + 1`, and the live row is DELETEd (`:286-311`) — so the chain is contiguous and the name is freed immediately. **None of this runs today:** the resource-side `logicalDelete` throws first, before the store is reached (§8, KI-1) |
| `template.purge` | Refused while a live row exists (`ResourceNotDeletedError`) and refused when there is no terminal history (`ResourceHistoryNotFoundError`); otherwise all history for that ID is removed (`:322-327`) |

The archive-on-update rule carries its own justification (`sqliteTemplateStore.ts:254-256`):

> Archive what is being replaced, at the revision it held. Without this an update
> would be the one revision transition leaving no history, and latestSnapshot()
> would report pre-update state as current.

`latestSnapshot(id)` (`:313-320`) returns the last `snapshot` record in the chain. It is how purge
and retention recover `resourceId` after the live row is gone — and it is where the purge defect in
§8 lives.

### 5.6 Store atomicity contracts

`TemplateStore` is **synchronous** ([`ports/templateStore.ts:55-61`](../../../apps/backend/src/3-capabilities/templates/ports/templateStore.ts)):
*"Durable project-local storage owned by Templates. Synchronous because SQLite is synchronous and
Templates has no non-SQLite future to keep open."* Templates is the only capability in the backend
whose store port is not `Promise`-returning.

`create` (`ports/templateStore.ts:75-85`), verbatim:

> Writes the catalog row, its receipt, and its Activity transaction in one SQLite
> transaction. False when the id or the (kind, resourceId) pair is taken; nothing
> is written.
>
> The three are inseparable. A row committed without its receipt would make a
> retry re-run the whole command and then collide with the name it wrote itself a
> moment earlier — a conflict reported against the caller for the store's own
> half-finished write.

`claimedResourceIds` (`:86-92`), verbatim:

> Every backing resource ID this catalog currently claims, for one kind.
> Includes history, because a logically-deleted template still owns its copy
> until purge — treating one as an orphan would delete a resource the catalog is
> still keeping for retention.

Both `insertReceipt` and `insertTransaction` are `INSERT OR IGNORE` (`sqliteTemplateStore.ts:368-374`,
`:391-395`), because a command that committed its receipt inside its own transaction is written
again by the service's generic path and the second write must be a no-op rather than a primary-key
violation. First write wins — *"which is also the right answer for a divergent reuse — the
committed result is the authoritative one."*

---

## 6 · Invariants

| Invariant | Enforced at |
| --- | --- |
| Templates allocates the Template ID; a caller supplying one gets a 400 | `wire/commandSchemas.ts:26-47` (`exactKeys` per command type) |
| The owning capability allocates the resource ID | `TemplatableResource.duplicate` returns `{resourceId}`; `ports/templatableResource.ts:19-22` |
| Catalog names are unique per kind, case-insensitively | UNIQUE index `(kind, name COLLATE NOCASE)`, plus a pre-check before the first external call (`templateService.ts:289-369`) |
| Both refusals — unsupported kind and name conflict — precede the first external call | `templateService.ts:278-288`, so a rejected registration never leaves a backing copy behind |
| One template per backing resource | `UNIQUE (kind, resource_id)` |
| An instantiation supplies exactly the declared parameters | `assertBindingsMatchDeclaration`, `templateService.ts:79-101` |
| Every instantiation argument carries a `target` | `decodeBindingArgument`, `wire/valueSchemas.ts:133-152` |
| Registration seals the copy; the owning capability refuses its whole public surface for it | Document's `assertNotSealed`, `document/application/documentService.ts:402-419` |
| Only `template.update` advances a live record, under CAS | `sqliteTemplateStore.ts:244-284`; a lost CAS raises `StaleTemplateRevisionError` |
| The revision chain is contiguous through deletion | `store.delete` archives at `revision`, tombstones at `revision + 1` (`:286-311`) |
| An exact retry replays; a request ID reused with different content is a mismatch | `templateService.ts:115-176`, digest **and** command type compared |
| A retry crosses the capability boundary with the same idempotency key | `resourceKey(commandType, requestId)`, `templateService.ts:66-67` |
| At most one outbox row per request per kind | Derived `sourceTransactionId` + `INSERT OR IGNORE` |
| An accepted command is never rolled back by an Activity delivery failure | `templateService.ts:235-256`; the row stays pending |

Digest canonicalisation is `domain/canonical.ts:4-7`: *"Sorted keys with `undefined` dropped, so a
retry whose JSON happens to order fields differently replays instead of failing as an idempotency
mismatch."* Names are trimmed **before** digesting (`wire/valueSchemas.ts:74-78`).

**Templates has no configuration section.** `grep -n -i "template" src/0-utils/config/loadBackendConfig.ts`
returns nothing; all limits are the module-level `TEMPLATE_WIRE_LIMITS` constant. A negative test
(`templates.test.ts:2164-2176`) writes `templates:\n  maxTemplatesPerProject: 1` into a config file
and asserts `"templates" in config === false`, pinning the loader's silent-ignore behaviour for
unknown sections.

---

## 7 · Design decisions worth preserving

### The inverted seam

`18ab0e8` ("feat(templates,document): invert the Templates seam and make Documents templatable",
2026-08-02) states the change in one line:

> Templates used to expect a hand-written translation adapter per resource kind,
> supply the destination ID, and get nothing back. It now receives the resource
> capability's own runtime object and drives it. Document satisfies that port
> structurally, so a Document can finally be registered as a template.

The port's own header (`ports/templatableResource.ts:3-29`) is the single most load-bearing comment
in the capability, verbatim:

> What a resource capability must be able to do for Templates to make templates
> out of it. Not an adapter: there is no object implementing this by hand in
> `1-init`. The resource capability's own runtime satisfies it **structurally**,
> and composition is one line —
>
> ```ts
> templateResources.register(document);
> ```
>
> The interface exists so that line typechecks. Without it the registry would be
> `Record<string, any>` and a missing or renamed method would surface at runtime
> as "undefined is not a function" inside a serial job. Typing the registry as
> `DocumentCapability` is the other alternative and fails twice over: Templates
> would import a capability, and the registry could never hold a second kind.
>
> Same pattern as `ContextManager` satisfying `PersonaContextPort`.
>
> **Templates supplies no identifiers it does not own.** The capability that
> stores a resource allocates its ID, so `duplicate` returns the ID it chose and
> every other method is addressed by that ID rather than by a Template ID.
>
> **Registration seals the resource.** The owning capability must refuse its
> whole public surface for a resource in template mode, reads included. These
> methods are how Templates reaches past that refusal, so an implementation is
> expected to use its own internal path rather than the public one.

### Which side decides what

The clearest statement of the division of authority is on the Document side, at
`document/application/documentService.ts:421-424`, verbatim:

> Templates runtime
>
> Document does not know what a template is for. It knows how to copy itself,
> how to go private, and how to bind its own variables. Templates decides when.

Document declares its own copy of the port shape as `DocumentTemplateRuntime`
(`documentService.ts:102-124`) rather than importing Templates, and
`DocumentCapability extends DocumentTemplateRuntime` (`:126`). Its header (`:90-101`) is quoted in
full on [document.md](document.md).

Composition is three lines in `startBackend.ts:113-120`:

```ts
// Templates is constructed after the resource capabilities so their runtime
// objects can be registered into it without a constructor cycle.
const templateResources = createTemplateResourceRegistry();
// One line, no adapter: DocumentCapability satisfies TemplatableResource
// structurally. This is the only place that sees both, which is what keeps
// Templates and Document from importing each other.
templateResources.register(document);
const templates = createTemplatesInstance(config, templateResources, activity, logger);
```

`1-init/create/templates.ts:16-23` says the same thing from the registry's side: *"Mutable only
during composition. Templates receives it through the narrow read-only
`TemplatableResourceRegistry` interface. `register` takes a capability's runtime object directly —
there is no adapter to write."*

### Why bindings cross typed and operations cross as `unknown`

`ports/templatableResource.ts:61-71`, verbatim:

> Typed rather than folded into `submit` because only the owning kind knows what
> a variable operation looks like, and Templates holds these in its own decoded
> vocabulary. Handing them over unchanged is a pass-through; turning them into
> operations would be a translation Templates cannot make.

### Why registration owns the whole procedure

`templateService.ts:278-288`, verbatim:

> Templates owns the whole procedure: copy, seal, bind, then record. The resource
> is driven, not asked — it neither knows nor decides that it is becoming a
> template.
>
> Both refusals — unsupported kind and name conflict — precede the first external
> call, so a rejected registration never leaves a backing copy behind. That
> ordering is the reason the name is checked here rather than being left to the
> unique index, which cannot report until the row is written and the row is now
> written last.

`:311-313`: *"The resource names its own row. Templates names the catalog entry, below, and only
after the copy exists — so there is no identity to freeze across the call and nothing to release
when it fails."*

### Why update is one command and not two

`templateService.ts:371-379`, verbatim:

> The only path that changes a registered template. Both halves run in one
> command: the backing content through the resource, the declaration in the
> catalog. Two writable statements about one template would otherwise drift.
>
> Resource first, catalog second — the same ordering as register. A failure
> before the local commit leaves the catalog untouched and no receipt behind, so
> the retry is the same command against the same state.

`:403-406`: *"Two calls rather than one, because they are two different statements: the declaration
says which variables are parameters, the operations say what the content is. Bindings first, so a
content edit that references a freshly bound variable sees it."*
`:427-428`: *"Wholesale replacement, never a patch: an omitted field means 'leave alone', and a
supplied one replaces its predecessor entirely."*

### Why instantiation is register minus one call

`templateService.ts:482-487`, verbatim:

> The mirror of register, one call shorter: copy and bind, but no
> `markAsTemplate`. An instance is an ordinary resource of its kind, and the only
> difference between the two procedures is that one seals and the other does not.

### Receipts instead of claims

`ports/templateStore.ts:14-30`, verbatim:

> What a completed command returned. An exact retry replays it; a request ID
> reused with different content is a mismatch.
>
> Nothing is written here ahead of the work. That is the whole difference from
> the claim this replaced: a claim had to exist *before* the external call so it
> could carry a frozen identity across it, which meant a pending state, a promote
> step, and a release step. A receipt records what happened, so it only ever
> exists after it has.

And the trade this shape makes, stated explicitly (`templateService.ts:115-176`):

> Receipt lookup, then work, then receipt. Nothing is written before the work
> runs, so a command that fails leaves no trace to reconcile — the retry is simply
> the command again.
>
> A failed attempt therefore starts over rather than resuming, and that is the
> trade this shape makes. What makes it safe is that every external call is keyed
> by the request: the resource replays its own completed attempt, so "start over"
> reaches the same place without doing the work twice.

### Why `listSealedResources` does not break "`template.list` is the only listing"

`ports/templatableResource.ts:100-116`, verbatim:

> Every resource this kind has sealed, with when it was sealed.
>
> **This is not a template listing**, and the distinction is the whole reason it
> is allowed to exist. `template.list` remains the only way anyone asks "what
> templates are there" — this answers "which of your rows did I tell you to seal",
> which only Templates can even ask, and only so it can compare that against its
> own catalog.
>
> It exists for exactly one caller: `collectOrphanedResources`. Registration
> writes the catalog row *after* sealing the copy, so a crash in between leaves a
> sealed resource no catalog row points at — unreachable by any query, because the
> owning capability refuses sealed resources and `template.list` only knows
> catalog rows. Diffing the two sides is the only way to see it.

### The orphan sweep, and why it has no timer of its own

The leak: registration seals the copy and *then* writes the catalog row. A crash in between leaves
a sealed resource that nothing points at — invisible to every query, because the owning capability
refuses sealed resources and `template.list` only knows catalog rows. `eebc1d6` (2026-08-02) closed
it. `templateService.ts:661-674`, verbatim:

> Finds backing resources this catalog does not claim, and removes them.
>
> The leak this closes: registration seals the copy and *then* writes the catalog
> row, so a crash in between leaves a sealed resource nothing points at. It is not
> merely hidden — the owning capability refuses sealed resources and
> `template.list` only knows catalog rows — so a diff of the two sides is the only
> thing that can see it.
>
> **Conservative on purpose.** Only resources sealed before `cutoff` are
> considered, because a registration in flight *right now* has a sealed copy and
> no catalog row yet, and that is the healthy case rather than the leak. The
> grace period is what tells them apart.

The algorithm, per registered kind (`collectOrphanedResources`, `:675-720`):

1. `claimed = store.claimedResourceIds(kind)` — live catalog rows **plus** every history snapshot
   of that kind.
2. `sealed = await resource.listSealedResources()`.
3. `orphans = sealed.filter(e => e.sealedAt < cutoff && !claimed.has(e.resourceId))`.
4. If there are any, log `templates.orphans.found` at **warn** with
   `{kind, sealed, claimed, orphans, cutoff, resourceIds}`.
5. Purge each with key `templates:orphan-purge:<resourceId>`, **each in its own `try/catch`** —
   *"One failure must not stop the sweep: the rest of the orphans are independent, and a permanent
   failure on one would otherwise wedge collection forever."* Failures log
   `templates.orphan.purge-failed` at **error**; successes log `templates.orphan.purged` at info.
6. Return the number reaped.

**The sweep owns no timer.** It is bound into the shared `ResourceRetentionScheduler` as a
*second, separate port*, `startBackend.ts:128-137`, verbatim:

```ts
bindResourceRetentionPort("templates", templates),
// Rides the retention sweep rather than owning a timer: it is the same
// shape of work — conservative, cutoff-driven, reaping what nothing
// references — and a second scheduler would be a second thing to
// configure, observe, and shut down. The retention cutoff doubles as the
// grace period that tells an orphan from a registration in flight.
bindResourceRetentionPort("templates-orphans", {
  pruneHistory: () => 0,
  purgeExpired: (cutoff) => templates.collectOrphanedResources(cutoff)
}),
```

**The retention cutoff is the grace period.** It is computed once per sweep as
`now − revisionRetentionDays × 24h` (`0-utils/persistence/resourceRetentionScheduler.ts:98-100`).
With the shipped defaults — `revisionRetentionDays: 30`, `sweepIntervalHours: 24`
(`loadBackendConfig.ts:254-256`) — **a registration must have been crashed mid-flight for 30 days
before its sealed copy is reaped.** The scheduler runs one sweep immediately after the HTTP
listener binds, then repeats on an `unref()`ed interval. There is no separate grace-period setting;
changing the retention window changes the orphan grace period with it.

The four subtests of `templates.test.ts` test 16 are the contract in four sentences: *an orphan
past the grace period is purged* / *a registration in flight is not an orphan* / *a
deleted-but-unpurged template still owns its copy* / *one failing purge does not stop the sweep*.

### On logging both IDs, always

`templateService.ts:357-360`, verbatim:

> Both IDs, always. They are different by rule now, and a log line carrying only
> one is unusable for tracing a template to its backing resource or back.

`:526-528`, on instantiation: *"Three IDs, and they are all different things: the catalog row, the
sealed template it copied, and the instance the caller now owns."*
`:90-92`, on a binding mismatch: *"The names, not just the counts. Whoever is debugging a rejected
instantiation needs to know *which* parameter, and the error carries the same lists so the log and
the response agree."*

---

## 8 · Known gaps and defects

### KI-1 — deleting a Document-backed template throws

`templateService.ts:555` calls `resource.logicalDelete(...)` and does not catch.
`DocumentTemplateRuntime.logicalDelete` (`document/application/documentService.ts:777-787`) builds
a `document.delete` command with **no `expectedRevision`** and casts the envelope, and Document's
`deleteDocument` compares `head.revision !== expectedRevision` against `undefined` at `:910`,
which is true for every live document. So `template.delete` throws a `RevisionConflictError`
before the catalog row is removed.

The status the client sees is **500 `internal_error`**, not a conflict: Document's
`RevisionConflictError` is not one of the nine errors `registerTemplateEndpoints.ts:7-21` imports,
so it falls off the end of the ladder into the fixed `"Template operation failed"` branch.

Document is the only kind registered into the Templates registry (`startBackend.ts:119`), so this
is every template. Nothing catches it in test: `templates.test.ts` uses a hand-written fake
`TemplatableResource` (`:163`), so Templates' own suite exercises a `logicalDelete` that works.

Tracked as **KI-1** in [11-known-issues.md](../11-known-issues.md); the Document side is in
[document.md](document.md).

### `template.purge` can 500 and strand a backing copy once history has been pruned

`templateService.ts:583-604`:

```ts
if (this.store.get(command.templateId)) this.store.purge(command.templateId);
const template = this.store.latestSnapshot(command.templateId);
if (!template) this.store.purge(command.templateId);
const retained = template as TemplateRecord;
```

Both guarded calls rely on `store.purge` **throwing**. With a live row it throws
`ResourceNotDeletedError` (409); with no history at all it throws `ResourceHistoryNotFoundError`
(404). But `pruneHistoryBefore` (`0-utils/persistence/resourceHistory.ts:192-204`) deletes every
history row older than the cutoff **except the terminal `deleted` tombstone** — so a deleted
template can end up holding a tombstone and no snapshot. In that state `purgeResourceHistory`
succeeds, because the latest record *is* a deletion, nothing throws, `template` is `undefined`, and
`retained.kind` raises a raw `TypeError`. The endpoint's fall-through maps it to
**500 `internal_error`**.

Verified by execution against a temporary SQLite database:

```text
pruneHistory removed rows: 1
latestSnapshot after prune: undefined
expiredDeleted after prune: [ 'f030e3fd-…' ]
purgeExpired count: 0
purge threw: TypeError - Cannot read properties of undefined (reading 'kind')
```

`purgeExpired` (`:646-659`) hits the same missing snapshot and does `continue`, so it **skips that
template forever**: its backing resource is never purged and its tombstone is never removed.

The state is reachable in production because `TemplateService.purgeExpired` has **no per-template
`try/catch`** — unlike `collectOrphanedResources`, which has one. Within a single sweep
`purgeExpired` runs before `pruneHistory`, so the healthy path purges first; but one throwing
`resource.purge` aborts the whole loop, the scheduler counts one failure and still runs
`pruneHistory` on the same cutoff, and that deletes the snapshots. From then on the affected
templates are permanently unpurgeable.

No test covers it. The subtest *"purge removes every history row, updates included"* exercises the
healthy path only. Comments does **not** have this problem: `SQLiteCommentStore.purge` only checks
that the latest history record is a deletion and never reads a snapshot.

### Only one kind is registered, and the compound-kind convention is unimplemented

`templateResources.register(document)` is the sole registration; `kinds()` returns `["document"]`.
Every other kind raises `TemplateUnsupportedKindError` → 400 `unsupported_kind`. The compound-kind
convention documented on `TemplatableResource.kind` (`slides::deck`, `slides::slide`) has no
implementation: `3-capabilities/slides/` exists at 15 files and 6,765 lines, is not constructed
anywhere, and satisfies no port (see [slides.md](slides.md)).

### The `submit` pass-through is not decoded on either side

`templates/wire/commandSchemas.ts:109-111` copies `resourceOperations` through verbatim, and
`domain/model.ts:114` types it `readonly resourceOperations?: unknown` — *"Content edits for the
backing resource, opaque here. Only the owning kind interprets them."* Document's `submit` is
commented *"the operations are the caller's, decoded by Templates' caller"* and checks only
`Array.isArray(operations) && operations.length > 0`. **Neither side runs a decoder**, so a
malformed operation reaches Document's reducer and throws a raw `TypeError`, which maps to 500
rather than 400. Detail and the reproduction are in [document.md](document.md) §8.

### Activity delivery is startup-drain-only, and the drain stops at the first failure

`publishPendingActivity()` is called once, from `startBackend.ts:194`, and there is no periodic
retry. Delivery is otherwise inline after commit; a failure logs
`templates.activity.publish-failed` at warn and leaves the row pending. The drain loop `break`s on
the first failure (`templateService.ts:252`), so one undeliverable row blocks every row behind it
until the next process start. Comments, whose outbox is otherwise the same design, **continues**
past a failure (`commentService.ts:208-210`).

The Activity module's own docs (`activity/docs/concepts.md:111-113`,
`activity/docs/invariants.md:98-102`) claim Templates "publishes post-commit and retries through
recovery". Post-commit is right; the retry is a single startup drain that stops early.

### `templates-wiring.test.ts` does not typecheck

`createTemplatesDouble` (`:23-34`) is annotated `: TemplateCapability` and omits the required
`collectOrphanedResources`; `tsc` reports `TS2741` if pointed at the file. It runs green because
`tsx` strips types and because `apps/backend/tsconfig.json` has `"include": ["src/**/*.ts"]` —
**the test tree is outside the typecheck project.** No test double in the repository is protected
from this class of drift.

### `SQLiteTemplateStore` has no `close()`

Six store classes in the backend expose one; `SQLiteTemplateStore` is not among them, and none of
the six is called outside tests. Shutdown (`startBackend.ts:220-227`) stops the sync timers, awaits
the retention sweep, closes Fastify, flushes the logger and exits with every database handle open.

### Nothing consumes Templates

`grep -rn '#templates' src` finds only `1-init/create/templates.ts` and the wiring file. No other
capability imports it, and the frontend does not call `/templates/*`
(`grep -rn "/templates/" apps/frontend/src` → no matches). Templates is reachable only over HTTP.

### Templates has no limits injection point

All limits are the module-level `TEMPLATE_WIRE_LIMITS` constant. There is no `TemplateOptions`
parameter and no configuration section, so page sizes, binding counts and byte bounds cannot be
tuned without editing source.

---

## 9 · Documentation drift, recorded

### The module's own `docs/` package is the worst-drifted in the tree

All six files under `3-capabilities/templates/docs/` were last written in **`18ab0e8`** — the very
commit that registered Document into the registry — and `eebc1d6` updated none of them even though
it added `listSealedResources`, `collectOrphanedResources`, the grace period, the
`templates-orphans` retention port and the whole content-logging pass. A later pass owns those
files; the contradictions are listed here so a reader of both is not misled.

| File | Claim | Reality |
| --- | --- | --- |
| `README.md:8-11` | *"**No resource runtime is registered yet.** `1-init/startBackend.ts` constructs the registry empty, so in the current tree every command that reaches a resource — and `template.load` — answers `400 unsupported_kind`."* | `startBackend.ts:119` registers Document; `kinds()` returns `["document"]`. The sentence was left untouched by the commit that registered it |
| `README.md:13-17` | *"**Nothing seals a backing copy yet.** … Document has no `isTemplate` flag, so nothing refuses anything today."* | `is_template` exists (`document/persistence/sqliteSchema.ts:66`) and `assertNotSealed` refuses every addressed public command and query |
| `README.md:19-26` | *"The first runtime will be Document, and it requires work that does not exist yet: Context Variables, `isTemplate` persistence, `duplicate`, `markAsTemplate`, and allowing a Prompt Block to hold `appliedRevision: 0`."* | **All five landed in `18ab0e8`.** The same file then says *"A green Templates test run … does not mean a user can create a template"* — it does |
| `concepts.md:176-181` | *"Half implemented, and the missing half is the enforcement. … **No resource capability refuses anything yet**"* | A `document.submit` against a sealed copy raises `DocumentTemplateModeError` and logs `document.template-mode.refused` at warn |
| `invariants.md:146-161` | Three "current non-guarantees" repeating the same framing | All three are false for the same reasons |
| `invariants.md:162-166`, `flows.md:55-60` | The backing-copy leak presented as an accepted open risk, *"tracked as general-updates AR-1"* | `eebc1d6` closed it. The docs never mention the sweep, the `listSealedResources` seam, the grace period, or the `templates-orphans` port |
| `runtime.md:6-12` | The construction diagram annotates the registry *"# empty in the current tree"* | Document is registered |
| `runtime.md:119-120` | *"The list query logs `searched: true` rather than the term itself — a search string is user content"* | Whenever a `search` or `kinds` filter is supplied, `templateService.ts:208-215` logs `templates.list.filtered {search, kinds, matched: [...names]}` — the term **and** the matched names — as a `{detail: "content"}` debug record. `searched: true` still appears on `templates.query.completed` at `:220`, so both statements are present and the stated privacy rationale is wrong rather than merely incomplete |
| `types.md:191-194` | *"`TemplatableResourceRegistry` exposes only `get(kind)`"* | It also exposes `kinds()` |
| `concepts.md:64-73`, `types.md` Ports section | 6 of the 8 port members; the ports listing omits `claimedResourceIds`, `latestSnapshot`, `expiredDeleted`, `pruneHistory` and the outbox pair | — |
| `runtime.md:81-92` | 6 idempotency-key shapes | **7** — `templates:orphan-purge:<resourceId>` is missing |
| `runtime.md:110-120` | 9 log events | roughly 19, including all four content-labelled ones and the three orphan-sweep events |

**What the package gets right and is worth carrying forward verbatim:** the identity rule, the
binding-rules table, the three-names table, the limits table (it matches `TEMPLATE_WIRE_LIMITS`
exactly), the status-code table (it matches `errorResponse` exactly), the serial-admission section,
the listing rules, and the revision rules.

### The archive

The superseded design page is at
[phase-1/capabilities-old/templates.md](../../phase-1/capabilities-old/templates.md). It describes
a Templates built on a *Library Kernel*, with per-kind draft payloads, ordered `TemplateSlot`s
carrying `acceptedBindingKinds`, append-only draft ChangeSets with exact inverses, schema
migration, immutable published payloads, version numbers and lineage, preview services,
materialization planners, and three hand-written adapters
(`documentTemplateAdapter.ts`, `slidesTemplateAdapter.ts`, `spreadsheetTemplateAdapter.ts`).
**None of that exists.** The real Templates has no drafts, no slots, no versions, no publishing,
no previews, no migrations, no adapters and no Library Kernel: it has a flat catalog row pointing
at a sealed copy and a single structural port.

Elsewhere in the archive, `phase-1/claude-notes/07-capability-inventory.md` omits Templates from
its capability table entirely; `phase-1/claude-notes/09-verified-status.md:116` acknowledges it in
a single row (*"**Built** since this snapshot"*) with no detail; and
`phase-1/runtime/backend-map.md:77` lists `templates/` among directories the same page's own
narrative treats as unbuilt.

---

## 10 · Where to look for what

| Concern | File |
| --- | --- |
| The catalog record, commands, queries, transactions | [`domain/model.ts`](../../../apps/backend/src/3-capabilities/templates/domain/model.ts) |
| The cross-capability contract | [`ports/templatableResource.ts`](../../../apps/backend/src/3-capabilities/templates/ports/templatableResource.ts) |
| Store atomicity contracts | [`ports/templateStore.ts`](../../../apps/backend/src/3-capabilities/templates/ports/templateStore.ts) |
| The five commands, three queries, receipts, the orphan sweep | [`application/templateService.ts`](../../../apps/backend/src/3-capabilities/templates/application/templateService.ts) |
| Untrusted input | [`wire/valueSchemas.ts`](../../../apps/backend/src/3-capabilities/templates/wire/valueSchemas.ts), [`wire/commandSchemas.ts`](../../../apps/backend/src/3-capabilities/templates/wire/commandSchemas.ts) |
| Storage shape | [`persistence/sqliteSchema.ts`](../../../apps/backend/src/3-capabilities/templates/persistence/sqliteSchema.ts) |
| HTTP | [`4-job-wiring/templates/registerTemplateEndpoints.ts`](../../../apps/backend/src/4-job-wiring/templates/registerTemplateEndpoints.ts) |
| Construction, the registry, the Activity adapter | [`1-init/create/templates.ts`](../../../apps/backend/src/1-init/create/templates.ts) |

Related pages: [document.md](document.md) for the other side of the seam,
[04-state-and-persistence.md](../04-state-and-persistence.md) for the retention scheduler the
orphan sweep rides, and [11-known-issues.md](../11-known-issues.md) for KI-1.
