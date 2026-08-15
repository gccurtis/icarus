import assert from "node:assert/strict";
import { rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { checkStyles } from "../rules.mjs";
import { buildFixture, replace } from "./build-fixtures.mjs";

const run = (mutate) => {
  const fixture = buildFixture();
  try {
    mutate?.(fixture);
    return checkStyles(fixture);
  } finally {
    rmSync(fixture.packageRoot, { recursive: true, force: true });
  }
};

const expectRule = (rule, mutate) => {
  const failures = run(mutate);
  assert.ok(failures.some((failure) => failure.rule === rule), `${rule} not found in ${JSON.stringify(failures, null, 2)}`);
};

test("valid fixture satisfies the complete contract", () => assert.deepEqual(run(), []));

test("STY001 structure", () => expectRule("STY001", ({ stylesRoot }) => {
  writeFileSync(join(stylesRoot, "misc.css"), ":root {}\n");
}));

test("STY001 rejects a duplicate root document", () => expectRule("STY001", ({ stylesRoot }) => {
  writeFileSync(join(stylesRoot, "styles.md"), "# Duplicate style-system document\n");
}));

test("STY002 documentation", () => expectRule("STY002", ({ stylesRoot }) => {
  unlinkSync(join(stylesRoot, "tokens", "tokens.md"));
}));

test("STY002 requires the style-system document", () => expectRule("STY002", ({ packageRoot }) => {
  unlinkSync(join(packageRoot, "docs", "styles-directory", "styles-directory.md"));
}));

test("STY003 public door", () => expectRule("STY003", ({ packageRoot }) => {
  writeFileSync(join(packageRoot, "src", "routes", "+layout.svelte"), "<main />\n");
}));

test("STY004 manifest reachability", () => expectRule("STY004", ({ stylesRoot }) => {
  replace(join(stylesRoot, "app.css"), '@import "./tokens/motion.css";\n', "");
}));

test("STY005 stage order", () => expectRule("STY005", ({ stylesRoot }) => {
  replace(
    join(stylesRoot, "app.css"),
    '@import "./semantic-sets/blue-primary.css";\n@import "./semantic-sets/cyan-primary.css";',
    '@import "./semantic-sets/cyan-primary.css";\n@import "./semantic-sets/blue-primary.css";'
  );
}));

test("STY006 declaration ownership", () => expectRule("STY006", ({ stylesRoot }) => {
  replace(join(stylesRoot, "tokens", "spacing.css"), "--token-spacing-unit", "--semantic-spacing-unit");
}));

test("STY007 dependency edge", () => expectRule("STY007", ({ stylesRoot }) => {
  replace(join(stylesRoot, "tokens", "color.css"), "var(--chromatic-green-surface)", "var(--palette-green-faded)");
}));

test("STY008 literal ownership", () => expectRule("STY008", ({ stylesRoot }) => {
  replace(join(stylesRoot, "tokens", "color.css"), "var(--chromatic-green-surface)", "#fff");
}));

test("STY009 theme interface", () => expectRule("STY009", ({ stylesRoot }) => {
  replace(join(stylesRoot, "chromatic-themes", "cyberpunk", "cyberpunk.css"), "  --palette-red-faded: #ffecef;\n", "");
}));

test("STY010 theme integration", () => expectRule("STY010", ({ stylesRoot }) => {
  replace(join(stylesRoot, "x-integrations", "tailwind", "tailwind.css"), "cyberpunk", "celestial");
}));

test("STY011 semantic interface", () => expectRule("STY011", ({ stylesRoot }) => {
  replace(join(stylesRoot, "semantic-sets", "cyan-primary.css"), "  --semantic-primary-surface: var(--chromatic-cyan-surface);\n", "");
}));

test("STY012 semantic meaning", () => expectRule("STY012", ({ stylesRoot }) => {
  // Collapse tertiary onto the primary's own hue, so two identity anchors
  // resolve to the same chromatic family.
  const path = join(stylesRoot, "semantic-sets", "blue-primary.css");
  replace(path, /--chromatic-blue-tertiary-/g, "--chromatic-blue-");
}));

test("STY013 integration boundary", () => expectRule("STY013", ({ stylesRoot }) => {
  replace(join(stylesRoot, "x-integrations", "shadcn", "bridge.css"), "var(--token-color-danger-fill)", "var(--chromatic-red-fill)");
}));

test("STY014 quarantine", () => expectRule("STY014", ({ packageRoot }) => {
  writeFileSync(join(packageRoot, "components.json"), JSON.stringify({ tailwind: { css: "src/lib/styles/app.css" } }));
}));

test("STY015 consumer surface", () => expectRule("STY015", ({ packageRoot }) => {
  writeFileSync(join(packageRoot, "src", "bad.svelte"), '<div style="color: var(--semantic-primary-text)"></div>\n');
}));
