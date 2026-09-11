import { parseArgs } from 'node:util';
import { join } from 'node:path';
import { main, root } from './lib/context.mjs';
import { assertFreePort, assertNoCacheProcesses, portOf } from './lib/processes.mjs';
import { acquireLease } from './lib/lease.mjs';
import { runCommand } from './lib/command.mjs';

main(import.meta.url, async () => {
  const { values } = parseArgs({ options: { port: { type: 'string' }, store: { type: 'string' }, help: { type: 'boolean' } } });
  if (values.help) {
    console.log('node .agents/scripts/dev.mjs --port <port> --store <disposable|development>\nForeground server; Ctrl-C stops its owned child. Disposable data is seeded and removed at exit. Development uses configured data without reseeding.');
    return;
  }
  const port = portOf(values.port);
  if (!['disposable', 'development'].includes(values.store)) throw new Error('Choose --store disposable or --store development explicitly.');
  const app = join(root, 'app');
  assertNoCacheProcesses(app);
  const release = acquireLease(root, 'development server', { port, store: values.store });
  try {
    assertNoCacheProcesses(app);
    await assertFreePort(port);
    const env = { ...process.env };
    for (const key of Object.keys(env)) if (key.startsWith('ICARUS_BROWSER_')) delete env[key];
    if (values.store === 'development') {
      delete env.ICARUS_STORE_DIRECTORY;
      delete env.ICARUS_EXTERNAL_FILE_DIRECTORY;
    }
    console.log(`Review URL: http://127.0.0.1:${port}/app/dev-project\nStore: ${values.store}. Stop with Ctrl-C in this session; no other server is touched.`);
    const args = values.store === 'disposable'
      ? [join(app, 'scripts/browser-server.mjs'), String(port)]
      : [join(app, 'node_modules/vite/bin/vite.js'), 'dev', '--host', '127.0.0.1', '--port', String(port), '--strictPort'];
    const result = await runCommand(process.execPath, args, { cwd: app, env });
    process.exitCode = result.code;
  } finally { release(); }
});
