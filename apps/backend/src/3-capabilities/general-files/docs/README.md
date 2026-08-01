# General Files capability

## Status and authority

General Files is an implemented project-scoped capability for storing arbitrary caller-supplied file transport strings. Identity is the SHA-256 digest of the complete string. A small extension allowlist classifies prose text for Knowledge admission; every other extension is stored without indexing. Updating content is a wholesale replacement that creates or reactivates the content-addressed target and retires the prior row.

These pages document the current TypeScript and SQLite behavior. General Files owns stored content, content identity, metadata, replacement links, active/deleted lifecycle, and its synchronous Knowledge reconciliation workflow. Knowledge owns windows, embeddings, lattice state, and retrieval.

## Documentation map

| Document | Purpose |
|---|---|
| [Concepts](concepts.md) | Content addressing, classification, replacement, Knowledge boundary, and architecture |
| [Types](types.md) | Domain types, result unions, filters, errors, store and SQLite representation |
| [Runtime](runtime.md) | Factory, all service/store methods, helpers, logging, and compensation |
| [Flows](flows.md) | All five endpoints and upload/update/delete call chains |
| [Invariants](invariants.md) | Exact guarantees, concurrency, transaction boundaries, limits, tests, and non-goals |

## Dependencies

- [`Knowledge`](../../../0-platform/knowledge/knowledge.ts) for prose-source add/upsert and removal.
- The shared [`Logger`](../../../0-platform/observability/logger.ts).
- Project identity from backend configuration, bound into SQLite at construction.
- The serial/concurrent job scheduler at the endpoint boundary.
- The [runtime resource registry](../../../1-init/create/resource-reader.ts), which exposes active prose files to Derived Output scope/list/read tools.

There is no filesystem read, multipart parser, binary decoder, text extractor, Formula dependency, or Intelligence call in this capability. The `content` field has already been decoded into a JavaScript string by its caller.

## Source map

| Concern | Source |
|---|---|
| Domain model and classification | [`domain/model.ts`](../domain/model.ts) |
| Typed application errors | [`domain/errors.ts`](../domain/errors.ts) |
| Persistence port | [`ports/repository.ts`](../ports/repository.ts) |
| Service and reconciliation helpers | [`application/generalFileService.ts`](../application/generalFileService.ts) |
| SQLite schema, migration, and transactions | [`persistence/sqliteGeneralFileRepository.ts`](../persistence/sqliteGeneralFileRepository.ts) |
| Public exports | [`index.ts`](../index.ts) |
| Composition factory | [`1-init/create/generalFiles.ts`](../../../1-init/create/generalFiles.ts) |
| HTTP/job wiring | [`4-job-wiring/general-files/registerGeneralFileEndpointMappings.ts`](../../../4-job-wiring/general-files/registerGeneralFileEndpointMappings.ts) |
| Resource scope/read adapter | [`1-init/create/resource-reader.ts`](../../../1-init/create/resource-reader.ts) |
| Regression tests | [`test/capabilities/general-files.test.ts`](../../../../test/capabilities/general-files.test.ts) |

## Related material

- [Original General Files design](../../../../../../scratch/general-files-design.md)
- [Recent capability fixes](../../../../../../scratch/recent-capabilities-fixes-2026-08-01.md)
- [Knowledge platform documentation](../../../../../../docs/platform/knowledge.md)

The design page contains historical prose; this package reflects current queue choices, file classifications, and compensation behavior.
