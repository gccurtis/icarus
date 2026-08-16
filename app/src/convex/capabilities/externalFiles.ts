import { v } from "convex/values";
import { projectMutation, projectQuery } from "$convex/functions";
import { ingest as ingestFile } from "$external-files/api/ingest/ingest";
import { list as listFiles } from "$external-files/api/list/list";
import { recordExtraction as recordFileExtraction } from "$external-files/api/record-extraction/record-extraction";
import { remove as removeFile } from "$external-files/api/remove/remove";
import { extractionOutcomeValidator } from "$external-files/types/external-file";

/**
 * External files' public surface — `api.capabilities.externalFiles.*`.
 *
 * **`ingest` fixes the origin at `upload`, because that is the only one a
 * browser can honestly claim.** A connector pull, an agent's export, and a
 * research capture all originate server-side and call the handler with their own
 * origin; accepting one here would let a caller sign a file as an agent's work.
 * The actor is built from `ctx.scope` for the same reason.
 *
 * `name`, `mimeType`, and `size` describe bytes already in storage — the caller
 * uploaded them and is the only one who knows what they were called. `kind` is
 * not an argument: it is read off the name.
 */
export const list = projectQuery({
  args: {},
  handler: (ctx) => listFiles(ctx, ctx.scope)
});

export const ingest = projectMutation({
  args: {
    storageId: v.id("_storage"),
    name: v.string(),
    mimeType: v.string(),
    size: v.number(),
    supersedes: v.optional(v.id("externalFiles"))
  },
  handler: (ctx, args) =>
    ingestFile(
      ctx,
      ctx.scope,
      { kind: "user", userId: ctx.scope.userId },
      { ...args, origin: { kind: "upload" } }
    )
});

export const recordExtraction = projectMutation({
  args: { fileId: v.id("externalFiles"), outcome: extractionOutcomeValidator },
  handler: (ctx, args) => recordFileExtraction(ctx, ctx.scope, args.fileId, args.outcome)
});

export const remove = projectMutation({
  args: { fileId: v.id("externalFiles") },
  handler: (ctx, args) => removeFile(ctx, ctx.scope, args.fileId)
});
