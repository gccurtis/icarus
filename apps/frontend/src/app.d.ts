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
       * The server runtime, resolved lazily — a request that touches no
       * capability builds nothing.
       */
      runtime: () => Promise<ServerRuntime>;
    }
    // interface Error {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
