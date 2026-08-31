import { requireScope } from "$runtime/server/scope.server";

/**
 * Who is signed in.
 *
 * It takes no argument. A user id in a request payload would let a caller act as
 * anyone, so the name comes from the scope and nowhere else.
 */
export const username = async (): Promise<string> => {
  const scope = await requireScope();

  return scope.username;
};
