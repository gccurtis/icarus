import { error } from "@sveltejs/kit";
import type { Configuration } from "$model/server/configuration/index.server";
import { requiredString } from "$model/server/configuration/index.server";
import { serverModel } from "$model/server/index.server";

/**
 * Who is asking. Established by the session cookie and nothing else.
 *
 * Browser-wide on purpose: signing in once signs in every tab, and signing out
 * signs out everywhere. That is what people expect, and it is why a user id is
 * never a parameter — one in a request payload would let a caller act as anyone.
 */
export type Session = {
  readonly userId: string;
};

/**
 * Who is asking, and about which project.
 *
 * The first parameter of every capability procedure, and the reason none of them
 * has to remember an authorization check: a `Scope` only exists because
 * `resolveScope` produced one, and it only produces one for a project the asking
 * user holds a handle to.
 *
 * Server-provided infrastructure — the logger, configuration — is *imported* by
 * the code that needs it. Identity is not, because it comes from the request.
 */
export type Scope = {
  readonly projectId: string;
  readonly userId: string;
};

/**
 * Resolves who is asking, from the request's cookies.
 *
 * Called once per request in `hooks.server.ts`, which is early enough to see
 * headers and too early to see a request body — so this answers authority only.
 * Which project a call is about arrives later, in the payload, and is resolved
 * by `resolveScope`.
 *
 * `cookies` is unused today and present because it is the parameter that
 * survives: this reads a signed session cookie once authentication exists, and
 * adding it later would reach every caller.
 */
export const resolveSession = async (cookies: {
  get(name: string): string | undefined;
}): Promise<Session> => {
  void cookies;

  return { userId: requiredString(configurationOf(), "development.userId") };
};

/**
 * Turns a session and a project handle into the scope a procedure runs under.
 *
 * **The lookup is the authorization.** A handle is only ever resolved within one
 * user's rows, so there is no separate membership check to forget — a token that
 * is not in the asking user's map has no project, and the answer is a 404 rather
 * than a fallback to something the caller did not ask for.
 *
 * That also makes a copied URL useless. A project has many collaborators and
 * each holds their own handle to it, so two users on one project present two
 * different tokens that resolve to the same project id.
 *
 * A 404 rather than a 403 deliberately: telling an unauthorized caller that a
 * project exists is itself a disclosure.
 */
export const resolveScope = async (
  session: Session,
  projectToken: string | undefined
): Promise<Scope> => {
  if (typeof projectToken !== "string" || projectToken.length === 0) {
    error(400, "A project token is required");
  }

  const projectId = await projectForToken(session.userId, projectToken);
  if (!projectId) error(404, "No such project");

  return { projectId, userId: session.userId };
};

/**
 * The map from (user, handle) to project.
 *
 * One row today, read from `configuration/dev.yaml`, which is what makes the
 * rejection path live from the first day rather than being written now and first
 * taken the day authentication lands.
 *
 * When the auth capability arrives this becomes a query against membership rows
 * in the control database — which cannot be a project database, since this is
 * the lookup that decides *which* project database to open. Nothing above or
 * below this function changes when it does.
 */
const projectForToken = async (
  userId: string,
  projectToken: string
): Promise<string | undefined> => {
  const configuration = configurationOf();

  const developmentUser = requiredString(configuration, "development.userId");
  const developmentToken = requiredString(configuration, "development.projectToken");

  return userId === developmentUser && projectToken === developmentToken
    ? requiredString(configuration, "development.projectId")
    : undefined;
};

/**
 * Reaches the process configuration.
 *
 * A value import from the composition root rather than a parameter: this module
 * is called from remote wrappers, which have a request and nothing else, and
 * threading configuration through every one of them would put infrastructure in
 * the signature the browser's payload is shaped by.
 *
 * Not a cycle — `index.server.ts` imports only the *types* from this file, and
 * type imports are erased.
 */
const configurationOf = (): Configuration => serverModel().configuration;
