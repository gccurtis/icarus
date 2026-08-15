import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * The control plane: who exists, what projects exist, and who may reach which.
 *
 * These are the only tables not scoped to a project, because they are what
 * decides what a project scope *is*. Every other capability's tables carry a
 * `projectId` and lead their indexes with it.
 *
 * **`by_user_and_token` leads with `userId`, not `token`.** A token-first index
 * would resolve any token to its project regardless of who presented it, which
 * is exactly the disclosure this design refuses. With the user first, a copied
 * URL lands in someone else's key range and finds nothing — so the lookup *is*
 * the authorization and there is no separate membership check to forget.
 *
 * Each collaborator on a project holds their own token for it, which is what
 * makes a token safe to put in a URL and useless to pass on.
 */
export const accessTables = {
  users: defineTable({
    /** Stable external identity — a JWT subject once one exists. Never a display value. */
    subject: v.string(),
    displayName: v.string()
  }).index("by_subject", ["subject"]),

  projects: defineTable({
    name: v.string()
  }),
  // No index. A project is never listed globally — that would be the one query
  // in the schema with no tenant predicate. It is reached by `db.get` from a
  // membership row the asking user already holds.

  memberships: defineTable({
    userId: v.id("users"),
    projectId: v.id("projects"),
    /** The opaque handle this user carries in its URL for this project. */
    token: v.string(),
    role: v.union(v.literal("owner"), v.literal("editor"), v.literal("viewer"))
  })
    .index("by_user_and_token", ["userId", "token"])
    .index("by_user_and_project", ["userId", "projectId"])
};
