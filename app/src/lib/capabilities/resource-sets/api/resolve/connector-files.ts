import type { Scope } from "$access/types/access";
import type { QueryCtx } from "$convex/_generated/server";
import type { ResourceRef } from "$shared/types/set-expression";

/**
 * The files a connector brought in — one connector's, or every connector's when
 * none is named.
 *
 * **A connector ref does not mean the connector.** Scoping to a source is what
 * people actually want: "answer from the material in our Notion", not "answer
 * from a credential record". Resolving it lazily is also what makes a set scoped
 * to a connector pick up whatever the last sync added.
 *
 * It reads `origin.connectorId` rather than a `connectors` table, which does not
 * exist until pass 8. That is not a stopgap: the files are what a set selects
 * either way, so this procedure does not change when the table arrives.
 */
export const connectorFiles = async (
  ctx: QueryCtx,
  scope: Scope,
  connectorId?: string
): Promise<ResourceRef[]> => {
  if (connectorId !== undefined) {
    const pulled = await ctx.db
      .query("externalFiles")
      .withIndex("by_connector_external", (q) =>
        q.eq("projectId", scope.projectId).eq("origin.connectorId", connectorId)
      )
      .collect();
    return pulled.map((file) => ({ kind: "externalFile", id: file._id }));
  }

  // Every connector at once has no index range of its own — the second column is
  // the connector id — so this is the project's files with the uploads dropped.
  const files = await ctx.db
    .query("externalFiles")
    .withIndex("by_project", (q) => q.eq("projectId", scope.projectId))
    .collect();

  return files
    .filter((file) => file.origin.kind === "connector")
    .map((file) => ({ kind: "externalFile", id: file._id }));
};
