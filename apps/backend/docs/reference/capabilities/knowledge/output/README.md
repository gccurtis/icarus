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

- Project-bound `SQLiteDerivedOutputStore`.
- Platform `Knowledge`, including frozen scope manifests and source-mutation events.
- Platform `Intelligence` for structured planning and tool-using synthesis.
- The composition-layer `RuntimeResourceRegistry`, implementing both Knowledge resolution and scoped resource list/read.
- Context, General Files, and Connector indirectly through that registry.
- Shared `Logger`.
- Job registry/scheduler at endpoint boundaries.

## Source map

| Concern | Current source |
|---|---|
| Domain/output/revision/evidence/error model | `domain/model.ts` |
| Store commands and settlement result types | `store.ts` |
| Service, prompts, validation, tools, refresh pipeline | `derived-outputs.ts` |
| SQLite current/root/history schema, claims, CAS settlement/invalidation, deletion, and purge | `sqlite-store.ts` |
| Public exports | `index.ts` |
| Factory | `initialization/runtimes/derived-outputs.ts` |
| Resource registry | `initialization/runtimes/resource-reader.ts` |
| Knowledge scope/events | `knowledge.ts`, `types.ts` |
| Composition and event subscription | `initialization/create-runtime.ts` |
| HTTP/job wiring | `api/routes/derived-outputs/registerDerivedOutputEndpoints.ts` |
| Regression tests | `derived-outputs.test.ts` |

## Related material

- `Original Derived Outputs design`
- `Knowledge/Derived exploration`
- `Context design`
- `Recent fixes and architectural decisions`
- `Knowledge platform documentation`

Use this package first when understanding what is coded; the scratch files retain useful design history but include superseded structures and terminology.
