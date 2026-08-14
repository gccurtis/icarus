// See https://svelte.dev/docs/kit/types#app.d.ts
import type { ServerRuntime } from "$runtime/server/index.server";
import type { Scope } from "$runtime/server/scope.server";

declare global {
  namespace App {
    interface Locals {
      /**
       * Who is asking, and about which project. Resolved once per request by
       * hooks.server.ts, and the first parameter of every capability procedure.
       */
      scope: Scope;

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
