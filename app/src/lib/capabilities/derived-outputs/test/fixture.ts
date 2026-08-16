import type { Scope } from "$access/types/access";
import type { ContentBlock } from "$content/types/block";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "$convex/_generated/server";
import { derivedOutputsRefusal } from "$derived-outputs/errors";
import type { DerivedInput, InputRevision } from "$derived-outputs/types/derived-output";
import { emptyBlock } from "$derived-outputs/types/derived-output";
import { fakeCtx } from "$shared/test/fake-ctx";

/** The fake `db` is structural; no handler here touches anything else on a ctx. */
export const asCtx = (ctx: ReturnType<typeof fakeCtx>) => ctx as unknown as MutationCtx & QueryCtx;

/** A scope exists only because the gate produced one, so the tests hand one over. */
export const scopeOf = (projectId: string, userId: string) =>
  ({ projectId, userId }) as unknown as Scope;

export const NOW = 1_700_000_000_000;

/** The caller, and a project they are not asking about to put other people's rows in. */
export const asking = async () => {
  const ctx = fakeCtx();
  const userId = await ctx.db.insert("users", {
    authSubject: "default-user",
    displayName: "Development User",
    updatedAt: NOW
  });
  const mine = await ctx.db.insert("projects", { name: "Development", revision: 1, updatedAt: NOW });
  const theirs = await ctx.db.insert("projects", { name: "Elsewhere", revision: 1, updatedAt: NOW });

  return { ctx, userId, mine, theirs, scope: scopeOf(mine, userId), elsewhere: scopeOf(theirs, userId) };
};

/** One paragraph — a derived output holds exactly one block, so this is the whole content. */
export const paragraph = (text: string, id = "generated"): ContentBlock => ({
  id,
  type: "text",
  variant: "paragraph",
  atoms: [{ id: `${id}a`, kind: "literal", text }],
  display: text,
  marks: []
});

type Row = ReturnType<typeof fakeCtx>;

/**
 * A general resource that exists: the leader anchor `start` writes beside the
 * resource row. Revision 0 until something lands above it.
 */
export const resourceAt = async (ctx: Row, projectId: string, resourceId: string) => {
  await ctx.db.insert("resourceSnapshots", {
    projectId,
    resourceType: "document",
    resourceId,
    revision: 0,
    role: "leader",
    body: { rows: [] },
    at: NOW
  });
  return { kind: "resource", resourceType: "document", resourceId } as const satisfies DerivedInput;
};

/** An edit landing on that resource. Its revision is what staleness compares. */
export const editedTo = async (ctx: Row, projectId: string, resourceId: string, revision: number) =>
  await ctx.db.insert("changeSets", {
    projectId,
    resourceType: "document",
    resourceId,
    revision,
    baseRevision: revision - 1,
    tier: "recent",
    ops: [],
    touched: [],
    actor: { kind: "system" },
    at: NOW
  });

/** A finding, whose writeup is revised in place. */
export const findingAt = async (ctx: Row, projectId: string, revision: number): Promise<Id<"findings">> =>
  (await ctx.db.insert("findings", {
    projectId,
    title: "Revenue grew",
    body: [],
    sources: [],
    createdBy: { kind: "system" },
    updatedBy: { kind: "system" },
    revision,
    updatedAt: NOW
  })) as Id<"findings">;

/** A file. Bytes are immutable, so it has no revision to move. */
export const fileAt = async (ctx: Row, projectId: string): Promise<Id<"externalFiles">> =>
  (await ctx.db.insert("externalFiles", {
    projectId,
    storageId: "_storage:1",
    name: "report.pdf",
    extension: "pdf",
    mimeType: "application/pdf",
    size: 1024,
    kind: "document",
    origin: { kind: "upload" },
    createdBy: { kind: "system" },
    updatedAt: NOW
  })) as Id<"externalFiles">;

/** A question, and the findings hanging off it. */
export const questionWith = async (
  ctx: Row,
  projectId: string,
  findingIds: Id<"findings">[]
): Promise<Id<"questions">> => {
  const questionId = (await ctx.db.insert("questions", {
    projectId,
    text: "Did revenue grow?",
    notes: [],
    status: "open",
    createdBy: { kind: "system" },
    revision: 1,
    updatedAt: NOW
  })) as Id<"questions">;

  for (const findingId of findingIds) await attach(ctx, projectId, questionId, findingId);
  return questionId;
};

/** One more finding bearing on a question — the membership a question input records. */
export const attach = async (
  ctx: Row,
  projectId: string,
  questionId: Id<"questions">,
  findingId: Id<"findings">
) =>
  await ctx.db.insert("researchLinks", {
    projectId,
    bearerKind: "finding",
    bearerId: findingId,
    subjectKind: "question",
    subjectId: questionId,
    bearing: "supports",
    createdBy: { kind: "system" }
  });

/** An output as some earlier generation left it, written without going through a handler. */
export const outputRow = async (
  ctx: Row,
  projectId: string,
  fields: Partial<{
    prompt: string;
    inputs: DerivedInput[];
    inputsAt: InputRevision[];
    block: ContentBlock;
    state: string;
    error: string;
    refreshedAt: number;
    model: string;
  }> = {}
) =>
  (await ctx.db.insert("derivedOutputs", {
    projectId,
    prompt: "Summarize the findings",
    scope: undefined,
    inputs: [],
    inputsAt: [],
    block: emptyBlock(),
    state: "idle",
    createdBy: { kind: "system" },
    updatedAt: NOW,
    ...fields
  })) as Id<"derivedOutputs">;

export const stored = (ctx: Row, id: string) => ctx.rows.get(id) as Record<string, unknown>;

/**
 * The refusal a call produced, or `undefined` if it produced none.
 *
 * The payload rather than the message, because the payload is the only part
 * Convex serializes: a plain `Error` still matches `/not found/` here and still
 * reaches the browser as an opaque server fault.
 */
export const refusalFrom = async (call: Promise<unknown>) =>
  await call.then(
    () => undefined,
    (error: unknown) => derivedOutputsRefusal(error)
  );
