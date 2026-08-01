# Activity kind

## Status and authority

Activity has an implemented project-scoped ledger and Presence core. It accepts
a trusted transaction, assigns it a monotonic project sequence, stores it
idempotently, answers feed-style queries, and keeps expiring Presence leases.

Startup constructs Activity before resource kinds and registers its public
query route. The current HTTP transport has no trusted stable session identity,
so `/activity/command` is deliberately registered as an explicit `501`
unsupported response rather than accepting unsafe Presence writes.

Document publishing is now wired through this boundary. Document writes a
self-contained local outbox record with its accepted mutation, maps that record
to an Activity transaction after commit, and marks it published only after
Activity accepts it. Startup also recovers pending Document delivery. Other
producing kinds remain separate integration work. Activity owns the project
ledger and current Presence state; it does not become a second resource
database.

## Documentation map

- [Concepts](concepts.md): vocabulary, ownership, and ledger/Presence model.
- [Types](types.md): transaction, query, Presence, store, and error families.
- [Runtime](runtime.md): construction, validation, SQLite persistence, and
  callable methods.
- [Flows](flows.md): publication, query, Presence, transport, and source-outbox
  integration flows.
- [Invariants](invariants.md): idempotency, ordering, isolation, validation,
  expiry, limits, and explicit non-goals.

## Current source map

| Layer | Authority and entry points |
| --- | --- |
| Public exports | [`index.ts`](../index.ts) |
| Transaction/query/Presence types | [`domain/model.ts`](../domain/model.ts) |
| Canonical metadata and digest | [`domain/canonical.ts`](../domain/canonical.ts) |
| Domain errors | [`domain/errors.ts`](../domain/errors.ts) |
| Application runtime | [`application/activityService.ts`](../application/activityService.ts) |
| Store contract | [`ports/activityStore.ts`](../ports/activityStore.ts) |
| SQLite adapter/schema | [`persistence/sqliteActivityStore.ts`](../persistence/sqliteActivityStore.ts), [`persistence/sqliteSchema.ts`](../persistence/sqliteSchema.ts) |
| Instance factory | [`create/activity.ts`](../../../1-init/create/activity.ts) |
| Public route registration | [`registerActivityEndpoints.ts`](../../../4-job-wiring/activity/registerActivityEndpoints.ts) |
| Startup composition | [`startBackend.ts`](../../../1-init/startBackend.ts) |
| Document publisher adapter | [`create/document.ts`](../../../1-init/create/document.ts), [`activityPublisher.ts`](../../document/ports/activityPublisher.ts) |

## Dependencies and integration boundary

The core depends on its `ActivityStore` port, an optional clock, and optional
Presence TTL. `SQLiteActivityStore` depends on `better-sqlite3`; the instance
factory opens it at `./data/activity.db` using the configured project ID.

The Activity package deliberately has no dependency on Document, Slide,
Connector, General, or another producing kind. Composition constructs Activity
first and injects the narrow publisher adapter into Document; Document's
database retains its own atomic mutation/outbox transaction. Slide and other
producer adapters are not wired yet.

Future transport integration must provide authenticated actor/session context
before it enables Presence heartbeat or leave. Future Activity management may
coordinate undo/redo, but source kinds continue to own source revision and
inverse semantics.

## Related material and tests

[`scratch/activity-design.md`](../../../../../../scratch/activity-design.md)
records the broader design and phased intent. These in-capability docs describe
what is wired and implemented in this tree; runtime code takes precedence when
the two differ.

Focused regression coverage is in
[`activity.test.ts`](../../../../test/capabilities/activity.test.ts). It covers
stable-ID replay/conflict behavior, descending transaction queries/filtering,
and Presence expiry without ledger entries. Endpoint behavior is covered by
[`activity-wiring.test.ts`](../../../../test/capabilities/activity-wiring.test.ts);
Document post-commit publication/recovery and self-contained outbox migration
are covered in the Document application/persistence suites.
