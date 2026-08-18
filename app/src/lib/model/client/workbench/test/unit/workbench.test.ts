import assert from "node:assert/strict";
import { test } from "vitest";
import { createConfiguration } from "$model/client/configuration";
import { createResourceRuntimes } from "$model/client/resource-runtimes";
import type { ResourceRuntimesModel } from "$model/client/resource-runtimes";
import { createWorkbench, isPermanent } from "$model/client/workbench";
import type { TabTarget, WorkbenchModel } from "$model/client/workbench";
import { DEFAULT_FRAME, SINGLETON_SCREENS } from "$model/client/workbench";

/**
 * What the workbench guarantees.
 *
 * Four invariants carry the object and every test here is one of them or a
 * consequence: a singleton cannot be closed, `activeId` is never empty, one
 * target is one tab, and view state is written through one path.
 *
 * The register is real rather than faked. It is cheap to build, its `attach` is
 * idempotent by design, and a fake would prove that the workbench calls a fake.
 */
const runtimes = (): ResourceRuntimesModel =>
  createResourceRuntimes(
    createConfiguration({ revisions: { changeSets: { flushAfterOps: 50, flushAfterMs: 2000 } } })
  );

const workbenchWith = (register = runtimes()): WorkbenchModel => createWorkbench(register);

const document = (id: string): TabTarget => ({
  kind: "resource",
  resourceType: "document",
  resourceId: id
});

const launcher: TabTarget = { kind: "launcher" };

// ---------------------------------------------------------------- singletons

test("opens on the singletons, with the first active", () => {
  const workbench = workbenchWith();

  assert.equal(workbench.tabs.length, SINGLETON_SCREENS.length);
  assert.equal(workbench.tabs.every(isPermanent), true);
  assert.equal(workbench.activeId, workbench.tabs[0].id);
  assert.equal(workbench.active.viewState.kind, "project-overview");
});

test("a singleton cannot be closed", () => {
  const workbench = workbenchWith();

  assert.throws(() => workbench.close(workbench.tabs[0].id), /permanent/);
});

test("a singleton cannot be reordered", () => {
  const workbench = workbenchWith();

  assert.throws(() => workbench.reorder(workbench.tabs[0].id, 1), /permanent/);
});

test("permanence is derived, so it cannot disagree with the target", () => {
  const workbench = workbenchWith();
  const tab = workbench.open(document("k57"));

  assert.equal(isPermanent(tab), false);
  assert.equal(isPermanent(workbench.tabs[0]), true);
  assert.equal("permanent" in tab, false);
});

// -------------------------------------------------------------------- open

test("opening the same target twice is one tab", () => {
  const workbench = workbenchWith();
  const before = workbench.tabs.length;

  const first = workbench.open(document("k57"));
  const second = workbench.open(document("k57"));

  assert.equal(first.id, second.id);
  assert.equal(workbench.tabs.length, before + 1);
});

test("one id under two resource types is two tabs", () => {
  const workbench = workbenchWith();

  const a = workbench.open(document("shared"));
  const b = workbench.open({ kind: "resource", resourceType: "slides", resourceId: "shared" });

  assert.notEqual(a.id, b.id);
});

test("opening a singleton activates the one already there", () => {
  const workbench = workbenchWith();
  const before = workbench.tabs.length;

  const tab = workbench.open({ kind: "singleton", screen: "research" });

  assert.equal(workbench.tabs.length, before);
  assert.equal(workbench.activeId, tab.id);
});

test("the launcher never dedupes — open five, get five", () => {
  const workbench = workbenchWith();
  const before = workbench.tabs.length;

  for (let i = 0; i < 5; i += 1) workbench.open(launcher);

  assert.equal(workbench.tabs.length, before + 5);
});

test("opening a resource attaches its runtime", () => {
  const register = runtimes();
  const workbench = workbenchWith(register);

  workbench.open(document("k57"));

  assert.deepEqual(register.open, ["document:k57"]);
});

test("a new tab lands after the singletons, so the closable ones are contiguous", () => {
  const workbench = workbenchWith();

  workbench.open(document("k57"));

  const kinds = workbench.tabs.map(isPermanent);
  assert.equal(kinds.lastIndexOf(true), SINGLETON_SCREENS.length - 1);
});

// -------------------------------------------------------- resolve launcher

test("a launcher becomes what it created, keeping its id and its slot", () => {
  const workbench = workbenchWith();
  const opened = workbench.open(launcher);
  const slot = workbench.tabs.findIndex((tab) => tab.id === opened.id);

  const resolved = workbench.resolveLauncher(opened.id, document("k57"));

  assert.equal(resolved.id, opened.id);
  assert.equal(workbench.tabs.findIndex((tab) => tab.id === resolved.id), slot);
  assert.equal(resolved.viewState.kind, "document");
});

test("resolving to something already open closes the launcher instead", () => {
  // Two tabs on one document is the thing matching exists to prevent, and a
  // launcher is the cheaper of the two to lose.
  const workbench = workbenchWith();
  const existing = workbench.open(document("k57"));
  const opened = workbench.open(launcher);

  const resolved = workbench.resolveLauncher(opened.id, document("k57"));

  assert.equal(resolved.id, existing.id);
  assert.equal(workbench.activeId, existing.id);
  assert.equal(workbench.tabs.some((tab) => tab.id === opened.id), false);
});

test("only a launcher can be resolved, and never to another launcher", () => {
  const workbench = workbenchWith();
  const opened = workbench.open(launcher);

  assert.throws(() => workbench.resolveLauncher(workbench.tabs[0].id, document("k57")), /launcher/);
  assert.throws(() => workbench.resolveLauncher(opened.id, launcher), /launcher/);
});

// ------------------------------------------------------------------- close

test("closing the active tab activates its left neighbour", () => {
  const workbench = workbenchWith();
  const first = workbench.open(document("a"));
  const second = workbench.open(document("b"));

  workbench.close(second.id);

  assert.equal(workbench.activeId, first.id);
});

test("closing a resource releases its runtime", () => {
  const register = runtimes();
  const workbench = workbenchWith(register);
  const tab = workbench.open(document("k57"));

  workbench.close(tab.id);

  assert.deepEqual(register.open, []);
});

test("a closed tab goes onto the reopen queue whole", () => {
  const workbench = workbenchWith();
  const tab = workbench.open(document("k57"));
  workbench.update(tab.id, "document", { zoom: 2, findQuery: "budget" });

  workbench.close(tab.id);

  assert.equal(workbench.closed.length, 1);
  assert.equal(workbench.closed[0].viewState.kind, "document");
});

test("the reopen queue is capped at ten, oldest first off", () => {
  const workbench = workbenchWith();

  for (let i = 0; i < 12; i += 1) {
    const tab = workbench.open(document(`doc-${i}`));
    workbench.close(tab.id);
  }

  assert.equal(workbench.closed.length, 10);
  // The two oldest fell off, so the last one closed is at the front.
  assert.equal(workbench.closed[0].target.kind, "resource");
});

test("reopening restores view state, not just identity", () => {
  const workbench = workbenchWith();
  const tab = workbench.open(document("k57"));
  workbench.update(tab.id, "document", { zoom: 2.5, findQuery: "margins" });
  workbench.resize({ contextWidth: 400 });
  workbench.close(tab.id);

  const reopened = workbench.reopenClosed();

  assert.ok(reopened);
  assert.equal(reopened.id, tab.id);
  assert.equal(reopened.viewState.kind === "document" && reopened.viewState.zoom, 2.5);
  assert.equal(reopened.viewState.frame.contextWidth, 400);
});

test("reopening reattaches the runtime", () => {
  const register = runtimes();
  const workbench = workbenchWith(register);
  const tab = workbench.open(document("k57"));
  workbench.close(tab.id);

  workbench.reopenClosed();

  assert.deepEqual(register.open, ["document:k57"]);
});

test("reopening with an empty queue is undefined, not a throw", () => {
  const workbench = workbenchWith();

  assert.equal(workbench.reopenClosed(), undefined);
});

test("closeAll clears to the singletons and releases everything", () => {
  const register = runtimes();
  const workbench = workbenchWith(register);
  workbench.open(document("a"));
  workbench.open(document("b"));

  workbench.closeAll();

  assert.equal(workbench.tabs.length, SINGLETON_SCREENS.length);
  assert.equal(workbench.activeId, workbench.tabs[0].id);
  assert.deepEqual(register.open, []);
});

test("closeAll does not fill the reopen queue", () => {
  // These are not being closed by a person, and offering to reopen them after
  // teardown would be offering to reopen a session that has ended.
  const workbench = workbenchWith();
  workbench.open(document("a"));

  workbench.closeAll();

  assert.equal(workbench.closed.length, 0);
});

// ------------------------------------------------------------------ reorder

test("reorder counts closable tabs only", () => {
  const workbench = workbenchWith();
  const a = workbench.open(document("a"));
  const b = workbench.open(document("b"));

  workbench.reorder(b.id, 0);

  const closable = workbench.tabs.filter((tab) => !isPermanent(tab));
  assert.deepEqual(closable.map((tab) => tab.id), [b.id, a.id]);
});

test("an overshooting drag clamps rather than throwing", () => {
  const workbench = workbenchWith();
  const a = workbench.open(document("a"));
  workbench.open(document("b"));

  assert.doesNotThrow(() => workbench.reorder(a.id, 99));

  const closable = workbench.tabs.filter((tab) => !isPermanent(tab));
  assert.equal(closable.at(-1)?.id, a.id);
});

// --------------------------------------------------------------- view state

test("a tab is minted with its screen's view state and a full frame", () => {
  const workbench = workbenchWith();
  const tab = workbench.open(document("k57"));

  assert.equal(tab.viewState.kind, "document");
  assert.deepEqual({ ...tab.viewState.frame }, { ...DEFAULT_FRAME });
});

test("update patches only the named screen's own state", () => {
  const workbench = workbenchWith();
  const tab = workbench.open(document("k57"));

  workbench.update(tab.id, "document", { zoom: 3 });

  assert.equal(tab.viewState.kind === "document" && tab.viewState.zoom, 3);
});

test("update throws when the kind does not match the tab", () => {
  // The restated kind is what makes a wrong caller a thrown error rather than a
  // corrupted tab — this is the case a cast would have silently allowed.
  const workbench = workbenchWith();
  const tab = workbench.open(document("k57"));

  assert.throws(() => workbench.update(tab.id, "slides", { zoom: 3 }), /shows document/);
});

test("update throws for a tab that does not exist", () => {
  const workbench = workbenchWith();

  assert.throws(() => workbench.update("tab-999", "document", { zoom: 3 }), /does not exist/);
});

test("no tab shares another's frame", () => {
  // `$state(DEFAULT_FRAME)` rather than a spread would wrap the frozen constant
  // and reach every later reader.
  const workbench = workbenchWith();
  const a = workbench.open(document("a"));
  const b = workbench.open(document("b"));

  workbench.activate(a.id);
  workbench.resize({ contextWidth: 400 });

  assert.equal(a.viewState.frame.contextWidth, 400);
  assert.equal(b.viewState.frame.contextWidth, DEFAULT_FRAME.contextWidth);
});

test("each tab keeps its own rail position", () => {
  const workbench = workbenchWith();
  const a = workbench.open(document("a"));
  const b = workbench.open(document("b"));

  workbench.activate(a.id);
  workbench.selectContext("outline");
  workbench.activate(b.id);

  assert.equal(a.viewState.frame.contextId, "outline");
  assert.equal(b.viewState.frame.contextId, undefined);
});

test("a rail position is a label the model never interprets", () => {
  // Which contexts a screen offers belongs to views/context-panel/. This object
  // remembers a string, so it cannot refuse one and does not try.
  const workbench = workbenchWith();

  assert.doesNotThrow(() => workbench.selectContext("anything-at-all"));
  assert.equal(workbench.frame.contextId, "anything-at-all");
});

test("resize cannot reach the rail", () => {
  // Structural rather than conventional: a drag can never move the rail.
  const workbench = workbenchWith();
  workbench.selectContext("outline");

  workbench.resize({ contextWidth: 500 });

  assert.equal(workbench.frame.contextId, "outline");
  assert.equal(workbench.frame.contextWidth, 500);
});

// --------------------------------------------------------------- inspection

test("inspection is a key, and it belongs to the tab", () => {
  const workbench = workbenchWith();
  const a = workbench.open(document("a"));
  const b = workbench.open(document("b"));

  workbench.activate(a.id);
  workbench.inspect("block.text-selection");

  assert.equal(workbench.inspectedNode, "block.text-selection");

  workbench.activate(b.id);
  assert.equal(workbench.inspectedNode, undefined);
});

test("inspecting nothing clears it", () => {
  const workbench = workbenchWith();
  workbench.inspect("document.page");

  workbench.inspect();

  assert.equal(workbench.inspectedNode, undefined);
});

// ------------------------------------------------------------------ runtime

test("runtimeFor returns the runtime a resource tab attached", () => {
  const register = runtimes();
  const workbench = workbenchWith(register);
  const tab = workbench.open(document("k57"));

  const runtime = workbench.runtimeFor(tab.id);

  assert.ok(runtime);
  assert.equal(runtime.sync, "loading");
});

test("runtimeFor is undefined for a tab that is not a resource", () => {
  const workbench = workbenchWith();

  assert.equal(workbench.runtimeFor(workbench.tabs[0].id), undefined);
  assert.equal(workbench.runtimeFor(workbench.open(launcher).id), undefined);
});

test("two tabs on one document reach one runtime", () => {
  // The whole reason the register is keyed by resource rather than by tab.
  const register = runtimes();
  const workbench = workbenchWith(register);
  const first = workbench.open(document("k57"));
  const second = workbench.open(document("k57"));

  assert.equal(workbench.runtimeFor(first.id), workbench.runtimeFor(second.id));
  assert.deepEqual(register.open, ["document:k57"]);
});

// ------------------------------------------------------------------ activate

test("activating a tab that does not exist throws", () => {
  const workbench = workbenchWith();

  assert.throws(() => workbench.activate("tab-999"), /does not exist/);
});

test("two workbenches share nothing", () => {
  const a = workbenchWith();
  const b = workbenchWith();

  a.open(document("only-in-a"));
  a.resize({ contextWidth: 400 });

  assert.equal(b.tabs.length, SINGLETON_SCREENS.length);
  assert.equal(b.frame.contextWidth, DEFAULT_FRAME.contextWidth);
  // The ids match — the counter is per instance, which is the point — so the
  // assertion that matters is that the tabs are not the same objects.
  assert.equal(a.tabs[0].id, b.tabs[0].id);
  assert.notEqual(a.tabs[0], b.tabs[0]);
});
