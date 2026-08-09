# Templates capability

## Status and authority

The capability is implemented, tested, and wired into startup. Its catalog,
receipts, wire decoding, endpoints, search, and Activity outbox all work.

**No resource runtime is registered yet.** `1-init/startBackend.ts` constructs
the registry empty, so in the current tree every command that reaches a resource
— and `template.load` — answers `400 unsupported_kind`. `template.get` and
`template.list` are fully operational and return an empty catalog.

**Nothing seals a backing copy yet.** The design has registration close the
owning capability's whole public surface for a template-mode resource, reads
included, leaving `template.update` and `template.load` as the only ways in.
Document has no `isTemplate` flag, so nothing refuses anything today. Templates'
half is built; the enforcement half is Document work.

The first runtime will be Document, and it requires work that does not exist yet:
Context Variables, `isTemplate` persistence, `duplicate`, `markAsTemplate`, and
allowing a Prompt Block to hold `appliedRevision: 0`. That design lives in
[`scratch/document-changes-design.md`](../../../../../../scratch/document-changes-design.md)
and must be read as intent, **not** as implemented behaviour.

A green Templates test run therefore means "Templates upholds its half of the
contract". It does not mean a user can create a template.

Design intent for the capability itself is in
[`scratch/templates-design.md`](../../../../../../scratch/templates-design.md);
progress is tracked in
[`scratch/0-templates-checklist.md`](../../../../../../scratch/0-templates-checklist.md).

## What it owns

- Which backing resources are registered as templates.
- Allocation of the Template ID, and the resource kind.
- The whole registration and instantiation **procedure** — copy, seal, bind.
- Exact command replay, by receipt.
- The only template listing in the system.

It does not own resource content, resource IDs, revision history, copy
mechanics, Context records, or Derived Outputs. It never reads or writes another
capability's tables.

## The shape, in one line

Templates receives a resource capability's **own runtime object** and drives it.
There is no adapter to write:

```ts
templateResources.register(document);
```

## Implementation map

| Concern | File |
| --- | --- |
| Public barrel | [`index.ts`](../index.ts) |
| Canonical types, commands, queries, source transactions | [`domain/model.ts`](../domain/model.ts) |
| Typed failure modes | [`domain/errors.ts`](../domain/errors.ts) |
| Canonical digest for replay | [`domain/canonical.ts`](../domain/canonical.ts) |
| Commands, queries, outbox drain | [`application/templateService.ts`](../application/templateService.ts) |
| Persistence contract | [`ports/templateStore.ts`](../ports/templateStore.ts) |
| What a templatable resource must do | [`ports/templatableResource.ts`](../ports/templatableResource.ts) |
| Narrow Activity port | [`ports/activityPublisher.ts`](../ports/activityPublisher.ts) |
| Table names and DDL | [`persistence/sqliteSchema.ts`](../persistence/sqliteSchema.ts) |
| SQLite adapter, search, and cursors | [`persistence/sqliteTemplateStore.ts`](../persistence/sqliteTemplateStore.ts) |
| Row/domain mapping | [`persistence/sqliteMappers.ts`](../persistence/sqliteMappers.ts) |
| Strict ingress decoding | [`wire/`](../wire/) |
| Construction and Activity adaptation | [`1-init/create/templates.ts`](../../../1-init/create/templates.ts) |
| Endpoints and error mapping | [`4-job-wiring/templates/registerTemplateEndpoints.ts`](../../../4-job-wiring/templates/registerTemplateEndpoints.ts) |
| Tests | [`test/capabilities/templates.test.ts`](../../../../test/capabilities/templates.test.ts) |

## Documentation map

- [Concepts](concepts.md): vocabulary, ownership, identity, and the resource seam.
- [Types](types.md): record, command, query, binding, and port families.
- [Runtime](runtime.md): construction, endpoints, queue choice, and logging.
- [Flows](flows.md): registration, instantiation, update, deletion, and recovery.
- [Invariants](invariants.md): what is guaranteed, and what is not.
