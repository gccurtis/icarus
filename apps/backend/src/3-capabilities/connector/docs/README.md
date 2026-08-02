# Connector capability

## Status and authority

Connector is an implemented project-scoped external-resource ingestion capability. It registers a provider locator, snapshots provider items, admits prose items to Knowledge, persists item metadata, supports manual and scheduled synchronization, exposes bounded readers, and reconciles partial Knowledge/store failures through a small persisted ingestion state.

Only the local `filesystem` provider exists today. It is explicitly a development adapter: it accepts paths readable by the backend process and is not a production containment or authorization boundary. Remote providers such as Google Drive or SharePoint are not implemented.

These documents describe current source behavior. Connector owns connector/item identities and metadata, synchronization/reconciliation state, provider contracts, and read orchestration. Providers own external listing/reads. Knowledge owns text indexing and retrieval.

## Documentation map

| Document | Purpose |
|---|---|
| [Concepts](concepts.md) | Provider/snapshot/reconciliation vocabulary, boundaries, and architecture |
| [Types](types.md) | Connector, item, provider, reader, errors, store, SQL and wire types |
| [Runtime](runtime.md) | Every service/store/provider/reader/scheduler method and helper group |
| [Flows](flows.md) | All ten endpoints plus scheduled synchronization and detailed sequences |
| [Invariants](invariants.md) | Guarantees, limits, identity/revisions, concurrency, failure recovery, scope, tests, and non-goals |

## Dependencies

- Project-bound [`SQLiteConnectorStore`](../persistence/sqliteConnectorRepository.ts).
- [`Knowledge`](../../../0-platform/knowledge/knowledge.ts) for prose add/upsert/remove.
- Provider map, currently containing only [`filesystemProvider`](../providers/filesystem.ts).
- Shared [`Logger`](../../../0-platform/observability/logger.ts).
- Job scheduler for HTTP work and recurring sync enqueue.
- The [runtime resource registry](../../../1-init/create/resource-reader.ts) for Context→source mapping and Derived Output reads.

## Source map

| Concern | Current source |
|---|---|
| Connector/item/sync model | [`domain/model.ts`](../domain/model.ts) |
| Errors | [`domain/errors.ts`](../domain/errors.ts) |
| Provider port | [`domain/provider.ts`](../domain/provider.ts) |
| Reader ports | [`domain/reader.ts`](../domain/reader.ts) |
| Store port | [`ports/repository.ts`](../ports/repository.ts) |
| Service and reconciliation | [`application/connectorService.ts`](../application/connectorService.ts) |
| SQLite current/history schema and claims | [`persistence/sqliteConnectorRepository.ts`](../persistence/sqliteConnectorRepository.ts) |
| Development filesystem adapter | [`providers/filesystem.ts`](../providers/filesystem.ts) |
| Public exports | [`index.ts`](../index.ts) |
| Factory/provider registration | [`1-init/create/connector.ts`](../../../1-init/create/connector.ts) |
| Recurring scheduler | [`1-init/create/connectorSyncScheduler.ts`](../../../1-init/create/connectorSyncScheduler.ts) |
| HTTP/job wiring | [`4-job-wiring/connector/registerConnectorEndpointMappings.ts`](../../../4-job-wiring/connector/registerConnectorEndpointMappings.ts) |
| Scope/read registry | [`1-init/create/resource-reader.ts`](../../../1-init/create/resource-reader.ts) |
| Regression tests | [`connector.test.ts`](../../../../test/capabilities/connector.test.ts) |

## Related material

- [Connector design](../../../../../../scratch/connector-design.md)
- [Recent capability fixes](../../../../../../scratch/recent-capabilities-fixes-2026-08-01.md)
- [Knowledge platform documentation](../../../../../../docs/platform/knowledge.md)

The source is authoritative where historical design prose still describes different paths, job modes, classifications, or sync behavior.
