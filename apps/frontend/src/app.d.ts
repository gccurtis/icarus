// See https://svelte.dev/docs/kit/types#app.d.ts
import type { ServerRuntime } from "$runtime/server/index.server";
import type { Session } from "$runtime/server/scope.server";

declare global {
  namespace App {
    interface Locals {
      /**
       * Who is asking. Resolved once per request by hooks.server.ts from the
       * session cookie.
       *
       * Authority only — deliberately not a `Scope`. Which project a call is
       * about arrives in the request body, which `handle` runs too early to
       * read, so a remote wrapper pairs this with the token it was sent and
       * calls `resolveScope`.
       */
      session: Session;

      /**
       * The server runtime: configuration, the logger, and the per-project
       * database registry. Built once for the process, not per request.
       */
      runtime: ServerRuntime;
    }
    // interface Error {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
