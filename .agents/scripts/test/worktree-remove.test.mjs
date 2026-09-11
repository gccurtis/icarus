import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { git, worktrees } from '../lib/worktrees/git.mjs';
import { removeWorktree } from '../lib/worktrees/remove.mjs';
import { inspectWorktree } from '../lib/worktrees/status.mjs';
import { acquireLease } from '../lib/lease.mjs';
import { commit, integrate, repository, taskOf } from './worktree-fixture.mjs';

test('cleanup requires exact confirmation and a task merged into both local and freshly fetched main', (t) => {
  const fixture = repository(t);
  const task = taskOf(fixture);
  const head = commit(task.path);
  assert.throws(() => removeWorktree(fixture.primary, 'test-task', 'other-task'), /exact-task-name/u);
  assert.throws(() => removeWorktree(task.path, 'test-task', 'test-task'), /currently used/u);
  assert.throws(() => removeWorktree(fixture.primary, 'test-task', 'test-task'), /not merged into both/u);
  integrate(fixture, task, false);
  assert.throws(() => removeWorktree(fixture.primary, 'test-task', 'test-task'), /not merged into both/u);
  git(fixture.primary, 'push', 'origin', 'main');
  const report = removeWorktree(fixture.primary, 'test-task', 'test-task');
  assert.equal(report.removed, task.path);
  assert.equal(report.retainedBranch, task.branch);
  assert.equal(existsSync(task.path), false);
  assert.equal(git(fixture.primary, 'rev-parse', task.branch).trim(), head);
  assert.equal(readFileSync(join(fixture.primary, 'AGENTS.md'), 'utf8'), '# Test repository\n');
  assert.equal(worktrees(fixture.primary).length, 1);
});

test('cleanup refuses primary, unowned, Git-locked, and leased worktrees without stealing ownership', (t) => {
  const fixture = repository(t);
  git(fixture.primary, 'switch', '-c', 'work/primary');
  assert.throws(() => removeWorktree(fixture.primary, 'primary', 'primary'), /primary/u);
  git(fixture.primary, 'switch', 'main');
  const manual = join(fixture.container, 'manual');
  git(fixture.primary, 'worktree', 'add', '-b', 'work/manual', manual, 'main');
  assert.throws(() => removeWorktree(fixture.primary, 'manual', 'manual'), /no worktree.json/u);
  const task = taskOf(fixture);
  commit(task.path);
  integrate(fixture, task);
  git(fixture.primary, 'worktree', 'lock', '--reason', 'owned elsewhere', task.path);
  assert.throws(() => removeWorktree(fixture.primary, 'test-task', 'test-task'), /locked/u);
  git(fixture.primary, 'worktree', 'unlock', task.path);
  const release = acquireLease(task.path, 'Another owner');
  const ownerFile = join(task.path, '.agents/runtime/worktree.lock/owner.json');
  const before = readFileSync(ownerFile, 'utf8');
  assert.throws(() => removeWorktree(fixture.primary, 'test-task', 'test-task'), /lease is present/u);
  assert.equal(readFileSync(ownerFile, 'utf8'), before);
  release();
  mkdirSync(join(task.path, '.agents/runtime/worktree.lock'));
  assert.throws(() => removeWorktree(fixture.primary, 'test-task', 'test-task'), /lease is present/u);
});

test('cleanup preserves tracked edits, untracked files, ignored data, credentials, and caches', (t) => {
  const fixture = repository(t);
  const cases = ['AGENTS.md', 'untracked.txt', '.env', 'data/review.json', 'app/node_modules/cache.txt'];
  for (const [index, file] of cases.entries()) {
    const name = `data-${index}`;
    const task = taskOf(fixture, name);
    commit(task.path);
    integrate(fixture, task);
    const target = join(task.path, file);
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, 'valuable local data');
    assert.throws(() => removeWorktree(fixture.primary, name, name), /modified or untracked|ignored files/u);
    assert.equal(readFileSync(target, 'utf8'), 'valuable local data');
  }
});

test('cleanup rejects hidden tracked edits even when ordinary Git status reports clean', (t) => {
  const fixture = repository(t);
  for (const flag of ['assume-unchanged', 'skip-worktree']) {
    const task = taskOf(fixture, flag);
    commit(task.path);
    integrate(fixture, task);
    git(task.path, 'update-index', `--${flag}`, 'AGENTS.md');
    writeFileSync(join(task.path, 'AGENTS.md'), 'hidden local work');
    assert.equal(git(task.path, 'status', '--porcelain').trim(), '');
    assert.throws(() => removeWorktree(fixture.primary, flag, flag), /hidden changes cannot be ruled out/u);
    assert.equal(readFileSync(join(task.path, 'AGENTS.md'), 'utf8'), 'hidden local work');
  }
});

test('cleanup refuses the ignored configuration symlink and leaves its source intact', (t) => {
  const fixture = repository(t);
  const source = join(fixture.primary, 'app/configuration/local.yaml');
  writeFileSync(source, 'fixture shared configuration');
  const task = taskOf(fixture);
  const link = join(task.path, 'app/configuration/local.yaml');
  commit(task.path);
  integrate(fixture, task);
  assert.throws(() => removeWorktree(fixture.primary, 'test-task', 'test-task'), /ignored files/u);
  assert.equal(readlinkSync(link), source);
  assert.equal(readFileSync(source, 'utf8'), 'fixture shared configuration');
  unlinkSync(link);
  assert.equal(removeWorktree(fixture.primary, 'test-task', 'test-task').removed, task.path);
  assert.equal(readFileSync(source, 'utf8'), 'fixture shared configuration');
});

test('cleanup preserves a pending empty cherry-pick and refuses an index lock', (t) => {
  const fixture = repository(t);
  const task = taskOf(fixture);
  commit(task.path);
  integrate(fixture, task);
  assert.throws(() => git(task.path, 'cherry-pick', 'HEAD'));
  assert.equal(git(task.path, 'status', '--porcelain').trim(), '');
  const metadata = git(task.path, 'rev-parse', '--absolute-git-dir').trim();
  const marker = join(metadata, 'CHERRY_PICK_HEAD');
  const pendingHead = readFileSync(marker, 'utf8');
  assert.throws(() => removeWorktree(fixture.primary, 'test-task', 'test-task'), /in-progress Git operation/u);
  assert.equal(readFileSync(marker, 'utf8'), pendingHead);
  assert.match(inspectWorktree(task.path).blockers.join('\n'), /CHERRY_PICK_HEAD/u);
  git(task.path, 'cherry-pick', '--abort');
  writeFileSync(join(metadata, 'index.lock'), 'another command owns this');
  assert.throws(() => removeWorktree(fixture.primary, 'test-task', 'test-task'), /index.lock/u);
  assert.equal(readFileSync(join(metadata, 'index.lock'), 'utf8'), 'another command owns this');
});

test('cleanup refuses a visible process rooted in the worktree and never stops it', async (t) => {
  const fixture = repository(t);
  const task = taskOf(fixture);
  commit(task.path);
  integrate(fixture, task);
  const child = spawn(process.execPath, ['-e', 'process.stdout.write("ready"); setInterval(() => {}, 1000)'], {
    cwd: task.path, stdio: ['ignore', 'pipe', 'pipe']
  });
  const stopped = once(child, 'exit');
  try {
    await once(child.stdout, 'data');
    assert.throws(() => removeWorktree(fixture.primary, 'test-task', 'test-task'), /active processes/u);
    assert.equal(child.exitCode, null);
    assert.equal(child.killed, false);
    assert.equal(existsSync(task.path), true);
  } finally {
    child.kill('SIGTERM');
    await stopped;
  }
});
