import type { Scope } from "$access/types/access";
import type { Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import { asThread } from "$research-threads/api/shared/as-thread";
import { requireThread } from "$research-threads/api/shared/require-thread";
import type { ResearchThread } from "$research-threads/types/research-thread";

/**
 * One thread, for opening it by its own address rather than through a list.
 *
 * It returns what [`list`](../list/list.md) returns per row, because there is no
 * heavier half to withhold: the substance of a thread is its messages, and those
 * are a separate read against a separate table.
 */
export const read = async (
  ctx: QueryCtx,
  scope: Scope,
  id: Id<"researchThreads">
): Promise<ResearchThread> => asThread(await requireThread(ctx, scope, id));
