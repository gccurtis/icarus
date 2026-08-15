#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cssFacts } from "../../lint/styles/rules.mjs";
import {
  die,
  parseArgs,
  registerImport,
  report,
  stylesRoot,
  transaction,
  updateInventory,
  validateName
} from "./shared.mjs";

const { positional, options } = parseArgs(process.argv.slice(2));
const name = positional[0];
validateName(name, "semantic set");
const anchors = ["primary", "secondary", "tertiary", "accent-1", "accent-2"];
const assignment = Object.fromEntries(anchors.map((anchor) => [anchor, options.get(anchor)]));
if (Object.values(assignment).some((value) => !value)) die(`all assignments are required: ${anchors.map((anchor) => `--${anchor}`).join(", ")}`);

const slots = join(stylesRoot, "chromatic-themes", "slots.css");
const discovered = cssFacts(slots).declarations.map(({ property }) => property.match(/^--chromatic-([a-z0-9-]+?)-(surface-hover|fill-hover|on-fill|surface|border|fill|text)$/)).filter(Boolean);
const hues = new Set(discovered.map((match) => match[1]));
const jobs = [...new Set(discovered.map((match) => match[2]))];
for (const [anchor, hue] of Object.entries(assignment)) if (!hues.has(hue)) die(`unknown hue '${hue}' for --${anchor}`);
if (new Set([assignment.primary, assignment.secondary, assignment.tertiary]).size !== 3) die("primary, secondary, and tertiary must be distinct");
for (const anchor of ["accent-1", "accent-2"]) if (["green", "red", "amber", "grey"].includes(assignment[anchor])) die(`${anchor} cannot use a fixed-meaning hue`);

const blocks = anchors.map((anchor) => {
  const lines = jobs.map((job) => `  --semantic-${anchor}-${job}: var(--chromatic-${assignment[anchor]}-${job});`);
  return `  /* ${assignment[anchor]} */\n${lines.join("\n")}`;
});
const contents = `/** ${name}: semantic identity assignment. Contract: semantic-sets.md. */\n\n[data-set="${name}"] {\n${blocks.join("\n\n")}\n}\n`;
const target = join(stylesRoot, "semantic-sets", `${name}.css`);
const app = join(stylesRoot, "app.css");
const inventory = join(stylesRoot, "semantic-sets", "semantic-sets.md");
const tx = transaction();
tx.create(target, contents);
tx.edit(app, registerImport({ stage: "set", specifier: `./semantic-sets/${name}.css` }));
tx.edit(inventory, updateInventory({
  path: inventory,
  start: "<!-- generated:semantic-set-inventory:start -->",
  end: "<!-- generated:semantic-set-inventory:end -->",
  header: "| Set | Primary | Secondary | Tertiary | Accent 1 | Accent 2 | Default |\n| --- | --- | --- | --- | --- | --- | --- |",
  row: `| \`${name}\` | ${assignment.primary} | ${assignment.secondary} | ${assignment.tertiary} | ${assignment["accent-1"]} | ${assignment["accent-2"]} | no |`,
  key: name
}));

try {
  report("created semantic set", tx.commit());
} catch (error) {
  die(error.message);
}
