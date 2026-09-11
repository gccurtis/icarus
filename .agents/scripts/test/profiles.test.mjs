import test from 'node:test';
import assert from 'node:assert/strict';
import { browserEnvironment, verificationOptions, verificationPlan } from '../lib/profiles.mjs';

test('plans are explicit, Chromium-only, ordered, and preserve selected tests', () => {
  const options = verificationOptions(['browser', '--port', '5223', '--plan', '--', 'test/browser/resource-creation.spec.ts']);
  const [command] = verificationPlan(options, '/project');
  assert.deepEqual(command.args, ['test:browser', '--project=chromium', 'test/browser/resource-creation.spec.ts']);
  assert.equal(command.cwd, '/project/app');
  assert.equal(options.plan, true);
  assert.deepEqual(verificationPlan(verificationOptions(['full', '--port', '5223']), '/project').map((item) => item.args[0]),
    ['--test', 'typecheck', 'lint', 'test:scripts', 'test', 'build', 'test:browser']);
});

test('rejects ambiguous profiles, unsafe overrides, and unbounded live runs', () => {
  for (const args of [[], ['unknown'], ['browser'], ['quick', '--port', '5223'], ['browser', '--port', '5223', '--', '--output=/tmp/shared'], ['full', '--port', '5223', '--live'], ['browser', '--port', '5223', '--live'], ['scripts', '--', 'x'], ['unit', '--typo']]) {
    assert.throws(() => verificationOptions(args), undefined, JSON.stringify(args));
  }
});

test('isolates browser tests from inherited live data, reset endpoints, and provider overrides', () => {
  const base = {
    PATH: '/tools', ICARUS_CHROMIUM_EXECUTABLE: '/chromium',
    ICARUS_BROWSER_BASE_URL: 'http://human-review', ICARUS_BROWSER_STORE_DIRECTORY: '/human-data',
    ICARUS_BROWSER_EXTERNAL_FILE_DIRECTORY: '/human-files', ICARUS_BROWSER_RESET_DIRECTORY: '/human-data',
    ICARUS_BROWSER_PROVIDER_ORIGIN: 'http://some-provider', ICARUS_BROWSER_RESET_TOKEN: 'secret',
    ICARUS_STORE_DIRECTORY: '/human-data', ICARUS_EXTERNAL_FILE_DIRECTORY: '/human-files',
    ICARUS_CONFIGURATION_DIRECTORY: '/custom-config', ICARUS_CONFIGURATION_OVERLAY: 'custom',
    ICARUS_LIVE_DERIVED_OUTPUT: '1', ICARUS_LIVE_RESEARCH_CHAT: '1'
  };
  const env = browserEnvironment(base, { port: 5223, live: false }, '/owned/evidence');
  assert.deepEqual(env, {
    PATH: '/tools', ICARUS_CHROMIUM_EXECUTABLE: '/chromium', ICARUS_BROWSER_PORT: '5223',
    ICARUS_BROWSER_PROVIDER_PORT: '15223', ICARUS_BROWSER_OUTPUT_DIRECTORY: '/owned/evidence'
  });
  assert.equal(base.ICARUS_BROWSER_RESET_TOKEN, 'secret');
  const live = browserEnvironment(base, { port: 60000, live: true }, '/owned/evidence');
  assert.equal(live.ICARUS_LIVE_DERIVED_OUTPUT, '1');
  assert.equal(live.ICARUS_LIVE_RESEARCH_CHAT, '1');
  assert.equal(live.ICARUS_BROWSER_PROVIDER_PORT, '50000');
  assert.equal(live.ICARUS_BROWSER_BASE_URL, undefined);
});
