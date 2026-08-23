# Revisions

Two tables holding all content of every general resource.

`resourceSnapshots` · `changeSets`

For a document and a deck, current content is the `leader` snapshot with the
`recent` change sets applied over it. **A resource row carries no body and no
revision number**: a Convex patch rewrites the whole document, so either would
mean rewriting the entire deck on every keystroke batch.

**A spreadsheet uses the same two tables differently**, because its cells are
rows and there is nothing to replay — see
[spreadsheet revisions](spreadsheet-revisions.md).

---

## `resourceSnapshots`

`app/src/lib/capabilities/revisions/schema/resource-snapshots.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { resourceBodyValidator } from "$revisions/types/body";
import { generalResourceTypeValidator } from "$revisions/types/change";

/**
 * A materialized body at a revision.
 *
 * **`(generalResourceType, resourceId)` is the whole key.** Never the id alone —
 * two resources of different kinds may carry the same one. `projectId` leads the
 * pair rather than the pair leading, so a read naming one field too few ranges
 * over a single project instead of the deployment; a prefix of equalities is the
 * same contiguous scan either way.
 *
 * **`resourceId` is a string, not a `v.id` union.** A union would make the
 * change-set machinery branch on resource type, which is the one thing that must
 * not happen — being generic over bodies is what lets a deck and a spreadsheet
 * use the same machinery.
 *
 * **`part` splits a body across rows.** A document caps at 1 MiB and nothing
 * bounds a body, so several rows may share one `(resource, role)`: arrays
 * concatenate in part order and everything else is read from part 0. A body with
 * one part is the ordinary case.
 */
export const resourceSnapshots = defineTable({
  projectId: v.id("projects"),
  generalResourceType: generalResourceTypeValidator,
  resourceId: v.string(),
  revision: v.number(),
  /** `leader` anchors the hot read and `base` the cold one; a checkpoint bounds replay. */
  role: v.union(v.literal("base"), v.literal("leader"), v.literal("checkpoint")),
  part: v.number(),
  body: resourceBodyValidator,
  at: v.number()
}).index("by_resource_role", [
  "projectId",
  "generalResourceType",
  "resourceId",
  "role",
  "part"
]);
```

A resource holds one `base` and one `leader`. The leader is patched forward
rather than appended, so snapshots do not accumulate.

---

## `changeSets`

`app/src/lib/capabilities/revisions/schema/change-sets.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { opValidator, generalResourceTypeValidator } from "$revisions/types/change";
import { actorValidator } from "$shared/types/actor";

/**
 * One accepted mutation: the coalesced ops, the revision it produced, and the
 * revision it was authored against.
 *
 * **Uniqueness of `revision` is the transaction's, not an index's.** Convex has
 * no unique constraint. Read the maximum and insert one above it in one
 * mutation: a writer that commits first invalidates this one's read set and it
 * re-runs. There is no version field and no retry loop.
 *
 * **`touched` holds the deepest thing each op addresses**, never its ancestors —
 * including them would report a collision on every shared container, so two
 * people editing different atoms of one paragraph would never both land.
 *
 * **Two indexes, not one.** `by_resource_state` serves the hot read — the recent
 * sets above the leader. `by_resource_revision` serves everything after revision
 * N, tier irrelevant. One index cannot do both: `tier` before `revision` makes a
 * tier-agnostic range impossible, and after it makes the hot read scan
 * historical rows it will discard.
 */
export const changeSets = defineTable({
  projectId: v.id("projects"),
  generalResourceType: generalResourceTypeValidator,
  resourceId: v.string(),
  revision: v.number(),
  /** What its author was looking at. */
  baseRevision: v.number(),
  /** A field rather than two tables, so consolidation is a flag flip. */
  tier: v.union(v.literal("recent"), v.literal("historical")),
  ops: v.array(opValidator),
  touched: v.array(v.string()),
  actor: actorValidator,
  at: v.number()
})
  .index("by_resource_state", [
    "projectId",
    "generalResourceType",
    "resourceId",
    "tier",
    "revision"
  ])
  .index("by_resource_revision", [
    "projectId",
    "generalResourceType",
    "resourceId",
    "revision"
  ]);
```

---

## The op vocabulary

`app/src/lib/capabilities/revisions/types/change.ts`

```ts
import { v } from "convex/values";

export const generalResourceTypeValidator = v.union(
  v.literal("document"),
  v.literal("slides"),
  v.literal("spreadsheet")
);

const opTargetValidator = v.union(
  v.literal("row"), v.literal("block"), v.literal("atom"), v.literal("mark"),
  v.literal("slide"), v.literal("element"), v.literal("section"),
  v.literal("sheet"), v.literal("cell"), v.literal("range"),
  v.literal("mergedCells"),
  v.literal("analytic"), v.literal("analyticComponent"),
  v.literal("chart"), v.literal("chartElement"),
  v.literal("field")
);

/**
 * Five ops over a path.
 *
 * **Every op is closed under inversion**, which is what the extra payloads buy:
 * `was` reverses a set, `values` and `after` reverse a remove, `wasAfter`
 * reverses a move. An undo is an ordinary change set, not a rewind. The inverse
 * is computed rather than stored — storing it would double the payload on the
 * append-heavy table and create two representations of one fact.
 *
 * **Each op names its own target union.** A nonsensical op is refused at the
 * door rather than failing when something tries to apply it. `move` is the one
 * that matters: its illegal targets read as plausible, and a cell is keyed by
 * address rather than ordered.
 *
 * **`text` targets literal atoms only.** A formula atom changes by `set`ting its
 * `formulaId`, which keeps the one in-place string edit in the system to one
 * kind of string.
 *
 * `value` and `values` are `v.any()` because a payload is whatever sits at the
 * path — a block, a mark, a row, a cell. A validator naming them would be this
 * capability knowing what a slide is.
 */
export const opValidator = v.union(
  v.object({
    op: v.literal("set"),
    target: opTargetValidator,
    path: v.string(),
    value: v.any(),
    was: v.any()
  }),
  v.object({
    op: v.literal("insert"),
    target: opTargetValidator,
    path: v.string(),
    after: v.union(v.string(), v.null()),
    values: v.array(v.any())
  }),
  v.object({
    op: v.literal("remove"),
    target: opTargetValidator,
    path: v.string(),
    ids: v.array(v.string()),
    after: v.union(v.string(), v.null()),
    values: v.array(v.any())
  }),
  v.object({
    op: v.literal("move"),
    target: opTargetValidator,
    path: v.string(),
    id: v.string(),
    after: v.union(v.string(), v.null()),
    wasAfter: v.union(v.string(), v.null())
  }),
  v.object({
    op: v.literal("text"),
    target: v.literal("atom"),
    path: v.string(),
    at: v.number(),
    insert: v.string(),
    remove: v.string()
  })
);
```

`analytic` addresses the ordered computation. `analyticComponent` addresses its
reusable materialized output. A chart component narrows further to `chart`, and
one identified CAGR/reference/text/trend declaration uses `chartElement`.
Surface placement remains on the owning block, slide element, or spreadsheet
analytic reference.

`range` remains a target because formula operands and print areas can name a
region rather than one cell. `mergedCells` names the stored collection and is a
noun like every other target.

---

## The body union

`app/src/lib/capabilities/revisions/types/body.ts`

```ts
import { v } from "convex/values";
import { documentBodyValidator, type DocumentBody } from "$documents/types/body";
import { slideDeckBodyValidator, type SlideDeckBody } from "$slide-decks/types/body";
import { spreadsheetBodyValidator, type SpreadsheetBody } from "$spreadsheets/types/body";

/**
 * What a snapshot's `body` may be: one of the three general resources' bodies,
 * told apart by the row's own `generalResourceType`.
 *
 * **This is the only place all three are named together, and it imports them
 * rather than declaring them.** A body's shape is its resource's model — a deck
 * body belongs to `slide-decks` — and stating them here would be this capability
 * knowing what a slide is, which is the one thing that would stop the machinery
 * being generic.
 *
 * A union rather than `v.any()`: per-type validation *and* one implementation,
 * rather than a choice between them. Nothing reads this union at runtime; the
 * schema does, at the door, which is where a malformed body should be refused.
 *
 * Convex objects reject unknown fields, and each of the three requires something
 * the others lack — `slides` and `theme` for a deck, `columns` and `print` for a
 * grid — so membership is unambiguous without a discriminant inside the body.
 * The discriminant is the column beside it.
 *
 * **A template body is the labelled version of this**, because a template row
 * has no `generalResourceType` column to discriminate by — see
 * [templates](templates.md#what-it-holds).
 */
export const resourceBodyValidator = v.union(
  documentBodyValidator,
  slideDeckBodyValidator,
  spreadsheetBodyValidator
);

export type ResourceBody = DocumentBody | SlideDeckBody | SpreadsheetBody;
```

---

## Files

```text
app/src/lib/capabilities/revisions/schema/
├── schema.md
├── resource-snapshots.ts
├── change-sets.ts
└── tables.ts                      revisionsTables

app/src/lib/capabilities/revisions/types/
├── change.ts                      GeneralResourceType, OpTarget, Op
└── body.ts                        the three-way body union
```

**Imports it does not define:** [`$shared/types/actor`](shared.md#actor), and the
three resource bodies named in [resources](resources.md).

## Related

[all tables](README.md) · [resources](resources.md) ·
[spreadsheet revisions](spreadsheet-revisions.md)
