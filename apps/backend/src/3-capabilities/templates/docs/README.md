# Templates capability

## Status and authority

The capability is implemented, tested, and wired into startup. Its catalog,
command claims, wire decoding, endpoints, and Activity outbox all work.

**No resource adapter is registered yet.** `1-init/startBackend.ts` constructs
the adapter registry empty, so in the current tree all three mutating commands
answer `400 unsupported_kind`. `template.get` and `template.list` are fully
operational and return an empty catalog.

The first adapter will be Document, and it requires work that does not exist
yet: Document representation v2, Context Variables, `isTemplate` persistence,
durable copy attempts, and a new `DerivedOutputs.clone`. That design lives in
[`scratch/document-design/templates-and-context-variables.md`](../../../../../../scratch/document-design/templates-and-context-variables.md)
and must be read as intent, **not** as implemented behaviour.

A green Templates test run therefore means "Templates upholds its half of the
adapter contract". It does not mean a user can create a template.

Design intent for the capability itself is in
[`scratch/templates-design.md`](../../../../../../scratch/templates-design.md);
the build plan is in
[`scratch/templates-implementation-plan.md`](../../../../../../scratch/templates-implementation-plan.md).

## What it owns

- Which backing resources are registered as templates.
- Allocation of the Template ID, and the resource kind.
- Exact command replay for registration, instantiation, and deletion.
- Dispatch to one injected adapter per registered kind.

It does not own resource content, revision history, copy rules, Context
records, or Derived Outputs. It never reads or writes another capability's
tables.

## Implementation map

| Concern | File |
| --- | --- |
| Public barrel | [`index.ts`](../index.ts) |
| Canonical types, commands, queries, facts | [`domain/model.ts`](../domain/model.ts) |
| Typed failure modes | [`domain/errors.ts`](../domain/errors.ts) |
| Canonical digest for replay | [`domain/canonical.ts`](../domain/canonical.ts) |
| Commands, queries, outbox drain | [`application/templateService.ts`](../application/templateService.ts) |
| Persistence contract | [`ports/templateStore.ts`](../ports/templateStore.ts) |
| Per-kind copy contract | [`ports/resourceAdapter.ts`](../ports/resourceAdapter.ts) |
| Narrow Activity port | [`ports/activityPublisher.ts`](../ports/activityPublisher.ts) |
| Table names and DDL | [`persistence/sqliteSchema.ts`](../persistence/sqliteSchema.ts) |
| SQLite adapter | [`persistence/sqliteTemplateStore.ts`](../persistence/sqliteTemplateStore.ts) |
| Row/domain mapping | [`persistence/sqliteMappers.ts`](../persistence/sqliteMappers.ts) |
| Strict ingress decoding | [`wire/`](../wire/) |
| Construction and Activity adaptation | [`1-init/create/templates.ts`](../../../1-init/create/templates.ts) |
| Endpoints and error mapping | [`4-job-wiring/templates/registerTemplateEndpoints.ts`](../../../4-job-wiring/templates/registerTemplateEndpoints.ts) |
| Tests | [`test/capabilities/templates.test.ts`](../../../../test/capabilities/templates.test.ts) |

## Documentation map

- [Concepts](concepts.md): vocabulary, ownership, and the adapter seam.
- [Types](types.md): record, command, query, binding, and port families.
- [Runtime](runtime.md): construction, endpoints, queue choice, and logging.
- [Flows](flows.md): registration, instantiation, deletion, and recovery.
- [Invariants](invariants.md): what is guaranteed, and what is not.
