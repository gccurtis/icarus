import { command } from "$app/server";

import { reply as replyProcedure } from "$capabilities/comments/api/reply/reply";
import { resolveThread as resolveThreadProcedure } from "$capabilities/comments/api/resolve-thread/resolve-thread";
import { startThread as startThreadProcedure } from "$capabilities/comments/api/start-thread/start-thread";

export const startThread = command("unchecked", startThreadProcedure);
export const reply = command("unchecked", replyProcedure);
export const resolveThread = command("unchecked", resolveThreadProcedure);

export type { ReplyInput, ReplyResult } from "$capabilities/comments/types/reply";
export type { ResolveThreadInput, ResolveThreadResult } from "$capabilities/comments/types/resolve-thread";
export type { StartThreadInput, StartThreadResult } from "$capabilities/comments/types/start-thread";
