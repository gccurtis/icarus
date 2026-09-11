import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkout } from './fixture.mjs';

test('status lists only real handoffs and labels unavailable Git/process information', (t) => {
  const directory = checkout(t);
  for (const name of ['_template', 'empty-task', 'ready-task']) {
    mkdirSync(join(directory, '.agents/tasks', name), { recursive: true });
  }
  writeFileSync(join(directory, '.agents/tasks/ready-task/handoff.md'), '# Ready task');
  const report = JSON.parse(execFileSync(process.execPath, ['.agents/scripts/status.mjs', '--json'], { cwd: directory, encoding: 'utf8' }));
  assert.deepEqual(report.tasks, ['.agents/tasks/ready-task/handoff.md']);
  assert.equal(report.changedEntries, 'unknown');
  assert.equal(report.head, '(unavailable)');
  assert.ok(['visible-linux-processes', 'sandbox-limited', 'unsupported', 'unreadable'].includes(report.processVisibility));
});
