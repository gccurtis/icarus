import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';

function result(directory, args) {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES']) delete env[key];
  const answer = spawnSync('git', args, {
    cwd: directory, env, encoding: 'utf8', timeout: 30000, maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (answer.error) throw new Error(`Git ${args[0]} could not run: ${answer.error.code}.`);
  return answer;
}

export function git(directory, ...args) {
  const answer = result(directory, args);
  if (answer.status !== 0) throw new Error(`Git ${args[0]} failed (exit ${answer.status}); inspect repository access or run that Git command directly.`);
  return answer.stdout;
}

export function isAncestor(directory, ancestor, tip) {
  const answer = result(directory, ['merge-base', '--is-ancestor', ancestor, tip]);
  if (answer.status === 0) return true;
  if (answer.status === 1) return false;
  throw new Error('Could not establish commit ancestry; no cleanup is safe.');
}

export function fetchMain(directory) {
  git(directory, 'fetch', '--no-tags', 'origin', 'refs/heads/main:refs/remotes/origin/main');
  return git(directory, 'rev-parse', '--verify', 'refs/remotes/origin/main^{commit}').trim();
}

export function worktrees(directory) {
  return git(directory, 'worktree', 'list', '--porcelain', '-z').split('\0\0').filter(Boolean).map((block) => {
    const fields = Object.fromEntries(block.split('\0').filter(Boolean).map((field) => {
      const space = field.indexOf(' ');
      return space < 0 ? [field, true] : [field.slice(0, space), field.slice(space + 1)];
    }));
    return { ...fields, path: fields.worktree };
  });
}

export function entryOf(directory) {
  const canonical = realpathSync(directory);
  const entries = worktrees(canonical);
  const entry = entries.find((item) => {
    try { return realpathSync(item.path) === canonical; }
    catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  });
  if (!entry) throw new Error('Choose the root of a registered worktree.');
  return { entry, entries, primary: entries[0].path };
}

export function contains(parent, child) {
  const part = relative(parent, child);
  return part === '' || (part !== '..' && !part.startsWith(`..${sep}`) && !isAbsolute(part));
}

export function pendingGitState(directory) {
  const gitDirectory = git(directory, 'rev-parse', '--absolute-git-dir').trim();
  return ['index.lock', 'HEAD.lock', 'config.worktree.lock', 'MERGE_HEAD', 'CHERRY_PICK_HEAD',
    'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'sequencer', 'BISECT_START']
    .filter((name) => existsSync(join(gitDirectory, name)));
}

export function taskName(value) {
  if (typeof value !== 'string' || value.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value)) {
    throw new Error('Use a task name of 1–80 lowercase letters/digits separated by hyphens.');
  }
  return value;
}
