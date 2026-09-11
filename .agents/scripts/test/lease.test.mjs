import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireLease, readLease } from '../lib/lease.mjs';

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'icarus-agent-lease-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('one worktree lease excludes concurrent owners and releases idempotently', (t) => {
  const directory = fixture(t);
  assert.equal(readLease(directory), null);
  const release = acquireLease(directory, 'server', { port: 3123 });
  assert.equal(readLease(directory).port, 3123);
  assert.throws(() => acquireLease(directory, 'build'), /already held/u);
  release();
  release();
  assert.equal(readLease(directory), null);
  acquireLease(directory, 'build')();
});

test('a stale or replaced lease is not stolen or removed by a previous owner', (t) => {
  const directory = fixture(t);
  const release = acquireLease(directory, 'old owner');
  const file = join(directory, '.agents/runtime/worktree.lock/owner.json');
  const replacement = { token: 'replacement', pid: 999999999, label: 'new owner' };
  writeFileSync(file, JSON.stringify(replacement));
  assert.throws(release, /ownership changed/u);
  assert.throws(() => acquireLease(directory, 'third owner'), /already held/u);
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), replacement);
});

test('unreadable metadata fails closed instead of clearing the lock', (t) => {
  const directory = fixture(t);
  acquireLease(directory, 'owner');
  writeFileSync(join(directory, '.agents/runtime/worktree.lock/owner.json'), 'not json');
  assert.ok(readLease(directory).error);
  assert.throws(() => acquireLease(directory, 'next'), /already held/u);
});
