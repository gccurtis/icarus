import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname } from "node:path";

const syncDirectory = (directory: string): void => {
  const descriptor = openSync(directory, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
};

/** Writes, syncs, renames, then syncs the containing directory. */
export const writeDurableFile = (path: string, contents: string): void => {
  const directory = dirname(path);
  const next = `${path}.next`;
  mkdirSync(directory, { recursive: true });
  let descriptor: number | undefined;
  try {
    descriptor = openSync(next, "w");
    writeFileSync(descriptor, contents, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    renameSync(next, path);
    syncDirectory(directory);
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    rmSync(next, { force: true });
    throw error;
  }
};

/** Removes a durable decision and syncs the directory entry removal. */
export const removeDurableFile = (path: string): void => {
  if (!existsSync(path)) return;
  rmSync(path);
  syncDirectory(dirname(path));
};
