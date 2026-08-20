# Threads

Two tables holding every conversation in the schema.

`threads` · `threadParts`

**Three tables own a conversation and none of them holds one.** A persona chat,
an agent task, and a research thread each carry an id into `threads`, which is
the one id space the three share. That is the whole reason this table exists: a
part, a branch, and a citation can then name a thread with a real `v.id` rather
than a `(kind, id)` pair the reader has to unpack.

---

## `threads`

`app/src/lib/capabilities/threads/schema/threads.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { branchPointValidator } from "$threads/types/branch-point";

/**
 * A conversation's identity, and almost nothing else.
 *
 * **`kind` is the way back.** A bare thread id — out of a branch point, out of
 * a finding's citation — has to reach the row that owns it, and one stored
 * field beats three speculative lookups against three tables.
 *
 * **`branchedFrom` lives here** because branching is a property of the
 * conversation rather than of the thing that owns it: a chat becomes a task, a
 * task becomes a chat, and either can branch from one of its own. On the owners
 * it would be the same field written three times.
 *
 * `title`, `updatedAt`, and the actor who started it stay on the owner. A task
 * list indexes by status and recency and renders titles from the rows it
 * already read; moving them here would make every list N lookups deeper.
 */
export const threads = defineTable({
  projectId: v.id("projects"),
  kind: v.union(
    v.literal("researchThread"),
    v.literal("personaThread"),
    v.literal("agentTask")
  ),
  branchedFrom: v.optional(branchPointValidator)
});
```

**No index.** Nothing lists threads — a thread is reached by the id its owner
holds, and every listing in the schema is a listing of owners. `projectId` is
still stored: an id arriving from a link is checkable against the caller's
project on the row it names, without a second read.

---

## `threadParts`

`app/src/lib/capabilities/threads/schema/thread-parts.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { messageValidator } from "$threads/types/message";

/**
 * A slice of one conversation.
 *
 * A Convex document caps at 1 MiB and a patch rewrites the whole document, and
 * nothing bounds how large one message is — so a conversation is rows rather
 * than a field. `messages` concatenates in part order.
 *
 * **A thread with no messages has no parts.** There is no empty part 0, so a
 * conversation that has not started is one row in `threads` and its owner.
 *
 * Nothing but messages is here. Everything a conversation knows about itself is
 * on `threads` or on its owner, so a part carries no field that could disagree
 * with the part beside it.
 */
export const threadParts = defineTable({
  projectId: v.id("projects"),
  threadId: v.id("threads"),
  part: v.number(),
  messages: v.array(messageValidator)
}).index("by_thread", ["projectId", "threadId", "part"]);
```

A thread with one part is what a thread looks like normally.
`maxMessagesPerThread` in configuration is the separate bound on how long a
conversation runs.

---

## `Message`

`app/src/lib/capabilities/threads/types/message.ts`

```ts
import { v, type Infer } from "convex/values";
import { blockValidator } from "$content/types/block";
import { actorValidator } from "$shared/types/actor";
import { resourceRefValidator } from "$shared/types/resource";

/**
 * One message.
 *
 * `id` is a string local to its thread, not an id into a table — messages are
 * not rows, so there is nothing to point at.
 *
 * Ordering is array position. `sentAt` is for display.
 *
 * **`author` is optional, and absent on a response means the thread's own
 * responder.** Attributing a persona's reply therefore never requires inventing
 * a unit of work nobody asked for.
 */
export const messageValidator = v.object({
  id: v.string(),
  role: v.union(v.literal("prompt"), v.literal("response")),
  author: v.optional(actorValidator),
  sentAt: v.number(),
  blocks: v.array(blockValidator),
  attachments: v.optional(v.array(resourceRefValidator)),
  labels: v.optional(v.array(v.string())),
  state: v.union(v.literal("streaming"), v.literal("complete"), v.literal("error")),
  error: v.optional(v.string())
});

export type Message = Infer<typeof messageValidator>;
```

**A message cites by writing.** A URL it drew on is a `link` mark on a span, and
project material it pulled in is an `attachments` entry — the same two devices
every other block of prose uses. There is no third citation field.

---

## `BranchPoint`

`app/src/lib/capabilities/threads/types/branch-point.ts`

```ts
import { v, type Infer } from "convex/values";

/**
 * Where a conversation was cut to start another one.
 *
 * **There is no `threadKind` here.** `threads.kind` holds it, so a branch point
 * is one id and the two numbers that locate a message inside it.
 *
 * `messageId` is only unique within its own thread, which is why the thread is
 * named at all. `index` says which message within that one, since consecutive
 * messages from one author may be stored together.
 */
export const branchPointValidator = v.object({
  threadId: v.id("threads"),
  messageId: v.string(),
  index: v.number()
});

export type BranchPoint = Infer<typeof branchPointValidator>;
```

---

## The three owners

Each holds one `threadId` and an index on it, so a thread reached by id can find
the row that owns it once `threads.kind` says which table to look in.

| Owner | What makes it that kind |
| --- | --- |
| [`personaThreads`](agents.md#personathreads) | the persona it is a chat with |
| [`agentTasks`](agents.md#agenttasks) | a status, a prompt, and a lifecycle |
| [`researchThreads`](investigation.md#researchthreads) | a mode anchored to a question or hypothesis |

**There is still no `messages` table.** A part holds many messages; a row per
message would multiply the count of the largest thing in a project by the size
of its smallest unit, and buy an ordering the array already has.

---

## Where a row can grow

`threadParts.messages` is the field `part` exists for. Nothing else here grows:
`threads` is four scalars.

---

## Files

```text
app/src/lib/capabilities/threads/
├── overview.md
├── schema/
│   ├── schema.md
│   ├── threads.ts
│   ├── thread-parts.ts
│   └── tables.ts                 threadsTables
└── types/
    ├── types.md
    ├── message.ts                Message
    └── branch-point.ts           BranchPoint

app/configuration/agents.yaml     maxMessagesPerThread
```

### Registering it

```js
// app/svelte.config.js
      $threads: "src/lib/capabilities/threads",
```

```json
// app/src/convex/tsconfig.json
      "$threads/*": ["../lib/capabilities/threads/*"],
```

```ts
// app/src/convex/schema.ts — the fragment list appears twice
import { threadsTables } from "$threads/schema/tables";
```

**Imports it does not define:** [`$content/types/block`](content.md),
[`$shared/types/actor`](shared.md#actor),
[`$shared/types/resource`](resource-sets.md#the-vocabulary).

## Related

[all tables](README.md) · [agents](agents.md) · [investigation](investigation.md)
