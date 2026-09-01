import { describe, expect, it } from "vitest";
import { render } from "svelte/server";
import type { Component } from "svelte";

/**
 * Every view renders on its own.
 *
 * The claim the trees are built on is that a view knows only its capabilities —
 * no client instance, no route, no parent threading content down. This is what
 * checks it: each one is rendered in isolation, with nothing but a permissive
 * prop bag, and a view that reached for something it should not have throws.
 *
 * **Server rendering rather than a DOM.** `svelte/server` runs in Node, so this
 * needs no jsdom and no browser, and it exercises the part that matters — props,
 * derivations, reads and markup. Effects do not run on the server, so an effect
 * that reached for `window` is not covered here.
 */
const MODULES = import.meta.glob<{ default: Component }>("/src/lib/app-views/**/*.svelte");

/**
 * Generous, because the cost is compilation rather than rendering: whichever
 * test happens to pull a large dependency graph through the transform first pays
 * for all of them, and which one that is changes between runs.
 */
const TIMEOUT = 30_000;

describe("every view renders on its own", () => {
  for (const [path, load] of Object.entries(MODULES)) {
    it(
      path.replace("/src/lib/", ""),
      async () => {
        const { default: View } = await load();
        // Reading `body` is what runs it — `render` returns lazy getters.
        const { body } = render(View, {
          props: { open: true, onback: () => {}, onclose: () => {} }
        });
        expect(body.length).toBeGreaterThan(0);
      },
      TIMEOUT
    );
  }
});
