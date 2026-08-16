import type { Scope } from "$access/types/access";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "$convex/_generated/server";
import { personasRefusal } from "$personas/errors";
import type { PersonaDefinition } from "$personas/types/definition";
import type { PersonaDraft } from "$personas/types/persona";
import { fakeCtx } from "$shared/test/fake-ctx";

/** The fake `db` is structural; no handler here touches anything else on a ctx. */
export const asCtx = (ctx: ReturnType<typeof fakeCtx>) => ctx as unknown as MutationCtx & QueryCtx;

/** A scope exists only because the gate produced one, so the tests hand one over. */
export const scopeOf = (projectId: string, userId: string) =>
  ({ projectId, userId }) as unknown as Scope;

const NOW = 1_700_000_000_000;

/**
 * The caller, and a second project they are not asking about — personas is a
 * capability where "whose is this" has three answers rather than two, so every
 * isolation test needs somewhere else to put a row.
 */
export const asking = async () => {
  const ctx = fakeCtx();
  const userId = await ctx.db.insert("users", {
    authSubject: "default-user",
    displayName: "Development User",
    updatedAt: NOW
  });
  const mine = await ctx.db.insert("projects", { name: "Development", revision: 1, updatedAt: NOW });
  const theirs = await ctx.db.insert("projects", { name: "Elsewhere", revision: 1, updatedAt: NOW });

  return { ctx, userId, scope: scopeOf(mine, userId), elsewhere: scopeOf(theirs, userId) };
};

/** Five empty sections, which is what a pure scope persona is stated as. */
export const blankDefinition = (): PersonaDefinition => ({
  focus: "",
  background: "",
  approach: "",
  outputPreferences: "",
  verification: ""
});

export const definitionOf = (sections: Partial<PersonaDefinition>): PersonaDefinition => ({
  ...blankDefinition(),
  ...sections
});

/** A persona with something to say, so a revision can be told from a fresh row. */
export const draft = (name = "Researcher", sections?: Partial<PersonaDefinition>): PersonaDraft => ({
  name,
  definition: definitionOf(sections ?? { focus: "Margin, not revenue" }),
  tools: []
});

/** A persona in whichever project is asked for, written straight to the table. */
export const personaIn = async (
  ctx: ReturnType<typeof fakeCtx>,
  projectId: string | undefined,
  name: string
) =>
  (await ctx.db.insert("personas", {
    projectId,
    name,
    definition: definitionOf({ focus: name }),
    tools: [],
    createdBy: { kind: "system" },
    revision: 1,
    updatedAt: NOW
  })) as Id<"personas">;

/**
 * A persona belonging to no project. Written straight to the table because
 * nothing in the project-scoped surface can make one — that is the point of
 * [`create`](../api/create/create.md) always stamping the caller's project.
 */
export const globalPersona = async (ctx: ReturnType<typeof fakeCtx>, name: string) =>
  await personaIn(ctx, undefined, name);

/**
 * The refusal a call produced, or `undefined` if it produced none.
 *
 * The payload rather than the message, because the payload is the only part
 * Convex serializes: a plain `Error` still matches /not found/ here and still
 * reaches the browser as an opaque server fault.
 */
export const refusalFrom = async (call: Promise<unknown>) =>
  await call.then(
    () => undefined,
    (error: unknown) => personasRefusal(error)
  );
