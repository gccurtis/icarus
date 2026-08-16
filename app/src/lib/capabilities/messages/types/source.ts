import { v, type Infer } from "convex/values";
import { resourceKindValidator } from "$shared/types/resource";

/**
 * What a turn drew on.
 *
 * A `resource` source names **both** `resourceType` and `resourceId`, never the
 * id alone: the pair is the key, and two resources of different kinds may carry
 * the same id. `file` and `finding` folded into it once findings became a
 * resource kind, which removed two variants differing only in which table they
 * meant.
 *
 * `excerpt` here is a working copy rather than a citation. When a message
 * becomes a finding, its sources are rebuilt with excerpts copied and dated,
 * because a finding's citations must survive independently of the thread.
 */
export const messageSourceValidator = v.union(
  v.object({
    kind: v.literal("resource"),
    resourceType: resourceKindValidator,
    /** `v.string()`: seven kinds answer to it, and a union of id types would make every reader choose. */
    resourceId: v.string(),
    title: v.optional(v.string()),
    excerpt: v.optional(v.string())
  }),
  v.object({
    kind: v.literal("url"),
    url: v.string(),
    title: v.optional(v.string()),
    excerpt: v.optional(v.string())
  }),
  v.object({
    kind: v.literal("lattice"),
    nodeId: v.id("latticeNodes"),
    excerpt: v.optional(v.string())
  })
);

export type MessageSource = Infer<typeof messageSourceValidator>;
