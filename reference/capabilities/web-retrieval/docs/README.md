# Web Retrieval documentation

## Status: scaffold only

Web Retrieval is not implemented. [`capabilities/web-retrieval`](../) contains only [`.gitkeep`](../.gitkeep). There are no TypeScript types, runtime objects, adapters, factories, configuration fields, consumers, endpoints, jobs, tests, logs, or persistence.

The repository-wide [Web Retrieval design page](../../../../../../docs/platform/web-retrieval.md) describes an intended provider-neutral search/fetch boundary. It is a design input, not evidence that those outcomes currently exist. Research and Sources pages also refer to future consumers that are not present under `apps/backend/src/capabilities`.

## Documentation map

| Document | Contents |
| --- | --- |
| [Concepts](concepts.md) | Intended boundary and vocabulary, clearly separated from repository state |
| [Types](types.md) | Current absence and a minimal future type map from the design |
| [Runtime](runtime.md) | Current runtime status and the smallest coherent implementation seam |
| [Flows](flows.md) | Current no-op topology and intended capability-owned call flow |
| [Invariants](invariants.md) | What is actually guaranteed now and acceptance gates for implementation |

## Source map

| Path | Current role |
| --- | --- |
| [`.gitkeep`](../.gitkeep) | Retains the empty directory |
| [`docs/platform/web-retrieval.md`](../../../../../../docs/platform/web-retrieval.md) | Aspirational platform design |
| [`docs/capabilities/research.md`](../../../../../../docs/capabilities/research.md) | Aspirational Research consumer design |
| [`docs/capabilities/sources.md`](../../../../../../docs/capabilities/sources.md) | Aspirational Source admission consumer design |

## Practical conclusion

No production code can currently search or fetch through this platform boundary. Any capability requiring web retrieval must first implement and compose it; using raw `fetch` elsewhere would bypass the intended security and normalization boundary.
