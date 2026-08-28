#!/usr/bin/env node
/**
 * A semantic token, declared in its domain.
 *
 *     pnpm new-token -- <domain> <name> <value>
 *
 * `<domain>` is one of the token files — color, typography, spacing, shape,
 * motion — and `<value>` is what the token names, which is a value from the
 * stage behind it and never a literal colour.
 *
 * One edit rather than several: a semantic token is declared once and resolves
 * through whichever theme is bound, so unlike a chromatic value there is no
 * per-theme copy to keep in step.
 */
import { join } from "node:path";

import { Plan } from "../shared/plan.mjs";
import { TOKEN_FILES } from "../../lint/shared/styles.mjs";
import { invocation, libRoot, packageRoot, usage } from "../shared/cli.mjs";

const LINE = "pnpm new-token -- <domain> <name> <value>";
const { positional, flags } = invocation();
const [domain, name, ...value] = positional;
const DOMAINS = TOKEN_FILES.map((file) => file.replace(/\.css$/, ""));

if (!DOMAINS.includes(domain)) usage(LINE, `The domain is one of ${DOMAINS.join(", ")}.`);
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name ?? "")) usage(LINE, "The token name is kebab-case, without its --token- prefix.");
if (value.length === 0) usage(LINE, "A token names a value from the stage behind it.");

const token = `--token-${name}`;
const declared = value.join(" ");

const base = packageRoot(import.meta.url);
const file = join(libRoot(import.meta.url), "styles", "semantic-tokens", `${domain}.css`);

const plan = new Plan(base);
if (/#[0-9a-fA-F]{3,8}\b|\b(?:rgb|hsl|oklch|oklab|lab|lch|hwb)\(/.test(declared)) {
  plan.fail(token, "a literal colour belongs to a theme; a token names one");
}

plan.edit(file, (text) => {
  if (new RegExp(`^\\s*${token}\\s*:`, "m").test(text)) return text;
  const block = text.match(/(:root \{\n)([\s\S]*?)(\n\})/);
  if (!block) throw new Error(`no :root block in ${domain}.css to declare the token in`);
  return text.replace(block[0], `${block[1]}${block[2]}\n  ${token}: ${declared};${block[3]}`);
});

plan.run({ dryRun: flags.has("dry-run"), what: "new-token" });
