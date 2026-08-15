import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { checkStyles } from "../../../lint/styles/rules.mjs";
import { buildFixture } from "../../../lint/styles/test/build-fixtures.mjs";

const scriptsRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const themeScript = join(scriptsRoot, "new-theme.mjs");

const run = (script, args, fixture, extraEnv = {}, cwd = fixture.packageRoot) => spawnSync(process.execPath, [script, ...args], {
  cwd,
  encoding: "utf8",
  env: { ...process.env, ICARUS_PACKAGE_ROOT: fixture.packageRoot, ...extraEnv }
});

const withFixture = (body) => {
  const fixture = buildFixture();
  try { body(fixture); }
  finally { rmSync(fixture.packageRoot, { recursive: true, force: true }); }
};

test("generates a light theme and registers every owned surface", () => withFixture((fixture) => {
  const result = run(themeScript, ["aurora", "--from", "celestial", "--scheme", "light"], fixture, {}, dirname(fixture.packageRoot));
  assert.equal(result.status, 0, result.stderr);
  const theme = join(fixture.stylesRoot, "chromatic-themes", "aurora", "aurora.css");
  assert.ok(existsSync(theme));
  assert.match(readFileSync(theme, "utf8"), /\[data-theme="aurora"\]/);
  assert.doesNotMatch(readFileSync(theme, "utf8"), /^:root,/m);
  assert.match(readFileSync(join(fixture.stylesRoot, "app.css"), "utf8"), /chromatic-themes\/aurora\/aurora\.css/);
  assert.deepEqual(checkStyles(fixture), []);
}));

test("registers a generated dark theme in Tailwind", () => withFixture((fixture) => {
  const result = run(themeScript, ["nocturne", "--from", "cyberpunk", "--scheme", "dark"], fixture);
  assert.equal(result.status, 0, result.stderr);
  const tailwind = readFileSync(join(fixture.stylesRoot, "x-integrations", "tailwind", "tailwind.css"), "utf8");
  assert.match(tailwind, /data-theme="nocturne"/);
  assert.deepEqual(checkStyles(fixture), []);
}));

test("rejects an invalid name without writes", () => withFixture((fixture) => {
  const badName = run(themeScript, ["Bad/Name", "--from", "celestial", "--scheme", "light"], fixture);
  assert.notEqual(badName.status, 0);
  assert.ok(!existsSync(join(fixture.stylesRoot, "chromatic-themes", "Bad")));
}));

test("refuses collisions", () => withFixture((fixture) => {
  const result = run(themeScript, ["celestial", "--from", "cyberpunk", "--scheme", "light"], fixture);
  assert.notEqual(result.status, 0);
  assert.ok(existsSync(join(fixture.stylesRoot, "chromatic-themes", "celestial", "celestial.css")));
}));

test("rolls back every applied write after failure", () => withFixture((fixture) => {
  const before = readFileSync(join(fixture.stylesRoot, "app.css"), "utf8");
  const result = run(themeScript, ["rollback", "--from", "celestial", "--scheme", "light"], fixture, { ICARUS_STYLE_FAIL_AFTER: "3" });
  assert.notEqual(result.status, 0);
  assert.ok(!existsSync(join(fixture.stylesRoot, "chromatic-themes", "rollback", "rollback.css")));
  assert.equal(readFileSync(join(fixture.stylesRoot, "app.css"), "utf8"), before);
}));
