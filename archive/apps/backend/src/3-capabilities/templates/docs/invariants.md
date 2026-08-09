# Templates invariants, guarantees, and limits

## Implemented precondition → outcome contracts

| Preconditions | Guaranteed outcome | Enforcement boundary |
|---|---|---|
| `template.register` with a registered kind | One record whose `resourceId` is the ID `duplicate` returned, and exactly one `duplicate` + one `markAsTemplate` call | Service ordering plus SQLite PK/UNIQUE |
| The resource throws during registration | No catalog row, no receipt, no transaction; the command is retryable from the start | Nothing is written before the resource returns |
| The kind has no registered runtime | `TemplateUnsupportedKindError` before any row or resource call | Runtime resolution runs first |
| An exact retry of any command | The stored result is replayed and the resource is not called again | `command_receipts` PK plus stored `result_json` |
| A request ID is reused with different canonical content or a different command type | `TemplateIdempotencyMismatchError` | Digest and command-type comparison on the receipt |
| `template.register` with a name already taken for that kind | `TemplateNameConflictError` before any resource call, so no backing copy exists | `nameTaken` check plus the `(kind, name)` unique index |
| Any accepted `template.register` | The catalog row, its receipt, and its transaction commit together or not at all | One `store.create` SQLite transaction |
| `template.update` at `expectedRevision` | The resource is called at most twice (bindings, then content), the replaced record is archived at its old revision, the row moves to `revision + 1`, and one `template.updated` transaction is written — atomically | `update` transaction |
| `template.update` with a stale `expectedRevision` or a taken name | The matching 409 is raised **before** any resource call, so no content is edited and nothing is written | Service checks precede the resource |
| `template.instantiate` whose bindings are not exactly the declared keys | `TemplateBindingMismatchError` before any resource call, naming what is missing and what is undeclared | Service check precedes `duplicate` |
| `template.instantiate` otherwise | One `duplicate`, **no** `markAsTemplate`, and no catalog row | Service; there is no instance table |
| `template.load` | The resource's content is returned verbatim, uninterpreted | Service; `content` is `unknown` |
| `template.get` / `template.list` | No resource call at all | Service; only `load` reads through |
| `template.list` with a cursor from another capability's listing | `InvalidTemplateCursorError`, not a plausible-looking position | `kind` tag inside the encoded cursor |
| `template.delete` | The current row moves to history, `logicalDelete` is called once, and one source transaction is written atomically | `delete` transaction |
| Any accepted registration, update, or deletion | Exactly one transaction-outbox row, committed with the catalog change | `create`/`update`/`delete` transactions |
| A command has `user`, `agent`, `automation`, or `system` origin | Its transaction preserves it for Activity | Wire decoder and local outbox |
| A publisher throws | The transaction stays unpublished and the accepted result is unchanged | Drain catches, logs, and stops |

## Identity rules

- **The capability that stores a thing allocates its ID.** Templates allocates
  the Template ID; the owning capability allocates the backing copy's and returns
  it from `duplicate`.
- `resourceId !== id`. There is no `CHECK (resource_id = id)`: it only ever held
  because Templates was passing its own ID down as the destination, which made a
  coincidence look like a rule.
- The wire decoder rejects a `templateId` key on `template.register` and a
  `destinationResourceId` key on `template.instantiate`. Neither is a thing a
  caller can know.
- `UNIQUE (kind, resource_id)` means one live record per backing resource.
- Nothing is written before the resource call, so there is no identity to freeze
  and no reservation to release.

## Binding rules

- One override rule governs how a binding record reaches a resource: an absent
  key inherits, a key with `target` sets, a key without `target` explicitly
  unbinds.
- `contextBindings` is optional on the wire and always a record in the domain.
- The declared bindings are persisted on the Template record and returned by
  `template.get` and `template.list`. They are the template's parameter list and
  part of what identifies it, not a cache of resource state.
- **Registration declares; instantiation supplies.** At registration a `target`
  is optional and an omitted one declares a parameter with no default. At
  instantiation a `target` is **required**, and the bindings must name exactly
  the declared set — no more, no fewer.
- Together those three rules mean **no instance holds an unbound variable**, and
  none of them depends on the declaration having had defaults.
- A declared `target` is what the *backing copy* holds, which is what makes a
  template openable and previewable. `duplicate` copies it verbatim and
  `applyBindings` then replaces it; it is never a silent fallback for an
  argument the instantiator omitted, because omitting one is refused.
- Bindings cross the port as bindings — `applyBindings` — not as `submit`
  operations. Templates holds them in its own decoded vocabulary and cannot turn
  them into a resource operation without learning that kind's operation union.
- Nothing is sent when there is nothing to apply: an empty declaration means no
  `applyBindings` call at all.
- A binding `description` is a declaration, meaningful only at registration, and
  the record is the only place it can live. Supplying one at instantiation is a
  400, not a silently ignored field.

## Naming rules

- Every record has a `name`, required at registration. It is not defaultable:
  `load` returns `unknown`, so Templates cannot find a title inside the source,
  and the backing copy's title is sealed anyway.
- Names are unique per `(kind, name)`, case-insensitively, so a Document and a
  Spreadsheet template may share one.
- Names are trimmed by the wire decoder, so `"  Report  "` and `"Report"` collide
  rather than coexisting as near-duplicates.
- The unique index carries **no** partial predicate, because deletion removes the
  live row rather than flagging it — a name is freed by construction rather than
  by a `deleted_at IS NULL` clause.
- The `nameTaken` pre-check, not the index, is what makes a collision surface
  before any resource call. The index cannot report until the row is written, and
  the row is written last.
- `template.update` renames the record. Nothing renames the backing copy, from
  either side. A `name` at instantiation names the *instance*, which is an
  ordinary resource.

## Revision rules

- Registration writes `revision: 1`. `template.update` is the only command that
  moves a live record forward; deletion moves it forward only in history.
- `expectedRevision` is a compare-and-swap, and the only one in this capability.
- **Every revision transition leaves a history record.** An update archives the
  record it replaced at that record's revision; deletion archives the current
  record and then writes a `deleted` record at `revision + 1`. So the chain a
  template leaves behind is contiguous, and `latestSnapshot` never reports
  pre-update state as current.
- History keeps `resourceId`, which is what lets `template.purge` name the
  backing copy after the live row is gone.

## Listing rules

- `template.list` is the only template listing in the system. No resource
  capability exposes one.
- Ordering is `(createdAt, id)` ascending, and pagination is keyset over that
  pair, so a page boundary is stable under concurrent inserts.
- `kinds` is any-of; an explicit `[]` matches nothing rather than everything.
- `search` is a case-insensitive substring over name and description, with `%`
  and `_` escaped so a term containing either stays literal.
- A whitespace-only `search` is dropped at the wire boundary: a search for
  nothing lists everything rather than nothing.

## Scope and security

- Project-scoped only. The table prefix is a deterministic SHA-256 fragment of
  the configured `projectId`; no public input selects a project or user scope.
- Templates performs no Context read or write. It imports the `ContextEntry` type
  only.
- Templates never reads or writes another capability's tables, and no SQLite
  transaction spans Templates and a resource database.

## Limits

| Limit | Default | Applied to |
|---|---:|---|
| `maxBindings` | 256 | Keys in one `contextBindings` record |
| `maxIdentifierBytes` | 512 | Identifiers and binding target fields |
| `maxDescriptionBytes` | 4,096 | Catalog and binding descriptions |
| `maxNameBytes` | 512 | Catalog name and instance name |
| `maxBindingNameBytes` | 512 | Variable names |
| `maxSearchBytes` | 512 | `template.list` search term |
| `maxKinds` | 64 | Entries in `template.list` `kinds` |
| `maxPageLimit` | 200 | `template.list` `limit` |
| `maxCursorBytes` | 1,024 | `template.list` cursor |

## What depends on serial admission

The one-call-per-request guarantee is **not** enforced by the store alone and
holds because `POST /templates/command` runs on the serial queue: the receipt
lookup and the resource call are separate steps, so two concurrent retries of one
`requestId` would both find no receipt and both drive the resource.

Calling `TemplateCapability.command` directly from more than one place
concurrently, bypassing the queue, would reopen that. Nothing does today.

## Current non-guarantees

- **No resource runtime is registered.** Every command that reaches a resource,
  and `template.load`, answer `unsupported_kind` in the current tree. Templates
  upholds its half of the contract; nothing yet upholds the other half. The first
  end-to-end template arrives with Document's `duplicate`/`markAsTemplate` — see
  [`document-changes-design.md`](../../../../../../scratch/document-changes-design.md).
- **The override rule is not applied to any resource here.** Templates declares
  and delivers it; only an owning kind can carry it out. The suite asserts
  delivery, not application.
- **Nothing is sealed yet, so "cannot drift" is one-sided.** The design has
  registration close the owning capability's whole public surface for a backing
  copy — reads included — leaving `template.update` and `template.load` as the
  only ways in. Document has no `isTemplate` flag and refuses nothing, so today
  an ordinary `document.submit` against a backing copy would still succeed and
  strand the catalog's declaration.
- **A never-retried crash between the resource call and the local commit leaks a
  backing copy.** It is unreachable rather than merely hidden: the owning
  capability refuses sealed resources and `template.list` only knows catalog
  rows. Accepted, and tracked as
  [general-updates AR-1](../../../../../../scratch/0-general-updates.md#ar-1--registration-can-leak-an-orphaned-backing-resource).
- **`template.update` is not atomic across the two stores.** The resource commits
  in its own database before the catalog commits here, so a crash in between
  leaves edited content under an unchanged declaration. No receipt was written,
  so a retry re-runs and the resource replays on the same key; the window is real
  but self-healing, and it is the same shape as registration's.
- Deleting a template does not cascade to instances, and Templates keeps no
  instance list to cascade through.
- Two concurrent registrations of the *same source* produce two distinct
  templates. Registration is deduplicated by `requestId`, not by source.

## Non-goals

Cross-project, user-level, or public templates; template versions or instance
pinning; categories or thumbnails; propagation from a template into existing
instances; batch instantiation; caller-chosen Template IDs; Context composition
on a caller's behalf.
