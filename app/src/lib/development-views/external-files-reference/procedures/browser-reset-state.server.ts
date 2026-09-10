import { cpSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";

const STORE_PREFIX = "icarus-browser-store-";
const EXTERNAL_PREFIX = "icarus-browser-external-files-";

export type DisposableBrowserState = {
  readonly store: string;
  readonly seed: string;
  readonly externalFiles: string;
};

const temporaryDirectory = (path: string, prefix: string, label: string): string => {
  if (resolve(dirname(path)) !== resolve(tmpdir()) || !basename(path).startsWith(prefix)) {
    throw new Error(`The browser harness refused to reset a non-disposable ${label} directory`);
  }
  return path;
};

/** Resolves the one exact set of disposable directories a browser reset owns. */
export const disposableBrowserState = (): DisposableBrowserState | undefined => {
  const store = process.env.ICARUS_BROWSER_RESET_DIRECTORY?.trim();
  const seed = process.env.ICARUS_BROWSER_SEED_DIRECTORY?.trim();
  const externalFiles = process.env.ICARUS_BROWSER_RESET_EXTERNAL_FILE_DIRECTORY?.trim();
  if (!store || !seed || !externalFiles) return undefined;

  return {
    store: temporaryDirectory(store, STORE_PREFIX, "Store"),
    seed,
    externalFiles: temporaryDirectory(externalFiles, EXTERNAL_PREFIX, "External file")
  };
};

/** Restores every durable repository owned by one disposable browser scenario. */
export const restoreDisposableBrowserState = (state: DisposableBrowserState): void => {
  rmSync(state.store, { recursive: true, force: true });
  mkdirSync(state.store, { recursive: true });
  cpSync(state.seed, state.store, { recursive: true });

  rmSync(state.externalFiles, { recursive: true, force: true });
  mkdirSync(state.externalFiles, { recursive: true });
};
