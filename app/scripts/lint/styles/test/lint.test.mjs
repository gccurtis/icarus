import assert from "node:assert/strict";
import { mkdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
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

test("restrict-stage-entries structure", () => expectRule("restrict-stage-entries", ({ stylesRoot }) => {
  writeFileSync(join(stylesRoot, "misc.css"), ":root {}\n");
}));

test("restrict-stage-entries rejects a duplicate root document", () => expectRule("restrict-stage-entries", ({ stylesRoot }) => {
  writeFileSync(join(stylesRoot, "styles.md"), "# Duplicate style-system document\n");
}));

test("require-stage-document documentation", () => expectRule("require-stage-document", ({ stylesRoot }) => {
  unlinkSync(join(stylesRoot, "semantic-tokens", "semantic-tokens.md"));
}));

test("require-stage-document requires the style-system document", () => expectRule("require-stage-document", ({ packageRoot }) => {
  unlinkSync(join(packageRoot, "docs", "styles-directory", "styles-directory.md"));
}));

test("confine-style-door public door", () => expectRule("confine-style-door", ({ packageRoot }) => {
  writeFileSync(join(packageRoot, "src", "routes", "+layout.svelte"), "<main />\n");
}));

test("require-manifest-import manifest reachability", () => expectRule("require-manifest-import", ({ stylesRoot }) => {
  replace(join(stylesRoot, "app.css"), '@import "./semantic-tokens/motion.css";\n', "");
}));

test("order-stage-imports stage order", () => expectRule("order-stage-imports", ({ stylesRoot }) => {
  // The default theme binds :root and must precede its alternates.
  replace(
    join(stylesRoot, "app.css"),
    '@import "./chromatic-themes/celestial/celestial.css";\n@import "./chromatic-themes/cyberpunk/cyberpunk.css";',
    '@import "./chromatic-themes/cyberpunk/cyberpunk.css";\n@import "./chromatic-themes/celestial/celestial.css";'
  );
}));

test("match-declaration-namespace declaration ownership", () => expectRule("match-declaration-namespace", ({ stylesRoot }) => {
  replace(join(stylesRoot, "semantic-tokens", "spacing.css"), "--token-spacing-unit", "--chromatic-spacing-unit");
}));

test("restrict-stage-references dependency edge", () => expectRule("restrict-stage-references", ({ stylesRoot }) => {
  replace(join(stylesRoot, "semantic-tokens", "color.css"), "var(--chromatic-green-surface)", "var(--palette-green-faded)");
}));

test("confine-literal-colors literal ownership", () => expectRule("confine-literal-colors", ({ stylesRoot }) => {
  replace(join(stylesRoot, "semantic-tokens", "color.css"), "var(--chromatic-green-surface)", "#fff");
}));

test("match-theme-interface theme interface", () => expectRule("match-theme-interface", ({ stylesRoot }) => {
  replace(join(stylesRoot, "chromatic-themes", "cyberpunk", "cyberpunk.css"), "  --palette-red-faded: #ffecef;\n", "");
}));

test("match-theme-registration theme integration", () => expectRule("match-theme-registration", ({ stylesRoot }) => {
  replace(join(stylesRoot, "x-integrations", "tailwind", "tailwind.css"), "cyberpunk", "celestial");
}));

test("require-role-slots role interface", () => expectRule("require-role-slots", ({ stylesRoot }) => {
  // A role must declare its complete seven-slot family.
  replace(
    join(stylesRoot, "semantic-tokens", "color.css"),
    "  --token-color-success-on-fill: var(--chromatic-green-on-fill);\n",
    ""
  );
}));

test("require-role-slots rejects an indirect role value", () => expectRule("require-role-slots", ({ stylesRoot }) => {
  replace(
    join(stylesRoot, "semantic-tokens", "color.css"),
    "--token-color-success-text: var(--chromatic-green-text);",
    "--token-color-success-text: var(--chromatic-green-fill);"
  );
}));

test("pin-meaning-hues role semantics", () => expectRule("pin-meaning-hues", ({ stylesRoot }) => {
  // accent-1 owns pink alone, so repointing it lands the whole family on a
  // fixed-meaning hue.
  replace(join(stylesRoot, "semantic-tokens", "color.css"), /--chromatic-pink-/g, "--chromatic-green-");
}));

test("pin-meaning-hues pins a meaning role to its hue", () => expectRule("pin-meaning-hues", ({ stylesRoot }) => {
  replace(join(stylesRoot, "semantic-tokens", "color.css"), /--chromatic-green-/g, "--chromatic-teal-");
}));

test("confine-integration-boundary integration boundary", () => expectRule("confine-integration-boundary", ({ stylesRoot }) => {
  replace(join(stylesRoot, "x-integrations", "shadcn", "bridge.css"), "var(--token-color-danger-fill)", "var(--chromatic-red-fill)");
}));

test("quarantine-generated-css quarantine", () => expectRule("quarantine-generated-css", ({ packageRoot }) => {
  writeFileSync(join(packageRoot, "components.json"), JSON.stringify({ tailwind: { css: "src/lib/styles/app.css" } }));
}));

test("restrict-consumer-surface consumer surface", () => expectRule("restrict-consumer-surface", ({ packageRoot }) => {
  writeFileSync(join(packageRoot, "src", "bad.svelte"), '<div style="color: var(--chromatic-blue-text)"></div>\n');
}));

test("restrict-registry-surface registry surface", () => expectRule("restrict-registry-surface", ({ packageRoot }) => {
  const registry = join(packageRoot, "src", "lib", "components", "vendor", "toggle");
  mkdirSync(registry, { recursive: true });
  writeFileSync(join(registry, "toggle.svelte"), '<div class="bg-active-surface"></div>\n');
}));

test("restrict-registry-surface permits shadcn bridge names", () => {
  const failures = run(({ packageRoot }) => {
    const registry = join(packageRoot, "src", "lib", "components", "vendor", "button");
    mkdirSync(registry, { recursive: true });
    writeFileSync(
      join(registry, "button.svelte"),
      '<div class="bg-primary text-primary-foreground bg-secondary-hover bg-accent ring-ring border-input"></div>\n'
    );
  });
  assert.deepEqual(failures.filter((failure) => failure.rule === "restrict-registry-surface"), []);
});
