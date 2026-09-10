import assert from "node:assert/strict";
import { test } from "vitest";
import type { DocumentBody } from "$representation/data/types/documents/body";
import { applyOps, invertAll } from "$representation/data/behavior/documents/apply-ops";
import {
  customPaperOps,
  marginOps,
  orientationOps,
  pageNumberOf,
  pageNumberOps,
  paperOps
} from "$app-views/categories/document-editor/procedures/layout";

const BARE: DocumentBody = { rows: [] };

test("the first layout edit writes the default page setup first", () => {
  const ops = paperOps(BARE, "a4");
  const after = applyOps(BARE, ops);

  assert.deepEqual(ops.map((op) => op.path), ["pageSetup", "pageSetup/paper"]);
  assert.equal(after.pageSetup?.paper, "a4");
  assert.equal(after.pageSetup?.orientation, "portrait");
  assert.deepEqual(applyOps(after, invertAll(ops)), BARE);
});

test("custom paper starts from the size the named paper had", () => {
  const letter = applyOps(BARE, paperOps(BARE, "letter"));
  const custom = applyOps(letter, paperOps(letter, "custom"));

  assert.deepEqual(custom.pageSetup?.paper, { width: 8.5, height: 11 });

  const wider = applyOps(custom, customPaperOps(custom, { width: 9 }));
  assert.deepEqual(wider.pageSetup?.paper, { width: 9, height: 11 });
});

test("orientation and margins are single field writes", () => {
  const after = applyOps(BARE, [...orientationOps(BARE, "landscape")]);
  assert.equal(after.pageSetup?.orientation, "landscape");

  const wide = applyOps(after, marginOps(after, "left", 1.25));
  assert.equal(wide.pageSetup?.margins.left, 1.25);
  assert.deepEqual(marginOps(wide, "left", 1.25), []);
});

test("page numbers use represented bottom-page furniture when none exists", () => {
  const numbered = applyOps(BARE, pageNumberOps(BARE, "center"));
  assert.equal(numbered.footer?.pageNumber?.position, "center");
  assert.equal(pageNumberOf(numbered)?.position, "center");

  const none = applyOps(numbered, pageNumberOps(numbered, "none"));
  assert.equal(pageNumberOf(none), undefined);
  assert.equal(none.footer?.rows.length, 1, "the footer stays");
});

test("turning numbering off clears numbering from both represented edges", () => {
  const before: DocumentBody = {
    rows: [],
    header: {
      rows: [],
      distanceFromEdge: 0.4,
      pageNumber: { position: "start" }
    },
    footer: {
      rows: [],
      distanceFromEdge: 0.4,
      pageNumber: { position: "end" }
    }
  };

  const after = applyOps(before, pageNumberOps(before, "none"));
  assert.equal(after.header?.pageNumber, undefined);
  assert.equal(after.footer?.pageNumber, undefined);
  assert.deepEqual(after.header?.rows, []);
  assert.deepEqual(after.footer?.rows, []);
});
