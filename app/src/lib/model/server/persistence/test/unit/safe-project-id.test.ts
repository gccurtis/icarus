import assert from "node:assert/strict";
import { test } from "vitest";
import { assertSafeProjectId } from "$model/server/persistence/methods/for-project/safe-project-id";

test("admits an ordinary project id", () => {
  for (const id of ["default", "a", "project-1", "a_b-c", "9lives"]) {
    assert.doesNotThrow(() => assertSafeProjectId(id), `${id} should be admitted`);
  }
});

test("rejects anything that could escape the projects directory", () => {
  for (const id of ["..", "../etc", "a/b", "a\\b", ".hidden", "/abs", "a\0b"]) {
    assert.throws(() => assertSafeProjectId(id), /not usable as a directory name/, `${id} escaped`);
  }
});

test("rejects uppercase, so a case-folding filesystem cannot merge two projects", () => {
  // APFS and NTFS fold `Alpha` and `alpha` to one directory while the registry
  // keys them separately — two projects sharing one database, held by two
  // single-connection instances at once.
  assert.throws(() => assertSafeProjectId("Alpha"), /not usable as a directory name/);
});

test("rejects an empty id and one past the length limit", () => {
  assert.throws(() => assertSafeProjectId(""), /not usable as a directory name/);
  assert.throws(() => assertSafeProjectId("a".repeat(65)), /not usable as a directory name/);
  assert.doesNotThrow(() => assertSafeProjectId("a".repeat(64)));
});

test("rejects a trailing newline, which a line-oriented source can smuggle in", () => {
  assert.throws(() => assertSafeProjectId("alpha\n"), /not usable as a directory name/);
});
