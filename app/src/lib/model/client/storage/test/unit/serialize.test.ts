import assert from "node:assert/strict";
import { test } from "vitest";
import { decode, encode } from "$model/client/storage/methods/serialize";
import { STORAGE_VERSION, storageKey } from "$model/client/storage/types";
import type { PersistedClient } from "$model/client/storage/types";

/**
 * Everything read here is untrusted stored text. `decode` must never throw, and
 * it must never hand back a value the
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

test("an unsupported version is discarded whole", () => {
  const unsupported = JSON.stringify({ v: 0, workbench: { tabs: [["unknown", "unknown"]] } });
  assert.deepEqual(decode(unsupported), { v: STORAGE_VERSION });
});

test("round trips a full document", () => {
  const document = {
    v: STORAGE_VERSION,
    workbench: {
      tabs: [
        [
          "project-overview",
          "project-overview",
          {
            contextId: "project-overview.overview",
            panels: {
              contextWidth: 312,
              contextCollapsed: false,
              inspectorWidth: 360,
              inspectorCollapsed: true
            }
          }
        ] as const
      ],
      active: ["project-overview", "project-overview"] as const
    }
  } satisfies PersistedClient;

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

test("rejects a current document whose panel geometry is incomplete or invalid", () => {
  for (const hostile of [Number.NaN, Infinity, -1, 1.5, "300", null, {}, 100_000]) {
    const stored = JSON.stringify({
      v: STORAGE_VERSION,
      workbench: {
        tabs: [
          [
            "project-overview",
            "project-overview",
            {
              panels: {
                contextWidth: hostile,
                contextCollapsed: false,
                inspectorWidth: 360,
                inspectorCollapsed: false
              }
            }
          ]
        ]
      }
    });
    assert.deepEqual(
      decode(stored),
      { v: STORAGE_VERSION },
      `${JSON.stringify(hostile)} was admitted`
    );
  }

  const partial = JSON.stringify({
    v: STORAGE_VERSION,
    workbench: { tabs: [["project-overview", "project-overview", { panels: { contextWidth: 312 } }]] }
  });
  assert.deepEqual(decode(partial), { v: STORAGE_VERSION });
});

test("admits a plausible width unchanged", () => {
  const stored = JSON.stringify({
    v: STORAGE_VERSION,
    workbench: {
      tabs: [
        [
          "project-overview",
          "project-overview",
          {
            panels: {
              contextWidth: 312,
              contextCollapsed: false,
              inspectorWidth: 360,
              inspectorCollapsed: true
            }
          }
        ]
      ]
    }
  });

  assert.equal(decode(stored).workbench?.tabs[0][2]?.panels?.contextWidth, 312);
});

test("does not clamp to panel bounds — that is the component's job", () => {
  // 40 is below any panel minimum. Storage's business is "could this be a
  // width", not "is this width allowed"; putting the bound here would put the
  // same number in two places.
  const stored = JSON.stringify({
    v: STORAGE_VERSION,
    workbench: {
      tabs: [
        [
          "project-overview",
          "project-overview",
          {
            panels: {
              contextWidth: 40,
              contextCollapsed: false,
              inspectorWidth: 360,
              inspectorCollapsed: true
            }
          }
        ]
      ]
    }
  });

  assert.equal(decode(stored).workbench?.tabs[0][2]?.panels?.contextWidth, 40);
});

test("rejects the whole current document when any tab is malformed", () => {
  const stored = JSON.stringify({
    v: STORAGE_VERSION,
    workbench: {
      tabs: [
        ["project-overview", "project-overview"],
        ["only-one"],
        [42, "p2"],
        ["kind", ""],
        "not an array",
        null
      ]
    }
  });

  assert.deepEqual(decode(stored), { v: STORAGE_VERSION });
});

test("rejects supplied options that are not one complete current options object", () => {
  const stored = JSON.stringify({
    v: STORAGE_VERSION,
    workbench: {
      tabs: [
        ["project-overview", "project-overview", 7],
        ["document-editor", "documents:2", { contextId: 7 }]
      ]
    }
  });

  assert.deepEqual(decode(stored), { v: STORAGE_VERSION });
});

test("rejects an unknown category and a mismatched resource namespace", () => {
  const stored = JSON.stringify({
    v: STORAGE_VERSION,
    workbench: { tabs: [["extension", "x"]] }
  });
  const mismatched = JSON.stringify({
    v: STORAGE_VERSION,
    workbench: { tabs: [["document-editor", "slideDecks:1"]] }
  });

  assert.deepEqual(decode(stored), { v: STORAGE_VERSION });
  assert.deepEqual(decode(mismatched), { v: STORAGE_VERSION });
});

test("rejects a context outside the category's current closed rail", () => {
  for (const contextId of ["extension", "document-editor.context"]) {
    const stored = JSON.stringify({
      v: STORAGE_VERSION,
      workbench: {
        tabs: [["document-editor", "documents:1", { contextId }]]
      }
    });

    assert.deepEqual(decode(stored), { v: STORAGE_VERSION });
  }
});

test("admits only current category-specific identities", () => {
  const valid = JSON.stringify({
    v: STORAGE_VERSION,
    workbench: {
      tabs: [
        ["agents", "agents"],
        ["analysis", "analysis-1"],
        ["context-editor", "context-editor"],
        ["project-overview", "project-overview"],
        ["document-editor", "documents:1"],
        ["new-tab", "new-tab"],
        ["slide-deck-editor", "slideDecks:1"],
        ["spreadsheet-editor", "spreadsheets:1"],
        ["research", "researchThreads:1"],
        ["templates", "templates"]
      ]
    }
  });
  assert.equal(decode(valid).workbench?.tabs.length, 10);

  for (const hostile of [
    ["project-overview", "projects:1"],
    ["agents", "agentTasks:1"],
    ["research", "threads:1"],
    [{ toString: () => "document-editor" }, "documents:1"]
  ]) {
    const stored = JSON.stringify({ v: STORAGE_VERSION, workbench: { tabs: [hostile] } });
    assert.deepEqual(decode(stored), { v: STORAGE_VERSION });
  }
});

test("rejects duplicate tab identities and an active identity that is not open", () => {
  const duplicate = JSON.stringify({
    v: STORAGE_VERSION,
    workbench: {
      tabs: [
        ["document-editor", "documents:1"],
        ["document-editor", "documents:1"]
      ]
    }
  });
  const absent = JSON.stringify({
    v: STORAGE_VERSION,
    workbench: {
      tabs: [["document-editor", "documents:1"]],
      active: ["document-editor", "documents:2"]
    }
  });
  assert.deepEqual(decode(duplicate), { v: STORAGE_VERSION });
  assert.deepEqual(decode(absent), { v: STORAGE_VERSION });
});

test("rejects an active entry with a non-current third member", () => {
  const stored = JSON.stringify({
    v: STORAGE_VERSION,
    workbench: {
      tabs: [],
      active: ["project-overview", "project-overview", { contextId: "project-overview.overview" }]
    }
  });

  assert.deepEqual(decode(stored), { v: STORAGE_VERSION });
});

test("survives a workbench section that is not an object", () => {
  for (const hostile of ["[]", "null", '"x"', "7"]) {
    const stored = `{"v":${STORAGE_VERSION},"workbench":${hostile}}`;
    assert.equal(decode(stored).workbench, undefined);
  }
});

test("rejects a workbench whose required tabs field is not an array", () => {
  const stored = JSON.stringify({ v: STORAGE_VERSION, workbench: { tabs: "nope" } });
  assert.deepEqual(decode(stored), { v: STORAGE_VERSION });
});

test("rejects unknown fields instead of treating another shape as current", () => {
  for (const value of [
    { v: STORAGE_VERSION, oldWorkbench: { tabs: [] } },
    {
      v: STORAGE_VERSION,
      workbench: { tabs: [], oldActive: ["project-overview", "project-overview"] }
    },
    {
      v: STORAGE_VERSION,
      workbench: {
        tabs: [[
          "project-overview",
          "project-overview",
          { contextId: "project-overview.overview", oldPanel: 300 }
        ]]
      }
    }
  ]) {
    assert.deepEqual(decode(JSON.stringify(value)), { v: STORAGE_VERSION });
  }
});
