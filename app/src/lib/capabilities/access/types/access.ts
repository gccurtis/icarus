import type { Id } from "$convex/_generated/dataModel";

/**
 * Who is asking, and about which project.
 *
 * The first thing every scoped handler receives, on `ctx.scope`, and the reason
 * none of them checks anything: a `Scope` exists only because `resolveScope`
 * produced one, and it produces one only for a project the asking user holds a
 * membership in.
 */
export type Scope = {
  readonly projectId: Id<"projects">;
  readonly userId: Id<"users">;
};

export type Role = "owner" | "editor" | "viewer";

/**
 * The one identity that exists before authentication does.
 *
 * `resolveScope` resolves this `authSubject` instead of reading `ctx.auth`, and
 * `seed` creates the row it names. **This is why nothing is actually kept out
 * yet** — every caller is treated as this user. The membership lookup beneath it
 * is real, so the shape every handler is written against is the final one; what
 * is missing is only where the claim comes from.
 */
export const DEVELOPMENT_SUBJECT = "default-user";
export const DEVELOPMENT_PROJECT = "Development";
export const DEVELOPMENT_TOKEN = "dev-project";
