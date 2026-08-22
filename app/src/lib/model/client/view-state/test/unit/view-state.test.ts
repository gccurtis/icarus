import assert from "node:assert/strict";
import { test } from "vitest";
import { createViewState } from "$model/client/view-state";
import type {
  Inspected,
  Selection,
  Tab,
  TabId,
  Target,
  ViewStateModel
} from "$model/client/view-state";
import {
  CONTEXT_IDS,
  DEFAULT_FRAME,
  INSPECTION_KEYS,
  SINGLETONS,
  defaultSubscreen,
  defaultContext,
  isInspectionKey,
  isSingleton,
  railFor
} from "$model/client/view-state";

/**
 * What view state guarantees.
 *
 * Four invariants carry the object and most of what is here is one of them or a
 * consequence: the seven singletons exist from construction and cannot be
 * closed, `activeId` always names a real tab, one target with an identity is one
 * tab, and every key names a file.
 *
 * **Keys are read out of the generated vocabulary rather than typed out.** A
 * hard-coded key that later stops existing is a test that fails for the wrong
 * reason; the thing that should fail is `pnpm view-state-keys -- --check`.
 */
const viewState = (): ViewStateModel => createViewState("p1");

const document = (id: string): Target => ({ screen: "document-editor", resourceId: id });
const launcher: Target = { screen: "new-tab" };

/** Read a tab back out of the model rather than holding the one `open` returned. */
const tabOf = (model: ViewStateModel, id: TabId): Tab => {
  const tab = model.tabs.find((candidate) => candidate.id === id);
  assert.ok(tab, `no tab '${id}'`);
  return tab;
};

const lens = INSPECTION_KEYS[0];
const otherLens = INSPECTION_KEYS[1];

// The two vocabularies overlap in spelling — "analysis.chart" is a rail view and
// a lens — so the key that proves a non-lens is refused has to be picked from the
// context ids that are not also lenses. The cast is the point: the type already
// refuses this, and the guard is for the callers that have no type.
const notALens = CONTEXT_IDS.find((id) => !isInspectionKey(id)) as unknown as Inspected;

const selection: Selection = { kind: "resource", id: "k57", at: "C2" };

// -------------------------------------------------------------- construction

test("opens on the seven singletons, in order, with the first active", () => {
  const model = viewState();

  assert.deepEqual(
    model.tabs.map((tab) => tab.screen),
    [...SINGLETONS]
  );
  assert.equal(model.activeId, model.tabs[0].id);
  assert.equal(model.active.screen, SINGLETONS[0]);
  assert.equal(model.project, "p1");
});

test("a tab starts on its screen's first subscreen, its rail's first view, and a full frame", () => {
  const model = viewState();
  const tab = model.active;

  assert.equal(tab.subscreen, defaultSubscreen(tab.screen));
  assert.equal(model.context, defaultContext(tab.screen, tab.subscreen));
  assert.equal(model.inspected, "empty");
  assert.equal(model.selection, undefined);
  assert.deepEqual({ ...model.frame }, { ...DEFAULT_FRAME });
});

test("permanence is derived, so a tab cannot disagree with its screen", () => {
  const model = viewState();
  const tab = model.open(document("k57"));

  assert.equal(model.tabs.slice(0, SINGLETONS.length).every((t) => isSingleton(t.screen)), true);
  assert.equal(isSingleton(tab.screen), false);
  assert.equal("permanent" in tab, false);
});

// ---------------------------------------------------------------------- open

test("opening a singleton returns the tab already there", () => {
  const model = viewState();
  const before = model.tabs.length;

  const tab = model.open({ screen: "research" });

  assert.equal(model.tabs.length, before);
  assert.equal(model.tabs.filter((candidate) => candidate.screen === "research").length, 1);
  assert.equal(model.activeId, tab.id);
});

test("opening one resource twice is one tab", () => {
  // A document reached from a mention, from the work table and from a search is
  // one tab, in the state the person left it.
  const model = viewState();
  const before = model.tabs.length;

  const first = model.open(document("k57"));
  const second = model.open(document("k57"));

  assert.equal(first.id, second.id);
  assert.equal(model.tabs.length, before + 1);
});

test("two resources are two tabs", () => {
  const model = viewState();

  const first = model.open(document("k57"));
  const second = model.open(document("k58"));

  assert.notEqual(first.id, second.id);
  assert.equal(model.tabs.length, SINGLETONS.length + 2);
});

test("one id under two screens is two tabs", () => {
  const model = viewState();

  const a = model.open(document("shared"));
  const b = model.open({ screen: "spreadsheet-editor", resourceId: "shared" });

  assert.notEqual(a.id, b.id);
});

test("the launcher never dedupes — open five, get five", () => {
  // A launcher has no identity, which is what a launcher is for.
  const model = viewState();

  for (let i = 0; i < 5; i += 1) model.open(launcher);

  assert.equal(model.tabs.length, SINGLETONS.length + 5);
});

// ----------------------------------------------------------------- active id

test("closing the active tab activates its left neighbour", () => {
  const model = viewState();
  const first = model.open(document("a"));
  const second = model.open(document("b"));

  model.close(second.id);

  assert.equal(model.activeId, first.id);
});

test("closing the last tab a person opened falls back onto a singleton", () => {
  const model = viewState();
  const tab = model.open(document("k57"));

  model.close(tab.id);

  assert.equal(model.tabs.length, SINGLETONS.length);
  assert.equal(model.tabs.some((candidate) => candidate.id === model.activeId), true);
  assert.equal(isSingleton(model.active.screen), true);
});

test("closing a tab that is not active leaves the active one alone", () => {
  const model = viewState();
  const first = model.open(document("a"));
  const second = model.open(document("b"));

  model.close(first.id);

  assert.equal(model.activeId, second.id);
});

test("activating a tab that is not there is ignored rather than thrown", () => {
  // The one caller that can produce an id naming no tab is a click on a tab being
  // closed in the same frame: a race, not a defect. The workbench threw here.
  const model = viewState();
  const was = model.activeId;

  assert.doesNotThrow(() => model.activate("t999"));

  assert.equal(model.activeId, was);
});

test("closing a tab that is not there is a no-op", () => {
  const model = viewState();

  assert.doesNotThrow(() => model.close("t999"));

  assert.equal(model.tabs.length, SINGLETONS.length);
  assert.equal(model.closed.length, 0);
});

// --------------------------------------------------------------------- close

test("every singleton refuses to close", () => {
  const model = viewState();

  for (const tab of model.tabs) {
    assert.throws(() => model.close(tab.id), /cannot be closed/);
  }

  assert.equal(model.tabs.length, SINGLETONS.length);
});

// -------------------------------------------------------------------- reopen

test("a closed tab goes onto the queue whole, not as an identity", () => {
  const model = viewState();
  const tab = model.open(document("k57"));

  model.close(tab.id);

  assert.equal(model.closed.length, 1);
  assert.equal(model.closed[0].id, tab.id);
  assert.equal(model.closed[0].resourceId, "k57");
});

test("reopening restores the rail, the inspection and the widths — not just the screen", () => {
  const model = viewState();
  const tab = model.open(document("k57"));
  const where = railFor("document-editor", "workspace")[3];
  model.selectContext(where);
  model.inspect(lens, selection);
  model.resize({ contextWidth: 400, inspectorCollapsed: true });
  model.close(tab.id);

  const reopened = model.reopenClosed();

  assert.ok(reopened);
  assert.equal(reopened.id, tab.id);
  assert.equal(model.activeId, tab.id);
  assert.equal(model.context, where);
  assert.equal(model.inspected, lens);
  assert.deepEqual(model.selection, selection);
  assert.equal(model.frame.contextWidth, 400);
  assert.equal(model.frame.inspectorCollapsed, true);
  assert.equal(model.closed.length, 0);
});

test("the queue caps at ten and drops the oldest", () => {
  const model = viewState();

  for (let i = 0; i < 12; i += 1) {
    const tab = model.open(document(`doc-${i}`));
    model.close(tab.id);
  }

  assert.equal(model.closed.length, 10);
  assert.equal(model.closed[0].resourceId, "doc-11");
  assert.equal(model.closed.at(-1)?.resourceId, "doc-2");
  assert.equal(model.closed.some((tab) => tab.resourceId === "doc-0"), false);
});

test("reopening with an empty queue is undefined, not a throw", () => {
  const model = viewState();

  assert.equal(model.reopenClosed(), undefined);
});

// ----------------------------------------------------------------- subscreen

test("a subscreen the screen does not have throws", () => {
  const model = viewState();
  model.open({ screen: "research" });

  assert.throws(() => model.showSubscreen("workspace"), /has no subscreen/);
});

test("a subscreen is view state, never a second tab", () => {
  // Research on one question and Research on every thread are one tab in two
  // states.
  const model = viewState();
  model.open({ screen: "research" });
  const before = model.tabs.length;
  const id = model.activeId;

  model.showSubscreen("one-question");
  model.showSubscreen("all-threads");

  assert.equal(model.tabs.length, before);
  assert.equal(model.activeId, id);
});

test("the rail moves to the new subscreen's default when the old view is not offered there", () => {
  const model = viewState();
  model.open({ screen: "research" });
  const stale = railFor("research", "all-threads")[1];
  model.selectContext(stale);

  model.showSubscreen("one-question");

  assert.equal(model.context, defaultContext("research", "one-question"));
  assert.notEqual(model.context, stale);
});

test("the rail stays where it is when the new subscreen offers it too", () => {
  // Two subscreens of one screen can share a rail — the specification gives
  // automations one table and says it is the same in both.
  const model = viewState();
  model.open({ screen: "automations" });
  const where = railFor("automations", "library")[2];
  model.selectContext(where);

  model.showSubscreen("rule");

  assert.equal(model.context, where);
});

test("changing subscreen clears the inspection and what it was about", () => {
  const model = viewState();
  model.open({ screen: "research" });
  model.inspect(lens, selection);

  model.showSubscreen("one-question");

  assert.equal(model.inspected, "empty");
  assert.equal(model.selection, undefined);
});

test("showing answers for the centre, not for the screen alone", () => {
  const model = viewState();
  model.open({ screen: "templates" });

  assert.equal(model.showing("templates"), true);
  assert.equal(model.showing("templates", "library"), true);
  assert.equal(model.showing("templates", "editor"), false);
  assert.equal(model.showing("research"), false);

  model.showSubscreen("editor");

  assert.equal(model.showing("templates", "editor"), true);
});

// ------------------------------------------------------------------- context

test("selecting a view the rail does not offer throws", () => {
  const model = viewState();
  model.open({ screen: "research" });

  // The tab opens on `all-threads`, so a view from the other centre is refused.
  assert.throws(() => model.selectContext(railFor("research", "one-question")[1]), /does not offer/);
});

test("selecting a view the rail offers moves the rail", () => {
  const model = viewState();
  const where = railFor("project-overview", "workspace")[4];

  model.selectContext(where);

  assert.equal(model.context, where);
});

test("each tab keeps its own rail position", () => {
  const model = viewState();
  const a = model.open(document("a"));
  const b = model.open(document("b"));
  const where = railFor("document-editor", "workspace")[2];

  model.activate(a.id);
  model.selectContext(where);
  model.activate(b.id);

  assert.equal(model.context, defaultContext("document-editor", "workspace"));
  assert.equal(tabOf(model, a.id).contextId, where);
});

test("a stranded rail position reads as the subscreen's default rather than throwing", () => {
  // The deliberate asymmetry: `selectContext` throws for a view the rail never
  // offered, and the getter falls back for one it no longer offers. Nothing
  // reaches that fallback today — `showSubscreen` resets the position as it goes
  // — so the drift is written in by hand, which is the case the getter exists for.
  const model = viewState();
  model.open({ screen: "research" });
  model.showSubscreen("one-question");
  const stranded = railFor("research", "all-threads")[0];

  tabOf(model, model.activeId).contextId = stranded;

  assert.equal(model.context, defaultContext("research", "one-question"));
  assert.throws(() => model.selectContext(stranded), /does not offer/);
});

// ---------------------------------------------------------------- inspection

test("a key that is not a lens throws", () => {
  const model = viewState();

  assert.throws(() => model.inspect(notALens), /is not a lens/);
  assert.equal(model.inspected, "empty");
});

test("nothing inspected is a state, so 'empty' is taken like any other key", () => {
  const model = viewState();
  model.inspect(lens);

  assert.doesNotThrow(() => model.inspect("empty"));

  assert.equal(model.inspected, "empty");
});

test("an inspection key carries no payload — the selection lives beside it", () => {
  const model = viewState();

  model.inspect(lens, selection);

  assert.equal(model.inspected, lens);
  assert.deepEqual(model.selection, selection);
});

test("inspecting without a selection leaves the selection alone", () => {
  // A breadcrumb changes the lens without changing what is selected, and so does
  // closing a lens back to "empty".
  const model = viewState();
  model.inspect(lens, selection);

  model.inspect(otherLens);
  assert.deepEqual(model.selection, selection);

  model.inspect("empty");
  assert.deepEqual(model.selection, selection);
});

test("clear says nothing is selected, and drops the selection with it", () => {
  const model = viewState();
  model.inspect(lens, selection);

  model.clear();

  assert.equal(model.inspected, "empty");
  assert.equal(model.selection, undefined);
});

test("an inspection belongs to its tab", () => {
  const model = viewState();
  const a = model.open(document("a"));
  const b = model.open(document("b"));

  model.activate(a.id);
  model.inspect(lens, selection);
  model.activate(b.id);

  assert.equal(model.inspected, "empty");
  assert.equal(model.selection, undefined);

  model.activate(a.id);
  assert.equal(model.inspected, lens);
});

// -------------------------------------------------------------------- resize

test("resize changes only what it was given", () => {
  const model = viewState();

  model.resize({ contextWidth: 400 });

  assert.equal(model.frame.contextWidth, 400);
  assert.equal(model.frame.inspectorWidth, DEFAULT_FRAME.inspectorWidth);
  assert.equal(model.frame.contextCollapsed, DEFAULT_FRAME.contextCollapsed);
  assert.equal(model.frame.inspectorCollapsed, DEFAULT_FRAME.inspectorCollapsed);

  model.resize({ inspectorCollapsed: true });

  assert.equal(model.frame.contextWidth, 400);
  assert.equal(model.frame.inspectorCollapsed, true);
});

test("resize cannot reach the rail", () => {
  // Structural rather than conventional: a drag can never move the rail.
  const model = viewState();
  const where = railFor("project-overview", "workspace")[2];
  model.selectContext(where);

  model.resize({ contextWidth: 500 });

  assert.equal(model.context, where);
  assert.equal(model.frame.contextWidth, 500);
  assert.equal("contextId" in model.frame, false);
});

test("no tab shares another's frame", () => {
  // The frame is copied at mint rather than referenced, so the frozen default
  // reaches no tab and one drag reaches one tab.
  const model = viewState();
  const a = model.open(document("a"));
  const b = model.open(document("b"));

  model.activate(a.id);
  model.resize({ contextWidth: 400 });

  assert.equal(tabOf(model, a.id).frame.contextWidth, 400);
  assert.equal(tabOf(model, b.id).frame.contextWidth, DEFAULT_FRAME.contextWidth);
  assert.equal(DEFAULT_FRAME.contextWidth, 276);
});

// ----------------------------------------------------------------- isolation

test("two view states share nothing", () => {
  const a = viewState();
  const b = viewState();

  a.open(document("only-in-a"));
  a.open({ screen: "research" });
  a.showSubscreen("one-question");
  a.resize({ contextWidth: 400 });
  a.inspect(lens, selection);

  assert.equal(b.tabs.length, SINGLETONS.length);
  assert.equal(b.frame.contextWidth, DEFAULT_FRAME.contextWidth);
  assert.equal(b.inspected, "empty");
  assert.equal(b.tabs[1].subscreen, defaultSubscreen("research"));
  // The ids match — the counter is per instance, which is the point — so what
  // has to hold is that the tabs are not the same objects.
  assert.equal(a.tabs[0].id, b.tabs[0].id);
  assert.notEqual(a.tabs[0], b.tabs[0]);
});
