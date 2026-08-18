import assert from "node:assert/strict";
import { test } from "vitest";
import {
  CONTEXTS_BY_SCREEN,
  isContextId,
  resolveContext
} from "$views/context-panel/procedures/resolve-context";

/**
 * The drift fallback, which is the reason this is a procedure rather than a
 * lookup in the markup.
 *
 * A tab's remembered context can go out of range — a stored id can outlive the
 * context it named, and a screen can swap to a disjoint rail — and a reset rail
 * is harmless where a crash during paint is not. There is no component-render
 * harness here, so this is where that case is provable.
 */

test("a remembered context is honoured", () => {
  assert.equal(resolveContext("document", "outline"), "outline");
  assert.equal(resolveContext("document", "overview"), "overview");
});

test("a tab with no remembered context gets the screen's default", () => {
  // The first entry of each array is the default.
  assert.equal(resolveContext("document", undefined), "outline");
  assert.equal(resolveContext("project-overview", undefined), "overview");
});

test("a context the screen does not offer falls back rather than throwing", () => {
  // `outline` is real but project overview's rail does not carry it.
  assert.equal(resolveContext("project-overview", "outline"), "overview");
});

test("a context that no longer exists falls back", () => {
  // What a stored id from an older build looks like.
  assert.equal(resolveContext("document", "activity"), "outline");
  assert.equal(resolveContext("document", ""), "outline");
});

test("every screen offers at least one context", () => {
  // A screen reaching the panel with an empty rail has no way to render, and
  // the default is `available[0]`.
  for (const [screen, contexts] of Object.entries(CONTEXTS_BY_SCREEN)) {
    assert.ok(contexts.length > 0, `${screen} has no contexts`);
  }
});

test("every screen's contexts are real ids", () => {
  for (const [screen, contexts] of Object.entries(CONTEXTS_BY_SCREEN)) {
    for (const id of contexts) assert.ok(isContextId(id), `${screen} names ${id}`);
  }
});
