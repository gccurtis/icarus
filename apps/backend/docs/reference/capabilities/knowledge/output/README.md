# Derived Outputs capability

## Status and authority

Derived Outputs is an implemented project-scoped capability that turns a prompt plus optional Context scope into an immutable, evidence-backed answer revision. A refresh plans retrieval, resolves and freezes one resource manifest, retrieves Knowledge regions, optionally uses scoped synthesis tools, validates provenance, and atomically publishes only if the definition, head, and project Knowledge generation are still current.

The capability owns current saved definitions, immutable answer revisions, lifecycle
history, refresh attempts, freshness, evidence validation, optional idempotency claims,
and refresh settlement. Logical deletion removes current/operational state while a stable
root retains answers and history until purge. Knowledge owns source ingestion and
retrieval. Intelligence owns provider execution. Resource capabilities own source content
and the places where an output reference is presented.

These pages describe the current code. Historical designs proposing a different owner, staged job graph, byte offsets, or broader output kinds are not runtime authority.

## Documentation map

| Document | Purpose |
|---|---|
| [Concepts](concepts.md) | Output/revision/evidence/scope vocabulary, ownership, lifecycle, and architecture |
| [Types](types.md) | All public and store-internal families, errors, manifests, persistence and wire shapes |
| [Runtime](runtime.md) | Construction, every service/store method, refresh stages, helpers, tools, logging, and concurrency |
| [Flows](flows.md) | All seven HTTP jobs, full refresh sequences, tools, invalidation, deletion/purge, and status mapping |
| [Invariants](invariants.md) | Publication/evidence/idempotency guarantees, limits, failure behavior, scope/security, tests, and non-goals |

## Dependencies

- Project-bound [`SQLiteDerivedOutputStore`](../sqlite-store.ts).
- Platform [`Knowledge`](../../../capabilities/knowledge/knowledge.ts), including frozen scope manifests and source-mutation events.
- Platform [`Intelligence`](../../../capabilities/intelligence/intelligence.ts) for structured planning and tool-using synthesis.
- The composition-layer [`RuntimeResourceRegistry`](../../../initialization/runtimes/resource-reader.ts), implementing both Knowledge resolution and scoped resource list/read.
- Context, General Files, and Connector indirectly through that registry.
- Shared [`Logger`](../../../capabilities/platform/observability/logger.ts).
- Job registry/scheduler at endpoint boundaries.

## Source map

| Concern | Current source |
|---|---|
| Domain/output/revision/evidence/error model | [`domain/model.ts`](../domain/model.ts) |
| Store commands and settlement result types | [`store.ts`](../store.ts) |
| Service, prompts, validation, tools, refresh pipeline | [`derived-outputs.ts`](../derived-outputs.ts) |
| SQLite current/root/history schema, claims, CAS settlement/invalidation, deletion, and purge | [`sqlite-store.ts`](../sqlite-store.ts) |
| Public exports | [`index.ts`](../index.ts) |
| Factory | [`initialization/runtimes/derived-outputs.ts`](../../../initialization/runtimes/derived-outputs.ts) |
| Resource registry | [`initialization/runtimes/resource-reader.ts`](../../../initialization/runtimes/resource-reader.ts) |
| Knowledge scope/events | [`knowledge.ts`](../../../capabilities/knowledge/knowledge.ts), [`types.ts`](../../../capabilities/knowledge/types.ts) |
| Composition and event subscription | [`initialization/create-runtime.ts`](../../../initialization/create-runtime.ts) |
| HTTP/job wiring | [`api/routes/derived-outputs/registerDerivedOutputEndpoints.ts`](../../../api/routes/derived-outputs/registerDerivedOutputEndpoints.ts) |
| Regression tests | [`derived-outputs.test.ts`](../../../../test/capabilities/derived-outputs.test.ts) |

## Related material

- [Original Derived Outputs design](../../../../../../scratch/derived-outputs-design.md)
- [Knowledge/Derived exploration](../../../../../../scratch/knowledge-derived.md)
- [Context design](../../../../../../scratch/context-design.md)
- [Recent fixes and architectural decisions](../../../../../../scratch/recent-capabilities-fixes-2026-08-01.md)
- [Knowledge platform documentation](../../../../../../docs/platform/knowledge.md)

Use this package first when understanding what is coded; the scratch files retain useful design history but include superseded structures and terminology.
