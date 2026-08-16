import type { Scope } from "$access/types/access";
import type { ActivityEntry } from "$activity/types/activity";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "$convex/_generated/server";
import { fakeCtx } from "$shared/test/fake-ctx";

/** The fake `db` is structural; neither handler touches anything else on a ctx. */
export const asCtx = (ctx: ReturnType<typeof fakeCtx>) => ctx as unknown as MutationCtx & QueryCtx;

/** A scope exists only because the gate produced one, so the tests hand one over. */
export const scopeOf = (projectId: string, userId: string) =>
  ({ projectId, userId }) as unknown as Scope;

const NOW = 1_700_000_000_000;

export const projectNamed = async (ctx: ReturnType<typeof fakeCtx>, name: string) =>
  await ctx.db.insert("projects", { name, revision: 1, updatedAt: NOW });

/** The caller: one user, one project, and the scope the gate would have produced. */
export const asking = async () => {
  const ctx = fakeCtx();
  const userId = await ctx.db.insert("users", {
    authSubject: "default-user",
    displayName: "Development User",
    updatedAt: NOW
  });
  return { ctx, scope: scopeOf(await projectNamed(ctx, "Development"), userId), userId };
};

/** A task nothing was written under: the agent label this capability cannot resolve. */
export const unwrittenTask = "agentTasks:1" as Id<"agentTasks">;

export const entryBy = (userId: string, verb: string): ActivityEntry => ({
  actor: { kind: "user", userId: userId as Id<"users"> },
  verb,
  target: { type: "document", id: "documents:1", label: "Q3 plan" }
});

/**
 * A task that ran, and the persona it ran as — the three-part label's subject.
 *
 * Written straight to the tables rather than through the agent tasks capability:
 * what is under test is that a label is resolved from the rows, not how they got
 * there.
 */
export const taskWith = async (
  ctx: ReturnType<typeof fakeCtx>,
  projectId: string,
  task: { title: string; persona?: string; origin: Record<string, unknown> }
) => {
  const personaId = task.persona
    ? await ctx.db.insert("personas", {
        projectId,
        name: task.persona,
        definition: {
          focus: task.persona,
          background: "",
          approach: "",
          outputPreferences: "",
          verification: ""
        },
        tools: [],
        createdBy: { kind: "system" },
        revision: 1,
        updatedAt: NOW
      })
    : undefined;

  return (await ctx.db.insert("agentTasks", {
    projectId,
    title: task.title,
    prompt: "Scan the market.",
    personaId,
    status: "running",
    origin: task.origin,
    updatedAt: NOW
  })) as Id<"agentTasks">;
};
