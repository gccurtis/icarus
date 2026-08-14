import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { cssFacts } from "../rules.mjs";

const packageRoot = dirname(dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url))))));
const stylesRoot = join(packageRoot, "src", "lib", "styles");

const declarations = (path) => new Map(cssFacts(path).declarations
  .filter(({ property }) => property.startsWith("--"))
  .map(({ property, value }) => [property, value]));

const resolveColor = (name, values, seen = new Set()) => {
  assert.ok(!seen.has(name), `cycle while resolving ${name}`);
  seen.add(name);
  const value = values.get(name);
  assert.ok(value, `missing ${name}`);
  const reference = value.match(/^var\((--[a-z0-9-]+)\)$/);
  if (reference) return resolveColor(reference[1], values, seen);
  assert.match(value, /^#[0-9a-f]{6}$/i, `${name} does not resolve to a hex color`);
  return value;
};

const luminance = (hex) => {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const contrast = (left, right) => {
  const values = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

test("every theme preserves border, text, and on-fill contrast contracts", () => {
  const themesRoot = join(stylesRoot, "chromatic-themes");
  const hues = [...new Set(cssFacts(join(themesRoot, "slots.css")).declarations
    .map(({ property }) => property.match(/^--chromatic-([a-z]+)-/)?.[1])
    .filter(Boolean))];
  for (const name of readdirSync(themesRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)) {
    const facts = cssFacts(join(themesRoot, name, `${name}.css`));
    const values = new Map(facts.declarations.filter(({ property }) => property.startsWith("--")).map(({ property, value }) => [property, value]));
    const scheme = facts.declarations.find(({ property }) => property === "color-scheme")?.value;
    const work = resolveColor("--theme-surface-work", values);
    const onFill = resolveColor("--theme-ink-on-fill", values);
    for (const hue of hues) {
      const border = resolveColor(`--palette-${hue}-normal`, values);
      const text = resolveColor(`--palette-${hue}-${scheme === "dark" ? "light" : "strong"}`, values);
      const fill = resolveColor(`--palette-${hue}-${scheme === "dark" ? "muted" : "emphasized"}`, values);
      assert.ok(contrast(border, work) >= 2.95, `${name}/${hue} border contrast fell below 3:1`);
      assert.ok(contrast(text, work) >= 6.95, `${name}/${hue} text contrast fell below 7:1`);
      assert.ok(contrast(fill, onFill) >= 4.45, `${name}/${hue} on-fill contrast fell below 4.5:1`);
    }
  }
});

test("Tailwind exposes every canonical token without defining design meaning", () => {
  const tokensRoot = join(stylesRoot, "tokens");
  const canonical = new Set(readdirSync(tokensRoot).filter((name) => name.endsWith(".css"))
    .flatMap((name) => [...declarations(join(tokensRoot, name)).keys()]));
  const adapter = cssFacts(join(stylesRoot, "x-integrations", "tailwind", "tailwind.css"));
  const referenced = new Set(adapter.declarations.flatMap(({ references }) => references));
  assert.deepEqual([...referenced].sort(), [...canonical].sort());
  assert.ok(adapter.declarations.every(({ value }) => /^var\(--token-[a-z0-9-]+\)$/.test(value)));
});
