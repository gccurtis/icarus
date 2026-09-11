import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root } from '../lib/context.mjs';
import { readLease } from '../lib/lease.mjs';
import { assertFreePort } from '../lib/processes.mjs';
import { checkout, unusedPort } from './fixture.mjs';

function serverFixture(directory) {
  const app = join(directory, 'app');
  for (const path of ['scripts', 'seed', 'data', 'node_modules/vite/bin']) mkdirSync(join(app, path), { recursive: true });
  for (const file of ['browser-server.mjs', 'browser-configuration.mjs']) cpSync(join(root, 'app/scripts', file), join(app, 'scripts', file));
  writeFileSync(join(app, 'seed/fixture.json'), '[{"title":"Review fixture"}]');
  writeFileSync(join(app, 'data/keep.json'), 'human review data');
  writeFileSync(join(app, 'node_modules/vite/bin/vite.js'), `
const http = require('node:http');
const port = Number(process.argv[process.argv.indexOf('--port') + 1]);
const info = { port, store: process.env.ICARUS_STORE_DIRECTORY, native: process.env.ICARUS_EXTERNAL_FILE_DIRECTORY };
const server = http.createServer((_req, res) => res.end('ready'));
server.listen(port, '127.0.0.1', () => console.log('TEST_READY ' + JSON.stringify(info)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
`);
}

function ready(child) {
  return new Promise((resolve, reject) => {
    let output = '';
    let errors = '';
    const timeout = setTimeout(() => reject(new Error(`Server did not start: ${errors}`)), 5000);
    child.stderr.on('data', (chunk) => { errors += chunk; });
    child.stdout.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/TEST_READY ([^\n]+)\n/u);
      if (match) { clearTimeout(timeout); resolve(JSON.parse(match[1])); }
    });
    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.once('close', () => { clearTimeout(timeout); reject(new Error(`Server exited before readiness: ${errors}`)); });
  });
}

for (const mode of ['disposable', 'development']) {
  test(`${mode} server owns its port/lifetime and preserves human review data`, { timeout: 10000 }, async (t) => {
    const directory = checkout(t);
    serverFixture(directory);
    const port = await unusedPort();
    const child = spawn(process.execPath, ['.agents/scripts/dev.mjs', '--port', String(port), '--store', mode], {
      cwd: directory, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ICARUS_STORE_DIRECTORY: '/must-not-use', ICARUS_EXTERNAL_FILE_DIRECTORY: '/must-not-use', ICARUS_BROWSER_STORE_DIRECTORY: '/must-not-use' }
    });
    const closed = once(child, 'close');
    let info;
    try {
      info = await ready(child);
      assert.equal(info.port, port);
      assert.equal(readLease(directory).port, port);
      if (mode === 'disposable') {
        assert.equal(readFileSync(join(info.store, 'fixture.json'), 'utf8'), '[{"title":"Review fixture"}]');
        assert.equal(existsSync(info.native), true);
      } else {
        assert.equal(info.store, undefined);
        assert.equal(info.native, undefined);
      }
    } finally {
      child.kill('SIGTERM');
      await closed;
    }
    assert.equal(readLease(directory), null);
    await assertFreePort(port);
    assert.equal(readFileSync(join(directory, 'app/data/keep.json'), 'utf8'), 'human review data');
    if (mode === 'disposable') {
      assert.equal(existsSync(info.store), false);
      assert.equal(existsSync(info.native), false);
    }
  });
}
