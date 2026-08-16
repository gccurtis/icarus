import type { Scope } from "$access/types/access";
import type { Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import { requireFile } from "$external-files/api/shared/require-file";
import type { FileOrigin } from "$external-files/types/external-file";

/**
 * What an arriving file replaces, if anything.
 *
 * A person re-uploading says which file they mean. **A connector re-sync cannot**
 * — it holds the provider's id, not ours — so its match is the index: same
 * connector, same external id, newest row. Without that, every remote change
 * would land as a duplicate instead of a version, under references made to the
 * content it replaced.
 *
 * Newest rather than first, so a third sync extends the chain rather than
 * forking it off the original.
 */
export const previousVersion = async (
  ctx: QueryCtx,
  scope: Scope,
  origin: FileOrigin,
  supersedes?: Id<"externalFiles">
): Promise<Id<"externalFiles"> | undefined> => {
  if (supersedes) return (await requireFile(ctx, scope, supersedes))._id;
  if (origin.kind !== "connector") return undefined;

  const previous = await ctx.db
    .query("externalFiles")
    .withIndex("by_connector_external", (q) =>
      q
        .eq("projectId", scope.projectId)
        .eq("origin.connectorId", origin.connectorId)
        .eq("origin.externalId", origin.externalId)
    )
    .order("desc")
    .first();

  return previous?._id;
};
