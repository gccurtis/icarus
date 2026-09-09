import assert from "node:assert/strict";
import { test } from "vitest";

import { DELIVERED_CAPABILITIES, DELIVERED_PANELS } from "$development-views/project-overview-delivery/procedures/contracts";
import {
  DELTA_GROUPS,
  deltaAdditionCount,
  deltaDeletionCount,
  deltaFileCount
} from "$development-views/project-overview-delivery/procedures/ledger";
import { DELIVERY_AREAS, DELIVERY_TOTALS } from "$development-views/project-overview-delivery/procedures/release";

test("the reference accounts for the pinned Git range exactly once", () => {
  const paths = DELTA_GROUPS.flatMap((group) => group.files.map((file) => file.path));

  assert.equal(deltaFileCount(), DELIVERY_TOTALS.files);
  assert.equal(deltaAdditionCount(), DELIVERY_TOTALS.additions);
  assert.equal(deltaDeletionCount(), DELIVERY_TOTALS.deletions);
  assert.equal(new Set(paths).size, paths.length);
});

test("the area summary and exact ledger describe the same partition", () => {
  assert.deepEqual(
    DELIVERY_AREAS.map(({ id, files, additions, deletions }) => ({ id, files, additions, deletions })),
    DELTA_GROUPS.map(({ id, files, additions, deletions }) => ({
      id,
      files: files.length,
      additions,
      deletions
    }))
  );
});

test("the product and capability totals remain complete", () => {
  assert.equal(DELIVERED_PANELS.length, DELIVERY_TOTALS.panels);
  assert.equal(DELIVERED_PANELS.filter((panel) => panel.surface === "Context").length, 2);
  assert.equal(DELIVERED_PANELS.filter((panel) => panel.surface === "Inspector").length, 4);
  assert.equal(DELIVERED_CAPABILITIES.length, DELIVERY_TOTALS.capabilityEntries);
  assert.equal(DELIVERED_CAPABILITIES.filter((entry) => entry.kind === "Command").length, 1);
});
