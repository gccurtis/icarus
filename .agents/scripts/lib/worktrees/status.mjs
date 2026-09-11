import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { entryOf, fetchMain, git, pendingGitState, taskName } from './git.mjs';
import { readLease } from '../lease.mjs';

export function worktreeRecord(directory, branch) {
  if (!branch.startsWith('work/')) return null;
  const task = taskName(branch.slice(5));
  const file = join(directory, '.agents/tasks', task, 'worktree.json');
  if (!existsSync(file)) return null;
  const value = JSON.parse(readFileSync(file, 'utf8'));
  if (!value || value.task !== task || value.branch !== branch || value.baseRef !== 'origin/main' ||
      typeof value.baseSha !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(value.baseSha) ||
      typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))) {
    throw new Error(`Invalid task worktree record: ${file}`);
  }
  return value;
}

export function inspectWorktree(directory) {
  const { entry, primary } = entryOf(directory);
  const branch = entry.branch?.replace(/^refs\/heads\//u, '') ?? '(detached)';
  const head = git(directory, 'rev-parse', 'HEAD').trim();
  const target = git(directory, 'rev-parse', '--verify', 'refs/remotes/origin/main^{commit}').trim();
  const [behind, ahead] = git(directory, 'rev-list', '--left-right', '--count', `${target}...${head}`).trim().split(/\s+/u).map(Number);
  const changes = git(directory, 'status', '--porcelain=v1', '--untracked-files=normal', '-z').split('\0').filter(Boolean);
  const linked = realpathSync(directory) !== realpathSync(primary);
  const taskBranch = /^work\/[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(branch);
  const blockers = [];
  if (!linked || !taskBranch) blockers.push('Implementation belongs in a linked work/<task> worktree.');
  if (changes.length) blockers.push('Commit or account for the working-tree changes before integration.');
  if (behind) blockers.push('The task does not contain current locally observed origin/main.');
  if (!ahead) blockers.push('There are no task commits to integrate.');
  if (entry.locked !== undefined || entry.prunable !== undefined) blockers.push('The Git worktree is locked or prunable.');
  const pending = pendingGitState(directory);
  if (pending.length) blockers.push(`In-progress Git operation or lock: ${pending.join(', ')}.`);
  if (existsSync(join(directory, '.agents/runtime/worktree.lock'))) blockers.push('A worktree command lease is present.');
  return {
    path: realpathSync(directory), primary, linked, branch, head,
    target: { ref: 'origin/main', sha: target, freshness: 'local ref only; ready refreshes it' },
    ahead, behind, changes, record: worktreeRecord(directory, branch), lease: readLease(directory),
    gitReady: blockers.length === 0, blockers,
    verification: 'Not assessed. Git preflight is not test certification or merge authorization.'
  };
}

export function readyWorktree(directory) {
  fetchMain(directory);
  const report = inspectWorktree(directory);
  report.target.freshness = 'fetched by this command; recheck before integration';
  return report;
}
