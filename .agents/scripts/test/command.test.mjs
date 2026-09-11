import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCommand } from '../lib/command.mjs';

test('captures both streams, reports failure, and releases signal handlers', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'icarus-agent-command-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const log = join(directory, 'command.log');
  const initial = ['SIGINT', 'SIGTERM'].map((signal) => process.listenerCount(signal));
  const result = await runCommand(process.execPath, ['-e', 'console.log("output"); console.error("error"); process.exitCode=7'], { log });
  assert.equal(result.code, 7);
  assert.match(readFileSync(log, 'utf8'), /output/u);
  assert.match(readFileSync(log, 'utf8'), /error/u);
  assert.deepEqual(['SIGINT', 'SIGTERM'].map((signal) => process.listenerCount(signal)), initial);
  await assert.rejects(runCommand(process.execPath, ['--version'], { log }), /EEXIST/u);
});

test('spawn failures remain failures and leave no signal listeners', async () => {
  const initial = process.listenerCount('SIGTERM');
  await assert.rejects(runCommand('/does-not-exist-icarus-agent-test', []), /ENOENT/u);
  assert.equal(process.listenerCount('SIGTERM'), initial);
});
