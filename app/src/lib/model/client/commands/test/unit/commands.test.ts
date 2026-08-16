import assert from "node:assert/strict";
import { test } from "vitest";
import { COMMAND_IDS, chordOf, createCommands, isCommandId } from "$model/client/commands";
import type { ClientStorage, PersistedWorkbench } from "$model/client/storage";
import { createWorkbench } from "$model/client/workbench";

/**
 * Enablement is the half worth testing hardest. `run` is a lookup and a call;
 * `enabled` is the half the bar renders, and it is the half that reads through a
 * closure into another object — so a change to the workbench is what would break
 * it, and nothing in this directory would say so.
 *
 * Every command closes over a real workbench, which is why these build one
 * rather than a stub. That is the cost of the closure, and it is the reason the
 * fake here is a storage rather than a workbench.
 */
const fakeStorage = (initial?: PersistedWorkbench): ClientStorage => {
  let workbench = initial;
  return {
    get workbench() {
      return workbench;
    },
    saveWorkbench: (value: PersistedWorkbench) => (workbench = value)
  };
};

const build = () => {
  const workbench = createWorkbench(fakeStorage());
  return { workbench, commands: createCommands(workbench) };
};

const OTHER = { kind: "project-overview", id: "other" } as const;
const THIRD = { kind: "project-overview", id: "third" } as const;

// ------------------------------------------------------------------ registry ----

test("every command id has a definition", () => {
  const { commands } = build();

  assert.deepEqual([...commands.ids], [...COMMAND_IDS]);
  for (const id of commands.ids) assert.equal(typeof commands.enabled(id), "boolean");
});

test("an unknown id is refused rather than ignored", () => {
  const { commands } = build();

  // @ts-expect-error — the point is what happens when a caller escapes the type.
  assert.throws(() => commands.run("nope"), /nope/);
  assert.equal(isCommandId("nope"), false);
  assert.equal(isCommandId("tab.close"), true);
});

// ---------------------------------------------------------------- enablement ----

test("tab.close is disabled while only the permanent tab is open", () => {
  const { commands } = build();

  assert.equal(commands.enabled("tab.close"), false);
});

test("tab.close becomes enabled once a transient tab is active", () => {
  const { workbench, commands } = build();

  workbench.open(OTHER);

  assert.equal(commands.enabled("tab.close"), true);
});

test("running a disabled command throws rather than doing nothing", () => {
  const { commands } = build();

  assert.throws(() => commands.run("tab.close"), /disabled/);
});

test("tab cycling is disabled with one tab and enabled with two", () => {
  const { workbench, commands } = build();

  assert.equal(commands.enabled("tab.next"), false);
  workbench.open(OTHER);
  assert.equal(commands.enabled("tab.next"), true);
  assert.equal(commands.enabled("tab.previous"), true);
});

// -------------------------------------------------------------------- effect ----

test("tab.next wraps from the last tab to the first", () => {
  const { workbench, commands } = build();
  workbench.open(OTHER);
  workbench.open(THIRD);

  assert.equal(workbench.activeId, workbench.tabs[2].id);
  commands.run("tab.next");

  assert.equal(workbench.activeId, workbench.tabs[0].id);
});

test("tab.previous wraps from the first tab to the last", () => {
  const { workbench, commands } = build();
  workbench.open(OTHER);
  workbench.activate(workbench.tabs[0].id);

  commands.run("tab.previous");

  assert.equal(workbench.activeId, workbench.tabs[1].id);
});

test("tab.close closes the active tab", () => {
  const { workbench, commands } = build();
  workbench.open(OTHER);

  commands.run("tab.close");

  assert.equal(workbench.tabs.length, 1);
});

// ---------------------------------------------------------------------- bar ----

test("the bar starts closed and command-bar.open toggles it", () => {
  const { commands } = build();

  assert.equal(commands.open, false);
  commands.run("command-bar.open");
  assert.equal(commands.open, true);
  commands.run("command-bar.open");
  assert.equal(commands.open, false);
});

test("hide closes the bar and is safe when it is already closed", () => {
  const { commands } = build();

  commands.toggle();
  commands.hide();
  assert.equal(commands.open, false);
  commands.hide();
  assert.equal(commands.open, false);
});

// ----------------------------------------------------------------- bindings ----

test("bindings resolve to commands, and an unbound command reports none", () => {
  const { commands } = build();

  assert.deepEqual(commands.bindingsFor("command-bar.open"), ["$mod+k"]);
  assert.deepEqual(commands.bindingsFor("tab.close"), []);
  assert.equal(commands.bindings["$mod+k"], "command-bar.open");
});

// -------------------------------------------------------------------- chords ----

test("a chord has one spelling, whatever order the parts arrive in", () => {
  assert.equal(chordOf({ mod: true, alt: false, shift: false, key: "k" }), "$mod+k");
  assert.equal(chordOf({ mod: true, alt: false, shift: true, key: "K" }), "$mod+shift+k");
  assert.equal(chordOf({ mod: true, alt: true, shift: true, key: "k" }), "$mod+alt+shift+k");
  assert.equal(chordOf({ mod: false, alt: false, shift: false, key: "PageDown" }), "pagedown");
});

// ------------------------------------------------------------------ isolation ----

test("two instances share no state", () => {
  const first = build();
  const second = build();

  first.commands.toggle();
  first.workbench.open(OTHER);

  assert.equal(second.commands.open, false);
  assert.equal(second.commands.enabled("tab.close"), false);
});
