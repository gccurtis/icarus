import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createServer } from 'node:net';
import { root } from '../lib/context.mjs';

export function checkout(t) {
  const directory = mkdtempSync(join(tmpdir(), 'icarus-agent-cli-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, 'app'));
  mkdirSync(join(directory, '.agents/scripts'), { recursive: true });
  cpSync(join(root, '.agents/scripts'), join(directory, '.agents/scripts'), {
    recursive: true, filter: (source) => !source.startsWith(join(root, '.agents/scripts/test'))
  });
  mkdirSync(join(directory, '.agents/scripts/test'));
  writeFileSync(join(directory, '.agents/scripts/test/fixture.test.mjs'), "import test from 'node:test'; test('agent profile fixture', () => {});\n");
  return directory;
}

export function fakePnpm(directory) {
  const bin = join(directory, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'pnpm'), `#!${process.execPath}
const fs = require('node:fs');
fs.appendFileSync(process.env.ICARUS_TEST_CALLS, JSON.stringify(process.argv.slice(2)) + '\\n');
if (process.argv[2] === process.env.ICARUS_TEST_FAIL) process.exitCode = 9;
`, { mode: 0o755 });
  const env = { ...process.env, PATH: `${bin}:${dirname(process.execPath)}:${process.env.PATH}`, ICARUS_TEST_CALLS: join(directory, 'calls.jsonl') };
  delete env.NODE_TEST_CONTEXT; // A fresh CLI must actually run its own test process.
  return env;
}

export async function unusedPort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
