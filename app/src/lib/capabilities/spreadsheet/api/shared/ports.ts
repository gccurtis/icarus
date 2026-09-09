import type { StoreUnitOfWork } from "$model/server/store/index.server";

/**
 * The smallest port a procedure that only looks can be handed.
 *
 * A read is the same operation inside a transaction and outside one, so a
 * helper asking for this can be given the Store or the unit of work staging an
 * intent, and neither has to know which it is.
 */
export type StoreReads = Pick<StoreUnitOfWork, "read">;
