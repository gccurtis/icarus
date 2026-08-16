import { v } from "convex/values";
import { projectMutation, projectQuery } from "$convex/functions";
import { create as createDocument } from "$documents/api/create/create";
import { list as listDocuments } from "$documents/api/list/list";
import { remove as removeDocument } from "$documents/api/remove/remove";
import { rename as renameDocument } from "$documents/api/rename/rename";

/**
 * Documents' public surface — `api.capabilities.documents.*`.
 *
 * Everything a browser can do to a document's metadata, and nothing it can do to
 * its content: editing is `revisions.submit` in pass 2, against a table this
 * capability does not own.
 *
 * **`v.id("documents")` proves the argument is a document id, not that it is
 * this project's.** The second half is `requireDocument`, inside the handler,
 * because it needs the scope the gate produced — and it answers "not found"
 * either way, so a caller cannot use the difference to learn what exists.
 */
export const list = projectQuery({
  args: {},
  handler: (ctx) => listDocuments(ctx, ctx.scope)
});

export const create = projectMutation({
  args: { title: v.string(), templateId: v.optional(v.string()) },
  handler: (ctx, args) => createDocument(ctx, ctx.scope, args.title, args.templateId)
});

export const rename = projectMutation({
  args: { documentId: v.id("documents"), title: v.string() },
  handler: (ctx, args) => renameDocument(ctx, ctx.scope, args.documentId, args.title)
});

export const remove = projectMutation({
  args: { documentId: v.id("documents") },
  handler: (ctx, args) => removeDocument(ctx, ctx.scope, args.documentId)
});
