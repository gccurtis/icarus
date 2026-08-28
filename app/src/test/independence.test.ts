import { describe, expect, it } from "vitest";
import { render } from "svelte/server";
import type { Component } from "svelte";

/**
 * Every panel renders on its own.
 *
 * The claim the four trees are built on is that a panel knows only its doors —
 * no client instance, no route, no parent threading content down. This is what
 * checks it: each one is rendered in isolation, with nothing but a permissive
 * prop bag, and a panel that reached for something it should not have throws.
 *
 * **Server rendering rather than a DOM.** `svelte/server` runs in Node, so this
 * needs no jsdom and no browser, and it exercises the part that matters — props,
 * derivations, doors and markup. Effects do not run on the server, so an effect
 * that reached for `window` is not covered here.
 */
const MODULES = import.meta.glob<{ default: Component }>(
  "/src/lib/views/{panels/context,panels/inspector,workspaces,modals}/**/*.svelte"
);

/**
 * Generous, because the cost is compilation rather than rendering: whichever
 * test happens to pull a large dependency graph through the transform first pays
 * for all of them, and which one that is changes between runs.
 */
const TIMEOUT = 30_000;

describe("every panel renders on its own", () => {
  for (const [path, load] of Object.entries(MODULES)) {
    it(
      path.replace("/src/lib/", ""),
      async () => {
        const { default: Panel } = await load();
        // Reading `body` is what runs it — `render` returns lazy getters.
        const { body } = render(Panel, {
          props: { open: true, onback: () => {}, onclose: () => {} }
        });
        expect(body.length).toBeGreaterThan(0);
      },
      TIMEOUT
    );
  }
});
