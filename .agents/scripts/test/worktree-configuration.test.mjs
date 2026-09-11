import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, lstatSync, readFileSync, readlinkSync, renameSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { linkWorktreeConfiguration } from '../lib/worktrees/configuration.mjs';
import { git } from '../lib/worktrees/git.mjs';
import { startWorktree } from '../lib/worktrees/start.mjs';
import { cli, repository, taskOf } from './worktree-fixture.mjs';

const override = (directory) => join(directory, 'app/configuration/local.yaml');
const fixtureSecret = 'fixture-only-private-key';

test('start links only the ignored local override while tracked configuration remains independent', (t) => {
  const fixture = repository(t);
  writeFileSync(override(fixture.primary), fixtureSecret);
  const task = taskOf(fixture);
  assert.equal(task.configuration.status, 'linked');
  assert.equal(lstatSync(override(task.path)).isSymbolicLink(), true);
  assert.equal(readlinkSync(override(task.path)), override(fixture.primary));
  assert.equal(readFileSync(override(task.path), 'utf8'), fixtureSecret);
  assert.doesNotMatch(JSON.stringify(task), new RegExp(fixtureSecret, 'u'));
  assert.doesNotMatch(readFileSync(task.handoff, 'utf8'), new RegExp(fixtureSecret, 'u'));
  assert.equal(lstatSync(join(task.path, 'app/configuration')).isSymbolicLink(), false);
  writeFileSync(join(task.path, 'app/configuration/dev.yaml'), 'task-owned settings');
  assert.match(readFileSync(join(fixture.primary, 'app/configuration/dev.yaml'), 'utf8'), /username: fixture/u);
  assert.equal(git(task.path, 'ls-files', '--', 'app/configuration/local.yaml'), '');
  assert.match(git(task.path, 'ls-files', '--others', '--ignored', '--exclude-standard'), /app\/configuration\/local.yaml/u);
  // Cleanup removes only the ignored link; shared source bytes remain intact.
  unlinkSync(override(task.path));
  assert.equal(readFileSync(override(fixture.primary), 'utf8'), fixtureSecret);
});

test('start from a linked worktree still selects the primary override rather than the caller override', (t) => {
  const fixture = repository(t);
  writeFileSync(override(fixture.primary), fixtureSecret);
  const caller = taskOf(fixture, 'caller');
  unlinkSync(override(caller.path));
  writeFileSync(override(caller.path), 'caller-specific configuration');
  const task = startWorktree(caller.path, 'nested-start', join(fixture.container, 'nested-start'));
  assert.equal(task.configuration.source, override(fixture.primary));
  assert.equal(readlinkSync(override(task.path)), override(fixture.primary));
  assert.equal(readFileSync(override(caller.path), 'utf8'), 'caller-specific configuration');
});

test('configure adds a later primary override to an existing worktree and safely reuses its link', (t) => {
  const fixture = repository(t);
  const task = taskOf(fixture);
  assert.equal(task.configuration.status, 'source-missing');
  assert.equal(existsSync(override(task.path)), false);
  assert.equal(cli(fixture.primary, 'configure').status, 1);
  writeFileSync(override(fixture.primary), fixtureSecret);
  const first = cli(fixture.primary, 'configure', '--path', task.path);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(JSON.parse(first.stdout).status, 'linked');
  assert.doesNotMatch(first.stdout + first.stderr, new RegExp(fixtureSecret, 'u'));
  const second = cli(task.path, 'configure');
  assert.equal(second.status, 0, second.stderr);
  assert.equal(JSON.parse(second.stdout).status, 'already-linked');
  unlinkSync(override(task.path));
  symlinkSync(relative(join(task.path, 'app/configuration'), override(fixture.primary)), override(task.path));
  assert.equal(linkWorktreeConfiguration(task.path).status, 'already-linked');
});

test('configure preserves existing files and different or dangling symlinks', (t) => {
  const fixture = repository(t);
  const task = taskOf(fixture);
  writeFileSync(override(fixture.primary), fixtureSecret);
  writeFileSync(override(task.path), 'owned local configuration');
  assert.throws(() => linkWorktreeConfiguration(task.path), /already exists.*preserved/u);
  assert.equal(readFileSync(override(task.path), 'utf8'), 'owned local configuration');
  unlinkSync(override(task.path));
  const other = join(fixture.container, 'other.yaml');
  writeFileSync(other, 'another configuration');
  symlinkSync(other, override(task.path));
  assert.throws(() => linkWorktreeConfiguration(task.path), /already exists.*preserved/u);
  assert.equal(readlinkSync(override(task.path)), other);
  unlinkSync(other);
  assert.throws(() => linkWorktreeConfiguration(task.path), /already exists.*preserved/u);
  assert.equal(readlinkSync(override(task.path)), other);
});

test('configure rejects tracked or unignored local override paths on either side', (t) => {
  const fixture = repository(t);
  const task = taskOf(fixture);
  writeFileSync(override(fixture.primary), fixtureSecret);
  for (const directory of [fixture.primary, task.path]) {
    const ignore = join(directory, '.gitignore');
    const original = readFileSync(ignore, 'utf8');
    writeFileSync(ignore, original.replace('app/configuration/local.yaml\n', ''));
    assert.throws(() => linkWorktreeConfiguration(task.path), /must be Git-ignored/u);
    writeFileSync(ignore, original);
    if (directory === task.path) writeFileSync(override(task.path), 'owned local configuration');
    git(directory, 'add', '--force', 'app/configuration/local.yaml');
    assert.throws(() => linkWorktreeConfiguration(task.path), /is tracked/u);
    git(directory, 'restore', '--staged', 'app/configuration/local.yaml');
    if (directory === task.path) unlinkSync(override(task.path));
  }
  assert.equal(existsSync(override(task.path)), false);
});

test('configure rejects symlinked configuration directories and invalid sources', (t) => {
  const fixture = repository(t);
  const task = taskOf(fixture);
  symlinkSync(join(fixture.container, 'missing.yaml'), override(fixture.primary));
  assert.throws(() => linkWorktreeConfiguration(task.path), /must resolve to a regular file/u);
  assert.equal(existsSync(override(task.path)), false);
  unlinkSync(override(fixture.primary));
  writeFileSync(override(fixture.primary), fixtureSecret);
  const config = join(task.path, 'app/configuration');
  const displaced = join(fixture.container, 'displaced-configuration');
  renameSync(config, displaced);
  symlinkSync(join(fixture.primary, 'app/configuration'), config);
  assert.throws(() => linkWorktreeConfiguration(task.path), /worktree-owned directory/u);
  assert.equal(readFileSync(override(fixture.primary), 'utf8'), fixtureSecret);
});
