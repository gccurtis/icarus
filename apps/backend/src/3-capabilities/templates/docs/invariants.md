# Templates invariants, guarantees, and limits

## Implemented precondition → outcome contracts

| Preconditions | Guaranteed outcome | Enforcement boundary |
|---|---|---|
| `template.register` with a registered kind and catalog room | One `ready` record with an allocated `id`, `resourceId === id`, and exactly one adapter copy call | Service ordering plus SQLite PK/UNIQUE |
| The adapter throws during registration | No catalog row survives and the identity is reusable | `deleteReservation` in the catch path |
| The kind has no adapter | `TemplateUnsupportedKindError` before any row or adapter call | Adapter resolution runs first |
| An exact retry of any command | The stored result is replayed and the adapter is called no further times | `command_claims` PK plus stored `result_json` |
| A request ID is reused with different canonical content or a different command type | `TemplateIdempotencyMismatchError` | Digest and command-type comparison on the claim |
| A pending claim is retried | The frozen `template_id` is reused and the same adapter idempotency key replayed | `bindClaimTemplateId` before the adapter call |
| `template.instantiate` on a ready record | The adapter is called once and **no** catalog row is written | Service; there is no instance table |
| `template.delete` on a ready record | The record is soft-deleted, the adapter called once, and one fact written in the same transaction | `softDelete` transaction |
| Any accepted registration or deletion | Exactly one outbox fact, committed with the catalog change | `markReady`/`softDelete` transactions |
| A publisher throws | The fact stays unpublished and the accepted result is unchanged | Drain catches, logs, and stops |

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
  inherits, a key with `entry` sets, a key without `entry` explicitly unbinds.
- `contextBindings` is optional on the wire and always a record in the domain.
- Templates persists no bindings; defaults live in the backing resource's own
  variable state.
- A binding `description` is forwarded and never inspected or stored.

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
| `templates.maxTemplatesPerProject` | 500 | Live records, checked before reservation |
| `maxBindings` | 256 | Keys in one `contextBindings` record |
| `maxIdentifierBytes` | 512 | Identifiers and binding entry fields |
| `maxDescriptionBytes` | 4,096 | Catalog and binding descriptions |
| `maxTitleBytes` | 4,096 | Instantiation title |
| `maxBindingNameBytes` | 512 | Variable names |

## What depends on serial admission

Two guarantees above are **not** enforced by the store alone and hold because
`POST /templates/command` runs on the serial queue:

- **`maxTemplatesPerProject`.** `countLive()` and `reserve()` are separate
  statements. Concurrent registrations could each observe room and then all
  reserve, overshooting the limit.
- **One adapter call per request.** `claimCommand` and the adapter call are
  separate steps, so two concurrent retries of one `requestId` would both
  observe a pending claim and both drive the adapter.

Calling `TemplateCapability.command` directly from more than one place
concurrently, bypassing the queue, would reopen both. Nothing does that today.

## Current non-guarantees

- **No adapter is registered.** All three mutating commands answer
  `unsupported_kind` in the current tree. Templates upholds its half of the
  contract; nothing yet upholds the other half.
- **The override rule is not applied to any resource here.** Templates states
  and forwards it; only an owning kind's adapter can carry it out. The test
  suite asserts delivery, not application.
- No transaction spans the claim and the adapter call. A crash between them is
  recovered by resumption, not by rollback.
- `description` is immutable after registration; there is no update command.
- `template.list` has no pagination contract, only the configured cap.
- Deleting a template does not cascade to instances, and Templates keeps no
  instance list to cascade through.
- Two concurrent registrations of the *same source* produce two distinct
  templates. Registration is not deduplicated by source, only by `requestId`.

## Non-goals

Cross-project, user-level, or public templates; template versions or instance
pinning; categories, thumbnails, or search; propagation from a template into
existing instances; batch instantiation; caller-chosen Template IDs; Context
composition on a caller's behalf.
