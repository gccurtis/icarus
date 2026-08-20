# Collaboration

Three tables: a conversation attached to a place, the remarks in it, and the log
of what happened.

`commentThreads` · `comments` · `activity`

Two capabilities. Threads and comments are one thing split in two rows; activity
shares nothing with them but the chapter.

---

## `commentThreads`

`app/src/lib/capabilities/comments/schema/comment-threads.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { anchorWithinValidator } from "$comments/types/anchor";
import { actorValidator } from "$shared/types/actor";
import { resourceRefValidator } from "$shared/types/resource";

/**
 * A conversation attached to a place in the project.
 *
 * **The thread owns the anchor and the resolved state; comments are the
 * replies.** One row per remark would have to nominate one of them as the one
 * carrying the anchor, and resolving a conversation would mean resolving an
 * individual remark.
 *
 * **`target` is a `ResourceRef`.** A thread hangs off project material and
 * nothing else, which is the same space a selection names and retrieval indexes.
 *
 * **`resolution` is one optional object, and absent is open.** A status beside
 * two nullable fields would allow `open` with a resolver and `resolved` with
 * nobody. The resolver is a user where `createdBy` is an actor: anything can
 * raise a remark, and closing one is a judgement a person makes.
 *
 * **Resolved rather than deleted.** A review discussion is often the only
 * record of why something is the way it is, and destroying it on resolve throws
 * that away at the moment it starts being useful.
 *
 * `quote` is what was selected. It renders in a list, so a thread reads on its
 * own without loading its target, and a range that has drifted is recognizable
 * as drifted.
 */
export const commentThreads = defineTable({
  projectId: v.id("projects"),
  target: resourceRefValidator,
  /** Absent means the whole thing. */
  within: v.optional(anchorWithinValidator),
  quote: v.optional(v.string()),
  resolution: v.optional(v.object({ by: v.id("users"), at: v.number() })),
  createdBy: actorValidator,
  updatedAt: v.number()
})
  .index("by_project", ["projectId", "updatedAt"])
  .index("by_target", ["projectId", "target.kind", "target.id"]);
```

### The anchor

`app/src/lib/capabilities/comments/types/anchor.ts`

```ts
import { v, type Infer } from "convex/values";

/**
 * The smallest thing the person actually pointed at.
 *
 * **Every variant names ids, never positions**, so an anchor cannot drift onto
 * the wrong paragraph or the wrong cell when something is inserted above it.
 * The one part still positional is `text`'s `from`/`to`, which is the same
 * offset arithmetic marks already require.
 *
 * **A cell is `(rowId, columnId)`** — the identity a `sheetCells` row carries —
 * rather than `"B7"`, which names a different cell after an insert. There is no
 * sheet id: a spreadsheet is one grid, and `target.id` names it.
 *
 * **A cell has no text range.** It holds a value rather than blocks, so there
 * is no block id to anchor inside and a cell comment is the whole cell.
 *
 * **There is no `row` variant.** Nobody points at a document row; they select
 * text, or they comment on the document. Rows are layout.
 *
 * A slide can be pointed at as a slide, which is the case that matters — "this
 * one needs rework" is about the slide, not about anything on it.
 */
export const anchorWithinValidator = v.union(
  v.object({ kind: v.literal("slide"), slideId: v.string() }),
  v.object({ kind: v.literal("element"), elementId: v.string() }),
  v.object({ kind: v.literal("cell"), rowId: v.string(), columnId: v.string() }),
  v.object({
    kind: v.literal("text"),
    blockId: v.string(),
    from: v.number(),
    to: v.number()
  })
);

export type AnchorWithin = Infer<typeof anchorWithinValidator>;
```

Which variants make sense depends on the target, and the validator cannot say
so — the owner is what enforces it, exactly as it does for a `ContentBlock`.

| Target kind | `within` may be |
| --- | --- |
| `document` | `text`, or absent |
| `slides` | `slide`, `element`, `text`, or absent |
| `spreadsheet` | `cell`, or absent |
| `externalFile` | absent |
| `connection` | absent |
| `finding` | `text`, or absent |

---

## `comments`

`app/src/lib/capabilities/comments/schema/comments.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { mentionValidator } from "$comments/types/mention";
import { blockValidator } from "$content/types/block";
import { actorValidator } from "$shared/types/actor";

/**
 * One remark in a thread.
 *
 * **The body is blocks.** A review remark gets links, mentions, code, and
 * pasted screenshots, and those are what blocks already express.
 *
 * **`mentions` is the same set flattened out of the marks.** In the text a
 * mention is a `link` mark on a span; here it is a list, so who a remark
 * addresses is one field rather than a walk over every block's marks. Convex
 * cannot index an array for membership, so this is not a query key — it is the
 * field a store with array indexes would index, and it costs one small array to
 * keep that open.
 *
 * `author` is an actor rather than a user: an agent reviewing a document and
 * leaving remarks on it is an ordinary thing to want.
 *
 * **`editedAt` keeps no prior text.** A comment is a remark in a conversation,
 * not a document, and version history for it would be storage nobody reads.
 *
 * No ordering field. Convex appends `_creationTime` to every index, so
 * `by_thread` is already chronological.
 */
export const comments = defineTable({
  projectId: v.id("projects"),
  threadId: v.id("commentThreads"),
  blocks: v.array(blockValidator),
  mentions: v.array(mentionValidator),
  author: actorValidator,
  editedAt: v.optional(v.number())
}).index("by_thread", ["projectId", "threadId"]);
```

`app/src/lib/capabilities/comments/types/mention.ts`

```ts
import { v, type Infer } from "convex/values";

/**
 * Who a remark addresses.
 *
 * **Not an `Actor`.** You mention a persona, where an actor's agent variant
 * points at a task — the two vocabularies overlap without matching.
 *
 * Per-variant field names, so each id is checked against the table it names.
 */
export const mentionValidator = v.union(
  v.object({ kind: v.literal("user"), userId: v.id("users") }),
  v.object({ kind: v.literal("persona"), personaId: v.id("personas") }),
  v.object({ kind: v.literal("task"), taskId: v.id("agentTasks") })
);

export type Mention = Infer<typeof mentionValidator>;
```

---

## `activity`

`app/src/lib/capabilities/activity/schema.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { actorValidator } from "$shared/types/actor";

/**
 * What happened in a project, in order. One row per event, appended and never
 * touched again.
 *
 * **Nothing here is ever patched.** No counter grows and no field is
 * reconciled: a burst of editing is coalesced before it is written, and what
 * lands is one ordinary row like every other. An editable log is not evidence
 * of anything.
 *
 * **Labels are frozen in.** `target.label` is a snapshot: an entry has to read
 * correctly after its subject is deleted, and "deleted a document" with no name
 * is not an audit record. A renamed document keeps its old name in past
 * entries, which is right — they describe what happened when it happened. It
 * also makes a hundred entries one query rather than a hundred lookups across a
 * dozen tables.
 *
 * `actorLabel` is the same idea applied to the actor, and activity is the only
 * place a label is stored rather than resolved. For an agent it freezes the
 * persona name and the task title together, so the entry still reads years
 * later whether or not either still exists.
 *
 * **`verb` is an open string.** The set grows with every capability that writes
 * one, and a closed union would make each new one a schema change for a value
 * nothing branches on.
 *
 * `context` is the containing thing when the target has one — a comment's
 * document, a hypothesis's question — so a feed can be narrowed to one area
 * without the reader knowing the shape of every target kind.
 *
 * **There is no `at`.** A row is written when its event happens, so
 * `_creationTime` is that time and the tiebreaker Convex appends orders both
 * indexes for free.
 */
export const activity = defineTable({
  projectId: v.id("projects"),
  actor: actorValidator,
  actorLabel: v.string(),
  verb: v.string(),
  target: v.object({ kind: v.string(), id: v.string(), label: v.string() }),
  context: v.optional(v.object({ kind: v.string(), id: v.string(), label: v.string() })),
  /** A sentence about the event. "14 files", "3 rows removed". */
  detail: v.optional(v.string())
})
  .index("by_project", ["projectId"])
  .index("by_target", ["projectId", "target.kind", "target.id"]);
```

**`target` is not a `ResourceRef`.** Activity records events on everything —
comments, threads, memberships, variables, templates — which is a wider space
than the material a selection can name, and it carries a frozen label a
`ResourceRef` has no room for.

**Two indexes, both feeds.** `by_project` is the project's, `by_target` is the
same feed narrowed to one thing's history. `["projectId", "actor.taskId"]` would
give an agent's, and `Actor`'s per-variant field names make it a real index — it
is not declared until something asks for it.

**There is no digest table and no rollup field.** Collapsing a burst is a
decision about what to write, made before the write; what reaches this table is
one event either way.

**Activity is not the undo log.** It records *what was done* where
[change sets](revisions.md#changesets) record *what changed*, and reverting an
agent's action is a different affordance from inverting your own edit. Nothing
is built for that and no field exists for it — noted here so the two are not
merged later on the assumption they were always one feature.

**Presence is not here.** Who is looking at what right now is wrong within
seconds of being written and belongs in a live channel rather than a table.

---

## Where a row can grow

`comments.blocks` has no ceiling in the validator — a bound on how long a remark
may be is set where the value is accepted, not by a part scheme. Nothing else
here grows: a thread is an anchor, and an activity row is a handful of short
strings.

---

## Files

```text
app/src/lib/capabilities/comments/
├── overview.md
├── schema/
│   ├── schema.md
│   ├── comment-threads.ts
│   ├── comments.ts
│   └── tables.ts                 commentsTables
└── types/
    ├── types.md
    ├── anchor.ts                 AnchorWithin
    └── mention.ts                Mention

app/src/lib/capabilities/activity/
├── overview.md
└── schema.ts                     activityTables
```

`activity` is one table, so `schema.ts` stays a file.

### Registering them

```js
// app/svelte.config.js
      $activity: "src/lib/capabilities/activity",
      $comments: "src/lib/capabilities/comments",
```

```json
// app/src/convex/tsconfig.json
      "$activity/*": ["../lib/capabilities/activity/*"],
      "$comments/*": ["../lib/capabilities/comments/*"],
```

```ts
// app/src/convex/schema.ts — the fragment list appears twice
import { activityTables } from "$activity/schema";
import { commentsTables } from "$comments/schema/tables";
```

**Imports it does not define:** [`$content/types/block`](content.md),
[`$shared/types/actor`](shared.md#actor),
[`$shared/types/resource`](resource-sets.md#the-vocabulary).

## Related

[all tables](README.md) · [content](content.md) · [revisions](revisions.md)
