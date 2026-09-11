import { existsSync, lstatSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { createHandoff } from '../../handoff.mjs';
import { contains, entryOf, fetchMain, git, taskName } from './git.mjs';
import { linkWorktreeConfiguration } from './configuration.mjs';

function destinationOf(requested, primary, task, entries) {
  if (requested && !isAbsolute(requested)) throw new Error('--path must be absolute.');
  const destination = requested ?? join(dirname(primary), `${basename(primary)}-worktrees`, task);
  try { lstatSync(destination); throw new Error('Destination already exists; inspect/reuse it explicitly.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  let ancestor = dirname(destination);
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  const canonical = resolve(realpathSync(ancestor), relative(ancestor, destination));
  if (entries.some((entry) => contains(entry.path, canonical))) {
    throw new Error('Put task worktrees outside every existing worktree, not inside its source tree.');
  }
  return canonical;
}

export function startWorktree(directory, name, requestedPath) {
  const task = taskName(name);
  const branch = `work/${task}`;
  const { entries, primary } = entryOf(directory);
  const existing = entries.find((entry) => entry.branch === `refs/heads/${branch}`);
  if (existing) throw new Error(`Task already has a worktree at ${existing.path}; continue there explicitly.`);
  const branches = git(directory, 'for-each-ref', '--format=%(refname)', 'refs/heads').trim().split('\n');
  if (branches.includes(`refs/heads/${branch}`)) throw new Error(`${branch} already exists; it will not be replaced.`);
  const destination = destinationOf(requestedPath, primary, task, entries);
  const baseSha = fetchMain(directory);
  if (git(directory, 'ls-remote', '--heads', 'origin', `refs/heads/${branch}`).trim()) {
    throw new Error(`${branch} already exists on origin; inspect ownership and resume it explicitly.`);
  }
  git(directory, 'cat-file', '-e', `${baseSha}:.agents/tasks/_template/handoff.md`);
  mkdirSync(dirname(destination), { recursive: true });
  git(directory, 'worktree', 'add', '--no-track', '-b', branch, destination, baseSha);
  try {
    const handoff = createHandoff(destination, task);
    const record = { task, branch, baseRef: 'origin/main', baseSha, createdAt: new Date().toISOString() };
    writeFileSync(join(dirname(handoff), 'worktree.json'), `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
    const configuration = linkWorktreeConfiguration(destination);
    return {
      path: destination, branch, baseSha, handoff, configuration,
      setup: 'The ignored local configuration is linked from the primary checkout when available. Tracked configuration remains worktree-owned. Dependencies, caches, credentials, and review data were not copied. Install dependencies in this worktree when needed.',
      publish: `git push -u origin HEAD:refs/heads/${branch}`
    };
  } catch (error) {
    throw new Error(`Worktree ${destination} was created, but setup failed: ${error.message}. It and ${branch} were preserved for inspection; no automatic cleanup was attempted.`);
  }
}
