import type { Configuration } from "$runtime/server/configuration/types";

/**
 * Who is asking, and about which project.
 *
 * Server-provided infrastructure — the database registry, the logger,
 * configuration — is *imported* by the procedures that need it. Identity is not,
 * because it comes from the request. So every capability procedure takes a Scope
 * as its first parameter and its own input as the rest.
 *
 * Keeping scope out of the input type is a security property rather than
 * tidiness: the browser's payload has no slot for `projectId` or `userId`, so a
 * client cannot name a project it does not belong to, and no procedure has to
 * remember to overwrite what it was sent.
 */
export type Scope = {
  readonly projectId: string;
  readonly userId: string;
};

/**
 * Resolves one request's scope.
 *
 * `projectToken` is unused today and present because it is the parameter that
 * survives. When the auth capability lands this looks it up against
 * the caller's membership rows in the control database — which makes the lookup
 * itself the authorization check, since a miss is a 404 rather than a fallback.
 * It is `async` now for the same reason: that lookup hits a database, and
 * changing the signature later would reach every caller.
 *
 * `session` is server-derived, never client-supplied. A user id taken from a
 * request body or a URL would let a caller act as anyone.
 */
export const resolveScope = async (
  configuration: Configuration,
  session: { userId: string } | undefined,
  projectToken: string | undefined
): Promise<Scope> => {
  void projectToken;

  return {
    projectId: requiredIdentity(configuration, "projectId"),
    userId: session?.userId ?? requiredIdentity(configuration, "userId")
  };
};

/**
 * The single user and project that exist before authentication does.
 *
 * Read from `configuration/project.yaml` rather than hardcoded, so the one
 * place naming the pre-auth identity is a config file someone can find, not a
 * constant buried in a module.
 */
const requiredIdentity = (configuration: Configuration, key: string): string => {
  const value = configuration.get(key);
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      `Configuration key '${key}' must be a non-empty string — it names the ${key === "projectId" ? "project" : "user"} served before authentication exists`
    );
  }
  return value;
};
