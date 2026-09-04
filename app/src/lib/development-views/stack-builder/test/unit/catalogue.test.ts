import assert from "node:assert/strict";
import { test } from "vitest";
import { VENDORED, catalogueFrom } from "$development-views/stack-builder/procedures/catalogue";

const Panel = () => {};
const PanelRow = () => {};
const helper = () => {};

const indexes = {
  "/src/lib/components/authored/panel/index.ts": { Panel, PanelRow },
  "/src/lib/components/authored/chart/index.ts": { helper }
};

const files = {
  "/src/lib/components/authored/panel/panel.svelte": Panel,
  "/src/lib/components/authored/panel/panel-row.svelte": PanelRow
};

test("an export is a catalogue entry only when it is the default of a component file", () => {
  assert.deepEqual(
    catalogueFrom(indexes, files)
      .filter((entry) => entry.source === "authored")
      .map((entry) => entry.name),
    ["Panel", "PanelRow"]
  );
});

test("an authored entry carries the path of the file it was found in", () => {
  const entry = catalogueFrom(indexes, files).find((found) => found.name === "PanelRow");
  assert.equal(entry?.path, "src/lib/components/authored/panel/panel-row.svelte");
  assert.equal(entry?.family, "panel");
});

test("entries are sorted, because an eager glob's key order differs between dev and build", () => {
  const names = catalogueFrom(
    { "/src/lib/components/authored/panel/index.ts": { PanelRow, Panel } },
    files
  ).map((entry) => entry.name);
  assert.deepEqual(names.slice(0, 2), ["Panel", "PanelRow"]);
});

test("an alias for a component already listed is not a second entry", () => {
  const withAlias = {
    "/src/lib/components/authored/panel/index.ts": { Panel, PanelRow, Root: Panel }
  };
  assert.equal(
    catalogueFrom(withAlias, files).filter((entry) => entry.source === "authored").length,
    2
  );
});

test("the six vendored entries are appended, each carrying its reason", () => {
  const vendored = catalogueFrom(indexes, files).filter((entry) => entry.source === "vendored");
  assert.equal(vendored.length, 6);
  assert.deepEqual(
    vendored.map((entry) => entry.name),
    ["accordion", "checkbox", "pagination", "separator", "tabs", "toggle"]
  );
  assert.ok(vendored.every((entry) => entry.reason.length > 0));
});

test("a vendored entry points at its index, which is the only path it may be entered at", () => {
  const entry = catalogueFrom(indexes, files).find((found) => found.name === "tabs");
  assert.equal(entry?.path, "src/lib/components/vendored/tabs/index.ts");
});

test("every entry id is unique", () => {
  const ids = catalogueFrom(indexes, files).map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("VENDORED is the curated six and nothing else", () => {
  assert.equal(VENDORED.length, 6);
});
