import type { ReadProjectOverviewResult } from "$capabilities/project/index.remote";

/**
 * Who is asking, and about what.
 *
 * The server resolves both identities from the current session and project route,
 * then publishes them in the current overview projection. This module only reads
 * that admitted snapshot; it does not initiate another remote query.
 */

/** The project this store is about. It holds exactly one. */
export const projectId = (overview: ReadProjectOverviewResult | undefined): string =>
  overview?.projectId ?? "";

/**
 * The signed-in person's exact scoped id.
 *
 * This is the exact id admitted by the scoped overview capability.
 */
export const viewerId = (overview: ReadProjectOverviewResult | undefined): string =>
  overview?.viewerId ?? "";
