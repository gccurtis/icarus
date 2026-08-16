import type { Scope } from "$access/types/access";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "$convex/_generated/server";
import { resourceSetsRefusal } from "$resource-sets/errors";
import type { Actor } from "$shared/types/actor";
import type { SetExpression } from "$shared/types/set-expression";
import { fakeCtx } from "$shared/test/fake-ctx";

/** The fake `db` is structural; no handler here touches anything else on a ctx. */
export const asCtx = (ctx: ReturnType<typeof fakeCtx>) => ctx as unknown as MutationCtx & QueryCtx;

/** A scope exists only because the gate produced one, so the tests hand one over. */
export const scopeOf = (projectId: string, userId: string) =>
  ({ projectId, userId }) as unknown as Scope;

const NOW = 1_700_000_000_000;

type Ctx = ReturnType<typeof fakeCtx>;

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

  return { ctx, userId, scope: scopeOf(mine, userId), elsewhere: scopeOf(theirs, userId) };
};

const by = (scope: Scope): Actor => ({ kind: "user", userId: scope.userId });

/**
 * Rows of the kinds a set selects. Written straight to the fake rather than
 * through each capability's `create`, so a resolution test fails for reasons
 * about resolution.
 */
const rowIn = async (ctx: Ctx, scope: Scope, table: string, fields: Record<string, unknown>) =>
  await ctx.db.insert(table, {
    projectId: scope.projectId,
    createdBy: by(scope),
    updatedBy: by(scope),
    updatedAt: NOW,
    ...fields
  });

export const aDocument = (ctx: Ctx, scope: Scope, title = "Notes") =>
  rowIn(ctx, scope, "documents", { title });

export const aDeck = (ctx: Ctx, scope: Scope, title = "Kickoff") =>
  rowIn(ctx, scope, "slideDecks", { title, aspectRatio: "16:9" });

export const aWorkbook = (ctx: Ctx, scope: Scope, title = "Model") =>
  rowIn(ctx, scope, "spreadsheets", { title });

export const aFinding = (ctx: Ctx, scope: Scope, title = "Margin fell") =>
  rowIn(ctx, scope, "findings", { title, body: [], sources: [], revision: 1 });

export const aTemplate = (ctx: Ctx, scope: Scope, name = "Weekly report") =>
  rowIn(ctx, scope, "templates", { name, target: "document", body: {}, slots: [], revision: 1 });

/** An uploaded file, unless a connector is named — then one that connector pulled in. */
export const aFile = (ctx: Ctx, scope: Scope, name = "notes.md", connectorId?: string) =>
  rowIn(ctx, scope, "externalFiles", {
    name,
    extension: "md",
    mimeType: "text/markdown",
    size: 12,
    kind: "ext-text",
    storageId: "storage:1",
    origin: connectorId
      ? { kind: "connector", connectorId, externalId: name }
      : { kind: "upload" }
  });

export const aSet = (ctx: Ctx, scope: Scope, name: string, expression: SetExpression) =>
  rowIn(ctx, scope, "resourceSets", { name, expression, revision: 1 });

/** One row of every kind, so a `project` resolution has something of each. */
export const someOfEverything = async (ctx: Ctx, scope: Scope) => ({
  document: await aDocument(ctx, scope),
  slides: await aDeck(ctx, scope),
  spreadsheet: await aWorkbook(ctx, scope),
  externalFile: await aFile(ctx, scope),
  finding: await aFinding(ctx, scope),
  template: await aTemplate(ctx, scope)
});

/**
 * A stored set id, as an expression that references it.
 *
 * Typed as the one member rather than `SetExpression`, because the whole union
 * is the outermost level of a finite nesting and cannot sit inside itself. A
 * selector can, at every depth — which is the point of `{ op: "set" }`.
 */
export const setRef = (setId: string): { op: "set"; setId: Id<"resourceSets"> } => ({
  op: "set",
  setId: setId as Id<"resourceSets">
});

/**
 * The refusal a call produced, or `undefined` if it produced none.
 *
 * The payload rather than the message, because the payload is the only part
 * Convex serializes: a plain `Error` still matches `/cycle/` here and still
 * reaches the browser as an opaque server fault.
 */
export const refusalFrom = async (call: Promise<unknown>) =>
  await call.then(
    () => undefined,
    (error: unknown) => resourceSetsRefusal(error)
  );
