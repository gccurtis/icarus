import assert from "node:assert/strict";
import { test } from "vitest";
import {
  isSafeName,
  isSafeSourcePath
} from "$development-views/stack-builder/procedures/admission.server";

test("a kebab name is admitted", () => {
  assert.equal(isSafeName("header-v2"), true);
  assert.equal(isSafeName("plan"), true);
});

test("a name that would escape the directory is refused", () => {
  for (const attempt of ["../users", "../../etc/passwd", "/etc/passwd", "a/../b", ".", ".."]) {
    assert.equal(isSafeName(attempt), false, attempt);
  }
});

test("a name that is not a kebab string is refused", () => {
  for (const attempt of ["Header", "a b", "a_b", "", "a".repeat(65), 7, null, undefined]) {
    assert.equal(isSafeName(attempt), false, String(attempt));
  }
});

test("a source path under the component trees is admitted", () => {
  assert.equal(isSafeSourcePath("src/lib/components/authored/panel/panel.svelte"), true);
  assert.equal(isSafeSourcePath("src/lib/components/vendored/tabs/index.ts"), true);
});

test("a source path outside the component trees, or reaching upward, is refused", () => {
  for (const attempt of [
    "src/lib/styles/app.css",
    "../.env",
    "src/lib/components/authored/../../../../.env",
    "/etc/passwd",
    "src/lib/components/authored/panel/panel.js",
    ""
  ]) {
    assert.equal(isSafeSourcePath(attempt), false, attempt);
  }
});
