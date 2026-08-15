# Knowledge lattice

The project's content, broken into passages, embedded, and linked. It is what
makes retrieval possible: given a question, find the passages that bear on it.

```ts
interface LatticeNode {
  projectId: Id<"projects">;
  source: LatticeSource;
  text: string;                // the passage
  embedding: number[];
  tokens: number;
  ordinal: number;             // position within the source
  staleAt?: number;            // set when the source changed
  updatedAt: number;
}

type LatticeSource =
  | { kind: "file"; fileId: Id<"externalFiles">; locator?: string }
  | { kind: "document"; documentId: Id<"documents">; blockIndex: number }
  | { kind: "slides"; deckId: Id<"slideDecks">; slideIndex: number }
  | { kind: "spreadsheet"; spreadsheetId: Id<"spreadsheets">; sheet: string; range?: string }
  | { kind: "finding"; findingId: Id<"findings"> }
  | { kind: "message"; threadId: Id<"researchThreads">; messageId: Id<"researchMessages"> };

interface LatticeEdge {
  projectId: Id<"projects">;
  fromId: Id<"latticeNodes">;
  toId: Id<"latticeNodes">;
  kind: "cites" | "derived_from" | "contradicts" | "similar";
  weight?: number;
}
```

## Nodes are derived, never authored

Every node is a projection of something else. Nothing is written directly into
the lattice, and nothing is lost by rebuilding it — which is what makes it safe
to re-chunk, re-embed with a different model, or discard and regenerate.

`source` is therefore required and is a discriminated union rather than a
freeform string, because reindexing has to be able to find every node derived
from a given file or document and replace exactly those.

`ordinal` keeps a source's passages in order, so retrieved context can be
expanded to its neighbours — a matched passage is often clearer with the one
before it.

## Embeddings live on the node

Convex indexes vectors on the document, so the embedding sits in the row it
describes rather than in a parallel store. A separate vector database would mean
two systems to keep consistent and a project's content living somewhere its
access rules do not reach.

The embedding's model is not recorded per node. Mixing embeddings from different
models in one index produces meaningless distances, so the invariant is that a
project's lattice is entirely one model — changing models means rebuilding, and
a per-node field would suggest otherwise.

## Staleness rather than deletion

When a source changes, its nodes get `staleAt` set instead of being deleted
immediately. Retrieval can still use them, marked as possibly out of date, while
re-embedding happens in the background.

The alternative is a window where a document has been edited and is absent from
retrieval entirely, which is worse: a slightly stale answer is more useful than
a confidently incomplete one.

## Edges

Edges are separate rows, not arrays on the node. A heavily cited passage would
otherwise carry an unbounded list that every read of it pays for, and every new
citation would rewrite it.

`cites` and `derived_from` are structural — extracted from real references
between objects. `similar` is computed from embedding proximity. `contradicts`
is asserted, usually from a [finding](../research/finding.md) whose bearing says
so. They are one type because traversal treats them the same way and only the
weighting differs.

## Retrieval is scoped by a resource set

A search restricts which nodes are eligible by their `source`, using a
[resource set](../special-resources/resource-set.md) expression. Supplying none
means the whole project, which is the default and the common case.

The scope is an expression resolved at search time rather than a stored id list,
so "the connector-synced material" keeps meaning that as syncs bring more in.
This is what `source` being a discriminated union buys beyond reindexing — a node
can be tested for membership in a set without a join.

## Index-wide state lives elsewhere

Properties of the whole index — which embedding model built it, whether it is
mid-rebuild, how many nodes are stale — are on the
[lattice version](../revisions/lattice-version.md), one row per project. A
per-node field cannot express them, because the subject is the population rather
than any node.

Its history is the [lattice change](../revisions/lattice-change.md) log: one row
per source change, holding the node sets that change produced. Each carries the
cause, including the resource revision it followed, so a lattice state and a
document state can be lined up.

## What is not here

No retrieval receipts and no per-query logs. What a particular search returned is
a property of that search — it belongs on the [message's tool
calls](../core/message.md#research-steps-are-tool-calls), where someone will
actually look for it.

## Related

[lattice version](../revisions/lattice-version.md) ·
[lattice change](../revisions/lattice-change.md) ·
[derived output](derived-output.md) ·
[external file](../special-resources/external-file.md) ·
[research](../research/research.md)
