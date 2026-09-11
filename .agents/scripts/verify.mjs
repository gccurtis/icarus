import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { main, revision, root } from './lib/context.mjs';
import { acquireLease } from './lib/lease.mjs';
import { assertFreePort, assertNoCacheProcesses } from './lib/processes.mjs';
import { runCommand } from './lib/command.mjs';
import { browserEnvironment, verificationOptions, verificationPlan } from './lib/profiles.mjs';

main(import.meta.url, async () => {
  if (process.argv.includes('--help')) {
    console.log('node .agents/scripts/verify.mjs <agents|quick|unit|scripts|browser|full> [--port <port>] [--plan] [--live] [-- <test-path>...]\nquick: typecheck + architecture; full: agents + quick + script/unit tests + build + Chromium.\nBrowser/full require an unused port. Live requires selected browser tests and scoped provider authorization.\nAgents/scripts do not touch app build caches. Artifacts and results stay in ignored .agents/runtime/.');
    return;
  }
  const options = verificationOptions(process.argv.slice(2));
  const plan = verificationPlan(options, root);
  if (options.plan) { console.log(JSON.stringify({ options, commands: plan }, null, 2)); return; }
  const app = join(root, 'app');
  const touchesCache = !['agents', 'scripts'].includes(options.profile);
  if (touchesCache) assertNoCacheProcesses(app);
  const release = touchesCache ? acquireLease(root, `verify ${options.profile}`) : () => {};
  const report = { profile: options.profile, started: new Date().toISOString(), tree: revision(), liveProviders: options.live, commands: [], status: 'running' };
  const directory = join(root, '.agents/runtime/runs', `${Date.now()}-${options.profile}-${randomUUID().slice(0, 8)}`);
  try {
    if (touchesCache) assertNoCacheProcesses(app);
    if (options.port) {
      await assertFreePort(options.port);
      if (!options.live) await assertFreePort(options.port <= 55535 ? options.port + 10000 : options.port - 10000);
    }
    mkdirSync(directory, { recursive: true });
    console.log(`Verification evidence: ${directory}`);
    for (const [index, command] of plan.entries()) {
      const browser = command.args.includes('test:browser');
      const env = browser ? browserEnvironment(process.env, options, join(directory, 'chromium')) : process.env;
      const log = join(directory, `${index + 1}.log`);
      console.log(`Running: ${command.command} ${command.args.join(' ')}`);
      const outcome = await runCommand(command.command, command.args, { cwd: command.cwd, env, log });
      report.commands.push({ ...command, ...outcome, log });
      if (outcome.code !== 0) {
        report.status = 'failed';
        process.exitCode = outcome.code;
        break;
      }
    }
    if (report.status === 'running') report.status = 'passed';
  } catch (error) {
    report.status = 'failed';
    report.error = error.message;
    throw error;
  } finally {
    report.finished = new Date().toISOString();
    try {
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, 'result.json'), JSON.stringify(report, null, 2));
    } finally { release(); }
  }
});
