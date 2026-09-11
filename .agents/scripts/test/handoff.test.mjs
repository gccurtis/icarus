import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, readFileSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHandoff } from '../handoff.mjs';
import { root } from '../lib/context.mjs';

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'icarus-agent-handoff-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, '.agents/tasks/_template'), { recursive: true });
  cpSync(join(root, '.agents/tasks/_template/handoff.md'), join(directory, '.agents/tasks/_template/handoff.md'));
  return directory;
}

test('creates a fresh handoff from the real template without unresolved substitutions', (t) => {
  const directory = fixture(t);
  const path = createHandoff(directory, 'editor-review');
  assert.equal(path, join(directory, '.agents/tasks/editor-review/handoff.md'));
  const content = readFileSync(path, 'utf8');
  assert.ok(content.includes(directory));
  assert.ok(content.includes('editor-review'));
  assert.doesNotMatch(content, /\{\{[A-Z]+\}\}/u);
});

test('rejects traversal and preserves existing handoffs byte for byte', (t) => {
  const directory = fixture(t);
  for (const name of ['../escape', 'a/b', 'Upper', '', '.', 'a'.repeat(81)]) {
    assert.throws(() => createHandoff(directory, name));
  }
  const path = createHandoff(directory, 'owned-task');
  writeFileSync(path, 'valuable decisions');
  assert.throws(() => createHandoff(directory, 'owned-task'), /EEXIST/u);
  assert.equal(readFileSync(path, 'utf8'), 'valuable decisions');
});

test('unknown template placeholders fail before creating the task directory', (t) => {
  const directory = fixture(t);
  writeFileSync(join(directory, '.agents/tasks/_template/handoff.md'), '{{UNSUPPORTED}}');
  assert.throws(() => createHandoff(directory, 'new-task'), /unsupported placeholder/u);
});
