import { v, type Infer } from "convex/values";
import { AgentTasksError } from "$agent-tasks/errors";
import type { ContentBlock } from "$content/types/block";
import type { Id } from "$convex/_generated/dataModel";
import type { Actor } from "$shared/types/actor";

/**
 * Where a task stands.
 *
 * **`waiting` is not `running`.** A task blocked on human input consumes nothing
 * and should not appear beside one burning through a model's context; folding
 * them together makes "what is this project spending" unanswerable.
 *
 * **`cancelled` is not `failed`.** Somebody stopping a task is not an error, and
 * merging the two makes a failure rate a measure of how often people change
 * their minds.
 *
 * `draft` is a task that exists and has not begun. It is separate from `running`
 * because `_creationTime` and `startedAt` are different moments.
 */
export const agentTaskStatusValidator = v.union(
  v.literal("draft"),
  v.literal("running"),
  v.literal("waiting"),
  v.literal("complete"),
  v.literal("failed"),
  v.literal("cancelled")
);

export type AgentTaskStatus = Infer<typeof agentTaskStatusValidator>;

/**
 * One line of what the agent said it would do.
 *
 * **A checklist, not a graph.** Dependencies, branching, and retries are
 * execution concerns that belong to whatever is running the task; what is worth
 * storing is the intention and how far it got, because that is what a person
 * watches.
 */
export const planStepValidator = v.object({
  description: v.string(),
  status: v.union(
    v.literal("pending"),
    v.literal("active"),
    v.literal("done"),
    v.literal("skipped"),
    v.literal("failed")
  )
});

export type PlanStep = Infer<typeof planStepValidator>;

/**
 * The persona chat message a task was spun off from.
 *
 * Both halves are stored for the reason a
 * [chat branch](../../persona-threads/types/persona-thread.ts) stores both: the
 * message says where the conversation was cut and the thread says which
 * conversation, so the inherited context is readable without a lookup to find
 * out where the message lived.
 */
export const branchPointValidator = v.object({
  threadId: v.id("personaThreads"),
  messageId: v.id("messages")
});

export type BranchPoint = Infer<typeof branchPointValidator>;

/** A task as its own page renders it. `projectId` stops at the read. */
export type AgentTask = {
  readonly id: Id<"agentTasks">;
  readonly title: string;
  readonly prompt: string;
  readonly description?: string;
  readonly personaId?: Id<"personas">;
  readonly branchedFrom?: BranchPoint;
  readonly status: AgentTaskStatus;
  readonly origin: Actor;
  readonly plan?: PlanStep[];
  readonly result?: ContentBlock[];
  readonly error?: string;
  readonly startedAt?: number;
  readonly finishedAt?: number;
  readonly createdAt: number;
  readonly updatedAt: number;
};

/**
 * A task as a list renders it — without the prompt, the plan, or the deliverable.
 *
 * All three are read on the task itself. A directory of tasks answers "what is
 * running and what came of it", and carrying every result's blocks to do that
 * would make the cheapest question in the capability the most expensive read.
 */
export type AgentTaskSummary = Omit<AgentTask, "prompt" | "plan" | "result">;

/** What a dispatcher states. No project and no origin: both come from the caller. */
export type TaskDispatch = {
  readonly title: string;
  readonly prompt: string;
  readonly description?: string;
  readonly personaId?: Id<"personas">;
  readonly branchedFrom?: BranchPoint;
};

/**
 * The stored form of a title: trimmed, and never empty.
 *
 * It is the `detail` half of every actor label the task produces — *Researcher ·
 * Gabriel Curtis · Q3 competitive scan* — so a blank one is a change in an audit
 * log that says only which persona made it, months after anyone remembers why.
 */
export const taskTitle = (title: string): string => {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    throw new AgentTasksError("empty-title", "A task needs a title to be identified by");
  }
  return trimmed;
};

/**
 * The stored form of a prompt: exactly what was written.
 *
 * **Not trimmed, not normalized, not summarized.** It is what gets sent to the
 * model and it is the task's provenance — everything the task did traces back to
 * it, so the argument against rewriting it later is that it has never been
 * rewritten. A blank one is refused instead, because there is nothing to run.
 */
export const taskPrompt = (prompt: string): string => {
  if (prompt.trim().length === 0) {
    throw new AgentTasksError("empty-prompt", "A task needs an instruction to run");
  }
  return prompt;
};

const FINISHED: ReadonlySet<AgentTaskStatus> = new Set(["complete", "failed", "cancelled"]);

/** Whether a task has stopped. The three are terminal; nothing moves out of them. */
export const hasFinished = (status: AgentTaskStatus): boolean => FINISHED.has(status);

/**
 * Who a task's work is attributed to: the task itself.
 *
 * **Dispatching does not make the dispatcher the actor.** A change set written
 * during a run carries this, not the person in `origin`, which is what keeps an
 * agent's hundred edits out of somebody's Ctrl-Z — undo selects on
 * `actor.kind === "user"`. The dispatcher is still named, for display, by the
 * `onBehalfOf` half of the label.
 */
export const taskActor = (taskId: Id<"agentTasks">): Actor => ({ kind: "agent", taskId });
