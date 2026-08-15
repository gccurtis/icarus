import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";
import { createBrowserStorage } from "$model/client/storage";
import { STORAGE_VERSION, storageKey } from "$model/client/storage/types";

/**
 * The two `localStorage` calls, and what they do when the store refuses.
 *
 * `localStorage` throws rather than returning null when site data is blocked —
 * Safari's private mode historically, and any browser with storage disabled. A
 * panel width is not worth taking the application down over, so both directions
 * are wrapped, and this is the only place that proves it.
 *
 * The suite runs under the node environment, so `window` is stubbed rather than
 * rendered. That is the honest seam anyway: what is being tested is this file's
 * response to a store that misbehaves, not the browser's.
 */

/** A `window` whose storage behaves however a test needs it to. */
const withStorage = (storage: Partial<Storage>) => {
  vi.stubGlobal("window", { localStorage: storage });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

const settled = () => new Promise<void>((resolve) => queueMicrotask(resolve));

test("reads this project's key, and only that key", () => {
  const asked: string[] = [];
  withStorage({
    getItem: (key: string) => {
      asked.push(key);
      return null;
    }
  });

  createBrowserStorage("alpha");

  assert.deepEqual(asked, [storageKey("alpha")]);
});

test("a store that cannot be read is an empty one", () => {
  // Not a crash, and not a distinct state: absent and unreadable both mean
  // "start from defaults".
  withStorage({
    getItem: () => {
      throw new Error("site data is blocked");
    }
  });

  const storage = createBrowserStorage("alpha");

  assert.equal(storage.workbench, undefined);
});

test("a store that cannot be written loses the next reload and nothing else", async () => {
  withStorage({
    getItem: () => null,
    setItem: () => {
      throw new Error("quota exceeded");
    }
  });

  const storage = createBrowserStorage("alpha");

  // The write happens in a microtask, so a throw there would be an unhandled
  // rejection rather than something a caller could catch — which is exactly why
  // it is swallowed at the source.
  storage.saveWorkbench({ tabs: [["project-overview", "a"]] });
  await assert.doesNotReject(settled());
});

test("what is written is this project's key and the whole document", async () => {
  const written = new Map<string, string>();
  withStorage({
    getItem: () => null,
    setItem: (key: string, value: string) => void written.set(key, value)
  });

  const storage = createBrowserStorage("beta");
  storage.saveWorkbench({ tabs: [["project-overview", "a"]] });
  await settled();

  assert.deepEqual([...written.keys()], [storageKey("beta")]);
  assert.equal(JSON.parse(written.get(storageKey("beta")) ?? "{}").v, STORAGE_VERSION);
});

test("two projects cannot grow each other's document", async () => {
  const written = new Map<string, string>();
  withStorage({
    getItem: () => null,
    setItem: (key: string, value: string) => void written.set(key, value)
  });

  createBrowserStorage("alpha").saveWorkbench({ tabs: [["project-overview", "a"]] });
  createBrowserStorage("beta").saveWorkbench({ tabs: [["project-overview", "b"]] });
  await settled();

  assert.equal(written.size, 2);
  assert.match(written.get(storageKey("alpha")) ?? "", /"a"/);
  assert.match(written.get(storageKey("beta")) ?? "", /"b"/);
});
