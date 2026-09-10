import { command, query } from "$app/server";

import { readComments as readCommentsProcedure } from "$capabilities/comments/api/read-comments/read-comments";
import { reply as replyProcedure } from "$capabilities/comments/api/reply/reply";
import { resolveThread as resolveThreadProcedure } from "$capabilities/comments/api/resolve-thread/resolve-thread";
import { startThread as startThreadProcedure } from "$capabilities/comments/api/start-thread/start-thread";

export const readComments = query(readCommentsProcedure);

export const startThread = command("unchecked", async (input) => {
  const result = await startThreadProcedure(input);
  await readComments().refresh();
  return result;
});
export const reply = command("unchecked", async (input) => {
  const result = await replyProcedure(input);
  await readComments().refresh();
  return result;
});
export const resolveThread = command("unchecked", async (input) => {
  const result = await resolveThreadProcedure(input);
  await readComments().refresh();
  return result;
});

export type { ReplyInput, ReplyResult } from "$capabilities/comments/types/reply";
export type { ResolveThreadInput, ResolveThreadResult } from "$capabilities/comments/types/resolve-thread";
export type { StartThreadInput, StartThreadResult } from "$capabilities/comments/types/start-thread";
export type {
  CommentActor,
  CommentAnchor,
  CommentPersonRecord,
  CommentRemarkRecord,
  CommentTarget,
  CommentThreadRecord,
  ReadCommentsResult
} from "$capabilities/comments/types/read-comments";
