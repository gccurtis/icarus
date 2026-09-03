import { username } from "$capabilities/development/index.remote";
import { rowsIn } from "$app-views/categories/project-overview/procedures/rows";

/**
 * Who is asking, and about what.
 *
 * **Both of these are standing in for the scope the server already resolves.**
 * `requireScope` maps a session cookie and a project token to a `userId` and a
 * `projectId` on every capability call — but the store capability is a path read
 * with no scope in its signature, so nothing carries either answer back. Until a
 * capability does, the board works them out from what it can see.
 *
 * The route gives the project *token*, not its id: `/app/dev-project` names the
 * handle a client carries, and `development.projectId` is what it resolves to.
 * So the token is no use here, and neither is anything else the client holds.
 */

/** The project this store is about. It holds exactly one. */
export const projectId = (): string => rowsIn("projects")[0]?._id ?? "";

/**
 * The signed-in person, by the name the development capability publishes.
 *
 * A join on the display name rather than the id, because `username` is the only
 * thing about the session that reaches the browser today. Two people with one
 * name would break it, which is one more reason this is temporary.
 */
export const viewerId = (): string => {
  const answer = username();
  if (!answer.ready) return "";

  const name = answer.current;
  return rowsIn("users").find((user) => user.displayName === name)?._id ?? "";
};
