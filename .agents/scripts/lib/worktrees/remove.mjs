import { existsSync, readdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { acquireLease } from '../lease.mjs';
import { processVisibility } from '../processes.mjs';
import { contains, fetchMain, git, isAncestor, pendingGitState, taskName, worktrees } from './git.mjs';
import { worktreeRecord } from './status.mjs';

function assertNoProcesses(directory) {
  if (processVisibility() !== 'visible-linux-processes') {
    throw new Error('Cleanup needs visible Linux process information; request scoped process-inspection access.');
  }
  const active = [];
  for (const pid of readdirSync('/proc').filter((name) => /^\d+$/u.test(name))) {
    try {
      if (contains(directory, realpathSync(join('/proc', pid, 'cwd')))) active.push(pid);
    } catch { /* Exited or inaccessible process; visibility remains best effort. */ }
  }
  if (active.length) throw new Error(`Worktree has active processes (PID ${active.join(', ')}); no process was stopped.`);
}

function assertEmptyChanges(directory, ownedLease = false) {
  const pending = pendingGitState(directory);
  if (pending.length) throw new Error(`Worktree has an in-progress Git operation or lock (${pending.join(', ')}); nothing was removed.`);
  const hidden = git(directory, 'ls-files', '-v', '-z').split('\0').filter((file) => /^(?:S|[a-z]) /u.test(file));
  if (hidden.length) throw new Error('Worktree index has assume-unchanged or skip-worktree entries; hidden changes cannot be ruled out.');
  if (git(directory, 'status', '--porcelain=v1', '--untracked-files=normal').trim()) {
    throw new Error('Worktree has modified or untracked files; nothing was removed.');
  }
  const ignored = git(directory, 'ls-files', '--others', '--ignored', '--exclude-standard', '-z').split('\0')
    .filter((file) => file && (!ownedLease || file !== '.agents/runtime/worktree.lock/owner.json'));
  if (ignored.length) throw new Error(`Worktree has ${ignored.length} ignored files (including possible data/caches). Preserve or explicitly dispose of them separately; cleanup will not force removal.`);
}

/** Delete only an explicitly confirmed, merged worktree; retain its branch. */
export function removeWorktree(directory, name, confirmation) {
  const task = taskName(name);
  if (confirmation !== task) throw new Error('Cleanup requires --confirm <the-exact-task-name>.');
  const branch = `work/${task}`;
  const entries = worktrees(directory);
  const matches = entries.filter((entry) => entry.branch === `refs/heads/${branch}`);
  if (matches.length !== 1) throw new Error('Choose a task with exactly one registered worktree.');
  const entry = matches[0];
  const target = realpathSync(entry.path);
  if (target === realpathSync(entries[0].path) || contains(target, realpathSync(directory)) || contains(target, realpathSync(process.cwd()))) {
    throw new Error('Cannot remove the primary or currently used worktree. Run cleanup from another checkout.');
  }
  if (entry.locked !== undefined || entry.prunable !== undefined) throw new Error('Git worktree is locked or prunable; inspect it without forcing removal.');
  if (!worktreeRecord(target, branch)) throw new Error('Task has no worktree.json ownership/base record; inspect it manually.');
  if (existsSync(join(target, '.agents/runtime/worktree.lock'))) throw new Error('Worktree command lease is present; do not steal it.');
  assertNoProcesses(target);
  assertEmptyChanges(target);
  const remoteMain = fetchMain(directory);
  const release = acquireLease(target, 'worktree removal');
  let removed = false;
  try {
    assertNoProcesses(target);
    assertEmptyChanges(target, true);
    const head = git(target, 'rev-parse', 'HEAD').trim();
    const currentBranch = git(target, 'symbolic-ref', '--short', 'HEAD').trim();
    if (currentBranch !== branch) throw new Error('Task branch changed during cleanup; nothing was removed.');
    if (!isAncestor(directory, head, 'refs/heads/main') || !isAncestor(directory, head, remoteMain)) {
      throw new Error('Task commits are not merged into both local main and freshly fetched origin/main.');
    }
    git(directory, 'worktree', 'remove', target);
    removed = true;
    return { removed: target, retainedBranch: branch, recovery: 'Committed files remain recoverable from the retained branch.' };
  } finally {
    if (!removed) release(); // Successful Git removal also removed this helper's own lease.
  }
}
