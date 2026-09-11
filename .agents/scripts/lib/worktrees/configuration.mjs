import { lstatSync, readlinkSync, realpathSync, statSync, symlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { entryOf, git } from './git.mjs';

const localFile = 'app/configuration/local.yaml';

function metadata(path) {
  try { return lstatSync(path); }
  catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
}

function assertLocalOverride(directory) {
  for (const path of ['app', 'app/configuration']) {
    if (!metadata(join(directory, path))?.isDirectory()) {
      throw new Error(`${directory}/${path} must be a real worktree-owned directory; configuration directories must not be symlinked.`);
    }
  }
  if (git(directory, 'ls-files', '--', localFile).trim()) {
    throw new Error(`${directory}/${localFile} is tracked; configuration linking requires an untracked, ignored local override.`);
  }
  let ignored = false;
  try { ignored = git(directory, 'check-ignore', '--no-index', '--', localFile).trim() === localFile; }
  catch { /* A missing ignore rule or failed Git check must not admit a secret-bearing link. */ }
  if (!ignored) throw new Error(`${directory}/${localFile} must be Git-ignored before configuration can be linked.`);
}

/** Share only the ignored override, without reading its contents or replacing any destination. */
export function linkWorktreeConfiguration(directory) {
  const { entry, primary } = entryOf(directory);
  const targetRoot = realpathSync(entry.path);
  const sourceRoot = realpathSync(primary);
  if (targetRoot === sourceRoot) throw new Error('Configure a linked task worktree, not the primary checkout.');
  assertLocalOverride(sourceRoot);
  assertLocalOverride(targetRoot);
  const source = join(sourceRoot, localFile);
  const destination = join(targetRoot, localFile);
  const target = metadata(destination);
  if (target && (!target.isSymbolicLink() || resolve(dirname(destination), readlinkSync(destination)) !== source)) {
    throw new Error(`${destination} already exists as a local file or a different symlink; it was preserved. Inspect its ownership before choosing configuration.`);
  }
  if (!metadata(source)) return { status: 'source-missing', source, destination };
  try {
    if (!statSync(source).isFile()) throw new Error('not a regular file');
  } catch {
    throw new Error(`${source} must resolve to a regular file; a broken link or other file type cannot supply local configuration.`);
  }
  if (target) return { status: 'already-linked', source, destination };
  // symlinkSync is exclusive: a concurrently created destination is never overwritten.
  symlinkSync(source, destination, 'file');
  return { status: 'linked', source, destination };
}
