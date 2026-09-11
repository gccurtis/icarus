import assert from "node:assert/strict";
import { test } from "vitest";

import { getNumber } from "$model/client/configuration/methods/get-number/get-number";
import { createConfigurationState } from "$model/client/configuration/state";
import type { ConfigurationNumberKey } from "$model/client/configuration/types";

const input = () => ({
  revisions: {
    changeSets: { flushAfterOps: 50, flushAfterMs: 2_000 },
    sync: { everyMs: 4_000 }
  },
  workspace: { changeSets: { flushAfterOps: 20, flushAfterMs: 800 } },
  presentation: {
    stage: { unitsHigh: 720, widthRem: 52, averageGlyphWidthEm: 0.52 },
    zoom: { minimum: 50, maximum: 200, step: 5 },
    gutter: { minimumRem: 0.75, maximumRem: 2.5 }
  }
});

const expected: readonly (readonly [ConfigurationNumberKey, number])[] = [
  ["presentation.gutter.maximumRem", 2.5],
  ["presentation.gutter.minimumRem", 0.75],
  ["presentation.stage.averageGlyphWidthEm", 0.52],
  ["presentation.stage.unitsHigh", 720],
  ["presentation.stage.widthRem", 52],
  ["presentation.zoom.maximum", 200],
  ["presentation.zoom.minimum", 50],
  ["presentation.zoom.step", 5],
  ["revisions.changeSets.flushAfterMs", 2_000],
  ["revisions.changeSets.flushAfterOps", 50],
  ["revisions.sync.everyMs", 4_000],
  ["workspace.changeSets.flushAfterMs", 800],
  ["workspace.changeSets.flushAfterOps", 20]
];

test("the closed key vocabulary selects every stored number", () => {
  const state = createConfigurationState(input());

  for (const [key, value] of expected) {
    assert.equal(getNumber(state, key), value, key);
  }
});

test("state owns primitive fields rather than retaining the transport tree", () => {
  const transport = input();
  const state = createConfigurationState(transport);

  transport.revisions.changeSets.flushAfterOps = 999;

  assert.equal(getNumber(state, "revisions.changeSets.flushAfterOps"), 50);
  assert.equal(Object.values(state).every((value) => typeof value === "number"), true);
});
