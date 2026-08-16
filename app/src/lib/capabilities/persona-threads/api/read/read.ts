import type { Scope } from "$access/types/access";
import type { Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import { asThread } from "$persona-threads/api/shared/as-thread";
import { requireThread } from "$persona-threads/api/shared/require-thread";
import type { PersonaThread } from "$persona-threads/types/persona-thread";

/**
 * One thread, for opening it by its own address rather than through a list.
 *
 * It returns what [`list`](../list/list.md) returns per row, because there is no
 * heavier half to withhold: the substance of a chat is its messages, and those
 * are a separate read against a separate table.
 */
export const read = async (
  ctx: QueryCtx,
  scope: Scope,
  id: Id<"personaThreads">
): Promise<PersonaThread> => asThread(await requireThread(ctx, scope, id));
