import type { Scope } from "$access/types/access";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "$convex/_generated/server";
import { emptyDocumentBody } from "$documents/types/body";
import { fakeCtx } from "$shared/test/fake-ctx";
import { emptySlideDeckBody } from "$slide-decks/types/body";
import { emptySpreadsheetBody } from "$spreadsheets/types/body";
import { templatesRefusal } from "$templates/errors";
import type { TemplateBody } from "$templates/types/body";

/** The fake `db` is structural; no handler here touches anything else on a ctx. */
export const asCtx = (ctx: ReturnType<typeof fakeCtx>) => ctx as unknown as MutationCtx & QueryCtx;

/** A scope exists only because the gate produced one, so the tests hand one over. */
export const scopeOf = (projectId: string, userId: string) =>
  ({ projectId, userId }) as unknown as Scope;

const NOW = 1_700_000_000_000;

/**
 * The caller, and a second project they are not asking about — templates is the
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

/** A body with something in it, so a copy can be told apart from an empty start. */
export const documentTemplateBody = (heading = "Client report"): TemplateBody => ({
  target: "document",
  ...emptyDocumentBody(),
  rows: [
    {
      id: "r1",
      kind: "blocks",
      blocks: [
        {
          id: "b1",
          type: "text",
          variant: "heading",
          atoms: [{ id: "a1", kind: "literal", text: heading }],
          display: heading,
          marks: []
        }
      ]
    }
  ]
});

export const slidesTemplateBody = (): TemplateBody => ({
  target: "slides",
  aspectRatio: "4:3",
  ...emptySlideDeckBody()
});

export const spreadsheetTemplateBody = (): TemplateBody => ({
  target: "spreadsheet",
  ...emptySpreadsheetBody()
});

/**
 * A template belonging to no project. Written straight to the table because
 * nothing in the project-scoped surface can make one — that is the point of
 * [`create`](../api/create/create.md) always stamping the caller's project.
 */
export const globalTemplate = async (ctx: ReturnType<typeof fakeCtx>, name: string) =>
  (await ctx.db.insert("templates", {
    name,
    target: "document",
    body: documentTemplateBody(name),
    slots: [],
    createdBy: { kind: "system" },
    revision: 1,
    updatedAt: NOW
  })) as Id<"templates">;

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
    (error: unknown) => templatesRefusal(error)
  );
