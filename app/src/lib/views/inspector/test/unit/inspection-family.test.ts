import assert from "node:assert/strict";
import { test } from "vitest";
import { INSPECTION_KEYS, familyOf } from "$views/inspector/procedures/inspection-family";

/**
 * Routing an inspection key.
 *
 * The key is a string the model never validated — that is the trade for the
 * model not owning this vocabulary — so the case worth pinning is what happens
 * to one this panel does not understand.
 */

test("a key routes on the family before the dot", () => {
  assert.equal(familyOf("block.text-selection"), "block");
  assert.equal(familyOf("document.page"), "document");
  assert.equal(familyOf("copilot.tool-call"), "copilot");
});

test("every declared key routes somewhere", () => {
  for (const key of INSPECTION_KEYS) {
    assert.ok(familyOf(key), `${key} does not route`);
  }
});

test("an unknown family is undefined, not a throw", () => {
  // It renders as "no view for this yet", which is the honest thing to say
  // about a label some surface produced and nothing here understands.
  assert.equal(familyOf("spreadsheet.cell"), undefined);
  assert.equal(familyOf("nonsense"), undefined);
  assert.equal(familyOf(""), undefined);
});

test("a family with no member still routes", () => {
  // The panel narrows on the whole key afterwards; the family is the only part
  // this function is responsible for.
  assert.equal(familyOf("block"), "block");
});
