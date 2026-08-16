import { v } from "convex/values";
import { projectMutation, projectQuery } from "$convex/functions";
import { branch as branchThread } from "$persona-threads/api/branch/branch";
import { list as listThreads } from "$persona-threads/api/list/list";
import { read as readThread } from "$persona-threads/api/read/read";
import { rename as renameThread } from "$persona-threads/api/rename/rename";
import { start as startThread } from "$persona-threads/api/start/start";

/**
 * Persona threads' public surface — `api.capabilities.personaThreads.*`.
 *
 * **Nothing here reads or writes a message.** A turn is
 * `api.capabilities.messages.*` naming this thread's id, so the two capabilities
 * meet at the index and nowhere else.
 *
 * **`branch` takes a title, not a transcript.** What came before is reached
 * through `branchedFrom`; a client that could send the earlier turns could send
 * different ones.
 */
export const list = projectQuery({
  args: { personaId: v.optional(v.id("personas")) },
  handler: (ctx, args) => listThreads(ctx, ctx.scope, args.personaId)
});

export const read = projectQuery({
  args: { threadId: v.id("personaThreads") },
  handler: (ctx, args) => readThread(ctx, ctx.scope, args.threadId)
});

export const start = projectMutation({
  args: { personaId: v.id("personas"), title: v.string() },
  handler: (ctx, args) => startThread(ctx, ctx.scope, args.personaId, args.title)
});

export const branch = projectMutation({
  args: {
    threadId: v.id("personaThreads"),
    messageId: v.id("messages"),
    title: v.optional(v.string())
  },
  handler: (ctx, args) =>
    branchThread(ctx, ctx.scope, { threadId: args.threadId, messageId: args.messageId }, args.title)
});

export const rename = projectMutation({
  args: { threadId: v.id("personaThreads"), title: v.string() },
  handler: (ctx, args) => renameThread(ctx, ctx.scope, args.threadId, args.title)
});
