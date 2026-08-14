import type { ClientStorage } from "$runtime/client/storage";
import type { Panels, PreferencesRuntime } from "$runtime/client/preferences/types";
import { DEFAULTS } from "$runtime/client/preferences/types";

/**
 * `.svelte.ts` because this holds `$state`. The field is private and the public
 * surface is a getter: reassigning an exported `let` does not propagate across a
 * module boundary, but reading through a getter does.
 */
export class Preferences implements PreferencesRuntime {
  // Spread, not `$state(DEFAULTS)` — see the reasoning on DEFAULTS. The spread
  // is load-bearing and easy to lose in a refactor, which is why DEFAULTS is
  // frozen: without the spread this line throws instead of leaking.
  #panels = $state<Panels>({ ...DEFAULTS });

  constructor(private readonly storage: ClientStorage) {
    const stored = storage.preferences;
    if (stored) this.#panels = { ...DEFAULTS, ...stored };
  }

  get panels(): Panels {
    return this.#panels;
  }

  set(patch: Partial<Panels>): void {
    this.#panels = { ...this.#panels, ...patch };
    this.storage.savePreferences(this.#panels);
  }
}
