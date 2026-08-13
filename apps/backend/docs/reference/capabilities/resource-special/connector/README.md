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

- Project-bound `SQLiteConnectorStore`.
- `Knowledge` for prose add/upsert/remove.
- Provider map, currently containing only `filesystemProvider`.
- Shared `Logger`.
- Job scheduler for HTTP work and recurring sync enqueue.
- The `runtime resource registry` for Context→source mapping and Derived Output reads.

## Source map

| Concern | Current source |
|---|---|
| Connector/item/sync model | `domain/model.ts` |
| Errors | `domain/errors.ts` |
| Provider port | `domain/provider.ts` |
| Reader ports | `domain/reader.ts` |
| Store port | `ports/repository.ts` |
| Service and reconciliation | `application/connectorService.ts` |
| SQLite current/history schema and claims | `persistence/sqliteConnectorRepository.ts` |
| Development filesystem adapter | `providers/filesystem.ts` |
| Public exports | `index.ts` |
| Factory/provider registration | `initialization/runtimes/connector.ts` |
| Recurring scheduler | `initialization/runtimes/connectorSyncScheduler.ts` |
| HTTP/job wiring | `api/routes/connector/registerConnectorEndpointMappings.ts` |
| Scope/read registry | `initialization/runtimes/resource-reader.ts` |
| Regression tests | `connector.test.ts` |

## Related material

- `Connector design`
- `Recent capability fixes`
- `Knowledge platform documentation`

The source is authoritative where historical design prose still describes different paths, job modes, classifications, or sync behavior.
