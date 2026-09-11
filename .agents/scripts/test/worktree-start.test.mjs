import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, renameSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { git, worktrees } from '../lib/worktrees/git.mjs';
import { startWorktree } from '../lib/worktrees/start.mjs';
import { inspectWorktree, worktreeRecord } from '../lib/worktrees/status.mjs';
import { commit, repository, taskOf } from './worktree-fixture.mjs';

test('start uses fresh origin/main, no main upstream, and a handoff without copying local data', (t) => {
  const fixture = repository(t);
  const { primary, container } = fixture;
  writeFileSync(join(primary, 'new-main.txt'), 'latest main');
  const baseSha = commit(primary, 'Advance main');
  git(primary, 'push', 'origin', 'main');
  git(primary, 'update-ref', 'refs/remotes/origin/main', `${baseSha}^`);
  writeFileSync(join(primary, 'AGENTS.md'), 'uncommitted work belongs to someone else');
  writeFileSync(join(primary, '.env'), 'fixture secret, not copied');
  mkdirSync(join(primary, 'data'));
  writeFileSync(join(primary, 'data/review.json'), 'fixture review data');
  const task = startWorktree(primary, 'fresh-task');
  assert.equal(task.path, join(container, 'primary-worktrees/fresh-task'));
  assert.equal(task.baseSha, baseSha);
  assert.equal(git(task.path, 'rev-parse', 'HEAD').trim(), baseSha);
  assert.equal(git(task.path, 'for-each-ref', '--format=%(upstream)', `refs/heads/${task.branch}`).trim(), '');
  assert.match(readFileSync(task.handoff, 'utf8'), /work\/fresh-task/u);
  assert.equal(worktreeRecord(task.path, task.branch).baseSha, baseSha);
  assert.equal(readFileSync(join(primary, 'AGENTS.md'), 'utf8'), 'uncommitted work belongs to someone else');
  assert.equal(existsSync(join(task.path, '.env')), false);
  assert.equal(existsSync(join(task.path, 'data')), false);
  assert.equal(existsSync(join(task.path, 'app/node_modules')), false);
  assert.match(task.publish, /HEAD:refs\/heads\/work\/fresh-task/u);
});

test('start refuses invalid names, existing branches, and existing or nested destinations', (t) => {
  const fixture = repository(t);
  const { primary, container } = fixture;
  for (const name of ['../escape', 'a/b', 'Upper', '', 'a'.repeat(81)]) {
    assert.throws(() => startWorktree(primary, name));
  }
  assert.throws(() => startWorktree(primary, 'relative', 'relative-path'), /absolute/u);
  assert.throws(() => startWorktree(primary, 'inside', join(primary, 'nested')), /outside/u);
  symlinkSync(primary, join(container, 'alias'));
  assert.throws(() => startWorktree(primary, 'alias', join(container, 'alias/nested')), /outside/u);
  symlinkSync(join(container, 'missing'), join(container, 'dangling'));
  assert.throws(() => startWorktree(primary, 'dangling', join(container, 'dangling')), /already exists/u);
  assert.throws(() => startWorktree(primary, 'existing', primary), /already exists/u);
  const task = taskOf(fixture);
  assert.throws(() => taskOf(fixture), /already has a worktree/u);
  git(primary, 'branch', 'work/local-task');
  assert.throws(() => startWorktree(primary, 'local-task'), /already exists/u);
  git(primary, 'push', 'origin', 'HEAD:refs/heads/work/remote-task');
  assert.throws(() => startWorktree(primary, 'remote-task'), /already exists on origin/u);
  assert.equal(git(task.path, 'symbolic-ref', '--short', 'HEAD').trim(), task.branch);
  assert.equal(worktrees(primary).length, 2);
});

test('partial setup is reported and preserves the new worktree and branch for inspection', (t) => {
  const fixture = repository(t);
  writeFileSync(join(fixture.primary, '.agents/tasks/_template/handoff.md'), '{{UNSUPPORTED}}');
  commit(fixture.primary, 'Broken handoff fixture');
  git(fixture.primary, 'push', 'origin', 'main');
  assert.throws(() => taskOf(fixture, 'setup-failure'), /was created, but setup failed.*preserved/u);
  assert.equal(git(join(fixture.container, 'setup-failure'), 'symbolic-ref', '--short', 'HEAD').trim(), 'work/setup-failure');
  assert.equal(worktrees(fixture.primary).length, 2);
});

test('an unrelated missing registered worktree does not prevent inspecting a surviving worktree', (t) => {
  const fixture = repository(t);
  const missing = taskOf(fixture, 'missing');
  const surviving = taskOf(fixture, 'surviving');
  renameSync(missing.path, join(fixture.container, 'moved-manually'));
  assert.equal(inspectWorktree(surviving.path).branch, surviving.branch);
});
