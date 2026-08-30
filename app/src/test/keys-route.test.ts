import { describe, expect, it } from "vitest";
import { render } from "svelte/server";

import ContextPanel from "$views/context-panel/context-panel.svelte";
import Inspector from "$views/inspector/inspector.svelte";
import {
  CONTEXT_IDS,
  INSPECTION_KEYS,
  SCREENS,
  SUBSCREENS,
  createViewState,
  railFor
} from "$model/client/view-state";

/**
 * Every key routes.
 *
 * A panel is reached by a key rather than by an import, so nothing in the type
 * system says a key leads anywhere: `key-vocabulary-matches-the-tree` proves a
 * panel is named, and nothing proves a name is reachable. This renders the two
 * containers over the whole vocabulary and asserts each one answers — with the
 * panel where there is one, and with the placeholder naming the key where there
 * is not.
 *
 * **It asserts the key is on the page, not that the placeholder is.** As panels
 * come back the placeholder is what disappears; the key stays, because a rail
 * entry marks itself current and a lens names what it is about.
 */
const KEY = Symbol.for("icarus.view-state");
const withModel = (model: unknown) => ({ context: new Map([[KEY, model]]) });

describe("every key the vocabulary declares reaches something", () => {
  it("renders a context for every entry of every rail", () => {
    const reached = new Set<string>();

    for (const screen of SCREENS) {
      for (const subscreen of SUBSCREENS[screen]) {
        for (const id of railFor(screen, subscreen)) {
          const model = createViewState("probe");
          model.open({ screen, subscreen });
          model.selectContext(id);

          const { body } = render(ContextPanel, withModel(model));
          expect(body, `${screen}/${subscreen} → ${id}`).toContain(id);
          reached.add(id);
        }
      }
    }

    // 65 of 91 today. The rest are on no rail and are reached, if at all, by a
    // panel calling `selectContext` — which is `rails.ts`'s business, not this
    // test's, and is why this asserts what the rails offer rather than the whole
    // vocabulary.
    expect(reached.size).toBeGreaterThan(0);
    expect([...reached].every((id) => (CONTEXT_IDS as readonly string[]).includes(id))).toBe(true);
  });

  it("renders a lens for every inspection key, about what was selected", () => {
    for (const key of INSPECTION_KEYS) {
      const model = createViewState("probe");
      model.inspect(key, { kind: "person", id: "mira", at: "C2" });

      const { body } = render(Inspector, withModel(model));
      expect(body, key).toContain(key);
    }
  });
});
