import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { portOf, assertFreePort, cacheProcesses, processVisibility } from '../lib/processes.mjs';

test('requires an explicit non-privileged port', () => {
  assert.equal(portOf('5223'), 5223);
  for (const port of [undefined, '', '3oops', '3.5', '-1', '80', '65536']) assert.throws(() => portOf(port));
});

test('distinguishes isolated sandbox visibility from readable host process information', { skip: process.platform !== 'linux' }, (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'icarus-agent-visibility-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  assert.equal(processVisibility(directory), 'unreadable');
  mkdirSync(join(directory, '1'));
  writeFileSync(join(directory, '1/cmdline'), 'codex-linux-sandbox\0--permissions');
  assert.equal(processVisibility(directory), 'sandbox-limited');
  writeFileSync(join(directory, '1/cmdline'), '/sbin/init');
  assert.equal(processVisibility(directory), 'visible-linux-processes');
});

test('an occupied port is rejected without stopping its listener', async () => {
  const server = createServer((socket) => socket.end());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    await assert.rejects(assertFreePort(port), /unavailable/u);
    assert.equal(server.listening, true);
  } finally { await new Promise((resolve) => server.close(resolve)); }
  await assertFreePort(port);
});

test('Linux discovery separates worktrees and does not expose raw process arguments', { skip: process.platform !== 'linux' }, (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'icarus-agent-process-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const app = join(directory, 'app');
  const other = join(directory, 'other');
  const proc = join(directory, 'proc');
  for (const path of [app, other, proc]) mkdirSync(path);
  const samples = [
    ['101', app, ['node', '/pkg/vite/bin/vite.js', '--port', '3123', '--secret', 'private'].join('\0')],
    ['102', other, ['node', '/pkg/vite/bin/vite.js'].join('\0')],
    ['103', app, ['node', 'unrelated.js'].join('\0')]
  ];
  for (const [pid, cwd, command] of samples) {
    const path = join(proc, pid);
    mkdirSync(path);
    symlinkSync(cwd, join(path, 'cwd'));
    writeFileSync(join(path, 'cmdline'), command);
  }
  const processes = cacheProcesses(app, proc);
  assert.equal(processes.length, 1);
  assert.equal(processes[0].pid, 101);
  assert.equal(processes[0].port, 3123);
  assert.equal(JSON.stringify(processes).includes('private'), false);
});
