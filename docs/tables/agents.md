# Agents

Three tables: a reusable identity, a conversation with one, and a unit of work
handed to one.

`personas` · `personaThreads` · `agentTasks`

**Neither `personaThreads` nor `agentTasks` stores its conversation.** Each
carries a `threadId` into [threads](threads.md), where the messages and the
branch point live.

---

## `personas`

`app/src/lib/capabilities/personas/schema.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { personaAvatarValidator, castValidator } from "$personas/types/persona";
import { personaDefinitionValidator } from "$personas/types/definition";
import { actorValidator } from "$shared/types/actor";
import { resourceSelectionValidator } from "$shared/types/resource-selection";

/**
 * A reusable agent identity.
 *
 * **`projectId` is optional**, and this is the only table where that is true: a
 * built-in persona belongs to no project. The index still leads with it — an
 * absent field sorts before every id, so globals are their own key range, and
 * neither range can reach another project's rows.
 */
export const personasTables = {
  personas: defineTable({
    projectId: v.optional(v.id("projects")),
    /** The mention handle and the attribution label. Trimmed, never empty. */
    name: v.string(),
    description: v.optional(v.string()),
    definition: personaDefinitionValidator,
    /** Retrievable material. Never rendered into a prompt. */
    scope: v.optional(resourceSelectionValidator),
    cast: v.optional(castValidator),
    /** Names, trimmed and deduped. Not grants. */
    tools: v.array(v.string()),
    avatar: v.optional(personaAvatarValidator),
    createdBy: actorValidator,
    revision: v.number(),
    updatedAt: v.number()
  })
    .index("by_project", ["projectId"])
    .index("by_project_name", ["projectId", "name"])
};
```

`app/src/lib/capabilities/personas/types/definition.ts`

```ts
import { v } from "convex/values";

/**
 * How a persona behaves, as five sections answering five questions.
 *
 * | Section | Question |
 * | --- | --- |
 * | `focus` | what is this about? |
 * | `background` | what do you already know? |
 * | `approach` | how should you work? |
 * | `outputPreferences` | what comes out? |
 * | `verification` | when are you done? |
 *
 * Five named fields rather than a list: the set is closed, so a list would allow
 * duplicates and omissions.
 *
 * **`background` is not `scope`.** Background is inline knowledge that is in the
 * prompt on every call. Scope is retrievable material that is never rendered.
 */
export const personaDefinitionValidator = v.object({
  focus: v.string(),
  background: v.string(),
  approach: v.string(),
  outputPreferences: v.string(),
  verification: v.string()
});
```

`app/src/lib/capabilities/personas/types/persona.ts`

```ts
import { v } from "convex/values";

const levelValidator = v.union(v.literal("low"), v.literal("medium"), v.literal("high"));

/**
 * What kind of model a persona wants — never which one. Nothing in the schema
 * names a model.
 */
export const castValidator = v.object({
  label: v.string(),
  strength: levelValidator,
  speed: levelValidator
});

/**
 * A face. A union, so "no avatar" has one representation.
 *
 * The picture is in `_storage`, not `externalFiles` — that table is project
 * material.
 */
export const personaAvatarValidator = v.union(
  v.object({ kind: v.literal("emoji"), emoji: v.string() }),
  v.object({ kind: v.literal("image"), storageId: v.id("_storage") })
);
```

**`tools` is names, not grants.** No scopes, conditions, or expiry — absence from
the list is the whole restriction, and the enforcement point is the tool
implementation regardless.

---

## `personaThreads`

`app/src/lib/capabilities/persona-threads/schema.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { actorValidator } from "$shared/types/actor";

/**
 * A chat with a persona.
 *
 * Separate from `agentTasks` because a task has a lifecycle, is indexed by
 * status, and can be an actor other rows attribute work to.
 *
 * **`threadId` is the conversation**, and nothing of it is here: the messages
 * are `threadParts` and the branch point is on `threads`. What this row holds
 * is what makes the conversation a persona chat.
 *
 * `by_thread` is the way back — a thread reached by id finds the chat that owns
 * it once `threads.kind` says which table to look in.
 */
export const personaThreadsTables = {
  personaThreads: defineTable({
    projectId: v.id("projects"),
    threadId: v.id("threads"),
    personaId: v.id("personas"),
    title: v.string(),
    createdBy: actorValidator,
    updatedAt: v.number()
  })
    .index("by_thread", ["projectId", "threadId"])
    .index("by_project", ["projectId", "updatedAt"])
    .index("by_persona", ["projectId", "personaId", "updatedAt"])
};
```

---

## `agentTasks`

`app/src/lib/capabilities/agent-tasks/schema.ts`

```ts
import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
  agentTaskStatusValidator,
  taskPromptValidator
} from "$agent-tasks/types/agent-task";
import { actorValidator } from "$shared/types/actor";

/**
 * One unit of work handed to an agent.
 *
 * The conversation is `threadId`, exactly as it is for a persona chat. What is
 * here is the lifecycle: a status to index by, the message that was the
 * instruction, and what the agent is carrying between turns.
 */
export const agentTasksTables = {
  agentTasks: defineTable({
    projectId: v.id("projects"),
    threadId: v.id("threads"),

    title: v.string(),
    description: v.optional(v.string()),
    personaId: v.optional(v.id("personas")),

    /** Which message is the instruction. */
    prompt: taskPromptValidator,

    status: agentTaskStatusValidator,
    origin: actorValidator,

    /** What the agent said it would do. A string for now. */
    plan: v.optional(v.string()),
    /** Whatever else the agent persists across turns. Opaque here. */
    data: v.optional(v.string()),

    error: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    updatedAt: v.number()
  })
    .index("by_thread", ["projectId", "threadId"])
    .index("by_project_status", ["projectId", "status", "updatedAt"])
    .index("by_persona", ["projectId", "personaId", "updatedAt"])
};
```

`app/src/lib/capabilities/agent-tasks/types/agent-task.ts`

```ts
import { v } from "convex/values";

/**
 * Where a task stands.
 *
 * **`waiting` is not `running`.** A task blocked on human input consumes nothing.
 * **`cancelled` is not `failed`.** Somebody stopping a task is not an error.
 * `draft` is a task that exists and has not begun.
 */
export const agentTaskStatusValidator = v.union(
  v.literal("draft"),
  v.literal("running"),
  v.literal("waiting"),
  v.literal("complete"),
  v.literal("failed"),
  v.literal("cancelled")
);

/**
 * Which message is the instruction.
 *
 * **The prompt is not the first message.** A task can begin from a conversation
 * already in progress; everything before the prompt is inherited context.
 *
 * A reference rather than a copy, so the instruction cannot drift from the
 * message it was read out of.
 */
export const taskPromptValidator = v.object({
  messageId: v.string(),
  index: v.number()
});
```

**No `result`.** A task's output is messages, and a message that is the outcome
carries a label. [`Message.labels`](threads.md#message) is general-purpose; this
is one use of it.

**`plan` and `data` are strings** — JSON for now. How planning works is its own
question.

---

## Files

```text
app/src/lib/capabilities/personas/
├── schema.ts
└── types/{persona.ts, definition.ts}

app/src/lib/capabilities/persona-threads/schema.ts

app/src/lib/capabilities/agent-tasks/
├── schema.ts
└── types/agent-task.ts
```

**Imports it does not define:** [`$shared/types/actor`](shared.md#actor),
[`$shared/types/resource-selection`](resource-sets.md#the-selection).

`Message` and `BranchPoint` are no longer here: both are held by
[threads](threads.md), which is the only table group that stores a conversation.

## Related

[all tables](README.md) · [threads](threads.md) · [knowledge](knowledge.md)
