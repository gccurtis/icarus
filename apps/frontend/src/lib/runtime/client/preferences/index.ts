import { browser } from "$app/environment";
import { Preferences } from "$runtime/client/preferences/definition.svelte";
import type { PreferencesRuntime } from "$runtime/client/preferences/types";
import type { ClientStorage } from "$runtime/client/storage";
import { storage } from "$runtime/client/storage";

export type { Panels, PreferencesRuntime } from "$runtime/client/preferences/types";
export { DEFAULTS } from "$runtime/client/preferences/types";

/** Builds one, over any storage. Tests use this directly with a fake. */
export const createPreferences = (from: ClientStorage): PreferencesRuntime =>
  new Preferences(from);

let instance: PreferencesRuntime | undefined;

/**
 * The one preferences object for this browser.
 *
 * The guard is the isolation. `browser` is `true` in the client bundle and
 * `false` in the server bundle, so on the server this cannot construct — there
 * is no instance to be shared between requests, rather than one that exists and
 * happens not to be read. See [`client.md`](../client.md).
 */
export const preferences = (): PreferencesRuntime => {
  if (!browser) {
    throw new Error(
      "preferences is browser-only. A route that reads it needs `ssr = false` — " +
        "see src/lib/runtime/client/client.md."
    );
  }

  return (instance ??= createPreferences(storage()));
};
