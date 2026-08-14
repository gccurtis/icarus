import { Preferences } from "$runtime/client/preferences/definition.svelte";
import type { PreferencesRuntime } from "$runtime/client/preferences/types";
import type { ClientStorage } from "$runtime/client/storage";

export type { Panels, PreferencesRuntime } from "$runtime/client/preferences/types";
export { DEFAULTS } from "$runtime/client/preferences/types";

/** Builds one, over any storage. Tests use this directly with a fake. */
export const createPreferences = (from: ClientStorage): PreferencesRuntime =>
  new Preferences(from);
