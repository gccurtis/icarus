# Lattice change

The lattice's history. One row per source change, holding the node sets that
change produced — grouped by the source each set came from.

```ts
interface LatticeChange {
  projectId: Id<"projects">;
  version: number;             // the lattice version this produced
  cause: LatticeCause;
  nodeSets: LatticeNodeSet[];
  reclustered?: number[];      // nodes touched per level, indexed by level
  at: number;
}

type LatticeCause =
  | { kind: "resource"; resourceType: "document" | "slides" | "spreadsheet"; resourceId: string; revision: number }
  | { kind: "file"; fileId: Id<"externalFiles"> }
  | { kind: "connector_sync"; connectorId: Id<"connectors"> }
  | { kind: "finding"; findingId: Id<"findings"> }
  | { kind: "rebuild"; reason: "embedding_changed" | "manual" | "corruption" };

interface LatticeNodeSet {
  source: LatticeSource;
  added: Id<"latticeNodes">[];
  removed: Id<"latticeNodes">[];
  unchanged: number;           // count only — nodes the source kept
}
```

`reclustered` is a count per level rather than a list of ids. A source change
[cascades upward](../knowledge/knowledge-lattice.md#staleness-cascades-upward):
editing one paragraph invalidates its windows, the cluster containing them, the
cluster containing that, and so on to the top. Listing every id touched would
make a change row larger than the change and would be read by nobody — what a
person wants to know is how far up the edit reached.

## Grouped by the change, listed by source

One change can touch many sources. A connector sync brings in forty files and
re-embeds all of them; a rebuild touches every source in the project. So a
change row holds a *list* of node sets, one per source affected.

Grouping this way rather than one row per source keeps the causal unit intact.
"These four hundred nodes appeared because of that sync" is one row, which is
both how a person reads it and how it is undone.

## Cause ties history together

`cause` is what makes the lattice explicable. A `resource` cause carries the
[change set](change-set.md) revision it followed, so a lattice state and a
document state can be lined up: *lattice version 214 reflects document revision
47*.

Without that link, a stale retrieval result is unattributable — you can see the
lattice is behind but not what it is behind. With it, the gap between a
document's current revision and the revision the lattice last indexed is a
subtraction.

## Added and removed, not modified

A node is never edited. When a source changes, its affected passages are
replaced: old node ids in `removed`, new ones in `added`.

This is because a node's identity is its content and its embedding together —
changing the text means a different vector, which is a different point in the
index, which is a different node. Modelling it as a modification would imply the
node persists across the change, and nothing about it does.

`unchanged` is a count rather than a list. A small edit to a large document
leaves most of its passages untouched, and listing thousands of ids to say
"these were fine" would make the change row larger than the change.

## Retention

Lattice history is prunable and carries no correctness weight. The lattice
itself can be rebuilt from project content at any time, so these rows exist to
explain what happened, not to enable reconstruction.

Old changes are dropped oldest-first. Unlike [resource
snapshots](resource-snapshot.md), there is no base to advance — dropping a
lattice change loses an explanation, never a state.

## Related

[lattice version](lattice-version.md) ·
[knowledge lattice](../knowledge/knowledge-lattice.md) ·
[change set](change-set.md)
