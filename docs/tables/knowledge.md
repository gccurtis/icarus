# Knowledge

Five tables: the project's content as overlapping windows, the clusters over
them, and the generated content that draws on both.

`latticeNodes` · `latticeEdges` · `latticeSources` · `latticeChanges` ·
`derivedOutputs`

---

## `latticeNodes`

`app/src/lib/capabilities/knowledge/schema/lattice-nodes.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * One row is a window of one source, or a cluster of the nodes below it.
 *
 * **One table, because there is one id space.** `members` and `latticeEdges`
 * name a node without caring which kind it is.
 *
 * A node's content is immutable: identity is the hash of `(source, text)` for a
 * window and of the sorted `members` for a cluster, so changing either is a
 * different node. The source is folded into a window's hash so the same
 * boilerplate in two documents stays two windows.
 */
export const latticeNodes = defineTable({
  projectId: v.id("projects"),
  level: v.number(),

  /** `clusters.length > 0`. Stored because it is an index key. */
  clustered: v.boolean(),

  /** Every cluster this node is a member of. Plural, because cliques overlap. */
  clusters: v.array(v.id("latticeNodes")),

  /** The embedding vector. For a cluster, the mean of its members'. */
  vector: v.array(v.float64()),

  updatedAt: v.number(),

  // ── a window ──────────────────────────────────────────────────
  sourceKind: v.optional(v.string()),
  sourceId: v.optional(v.string()),
  /** The window's span in that source. */
  start: v.optional(v.number()),
  end: v.optional(v.number()),
  /** This window's text. Never the source's. */
  text: v.optional(v.string()),

  // ── a cluster ─────────────────────────────────────────────────
  members: v.optional(v.array(v.id("latticeNodes"))),
  cohesion: v.optional(v.number())
})
  .index("by_project_clustered", ["projectId", "clustered"])
  .index("by_project_level", ["projectId", "level"])
  .index("by_source", ["projectId", "sourceKind", "sourceId"]);
```

`vector` is only a centroid when the node is a cluster, which is why the field is
not called one.

A cluster carries no windows of its own, which is why a window's span is two
numbers rather than an array — a window node is exactly one window.

Three indexes. `vector` is stored and not vector-indexed.

---

## `latticeEdges`

`app/src/lib/capabilities/knowledge/schema/lattice-edges.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * One pair of nodes and how strongly they relate.
 *
 * A weight is a function of two vectors and a node's content is immutable, so
 * there is no generation or level here — a second number saying when it was
 * computed would distinguish rows that cannot differ.
 *
 * One row per pair, read from either end.
 */
export const latticeEdges = defineTable({
  projectId: v.id("projects"),
  fromId: v.id("latticeNodes"),
  toId: v.id("latticeNodes"),
  weight: v.number()
})
  .index("by_from", ["projectId", "fromId"])
  .index("by_to", ["projectId", "toId"]);
```

---

## `latticeSources`

`app/src/lib/capabilities/knowledge/schema/lattice-sources.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * What has already been read out of each source, and at which revision.
 *
 * It holds no node ids — `latticeNodes.by_source` names them.
 *
 * `revision` is a string because sources revision differently and nothing here
 * compares them for order.
 */
export const latticeSources = defineTable({
  projectId: v.id("projects"),
  sourceKind: v.string(),
  sourceId: v.string(),
  revision: v.string(),
  ingestedAt: v.number()
}).index("by_source", ["projectId", "sourceKind", "sourceId"]);
```

---

## `latticeChanges`

`app/src/lib/capabilities/knowledge/schema/lattice-changes.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * What one clustering pass did, in enough detail to undo it.
 *
 * **No vectors.** A cluster's vector is the mean of its members', so reverting
 * needs the member list and not the 1536 numbers derived from it. A removed
 * window cannot be rebuilt from here — its vector is not stored.
 *
 * Rows are ordered by `_creationTime`, so there is no version counter.
 */
export const latticeChanges = defineTable({
  projectId: v.id("projects"),
  /** Uniform `{kind, id}` — never per-variant id names. */
  cause: v.object({ kind: v.string(), id: v.string() }),

  added: v.array(v.id("latticeNodes")),

  /** The previous values of clusters that were patched in place. */
  changed: v.array(
    v.object({
      id: v.id("latticeNodes"),
      members: v.array(v.id("latticeNodes")),
      cohesion: v.number()
    })
  ),

  removed: v.array(
    v.object({
      id: v.id("latticeNodes"),
      level: v.number(),
      sourceKind: v.optional(v.string()),
      sourceId: v.optional(v.string()),
      members: v.optional(v.array(v.id("latticeNodes")))
    })
  )
}).index("by_project", ["projectId"]);
```

---

## `derivedOutputs`

`app/src/lib/capabilities/derived-outputs/schema.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { blockValidator } from "$content/types/block";
import {
  derivedStateValidator,
  evidenceValidator
} from "$derived-outputs/types/derived-output";
import { actorValidator } from "$shared/types/actor";
import { resourceSelectionValidator } from "$shared/types/resource-selection";

/**
 * Generated content that stays connected to what it was generated from.
 *
 * **`response` is one block.** An output fills the position a prompt block
 * occupies, and a position holds one block.
 *
 * **Three lists, three jobs.** `queries` is what the prompt asked, `retrieved`
 * is what came back, `evidence` is what the answer rests on. None is derivable
 * from the others.
 */
export const derivedOutputsTables = {
  derivedOutputs: defineTable({
    projectId: v.id("projects"),
    /** The whole instruction, and the only copy of it. */
    prompt: v.string(),
    /** Absent means the whole project. */
    scope: v.optional(resourceSelectionValidator),
    queries: v.array(v.string()),
    /** Everything the queries returned, used or not. */
    retrieved: v.array(v.id("latticeNodes")),
    evidence: v.array(evidenceValidator),
    response: blockValidator,
    state: derivedStateValidator,
    error: v.optional(v.string()),
    /** `updatedAt` moves for a failed attempt; this does not. */
    refreshedAt: v.optional(v.number()),
    createdBy: actorValidator,
    updatedAt: v.number()
  })
    .index("by_project", ["projectId"])
    .index("by_project_state", ["projectId", "state"])
};
```

`app/src/lib/capabilities/derived-outputs/types/derived-output.ts`

```ts
import { v } from "convex/values";

/**
 * One thing the answer rests on, quoted.
 *
 * **The text travels with the span.** A citation exists to survive its source
 * changing, and a span alone resolves against content that may no longer say
 * what it said.
 *
 * A retrieved node is named in `retrieved`, so there is no node variant here. A
 * web page becomes an `externalFile::webLink`, which is what gives it an id.
 */
export const evidenceValidator = v.object({
  resourceKind: v.string(),
  resourceId: v.string(),
  /** Absent means the whole thing. */
  span: v.optional(v.object({ start: v.number(), end: v.number() })),
  text: v.string()
});

export const derivedStateValidator = v.union(
  v.literal("idle"),
  v.literal("generating"),
  v.literal("fresh"),
  v.literal("stale"),
  v.literal("error")
);
```

---

## The lattice's identity is on the project

Which model built a project's lattice, at what width, is
[`projects.lattice`](access.md#projects) — not a table here.

## The PCA basis is a file

`pcaDims × dimensions` float64s — at 128 × 1536 that is ≈1.5 MiB, over the 1 MiB
document limit. It is written whole, read whole, and replaced whole.

No table. A stored basis is a file whose id lives on `projects.lattice`.

---

## Files

```text
app/src/lib/capabilities/knowledge/schema/
├── schema.md
├── lattice-nodes.ts
├── lattice-edges.ts
├── lattice-sources.ts
├── lattice-changes.ts
└── tables.ts                      knowledgeTables

app/src/lib/capabilities/derived-outputs/
├── schema.ts
└── types/derived-output.ts
```

Four tables in one capability, so `schema/` is a directory — see
[the convention](README.md#schemas-are-a-directory-one-file-per-table).

**Imports it does not define:** [`$content/types/block`](content.md),
[`$shared/types/actor`](shared.md#actor),
[`$shared/types/resource-selection`](resource-sets.md#the-selection).

## Related

[all tables](README.md) · [agents](agents.md)
