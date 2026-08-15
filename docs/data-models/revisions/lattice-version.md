# Lattice version

One row per project. The current state of the [knowledge
lattice](../knowledge/knowledge-lattice.md) — what it was built from and what it
is built with.

```ts
interface LatticeVersion {
  projectId: Id<"projects">;   // unique — one per project
  version: number;
  embeddingModel: string;      // the provider's identifier, resolved
  embeddingBinding: string;    // the intelligence key it resolved from
  dimensions: number;
  nodeCount: number;
  staleCount: number;
  state: "building" | "ready" | "rebuilding" | "error";
  error?: string;
  rebuildReason?: "embedding_changed" | "manual" | "corruption";
  updatedAt: number;
}
```

## Why a version at all

Individual lattice nodes already carry their own `updatedAt` and `staleAt`. What
they cannot express is a property of the *whole index*, and retrieval depends on
several:

Every vector in a project must come from one embedding model, because distances
between vectors from different models are meaningless. `embeddingModel` and
`dimensions` are that invariant, written down in one place where a mismatch is
detectable rather than being an assumption spread across every node.

`state` is the index's readiness. A lattice mid-rebuild holds a mix of old and
new vectors and should not be queried as though it were coherent — a per-node
flag cannot say that, because the problem is the population, not any node.

## One per project

Enforced by a unique index on `projectId`. The lattice is a single index over
one project's content; two would mean two answers to "what does this project
know", with nothing to say which is right.

## Version numbers

`version` increments on every [lattice change](lattice-change.md). It is what
lets a retrieval result, a [derived
output](../knowledge/derived-output.md), or a research answer record *which*
lattice it drew on, so a later "why did it say that" has something to compare
against.

It is a counter over changes, not a content hash. A hash would identify
identical states, which nothing needs; an ordering is what makes staleness
comparisons work.

## Both binding and resolved model

`embeddingBinding` is the [intelligence](../ai/intelligence.md) key —
`"embedding"`. `embeddingModel` is what that key pointed at when the lattice was
built.

Storing both is the point. The binding can be repointed at any time, and the
lattice does not automatically follow; comparing the two is exactly how a
required rebuild is detected. Storing only the binding would hide the drift, and
storing only the model would lose the connection to the configuration that
should be updated.

## Counts

`nodeCount` and `staleCount` are maintained rather than computed. They drive a
readiness indicator that renders on every project view, and counting rows for it
would mean scanning the lattice to draw a badge.

They are approximate by nature and are corrected on rebuild.

## Related

[lattice change](lattice-change.md) ·
[knowledge lattice](../knowledge/knowledge-lattice.md) ·
[intelligence](../ai/intelligence.md)
