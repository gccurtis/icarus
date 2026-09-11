import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { runCommand } from '../lib/command.mjs';
import { readLease } from '../lib/lease.mjs';
import { checkout, fakePnpm, unusedPort } from './fixture.mjs';

function report(directory) {
  const runs = join(directory, '.agents/runtime/runs');
  const entries = readdirSync(runs);
  assert.equal(entries.length, 1);
  return JSON.parse(readFileSync(join(runs, entries[0], 'result.json'), 'utf8'));
}

test('plan does not execute commands or create runtime state', async (t) => {
  const directory = checkout(t);
  const env = fakePnpm(directory);
  const result = await runCommand(process.execPath, ['.agents/scripts/verify.mjs', 'quick', '--plan'], { cwd: directory, env });
  assert.equal(result.code, 0);
  assert.equal(existsSync(env.ICARUS_TEST_CALLS), false);
  assert.equal(existsSync(join(directory, '.agents/runtime')), false);
});

test('first failure stops verification, records actual results, and releases the lease', async (t) => {
  const directory = checkout(t);
  const env = { ...fakePnpm(directory), ICARUS_TEST_FAIL: 'typecheck' };
  const result = await runCommand(process.execPath, ['.agents/scripts/verify.mjs', 'quick'], { cwd: directory, env });
  assert.equal(result.code, 9);
  assert.equal(readFileSync(env.ICARUS_TEST_CALLS, 'utf8'), '["typecheck"]\n');
  const recorded = report(directory);
  assert.equal(recorded.status, 'failed');
  assert.equal(recorded.commands.length, 1);
  assert.equal(recorded.commands[0].code, 9);
  assert.equal(readLease(directory), null);
});

test('successful full profile executes all checks in order and records its evidence', async (t) => {
  const directory = checkout(t);
  const env = fakePnpm(directory);
  const port = await unusedPort();
  const result = await runCommand(process.execPath, ['.agents/scripts/verify.mjs', 'full', '--port', String(port)], { cwd: directory, env });
  assert.equal(result.code, 0);
  const recorded = report(directory);
  assert.equal(recorded.status, 'passed');
  assert.equal(recorded.commands.length, 7);
  assert.equal(recorded.liveProviders, false);
  assert.equal(readLease(directory), null);
  assert.deepEqual(readFileSync(env.ICARUS_TEST_CALLS, 'utf8').trim().split('\n').map(JSON.parse).map((args) => args[0]),
    ['typecheck', 'lint', 'test:scripts', 'test', 'build', 'test:browser']);
});
