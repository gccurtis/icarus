import type { NamedVariableInput } from "$name-manager/types/variables";

/**
 * What a browser sends. One field wider than each procedure's own input, and the
 * extra field is the whole boundary.
 *
 * A client instance holds a **project token** — an opaque handle it carries in
 * its URL — and must send it with every call, because a remote function cannot
 * see the page that called it: kit serves them all from `/_app/remote/…` with
 * empty route params, so there is no route to read the project from.
 *
 * The token is not a credential and is not trusted. `resolveScope` looks it up
 * within the asking user's own handles, and a token that is not there resolves
 * to no project at all. By the time a procedure runs it has a `Scope` and the
 * token no longer exists.
 *
 * **Nothing here names a user.** That comes only from the session cookie.
 */
interface ProjectRequest {
  readonly project: string;
}

export interface DefineRequest extends ProjectRequest {
  readonly variable: NamedVariableInput;
}

export interface GetRequest extends ProjectRequest {
  readonly name: string;
}

export type RequireRequest = GetRequest;

export type ListRequest = ProjectRequest;
