import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { root } from '../lib/context.mjs';

const { parse } = createRequire(join(root, 'app/package.json'))('yaml');

test('root onboarding routes resolve to real files', () => {
  const instructions = readFileSync(join(root, 'AGENTS.md'), 'utf8');
  for (const match of instructions.matchAll(/\]\(([^)]+)\)/gu)) {
    assert.equal(existsSync(resolve(root, match[1])), true, `Broken onboarding route: ${match[1]}`);
  }
});

for (const directory of readdirSync(join(root, '.agents/skills'))) {
  test(`${directory} is a discoverable, complete skill with resolvable local links`, () => {
    const home = join(root, '.agents/skills', directory);
    const contents = readFileSync(join(home, 'SKILL.md'), 'utf8');
    const frontmatter = contents.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/u);
    assert.ok(frontmatter, 'SKILL.md needs YAML frontmatter');
    const metadata = parse(frontmatter[1]);
    assert.equal(metadata.name, directory);
    assert.match(metadata.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
    assert.ok(metadata.name.length < 64);
    assert.equal(typeof metadata.description, 'string');
    assert.ok(metadata.description.trim().length > 0);
    assert.doesNotMatch(contents, /\[TODO|\{\{[A-Z]+\}\}/u);
    for (const match of contents.matchAll(/\]\(([^)]+)\)/gu)) {
      assert.equal(existsSync(resolve(home, match[1])), true, `Broken skill route: ${match[1]}`);
    }
  });
}
