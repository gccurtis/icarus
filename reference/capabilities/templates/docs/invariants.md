# Templates invariants, guarantees, and limits

## Implemented precondition → outcome contracts

| Preconditions | Guaranteed outcome | Enforcement boundary |
|---|---|---|
| `template.register` with a registered kind | One `ready` record with an allocated `id`, `resourceId === id`, and exactly one adapter copy call | Service ordering plus SQLite PK/UNIQUE |
| The adapter throws during registration | No catalog row survives and the identity is reusable | `deleteReservation` in the catch path |
| The kind has no adapter | `TemplateUnsupportedKindError` before any row or adapter call | Adapter resolution runs first |
| An exact retry of any command | The stored result is replayed and the adapter is called no further times | `command_claims` PK plus stored `result_json` |
| A request ID is reused with different canonical content or a different command type | `TemplateIdempotencyMismatchError` | Digest and command-type comparison on the claim |
| A pending claim is retried | The frozen `template_id` is reused and the same adapter idempotency key replayed | `bindClaimTemplateId` before the adapter call |
| `template.register` with a name already taken for that kind | `TemplateNameConflictError` before any adapter call, so no backing copy exists | `nameTaken` check plus the `(kind, name)` unique index |
| `template.update` on a ready record at `expectedRevision` | The adapter is called at most once, the replaced record is archived to history at its old revision, the row moves to `revision + 1`, and one `template.updated` transaction is written — all atomically | `update` transaction |
| `template.update` with a stale `expectedRevision` or a taken name | The matching 409 is raised **before** the adapter call, so no content is edited and nothing is written | Service checks precede the adapter |
| `template.load` on a ready record | The adapter's content is returned verbatim, uninterpreted | Service; `content` is `unknown` |
| `template.get` / `template.list` | No adapter call at all | Service; only `load` reads through |
| `template.instantiate` on a ready record | The adapter is called once and **no** catalog row is written | Service; there is no instance table |
| `template.delete` on a ready record | The current row moves to history, the adapter is called once, and one source transaction is written atomically | `delete` transaction |
| Any accepted registration or deletion | Exactly one transaction-outbox row, committed with the catalog change | `markReady`/`delete` transactions |
| A command has `user`, `agent`, `automation`, or `system` origin | Registration/deletion transactions preserve it for Activity | Wire decoder and local outbox |
| A publisher throws | The transaction stays unpublished and the accepted result is unchanged | Drain catches, logs, and stops |

## Identity rules

- The Template ID is allocated by Templates and never accepted from a caller;
  the wire decoder rejects a `templateId` key on `template.register`.
- The identity is frozen on the command claim and in a `reserving` catalog row
  **before** any adapter call.
- In version 1 `resource_id = id`, enforced by a `CHECK` constraint rather than
  only in TypeScript.
- `UNIQUE (kind, resource_id)` means one live record per backing resource.
- A `reserving` record is invisible to `get` and `list` and blocks only its own
  identity.

## Binding rules

- One override rule applies at registration and instantiation: an absent key
  inherits, a key with `target` sets, a key without `target` explicitly unbinds.
- `contextBindings` is optional on the wire and always a record in the domain.
- The declared bindings are persisted on the Template record and returned by
  `template.get` and `template.list`. They are the template's parameter list and
  part of what identifies it, not a cache of resource state.
- The backing resource separately holds each variable's applied target, written
  by the adapter. Neither side is derivable from the other.
- A binding `description` is a declaration, meaningful only at registration, and
  the record is the only place it can live. Supplying one at instantiation is a
  400, not a silently ignored field.

## Naming rules

- Every record has a `name`, required at registration. It is not defaultable:
  the mutating adapter methods return `void`, so Templates cannot read the
  source resource's title, and the backing copy's title is sealed anyway.
- Names are unique per `(kind, name)`, case-insensitively, so a Document and a
  Spreadsheet template may share one.
- Names are trimmed by the wire decoder, so `"  Report  "` and `"Report"`
  collide rather than coexisting as near-duplicates.
- The unique index covers `reserving` rows and carries **no** partial predicate.
  Both are deliberate: covering reservations makes a collision surface in
  `reserve()` before the adapter call, and deletion removes the live row rather
  than flagging it, so a name is freed by construction rather than by a
  `deleted_at IS NULL` clause.
- `template.update` renames the record. Nothing renames the backing resource,
  from either side.

## Revision rules

- Registration writes `revision: 1`. `template.update` is the only command that
  moves a live record forward; deletion moves it forward only in history.
- `expectedRevision` is a compare-and-swap, and the first one in this
  capability.
- **Every revision transition leaves a history record.** An update archives the
  record it replaced at that record's revision; deletion archives the current
  record and then writes a `deleted` record at `revision + 1`. So the chain a
  template leaves behind is contiguous, and `latestSnapshot` never reports
  pre-update state as current.

## Scope and security

- Project-scoped only. The table prefix is a deterministic SHA-256 fragment of
  the configured `projectId`; no public input selects a project or user scope.
- Templates performs no Context read or write. It imports the `ContextEntry`
  type only.
- Templates never reads or writes another capability's tables, and no SQLite
  transaction spans Templates and a resource database.

## Limits

| Limit | Default | Applied to |
|---|---:|---|
| `maxBindings` | 256 | Keys in one `contextBindings` record |
| `maxIdentifierBytes` | 512 | Identifiers and binding entry fields |
| `maxDescriptionBytes` | 4,096 | Catalog and binding descriptions |
| `maxTitleBytes` | 4,096 | Instantiation title |
| `maxBindingNameBytes` | 512 | Variable names |

## What depends on serial admission

The adapter-call guarantee above is **not** enforced by the store alone and
holds because
`POST /templates/command` runs on the serial queue:

- **One adapter call per request.** `claimCommand` and the adapter call are
  separate steps, so two concurrent retries of one `requestId` would both
  observe a pending claim and both drive the adapter.

Calling `TemplateCapability.command` directly from more than one place
concurrently, bypassing the queue, would reopen both. Nothing does that today.

## Current non-guarantees

- **No adapter is registered.** Every command that needs one, and
  `template.load`, answer `unsupported_kind` in the current tree. Templates
  upholds its half of the contract; nothing yet upholds the other half.
- **The override rule is not applied to any resource here.** Templates declares
  and delivers it; only an owning kind's adapter can carry it out. The test
  suite asserts delivery, not application.
- **Nothing is sealed yet, so "cannot drift" is one-sided.** The design has
  registration close the owning capability's whole public surface for a backing
  copy — reads included — leaving `template.update` and `template.load` as the
  only ways in. Document has no `isTemplate` flag and refuses nothing, so today
  an ordinary `document.submit` against a backing copy would still succeed and
  strand the catalog's declaration. Templates' half is done; the enforcement
  half is Document work.
- No SQLite transaction spans the claim and the adapter call. A crash between
  them is recovered by resumption, not by rollback.
- **`template.update` is not atomic across the two stores.** The adapter call
  commits in the resource's database before the catalog commits in this one, so
  a crash in between leaves edited content under an unchanged declaration. The
  claim is still pending, so a retry completes it; the window is real but
  self-healing, and it is the same shape as registration's.
- `template.list` has no pagination contract.
- Deleting a template does not cascade to instances, and Templates keeps no
  instance list to cascade through.
- Two concurrent registrations of the *same source* produce two distinct
  templates. Registration is not deduplicated by source, only by `requestId`.

## Non-goals

Cross-project, user-level, or public templates; template versions or instance
pinning; categories, thumbnails, or search; propagation from a template into
existing instances; batch instantiation; caller-chosen Template IDs; Context
composition on a caller's behalf.
