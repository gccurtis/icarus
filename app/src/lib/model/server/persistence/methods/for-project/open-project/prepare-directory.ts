import { mkdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Makes sure the project's directory exists, and answers with its path.
 *
 * PGlite creates its own directory but not the parents, so a fresh checkout
 * fails on the first open with an ENOENT naming a path that looks correct. The
 * failure reads as a broken configured root rather than as a missing parent,
 * which is why this is done here and not left to the driver.
 */
export const prepareDirectory = async (root: string, projectId: string): Promise<string> => {
  const directory = join(root, projectId);
  await mkdir(directory, { recursive: true });
  return directory;
};
