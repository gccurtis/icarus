import { join } from 'node:path';
import { portOf } from './processes.mjs';

export const profileNames = ['agents', 'quick', 'unit', 'scripts', 'browser', 'full'];

export function verificationOptions(args) {
  const values = [...args];
  const profile = values.shift();
  if (!profileNames.includes(profile)) throw new Error(`Choose a profile: ${profileNames.join(', ')}.`);
  const options = { profile, plan: false, live: false, tests: [] };
  while (values.length) {
    const arg = values.shift();
    if (arg === '--plan') options.plan = true;
    else if (arg === '--live') options.live = true;
    else if (arg === '--port') options.port = portOf(values.shift());
    else if (arg === '--') { options.tests = values.splice(0); break; }
    else throw new Error(`Unknown option: ${arg}`);
  }
  const browser = profile === 'browser' || profile === 'full';
  if (browser && !options.port) throw new Error('Browser/full verification requires --port <owned-port>.');
  if (!browser && options.port) throw new Error('--port is only for browser/full profiles.');
  if (options.tests.some((test) => test.startsWith('-'))) throw new Error('After --, provide test paths only; runner/server overrides are not accepted.');
  if (options.tests.length && !['unit', 'browser'].includes(profile)) throw new Error('Test selection is supported only by unit/browser profiles.');
  if (options.live && (profile !== 'browser' || !options.tests.length)) throw new Error('--live requires browser with explicit test paths and scoped provider authorization.');
  return options;
}

export function verificationPlan(options, directory) {
  const pnpm = (name, args = []) => ({ command: 'pnpm', args: [name, ...args], cwd: join(directory, 'app') });
  const agents = { command: process.execPath, args: ['--test', '.agents/scripts/test/*.test.mjs'], cwd: directory };
  const checks = {
    quick: [pnpm('typecheck'), pnpm('lint')],
    unit: [pnpm('test', options.tests)],
    scripts: [pnpm('test:scripts')],
    browser: [pnpm('test:browser', ['--project=chromium', ...options.tests])],
    full: [agents, pnpm('typecheck'), pnpm('lint'), pnpm('test:scripts'), pnpm('test'), pnpm('build'), pnpm('test:browser', ['--project=chromium'])],
    agents: [agents]
  };
  return checks[options.profile];
}

/** Prevent inherited harness overrides from touching a human review Store. */
export function browserEnvironment(base, options, outputDirectory) {
  const env = { ...base };
  for (const key of Object.keys(env)) {
    if (key.startsWith('ICARUS_BROWSER_') || key.startsWith('ICARUS_LIVE_') ||
      ['ICARUS_STORE_DIRECTORY', 'ICARUS_EXTERNAL_FILE_DIRECTORY', 'ICARUS_CONFIGURATION_DIRECTORY', 'ICARUS_CONFIGURATION_OVERLAY'].includes(key)) delete env[key];
  }
  const providerPort = options.port <= 55535 ? options.port + 10000 : options.port - 10000;
  Object.assign(env, {
    ICARUS_BROWSER_PORT: String(options.port),
    ICARUS_BROWSER_PROVIDER_PORT: String(providerPort),
    ICARUS_BROWSER_OUTPUT_DIRECTORY: outputDirectory
  });
  if (options.live) Object.assign(env, { ICARUS_LIVE_DERIVED_OUTPUT: '1', ICARUS_LIVE_RESEARCH_CHAT: '1' });
  return env;
}
