import type { Scope } from "$access/types/access";
import type { QueryCtx } from "$convex/_generated/server";
import type { ExternalFile } from "$external-files/types/external-file";

/**
 * One project's files, metadata only — the bytes are in storage and a list never
 * touches them.
 *
 * Superseded rows are returned too. They are still files, still referenced, and
 * which of them a surface shows is its own decision: a picker folds the chain by
 * `supersedes`, an audit view wants every link in it.
 */
export const list = async (ctx: QueryCtx, scope: Scope): Promise<ExternalFile[]> => {
  const rows = await ctx.db
    .query("externalFiles")
    .withIndex("by_project", (q) => q.eq("projectId", scope.projectId))
    .collect();

  // `projectId` stops here: every file returned is from the project that was
  // asked about, so repeating it per row says nothing.
  return rows.map((file) => ({
    id: file._id,
    storageId: file.storageId,
    name: file.name,
    extension: file.extension,
    mimeType: file.mimeType,
    size: file.size,
    kind: file.kind,
    origin: file.origin,
    supersedes: file.supersedes,
    extraction: file.extraction,
    createdBy: file.createdBy,
    updatedAt: file.updatedAt
  }));
};
