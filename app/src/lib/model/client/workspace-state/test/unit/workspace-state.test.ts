import assert from "node:assert/strict";
import { test } from "vitest";
import { createConfiguration } from "$model/client/configuration";
import { createTabList } from "$model/client/tab-list";
import { createTabViews } from "$model/client/tab-views";
import { createWorkspaceState } from "$model/client/workspace-state";
import type {
  Inspected,
  Selection,
  Subscreen,
  Tab,
  TabId,
  Target,
  WorkspaceStateModel
} from "$model/client/workspace-state";
import {
  CONTEXT_VIEWS,
  DEFAULT_FRAME,
  INSPECTOR_VIEWS,
  RAILS,
  CATEGORIES,
  SINGLETONS,
  SUBSCREENS,
  defaultSubscreen,
  defaultContext,
  isInspectorView,
  isSingleton,
  railFor
} from "$model/client/workspace-state";

/**
 * What workspace state guarantees.
 *
 * Five invariants carry the object and most of what is here is one of them or a
 * consequence: the permanent tabs exist from construction and cannot be
 * closed, `activeId` always names a real tab, one target with an identity is one
 * tab, a centre change takes its rail and its inspection with it, and every key
 * names a file.
 *
 * **Keys are read out of the generated vocabulary rather than typed out.** A
 * hard-coded key that later stops existing is a test that fails for the wrong
 * reason; the thing that should fail is `pnpm category-keys -- --check`.
 *
 * **Agents is the category with four centres and Templates the category with
 * two**, so everything about moving between centres is written against one of
 * those. Every other category has the single centre `workspace`, and a subject
 * inside one of those categories is a `focus` rather than a centre.
 */
const UNPERSISTED = { workspace: { changeSets: { flushAfterOps: 0, flushAfterMs: 0 } } };

const workspaceState = (): WorkspaceStateModel =>
  createWorkspaceState("p1", createTabList(), createTabViews(), createConfiguration(UNPERSISTED));

const document = (id: string): Target => ({ category: "document-editor", resourceId: id });
const thread = (id: string): Target => ({ category: "research", resourceId: id });
const launcher: Target = { category: "new-tab" };

/** Read a tab back out of the model rather than holding the one `open` returned. */
const tabOf = (model: WorkspaceStateModel, id: TabId): Tab => {
  const tab = model.tabs.find((candidate) => candidate.id === id);
  assert.ok(tab, `no tab '${id}'`);
  return tab;
};

const lens = INSPECTOR_VIEWS[0];
const otherLens = INSPECTOR_VIEWS[1];

// The two vocabularies overlap in spelling — "analysis.chart" is a rail view and
// a lens — so the key that proves a non-lens is refused has to be picked from the
// context ids that are not also lenses. The cast is the point: the type already
// refuses this, and the guard is for the callers that have no type.
const notALens = CONTEXT_VIEWS.find((id) => !isInspectorView(id)) as unknown as Inspected;

const selection: Selection = { kind: "resource", id: "k57", at: "C2" };

// -------------------------------------------------------------- construction

test("opens on the permanent tabs, in order, with the first active", () => {
  const model = workspaceState();

  assert.deepEqual(
    model.tabs.map((tab) => tab.category),
    [...SINGLETONS]
  );
  assert.equal(model.activeId, model.tabs[0].id);
  assert.equal(model.active.category, SINGLETONS[0]);
  assert.equal(model.project, "p1");
});

test("a permanent tab is a place, so its category is its whole identity", () => {
  // Nothing is selected when a project loads, so a permanent tab is for a kind of
  // work rather than for one thing: it edits no resource, and asking for its
  // category a second time hands back the tab that is already there.
  const model = workspaceState();

  for (const tab of model.tabs) {
    assert.equal(tab.resourceId, undefined);
    assert.equal(isSingleton(tab.category), true);
    assert.equal(model.open({ category: tab.category }).id, tab.id);
  }

  assert.equal(model.tabs.length, SINGLETONS.length);
});

test("every permanent tab starts on its category's default centre, its rail's first view, and nothing open inside it", () => {
  // Asserted over all four rather than the active one, because the default is
  // named per category: Agents and Templates open on their library, the rest on
  // their one workspace, and a table that got one wrong would still pass a test
  // that only looked at Project Overview.
  const model = workspaceState();

  for (const tab of model.tabs) {
    assert.equal(tab.subscreen, defaultSubscreen(tab.category));
    assert.equal(tab.contextId, defaultContext(tab.category, tab.subscreen));
    assert.equal(tab.focus, undefined);
    assert.equal(tab.inspected, "empty");
    assert.equal(tab.selection, undefined);
  }

  assert.equal(model.context, defaultContext(model.active.category, model.active.subscreen));
  assert.equal(model.inspected, "empty");
  assert.equal(model.selection, undefined);
  assert.deepEqual({ ...model.frame }, { ...DEFAULT_FRAME });
});

test("permanence is derived, so a tab cannot disagree with its category", () => {
  const model = workspaceState();
  const tab = model.open(document("k57"));

  assert.equal(model.tabs.slice(0, SINGLETONS.length).every((t) => isSingleton(t.category)), true);
  assert.equal(isSingleton(tab.category), false);
  assert.equal("permanent" in tab, false);
});

// ---------------------------------------------------------------- vocabulary

test("every category opens on a centre it actually has", () => {
  // `DEFAULT_SUBSCREEN` is total over categories but its values are the union of
  // every category's centres, so `agents: "chart"` would compile and then
  // throw on the first `showSubscreen`. Nothing but this checks the two tables
  // agree.
  for (const category of CATEGORIES) {
    const offered: readonly string[] = SUBSCREENS[category];
    const opens = defaultSubscreen(category);
    // A category with no content view has nothing to default to, and `mintView`
    // refuses it rather than minting a tab that cannot paint.
    if (offered.length === 0) {
      assert.equal(opens, undefined, `'${category}' has no centre but names a default`);
      continue;
    }
    assert.ok(
      opens !== undefined && offered.includes(opens),
      `'${category}' opens on a centre it has not got`
    );
  }
});

test("every rail is keyed by a centre its category has, and offers no view twice", () => {
  // `RAILS` is partial over subscreens for a good reason — no category has all of
  // them — and the cost is that a transcription typo is a row nothing ever reads.
  for (const category of CATEGORIES) {
    const offered: readonly string[] = SUBSCREENS[category];

    for (const subscreen of Object.keys(RAILS[category])) {
      assert.ok(offered.includes(subscreen), `'${category}' has no centre '${subscreen}'`);

      const rail = railFor(category, subscreen as Subscreen);
      assert.equal(new Set(rail).size, rail.length, `'${category}/${subscreen}' repeats a view`);
    }
  }
});

// ---------------------------------------------------------------------- open

test("opening a permanent category returns the tab already there", () => {
  const model = workspaceState();
  const before = model.tabs.length;

  const tab = model.open({ category: "templates" });

  assert.equal(model.tabs.length, before);
  assert.equal(model.tabs.filter((candidate) => candidate.category === "templates").length, 1);
  assert.equal(model.activeId, tab.id);
});

test("opening one resource twice is one tab", () => {
  // A document reached from a mention, from the work table and from a search is
  // one tab, in the state the person left it.
  const model = workspaceState();
  const before = model.tabs.length;

  const first = model.open(document("k57"));
  const second = model.open(document("k57"));

  assert.equal(first.id, second.id);
  assert.equal(model.tabs.length, before + 1);
});

test("two resources are two tabs", () => {
  const model = workspaceState();

  const first = model.open(document("k57"));
  const second = model.open(document("k58"));

  assert.notEqual(first.id, second.id);
  assert.equal(model.tabs.length, SINGLETONS.length + 2);
});

test("one id under two categories is two tabs", () => {
  const model = workspaceState();

  const a = model.open(document("shared"));
  const b = model.open({ category: "spreadsheet-editor", resourceId: "shared" });

  assert.notEqual(a.id, b.id);
});

test("two research threads are two tabs", () => {
  // A line of enquiry is opened, worked in and closed, so it is keyed by the
  // thread exactly as a document is keyed by the document — several at once in
  // the strip, each with its own rail position and its own inspection.
  const model = workspaceState();

  const first = model.open(thread("th-1"));
  const second = model.open(thread("th-2"));

  assert.notEqual(first.id, second.id);
  assert.equal(isSingleton("research"), false);
  assert.equal(model.tabs.length, SINGLETONS.length + 2);
  assert.equal(model.tabs.filter((tab) => tab.category === "research").length, 2);
});

test("one research thread reached twice is one tab, in the state it was left", () => {
  const model = workspaceState();
  const first = model.open(thread("th-1"));
  const where = railFor("research", "thread")[3];
  model.selectContext(where);
  model.inspect(lens, selection);
  model.open(document("k57"));

  const second = model.open(thread("th-1"));

  assert.equal(second.id, first.id);
  assert.equal(model.activeId, first.id);
  assert.equal(model.tabs.length, SINGLETONS.length + 2);
  assert.equal(model.context, where);
  assert.equal(model.inspected, lens);
  assert.deepEqual(model.selection, selection);
});

test("the launcher never dedupes — open five, get five", () => {
  // A launcher has no identity, which is what a launcher is for.
  const model = workspaceState();

  for (let i = 0; i < 5; i += 1) model.open(launcher);

  assert.equal(model.tabs.length, SINGLETONS.length + 5);
});

test("opening an already-open permanent tab onto a centre moves it, resets the rail and drops the stale inspection", () => {
  // Choosing a persona from the Overview has to land on that persona. Activating
  // the tab and leaving it wherever it was would ignore half of what was asked
  // for, and the state left over from the old centre would outlive what it was
  // about — which is why this routes through `landOn` rather than assigning.
  const model = workspaceState();
  model.open({ category: "agents" });
  const stale = railFor("agents", "library")[2];
  model.selectContext(stale);
  model.inspect(lens, selection);
  model.open(document("k57"));
  const before = model.tabs.length;

  const tab = model.open({ category: "agents", subscreen: "persona", focus: "pa-3" });

  assert.equal(model.tabs.length, before);
  assert.equal(model.activeId, tab.id);
  assert.equal(model.active.subscreen, "persona");
  assert.equal(model.active.focus, "pa-3");
  assert.equal(model.context, defaultContext("agents", "persona"));
  assert.notEqual(model.context, stale);
  assert.equal(model.inspected, "empty");
  assert.equal(model.selection, undefined);
});

test("a target with a focus and no centre says what the tab is about without moving it", () => {
  // The narrower half of the same call, and the one a thread needs: the category
  // has one centre, so arriving at a question inside it is a change of subject and
  // nothing else. Resetting the rail here would throw away a position nothing
  // invalidated.
  const model = workspaceState();
  const first = model.open(thread("th-1"));
  const where = railFor("research", "thread")[2];
  model.selectContext(where);
  model.open(document("k57"));

  model.open({ category: "research", resourceId: "th-1", focus: "q-4" });

  assert.equal(model.activeId, first.id);
  assert.equal(model.active.focus, "q-4");
  assert.equal(model.active.subscreen, defaultSubscreen("research"));
  assert.equal(model.context, where);
});

test("a centre asked for with no focus clears the one that was there", () => {
  const model = workspaceState();
  model.open({ category: "agents", subscreen: "persona", focus: "pa-3" });

  model.open({ category: "agents", subscreen: "library" });

  assert.equal(model.active.subscreen, "library");
  assert.equal(model.active.focus, undefined);
});

test("a target naming a centre the screen has not got is refused by open, not just by showSubscreen", () => {
  // The refusal lives in `landOn`, which both methods go through, so there is one
  // rule and two ways in rather than a check on the one people happen to use.
  const model = workspaceState();
  model.open(thread("th-1"));

  assert.throws(
    () => model.open({ category: "research", resourceId: "th-1", subscreen: "persona" }),
    /has no subscreen/
  );
  assert.equal(model.active.subscreen, defaultSubscreen("research"));
});

test("a minted tab arrives on the subject it was opened onto, and on none when it was opened onto none", () => {
  const model = workspaceState();

  const withFocus = model.open({
    category: "document-editor",
    resourceId: "k57",
    focus: "sec-2"
  });
  const without = model.open(document("k58"));

  assert.equal(tabOf(model, withFocus.id).focus, "sec-2");
  assert.equal(tabOf(model, without.id).focus, undefined);
});

// ----------------------------------------------------------------- active id

test("closing the active tab activates its left neighbour", () => {
  const model = workspaceState();
  const first = model.open(document("a"));
  const second = model.open(document("b"));

  model.close(second.id);

  assert.equal(model.activeId, first.id);
});

test("closing the last tab a person opened falls back onto a permanent one", () => {
  const model = workspaceState();
  const tab = model.open(document("k57"));

  model.close(tab.id);

  assert.equal(model.tabs.length, SINGLETONS.length);
  assert.equal(model.tabs.some((candidate) => candidate.id === model.activeId), true);
  assert.equal(isSingleton(model.active.category), true);
});

test("closing a tab that is not active leaves the active one alone", () => {
  const model = workspaceState();
  const first = model.open(document("a"));
  const second = model.open(document("b"));

  model.close(first.id);

  assert.equal(model.activeId, second.id);
});

test("activating a tab that is not there is ignored rather than thrown", () => {
  // The one caller that can produce an id naming no tab is a click on a tab being
  // closed in the same frame: a race, not a defect.
  const model = workspaceState();
  const was = model.activeId;

  assert.doesNotThrow(() => model.activate("t999"));

  assert.equal(model.activeId, was);
});

test("closing a tab that is not there is a no-op", () => {
  const model = workspaceState();

  assert.doesNotThrow(() => model.close("t999"));

  assert.equal(model.tabs.length, SINGLETONS.length);
  assert.equal(model.canUndo, false);
});

test("activeId names a real tab after every method, including after closing the active one", () => {
  // The invariant every surface leans on: `active` has no undefined branch, so a
  // single method leaving `activeId` naming nothing would show as a blank shell
  // rather than as an error. Walked as a sequence rather than per method, because
  // the cases that could break it are the ones where a tab leaves.
  const model = workspaceState();
  const permanent = model.tabs[0].id;
  let doc: TabId = "";
  let enquiry: TabId = "";

  const steps: readonly (readonly [string, () => void])[] = [
    ["open a thread", () => void (enquiry = model.open(thread("th-1")).id)],
    ["open a document", () => void (doc = model.open(document("k57")).id)],
    ["activate a permanent tab", () => model.activate(permanent)],
    ["land on a centre", () => model.showSubscreen("overview")],
    ["move the rail", () => model.selectContext(railFor("project-overview", "overview")[1])],
    ["inspect", () => model.inspect(lens, selection)],
    ["clear", () => model.clear()],
    ["resize", () => model.resize({ contextWidth: 400 })],
    ["activate the document", () => model.activate(doc)],
    ["close the active tab", () => model.close(doc)],
    ["close the thread", () => model.close(enquiry)],
    ["reopen", () => void model.reopenClosed()],
    ["activate a tab that is not there", () => model.activate("t999")],
    ["close a tab that is not there", () => model.close("t999")],
    ["reopen the rest of the queue", () => void model.reopenClosed()],
    ["reopen an empty queue", () => void model.reopenClosed()]
  ];

  for (const [what, step] of steps) {
    step();
    assert.ok(
      model.tabs.some((tab) => tab.id === model.activeId),
      `'${what}' left activeId naming no tab`
    );
    assert.equal(model.active.id, model.activeId);
  }
});

// --------------------------------------------------------------------- close

test("every permanent tab refuses to close", () => {
  const model = workspaceState();

  for (const tab of model.tabs) {
    assert.throws(() => model.close(tab.id), /cannot be closed/);
  }

  assert.equal(model.tabs.length, SINGLETONS.length);
});

// -------------------------------------------------------------------- reopen

test("a closed tab comes back whole, not as an identity", () => {
  const model = workspaceState();
  const tab = model.open(document("k57"));

  model.close(tab.id);
  const reopened = model.reopenClosed();

  assert.ok(reopened);
  assert.equal(reopened.id, tab.id);
  assert.equal(reopened.resourceId, "k57");
});

test("reopening restores the rail, the inspection and the widths — not just the category", () => {
  const model = workspaceState();
  const tab = model.open(document("k57"));
  const where = railFor("document-editor", "document")[3];
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
  assert.equal(model.reopenClosed(), undefined, "nothing else is waiting to come back");
});

test("a closed thread comes back as the same thread, with the subject it was on", () => {
  // Closing a research tab closes a line of enquiry, and the queue is what makes
  // that recoverable: the thread comes back by id, on the question it was on,
  // rather than as a second tab about the same thread.
  const model = workspaceState();
  const tab = model.open({ category: "research", resourceId: "th-1", focus: "q-4" });
  const where = railFor("research", "thread")[4];
  model.selectContext(where);

  model.close(tab.id);
  assert.equal(model.tabs.some((candidate) => candidate.category === "research"), false);

  const reopened = model.reopenClosed();

  assert.ok(reopened);
  assert.equal(reopened.id, tab.id);
  assert.equal(reopened.resourceId, "th-1");
  assert.equal(reopened.focus, "q-4");
  assert.equal(model.context, where);
  assert.equal(model.open(thread("th-1")).id, tab.id);
  assert.equal(model.tabs.filter((candidate) => candidate.category === "research").length, 1);
});

test("reopening walks back through every close, newest first", () => {
  const model = workspaceState();

  for (let i = 0; i < 12; i += 1) {
    const tab = model.open(document(`doc-${i}`));
    model.close(tab.id);
  }

  const back = Array.from({ length: 12 }, () => model.reopenClosed()?.resourceId);

  assert.equal(back[0], "doc-11");
  assert.equal(back.at(-1), "doc-0");
  assert.equal(model.reopenClosed(), undefined);
});

test("reopening with an empty queue is undefined, not a throw", () => {
  const model = workspaceState();

  assert.equal(model.reopenClosed(), undefined);
});

// ----------------------------------------------------------------- subscreen

test("a subscreen the screen does not have throws", () => {
  const model = workspaceState();
  model.open(thread("th-1"));

  assert.throws(() => model.showSubscreen("persona"), /has no subscreen/);
  assert.equal(model.active.subscreen, defaultSubscreen("research"));
});

test("a subscreen is view state, never a second tab", () => {
  // Agents on a persona and Agents on the library it was chosen from are one tab
  // in two states.
  const model = workspaceState();
  model.open({ category: "agents" });
  const before = model.tabs.length;
  const id = model.activeId;

  model.showSubscreen("persona");
  model.showSubscreen("task");

  assert.equal(model.tabs.length, before);
  assert.equal(model.activeId, id);
});

test("the rail moves to the new subscreen's default when the old view is not offered there", () => {
  // Templates is the case that makes this visible: a library and the thing being
  // authored share no rail entry at all.
  const model = workspaceState();
  model.open({ category: "templates" });
  const stale = railFor("templates", "library")[1];
  model.selectContext(stale);

  model.showSubscreen("editor");

  assert.equal(model.context, defaultContext("templates", "editor"));
  assert.notEqual(model.context, stale);
});

test("the rail stays where it is when the new subscreen offers it too", () => {
  // Agents changes under you while you read it, so the four centres share the
  // views that say what is running — and moving off one of those on a subscreen
  // change would be losing a position for no reason.
  const model = workspaceState();
  model.open({ category: "agents" });
  const where = railFor("agents", "library")[1];
  model.selectContext(where);

  model.showSubscreen("persona");

  assert.equal(model.context, where);
});

test("changing subscreen clears the inspection and what it was about", () => {
  const model = workspaceState();
  model.open({ category: "agents" });
  model.inspect(lens, selection);

  model.showSubscreen("persona");

  assert.equal(model.inspected, "empty");
  assert.equal(model.selection, undefined);
});

test("a centre is switched with what it is about, and switching without one says nothing is", () => {
  // There is no switcher in the shell: you reach a persona by choosing one, so
  // choosing and switching are a single call, and going back to a library is the
  // same call with the subject left off.
  const model = workspaceState();
  model.open({ category: "agents" });

  model.showSubscreen("persona", "pa-3");
  assert.equal(model.active.focus, "pa-3");

  model.showSubscreen("task", "ta-7");
  assert.equal(model.active.focus, "ta-7");

  model.showSubscreen("library");
  assert.equal(model.active.subscreen, "library");
  assert.equal(model.active.focus, undefined);
});

test("showing answers for the centre, not for the category alone", () => {
  const model = workspaceState();
  model.open({ category: "templates" });

  assert.equal(model.showing("templates"), true);
  assert.equal(model.showing("templates", "library"), true);
  assert.equal(model.showing("templates", "editor"), false);
  assert.equal(model.showing("research"), false);

  model.showSubscreen("editor");

  assert.equal(model.showing("templates", "editor"), true);
});

// ------------------------------------------------------------------- subject

test("what a centre is about belongs to its tab", () => {
  // `focus` is writable where `resourceId` is fixed, so the tab that holds it has
  // to be the one in front of the person and no other.
  const model = workspaceState();
  const a = model.open(thread("th-1"));
  const b = model.open(thread("th-2"));

  model.open({ category: "research", resourceId: "th-1", focus: "q-4" });

  assert.equal(model.activeId, a.id);
  assert.equal(model.active.focus, "q-4");

  model.activate(b.id);
  assert.equal(model.active.focus, undefined);

  model.activate(a.id);
  assert.equal(model.active.focus, "q-4");
});

// ------------------------------------------------------------------- context

test("selecting a view the rail does not offer throws", () => {
  const model = workspaceState();
  model.open({ category: "agents" });

  // The tab opens on `library`, so a view from another of the four centres is
  // refused.
  assert.throws(() => model.selectContext(railFor("agents", "persona")[2]), /does not offer/);
});

test("selecting a view the rail offers moves the rail", () => {
  const model = workspaceState();
  const where = railFor("project-overview", "overview")[3];

  model.selectContext(where);

  assert.equal(model.context, where);
});

test("each tab keeps its own rail position", () => {
  const model = workspaceState();
  const a = model.open(document("a"));
  const b = model.open(document("b"));
  const where = railFor("document-editor", "document")[2];

  model.activate(a.id);
  model.selectContext(where);
  model.activate(b.id);

  assert.equal(model.context, defaultContext("document-editor", "document"));
  assert.equal(tabOf(model, a.id).contextId, where);
});

test("a stranded rail position reads as the subscreen's default rather than throwing", () => {
  // The deliberate asymmetry: `selectContext` refuses a view outright, and the
  // getter answers with the subscreen's default for a stored position that has
  // drifted off the rail. Nothing reaches that fallback through a method —
  // `landOn` resets the position as it goes — so the drift is written in by hand,
  // which is the case the getter exists for.
  const model = workspaceState();
  model.open({ category: "agents" });
  model.showSubscreen("persona");
  const stranded = railFor("agents", "library")[2];

  tabOf(model, model.activeId).contextId = stranded;

  assert.equal(model.context, defaultContext("agents", "persona"));
  assert.throws(() => model.selectContext(stranded), /does not offer/);
});

// ---------------------------------------------------------------- inspection

test("a key that is not a lens throws", () => {
  const model = workspaceState();

  assert.throws(() => model.inspect(notALens), /is not a lens/);
  assert.equal(model.inspected, "empty");
});

test("nothing inspected is a state, so 'empty' is taken like any other key", () => {
  const model = workspaceState();
  model.inspect(lens);

  assert.doesNotThrow(() => model.inspect("empty"));

  assert.equal(model.inspected, "empty");
});

test("an inspection key carries no payload — the selection lives beside it", () => {
  const model = workspaceState();

  model.inspect(lens, selection);

  assert.equal(model.inspected, lens);
  assert.deepEqual(model.selection, selection);
});

test("inspecting without a selection leaves the selection alone", () => {
  // A breadcrumb changes the lens without changing what is selected, and so does
  // closing a lens back to "empty".
  const model = workspaceState();
  model.inspect(lens, selection);

  model.inspect(otherLens);
  assert.deepEqual(model.selection, selection);

  model.inspect("empty");
  assert.deepEqual(model.selection, selection);
});

test("clear says nothing is selected, and drops the selection with it", () => {
  const model = workspaceState();
  model.inspect(lens, selection);

  model.clear();

  assert.equal(model.inspected, "empty");
  assert.equal(model.selection, undefined);
});

test("an inspection belongs to its tab", () => {
  const model = workspaceState();
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
  const model = workspaceState();

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
  const model = workspaceState();
  const where = railFor("project-overview", "overview")[2];
  model.selectContext(where);

  model.resize({ contextWidth: 500 });

  assert.equal(model.context, where);
  assert.equal(model.frame.contextWidth, 500);
  assert.equal("contextId" in model.frame, false);
});

test("no tab shares another's frame", () => {
  // The frame is copied at mint rather than referenced, so the frozen default
  // reaches no tab and one drag reaches one tab.
  const model = workspaceState();
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
  const a = workspaceState();
  const b = workspaceState();

  a.open(document("only-in-a"));
  a.open(thread("th-1"));
  a.open({ category: "agents" });
  a.showSubscreen("persona", "pa-3");
  a.resize({ contextWidth: 400 });
  a.inspect(lens, selection);

  const agentsInB = b.tabs.find((tab) => tab.category === "agents");
  assert.ok(agentsInB);

  assert.equal(b.tabs.length, SINGLETONS.length);
  assert.equal(b.frame.contextWidth, DEFAULT_FRAME.contextWidth);
  assert.equal(b.inspected, "empty");
  assert.equal(agentsInB.subscreen, defaultSubscreen("agents"));
  assert.equal(agentsInB.focus, undefined);
  // The ids match — the counter is per instance, which is the point — so what
  // has to hold is that the tabs are not the same objects.
  assert.equal(a.tabs[0].id, b.tabs[0].id);
  assert.notEqual(a.tabs[0], b.tabs[0]);
});

// ---------------------------------------------------------------- undo, redo

test("nothing to undo, and nothing to redo, on a fresh model", () => {
  const model = workspaceState();

  assert.equal(model.canUndo, false);
  assert.equal(model.canRedo, false);
  assert.doesNotThrow(() => model.undo());
  assert.doesNotThrow(() => model.redo());
  assert.equal(model.tabs.length, SINGLETONS.length);
});

test("open, then close, then undo back to the starting state", () => {
  const model = workspaceState();
  const started = model.activeId;
  const tab = model.open(document("k57"));

  model.close(tab.id);
  assert.equal(model.tabs.length, SINGLETONS.length);

  model.undo();
  assert.equal(model.tabs.length, SINGLETONS.length + 1, "the tab is back");

  model.undo();
  assert.equal(model.activeId, tab.id, "and so is the tab it was on");

  model.undo();
  model.undo();
  assert.equal(model.tabs.length, SINGLETONS.length);
  assert.equal(model.activeId, started);
  assert.equal(model.canUndo, false);
});

test("redo walks the log forward again", () => {
  const model = workspaceState();
  const where = railFor("document-editor", "document")[3];
  const tab = model.open(document("k57"));
  model.selectContext(where);

  model.undo();
  assert.notEqual(model.context, where);
  assert.equal(model.canRedo, true);

  model.redo();
  assert.equal(model.context, where);
  assert.equal(model.canRedo, false);
  assert.equal(model.activeId, tab.id);
});

test("a new gesture drops what was undone", () => {
  const model = workspaceState();
  model.open(document("k57"));
  model.resize({ contextWidth: 400 });

  model.undo();
  assert.equal(model.canRedo, true);

  model.resize({ contextWidth: 320 });

  assert.equal(model.canRedo, false);
  assert.equal(model.frame.contextWidth, 320);
});

test("undoing a landing restores all five fields it wrote", () => {
  const model = workspaceState();
  model.open({ category: "agents" });
  const where = railFor("agents", "library")[2];
  model.selectContext(where);
  model.inspect(lens, selection);

  model.showSubscreen("persona", "pa-3");
  assert.equal(model.active.subscreen, "persona");
  assert.equal(model.inspected, "empty");

  model.undo();

  const back = model.active;
  assert.equal(back.subscreen, "library");
  assert.equal(back.focus, undefined);
  assert.equal(model.context, where);
  assert.equal(model.inspected, lens);
  assert.deepEqual(model.selection, selection);
});

test("undoing a drag restores the whole frame, not the one edge that moved", () => {
  const model = workspaceState();
  model.open(document("k57"));
  model.resize({ contextWidth: 400, inspectorCollapsed: true });

  model.undo();

  assert.deepEqual({ ...model.frame }, { ...DEFAULT_FRAME });
});

test("reopening is the most recent close inverted, and is itself undoable", () => {
  const model = workspaceState();
  const first = model.open(document("k57"));
  const second = model.open(thread("th-1"));

  model.close(first.id);
  model.close(second.id);

  assert.equal(model.reopenClosed()?.id, second.id, "newest first");
  assert.equal(model.reopenClosed()?.id, first.id);
  assert.equal(model.reopenClosed(), undefined, "each close comes back once");

  model.undo();
  model.undo();
  assert.equal(model.tabs.some((tab) => tab.id === first.id), false);
});
