import type { Scope } from "$access/types/access";
import type { QueryCtx } from "$convex/_generated/server";
import type { LinkBearerKind, LinkSubjectKind } from "$research-links/types/research-link";

/** The kind half of an endpoint names the table the id half has to come from. */
const tableOf = {
  finding: "findings",
  hypothesis: "hypotheses",
  question: "questions"
} as const;

export type EndpointKind = LinkBearerKind | LinkSubjectKind;

/** An end of an edge, with the line a reader recognizes it by. */
export type Endpoint = { readonly id: string; readonly label: string };

/**
 * The row an endpoint names, when it is one the caller's project holds.
 *
 * **`null` rather than a refusal**, because the two callers want different
 * things from the same lookup: `link` refuses to draw an edge to a row it cannot
 * see, and `unlink` only wants a label and must still work when the row is gone
 * — which is exactly when a dangling edge is being cleaned up.
 *
 * `normalizeId` is what makes `(kind, id)` a key rather than two loose columns:
 * an id minted for another table normalizes to nothing, so the pair either names
 * a row or names nothing.
 *
 * The label is the object's own sentence because the activity log freezes it in
 * and has to still read after the row it came from is deleted.
 */
export const endpointIn = async (
  ctx: QueryCtx,
  scope: Scope,
  kind: EndpointKind,
  id: string
): Promise<Endpoint | null> => {
  const normalized = ctx.db.normalizeId(tableOf[kind], id);
  if (normalized === null) return null;

  const row = await ctx.db.get(normalized);
  if (!row || row.projectId !== scope.projectId) return null;

  if ("title" in row) return { id, label: row.title };
  if ("statement" in row) return { id, label: row.statement };
  return { id, label: row.text };
};
