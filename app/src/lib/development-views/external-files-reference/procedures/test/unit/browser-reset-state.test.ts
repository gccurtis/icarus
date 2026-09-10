import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test, vi } from "vitest";

import {
  disposableBrowserState,
  restoreDisposableBrowserState
} from "$development-views/external-files-reference/procedures/browser-reset-state.server";

const directories: string[] = [];

const temporary = (prefix: string): string => {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  directories.push(directory);
  return directory;
};

afterEach(() => {
  vi.unstubAllEnvs();
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a browser reset restores represented seed and clears every native External byte", () => {
  const store = temporary("icarus-browser-store-");
  const seed = temporary("icarus-browser-seed-");
  const externalFiles = temporary("icarus-browser-external-files-");
  writeFileSync(join(store, "stale-row.json"), "stale");
  writeFileSync(join(seed, "current-row.json"), "current");
  writeFileSync(join(externalFiles, "stale-native-blob"), "native");

  vi.stubEnv("ICARUS_BROWSER_RESET_DIRECTORY", store);
  vi.stubEnv("ICARUS_BROWSER_SEED_DIRECTORY", seed);
  vi.stubEnv("ICARUS_BROWSER_RESET_EXTERNAL_FILE_DIRECTORY", externalFiles);

  const state = disposableBrowserState();
  assert.notEqual(state, undefined);
  restoreDisposableBrowserState(state!);

  assert.equal(existsSync(join(store, "stale-row.json")), false);
  assert.equal(readFileSync(join(store, "current-row.json"), "utf8"), "current");
  assert.deepEqual(readdirSync(externalFiles), []);
});

test("the reset seam requires one exact disposable represented-and-native state", () => {
  const store = temporary("icarus-browser-store-");
  const seed = temporary("icarus-browser-seed-");
  vi.stubEnv("ICARUS_BROWSER_RESET_DIRECTORY", store);
  vi.stubEnv("ICARUS_BROWSER_SEED_DIRECTORY", seed);

  assert.equal(disposableBrowserState(), undefined);

  vi.stubEnv("ICARUS_BROWSER_RESET_EXTERNAL_FILE_DIRECTORY", join(seed, "not-disposable"));
  assert.throws(disposableBrowserState, /non-disposable External file directory/);
});
