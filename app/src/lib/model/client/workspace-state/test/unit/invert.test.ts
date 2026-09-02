import assert from "node:assert/strict";
import { test } from "vitest";

import { invert, invertAll } from "$representation/data/behavior/workspace/invert";
import { CONTEXT_VIEWS, INSPECTOR_VIEWS } from "$representation/data/behavior/workspace/views";
import type { WorkspaceOp } from "$representation/data/types/workspace/op";
import type { Frame, Landing, TabView } from "$representation/data/types/workspace/tab";

const frame: Frame = {
  contextWidth: 276,
  contextCollapsed: false,
  inspectorWidth: 320,
  inspectorCollapsed: false
};
const dragged: Frame = { ...frame, contextWidth: 400, inspectorCollapsed: true };

const library: Landing = {
  content: "agents.library",
  focus: null,
  contextId: CONTEXT_VIEWS[0],
  inspected: "empty",
  selection: null
};
const persona: Landing = {
  content: "agents.persona",
  focus: "p-1",
  contextId: CONTEXT_VIEWS[1],
  inspected: INSPECTOR_VIEWS[0],
  selection: { kind: "persona", id: "p-1" }
};

const view: TabView = { ...library, frame };
const target = { category: "document-editor", resourceId: "k57" } as const;

const OPS: readonly WorkspaceOp[] = [
  { op: "open", tab: "t9", at: 3, target, view },
  { op: "close", tab: "t9", at: 3, target, view },
  { op: "activate", was: "t1", now: "t2" },
  { op: "land", tab: "t9", was: library, now: persona },
  { op: "context", tab: "t9", was: CONTEXT_VIEWS[0], now: CONTEXT_VIEWS[1] },
  {
    op: "inspect",
    tab: "t9",
    was: "empty",
    now: INSPECTOR_VIEWS[0],
    wasSelection: null,
    selection: { kind: "cell", id: "C2" }
  },
  { op: "resize", tab: "t9", was: frame, now: dragged }
];

test("every member of the union is covered here", () => {
  assert.equal(new Set(OPS.map((op) => op.op)).size, OPS.length);
  assert.equal(OPS.length, 7);
});

test("inverting twice is the original, for every member", () => {
  for (const op of OPS) {
    assert.deepEqual(invert(invert(op)), op, op.op);
  }
});

test("open and close are each other, with the same payload", () => {
  const [opened, closed] = OPS;

  assert.deepEqual(invert(opened), closed);
  assert.deepEqual(invert(closed), opened);
});

test("inverting reads no state and leaves its argument alone", () => {
  for (const op of OPS) {
    const before = structuredClone(op);
    invert(op);
    assert.deepEqual(op, before, op.op);
  }
});

test("a gesture inverts in reverse order", () => {
  const gesture = OPS.slice(2);

  assert.deepEqual(
    invertAll(gesture),
    [...gesture].reverse().map(invert)
  );
  assert.deepEqual(invertAll(invertAll(gesture)), gesture);
});
