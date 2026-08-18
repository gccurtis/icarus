import type { GeneralResourceType } from "$revisions/types/resource";
import type { RuntimeKey } from "$model/client/resource-runtimes/types";

/**
 * A resource's identity in the register.
 *
 * `:` separates the two halves because a resource type never contains one, so no
 * two different resources can produce one key.
 *
 * Shared because `attach` and `release` must agree on it exactly. Two spellings
 * of the same key is a second runtime for one resource, which is the single
 * thing this object exists to prevent.
 */
export const runtimeKey = (type: GeneralResourceType, id: string): RuntimeKey => `${type}:${id}`;
