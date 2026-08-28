#!/usr/bin/env node
/**
 * A chromatic theme with every declared token present, and its registration.
 *
 *     pnpm new-theme -- <name> [--dark]
 *
 * The token list is read off the default theme rather than written here, so a
 * theme generated today declares exactly what the others declare and
 * `themes-agree-with-each-other` passes on the first run. A generated theme
 * missing one token would resolve to nothing under itself alone, which is the
 * failure that check exists to prevent.
 */
import { join } from "node:path";

import { Plan } from "../shared/plan.mjs";
import { declarationsIn } from "../../lint/shared/css.mjs";
import { bindsRoot, selectorParts } from "../../lint/shared/styles.mjs";
import { invocation, libRoot, packageRoot, requireKebab, usage } from "../shared/cli.mjs";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const LINE = "pnpm new-theme -- <name> [--dark]";
const { positional, flags } = invocation();
const [name, ...rest] = positional;
if (rest.length > 0) usage(LINE, "One theme at a time.");
requireKebab(name, "theme name", LINE);

const base = packageRoot(import.meta.url);
const styles = join(libRoot(import.meta.url), "styles");
const themesRoot = join(styles, "chromatic-themes");
const dark = flags.has("dark");

const plan = new Plan(base);

/** The theme every other theme has to match: the one that binds `:root`. */
const defaultTheme = () => {
  for (const entry of readdirSync(themesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const css = join(themesRoot, entry.name, `${entry.name}.css`);
    if (!existsSync(css)) continue;
    const text = readFileSync(css, "utf8");
    const declarations = declarationsIn(text, css);
    if (declarations.some(({ selectors }) => bindsRoot(selectorParts(selectors)))) {
      return { name: entry.name, declarations };
    }
  }
  return null;
};

const source = defaultTheme();
if (!source) plan.fail("chromatic-themes/", "no theme binds :root, so there is no interface to match");

if (source) {
  const tokens = [...new Set(source.declarations.map(({ name: token }) => token))].sort();
  const body = tokens.map((token) => `  ${token}: /* TODO */ inherit;`).join("\n");

  plan.create(
    join(themesRoot, name, `${name}.css`),
    `/**
 * ${name}: one complete chromatic interface.
 *
 * Every value here is a literal colour, and this is the only stage where one may
 * be written. What each token means is decided by \`semantic-tokens/\`, which
 * names these and never redeclares them.
 */
[data-theme="${name}"] {
  color-scheme: ${dark ? "dark" : "light"};

${body}
}
`
  );

  plan.create(
    join(themesRoot, name, `${name}.md`),
    `# ${name}

<!-- What this theme is for, and which end of the range it reads from. -->
`
  );

  // Alternates load after the default, so the default's `:root` binding stays
  // the one that applies when no attribute is set.
  plan.edit(join(styles, "app.css"), (text) => {
    const line = `@import "./chromatic-themes/${name}/${name}.css";\n`;
    if (text.includes(line)) return text;
    const slots = `@import "./chromatic-themes/slots.css";`;
    if (!text.includes(slots)) throw new Error("no slot import to insert the theme before");
    return text.replace(slots, `${line}${slots}`);
  });

  if (dark) {
    plan.edit(join(styles, "x-integrations", "tailwind", "tailwind.css"), (text) => {
      if (text.includes(`data-theme="${name}"`)) return text;
      // The selector list nests parentheses, so the line is matched whole and
      // the new theme is added before it closes.
      const variant = text.match(/^@custom-variant dark \((.*)\);$/m);
      if (!variant) throw new Error("no dark variant to register the theme in");
      const added = `&:where([data-theme="${name}"], [data-theme="${name}"] *)`;
      return text.replace(variant[0], `@custom-variant dark (${variant[1]}, ${added});`);
    });
  }
}

plan.run({ dryRun: flags.has("dry-run"), what: "new-theme" });
