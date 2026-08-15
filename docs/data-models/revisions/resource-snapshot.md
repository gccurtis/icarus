# Resource snapshot

A materialized body of a general resource at one revision. Snapshots are the
anchors that [change sets](change-set.md) are applied on top of.

```ts
interface ResourceSnapshot {
  projectId: Id<"projects">;
  resourceType: "document" | "slides" | "spreadsheet";
  resourceId: string;
  revision: number;
  role: "base" | "leader" | "checkpoint";
  body: ResourceBody;
  at: number;
}

type ResourceBody =
  | { resourceType: "document"; blocks: ContentBlock[] }
  | { resourceType: "slides"; slides: Slide[]; theme?: SlideTheme }
  | { resourceType: "spreadsheet"; sheets: Sheet[] };
```

## Three roles, two jobs

**`leader`** is the hot anchor. Current content is the leader body plus every
`recent` change set after its revision. Exactly one per resource, and it is
never current — it advances only on consolidation.

**`base`** is the cold anchor: the oldest state still reconstructable. Historical
change sets run forward from it, and nothing before it can be reached. Exactly
one per resource.

**`checkpoint`** are optional intermediates in the cold range. A resource with
tens of thousands of historical sets is slow to reconstruct from the base alone;
a checkpoint every few thousand revisions bounds that replay. Purely an
optimization — adding or discarding them changes nothing about what is
reconstructable.

All three are the same object because they are the same thing: a body at a
revision. What differs is which range of change sets runs from it.

## Why the leader is not the live resource row

Putting the current body on the resource row and keeping it current would mean
every accepted change rewrites the whole body. Convex patches rewrite the entire
document, so a large deck or a long document would be rewritten on every
keystroke batch — hundreds of kilobytes of write amplification per edit.

With a leader snapshot, an edit appends one small change set row and touches
nothing else. The cost is that a read is the leader plus N recent sets rather
than a single row, and N is bounded by the consolidation interval, which is
[configuration](../../../app/configuration/revisions.yaml).

That trade is the right way round: reads can be cached and batched, and the
replay is over a bounded number of small sets. Write amplification cannot be
mitigated at all.

## Consolidation

Fold the recent change sets into the leader body, write the leader at its new
revision, and re-tier those sets to `historical`.

Nothing is recomputed beyond that fold, and no other row is touched. The
resource row is not involved, because it does not carry a revision.

## Advancing the base

Pruning history: pick a revision R, reconstruct the body at R, write it as the
new `base`, discard historical sets and checkpoints older than R.

This is the storage lever. How far back history goes is a retention number,
applied by moving R forward, with no effect on merging, on reads, or on the hot
tier.

## Reading a past revision

Base body, then historical change sets in order up to the target — or the
nearest checkpoint at or below the target, then forward from there.

This is the only mechanism for older versions. Nothing stores past bodies
separately; any revision within the retained range is reachable by replay, which
is why no other object needed a bespoke history model.

## Body is a union on resource type

One snapshot table serves all three general resources, discriminated by
`resourceType`. Replay is generic over [ops](change-set.md#paths) and the body
is opaque to it, so a table per resource type would triple the code for no gain.

The body deliberately excludes metadata — title, template origin, timestamps.
Those live on the resource row and are not worth versioning; a renamed document
is not a different document, and [activity](../collaboration/activity.md)
already records the rename.

## Related

[change set](change-set.md) · [revisions](README.md) ·
[document](../general-resources/document.md) ·
[slides](../general-resources/slides.md) ·
[spreadsheet](../general-resources/spreadsheet.md)
