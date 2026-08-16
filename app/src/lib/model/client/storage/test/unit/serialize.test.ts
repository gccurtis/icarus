import assert from "node:assert/strict";
import { test } from "vitest";
import { decode, encode } from "$model/client/storage/methods/serialize";
import { STORAGE_VERSION, storageKey } from "$model/client/storage/types";

/**
 * Everything read here was written by an older build, or edited by hand, or
 * corrupted. `decode` must never throw, and it must never hand back a value the
 * rest of the application would then trip over — a panel width of `NaN`, or a
 * tab that is half a tab.
 */

test("an absent store gives an empty document", () => {
  for (const absent of [null, undefined, ""]) {
    assert.deepEqual(decode(absent), { v: STORAGE_VERSION });
  }
});

test("text that is not JSON gives an empty document rather than throwing", () => {
  assert.deepEqual(decode("{not json"), { v: STORAGE_VERSION });
  assert.deepEqual(decode("[]"), { v: STORAGE_VERSION });
  assert.deepEqual(decode('"a string"'), { v: STORAGE_VERSION });
});

test("a version mismatch discards rather than migrating", () => {
  const older = JSON.stringify({ v: 0, workbench: { tabs: [["project-overview", "p1"]] } });
  assert.deepEqual(decode(older), { v: STORAGE_VERSION });
});

test("round trips a full document", () => {
  const document = {
    v: STORAGE_VERSION,
    workbench: {
      tabs: [
        [
          "project-overview",
          "p1",
          {
            contextId: "overview",
            panels: {
              contextWidth: 312,
              contextCollapsed: false,
              inspectorWidth: 360,
              inspectorCollapsed: true
            }
          }
        ] as const
      ],
      active: ["project-overview", "p1"] as const
    }
  };

  assert.deepEqual(decode(encode(document)), document);
});

test("omits absent sections rather than writing nulls", () => {
  assert.equal(encode({ v: STORAGE_VERSION }), `{"v":${STORAGE_VERSION}}`);
});

test("one key per project", () => {
  // A workbench belongs to a project, and everything persisted is workbench
  // state. Two projects must not be able to grow each other's document.
  assert.notEqual(storageKey("alpha"), storageKey("beta"));
  assert.ok(storageKey("alpha").endsWith("alpha"));
});

// ------------------------------------------------------------- hostile ----

test("replaces a width that could not be one", () => {
  for (const hostile of [Number.NaN, Infinity, -1, 1.5, "300", null, {}, 100_000]) {
    const stored = JSON.stringify({
      v: STORAGE_VERSION,
      workbench: { tabs: [["project-overview", "p1", { panels: { contextWidth: hostile } }]] }
    });
    const [tab] = decode(stored).workbench?.tabs ?? [];

    assert.equal(tab?.[2]?.panels?.contextWidth, 0, `${JSON.stringify(hostile)} was admitted`);
  }
});

test("admits a plausible width unchanged", () => {
  const stored = JSON.stringify({
    v: STORAGE_VERSION,
    workbench: { tabs: [["project-overview", "p1", { panels: { contextWidth: 312 } }]] }
  });

  assert.equal(decode(stored).workbench?.tabs[0][2]?.panels?.contextWidth, 312);
});

test("does not clamp to panel bounds — that is the component's job", () => {
  // 40 is below any panel minimum. Storage's business is "could this be a
  // width", not "is this width allowed"; putting the bound here would put the
  // same number in two places.
  const stored = JSON.stringify({
    v: STORAGE_VERSION,
    workbench: { tabs: [["project-overview", "p1", { panels: { contextWidth: 40 } }]] }
  });

  assert.equal(decode(stored).workbench?.tabs[0][2]?.panels?.contextWidth, 40);
});

test("drops a tab that is not a ref", () => {
  const stored = JSON.stringify({
    v: STORAGE_VERSION,
    workbench: {
      tabs: [
        ["project-overview", "p1"],
        ["only-one"],
        [42, "p2"],
        ["kind", ""],
        "not an array",
        null
      ]
    }
  });

  assert.deepEqual(decode(stored).workbench?.tabs, [["project-overview", "p1"]]);
});

test("drops options that could not be options, keeping the tab", () => {
  // A bad width costs a re-drag; losing the tab loses the user's place.
  const stored = JSON.stringify({
    v: STORAGE_VERSION,
    workbench: {
      tabs: [
        ["project-overview", "p1", 7],
        ["project-overview", "p2", { contextId: 7 }]
      ]
    }
  });

  assert.deepEqual(decode(stored).workbench?.tabs, [
    ["project-overview", "p1"],
    ["project-overview", "p2"]
  ]);
});

test("keeps an unknown kind — dropping it is the workbench's decision", () => {
  // Storage cannot know what a ResourceKind is without depending on the domain,
  // which would make the stored format follow every domain change. The workbench
  // drops what it does not recognise.
  const stored = JSON.stringify({
    v: STORAGE_VERSION,
    workbench: { tabs: [["a-kind-that-no-longer-exists", "x"]] }
  });

  assert.deepEqual(decode(stored).workbench?.tabs, [["a-kind-that-no-longer-exists", "x"]]);
});

test("keeps an unknown context id — the workbench decides that too", () => {
  const stored = JSON.stringify({
    v: STORAGE_VERSION,
    workbench: { tabs: [["project-overview", "p1", { contextId: "gone" }]] }
  });

  assert.equal(decode(stored).workbench?.tabs[0][2]?.contextId, "gone");
});

test("takes only the ref from an active entry, never a third element", () => {
  const stored = JSON.stringify({
    v: STORAGE_VERSION,
    workbench: { tabs: [], active: ["project-overview", "p1", { contextId: "overview" }] }
  });

  assert.deepEqual(decode(stored).workbench?.active, ["project-overview", "p1"]);
});

test("survives a workbench section that is not an object", () => {
  for (const hostile of ["[]", "null", '"x"', "7"]) {
    const stored = `{"v":${STORAGE_VERSION},"workbench":${hostile}}`;
    assert.equal(decode(stored).workbench, undefined);
  }
});

test("gives an empty tab list when tabs is not an array", () => {
  const stored = JSON.stringify({ v: STORAGE_VERSION, workbench: { tabs: "nope" } });
  assert.deepEqual(decode(stored).workbench?.tabs, []);
});
