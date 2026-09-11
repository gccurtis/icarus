import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { git } from '../lib/worktrees/git.mjs';
import { acquireLease } from '../lib/lease.mjs';
import { inspectWorktree, readyWorktree, worktreeRecord } from '../lib/worktrees/status.mjs';
import { cli, commit, repository, taskOf } from './worktree-fixture.mjs';

test('status is read-only and ready refreshes main without claiming test certification', (t) => {
  const fixture = repository(t);
  const task = taskOf(fixture);
  assert.equal(inspectWorktree(fixture.primary).gitReady, false);
  assert.equal(inspectWorktree(task.path).gitReady, false);
  commit(task.path);
  let report = inspectWorktree(task.path);
  assert.equal(report.gitReady, true);
  assert.equal(report.ahead, 1);
  assert.match(report.verification, /not test certification or merge authorization/u);
  const release = acquireLease(task.path, 'Test ownership');
  assert.equal(inspectWorktree(task.path).gitReady, false);
  release();
  git(fixture.primary, 'worktree', 'lock', task.path);
  assert.equal(inspectWorktree(task.path).gitReady, false);
  git(fixture.primary, 'worktree', 'unlock', task.path);
  writeFileSync(join(fixture.primary, 'target-changed.txt'), 'main changed elsewhere');
  const remoteHead = commit(fixture.primary, 'Advance main');
  git(fixture.primary, 'push', 'origin', 'main');
  git(fixture.primary, 'update-ref', 'refs/remotes/origin/main', task.baseSha);
  assert.equal(inspectWorktree(task.path).gitReady, true); // Deliberately cached ref, not an implicit fetch.
  report = readyWorktree(task.path);
  assert.equal(report.target.sha, remoteHead);
  assert.match(report.target.freshness, /fetched by this command/u);
  assert.equal(report.gitReady, false);
  assert.equal(report.behind, 1);
  assert.equal(report.record.baseSha, task.baseSha);
  assert.deepEqual(report.changes, []);
});

test('invalid ownership records fail explicitly; unmanaged branches are not assigned fictional records', (t) => {
  const fixture = repository(t);
  const task = taskOf(fixture);
  const file = join(task.path, '.agents/tasks/test-task/worktree.json');
  const valid = JSON.parse(readFileSync(file, 'utf8'));
  for (const value of [null, {}, { ...valid, baseSha: 'old' }, { ...valid, branch: 'main' }, { ...valid, createdAt: 'invalid' }]) {
    writeFileSync(file, JSON.stringify(value));
    assert.throws(() => worktreeRecord(task.path, task.branch), /Invalid task worktree record/u);
  }
  assert.equal(worktreeRecord(fixture.primary, 'main'), null);
  assert.equal(worktreeRecord(fixture.primary, 'work/manually-created'), null);
});

test('CLI offers only scoped actions and ready has a failing exit code for a nonready tree', (t) => {
  const fixture = repository(t);
  const task = taskOf(fixture);
  const help = cli(fixture.primary, '--help');
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /No command merges, rebases, commits, or pushes/u);
  for (const args of [['merge'], ['start', 'bad/name'], ['status', 'extra'], ['configure', 'extra'], ['configure', '--confirm', 'test-task'], ['remove', 'test-task', '--path', task.path], ['ready', '--force'], ['status', '--confirm', 'test-task']]) {
    assert.equal(cli(fixture.primary, ...args).status, 1, args.join(' '));
  }
  assert.equal(cli(fixture.primary, 'ready', '--path', task.path).status, 1);
  commit(task.path);
  const report = cli(fixture.primary, 'ready', '--path', task.path);
  assert.equal(report.status, 0, report.stderr);
  assert.equal(JSON.parse(report.stdout).gitReady, true);
});
