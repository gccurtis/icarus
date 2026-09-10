import assert from "node:assert/strict";
import { test } from "node:test";

import { browserOutputDirectory } from "../browser-output-directory.mjs";

test("concurrent browser processes cannot share transient Playwright artifacts", () => {
  const first = browserOutputDirectory({ override: undefined, pid: 10_001, port: 5203 });
  const secondProcess = browserOutputDirectory({ override: undefined, pid: 10_002, port: 5203 });
  const secondServer = browserOutputDirectory({ override: undefined, pid: 10_001, port: 5204 });

  assert.notEqual(first, secondProcess);
  assert.notEqual(first, secondServer);
  assert.match(first, /test-results[/\\]browser[/\\]5203-10001$/u);
});

test("an explicit browser artifact directory is deterministic", () => {
  assert.equal(
    browserOutputDirectory({
      override: "/tmp/icarus-browser-contract",
      pid: 10_001,
      port: 5203
    }),
    "/tmp/icarus-browser-contract"
  );
});

test("an explicitly empty browser artifact directory is rejected", () => {
  assert.throws(
    () => browserOutputDirectory({ override: "  ", pid: 10_001, port: 5203 }),
    /must not be empty/u
  );
});
