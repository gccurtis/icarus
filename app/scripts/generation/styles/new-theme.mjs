#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cssFacts } from "../../lint/styles/rules.mjs";
import {
  commandArgs,
  darkVariant,
  die,
  parseArgs,
  registerImport,
  report,
  stylesRoot,
  transaction,
  updateInventory,
  validateName
} from "./shared.mjs";

const { positional, options } = parseArgs(commandArgs());
const name = positional[0];
const from = options.get("from");
const scheme = options.get("scheme");
validateName(name, "theme");
validateName(from, "source theme");
if (!["light", "dark"].includes(scheme)) die("--scheme must be light or dark");

const sourcePath = join(stylesRoot, "chromatic-themes", from, `${from}.css`);
if (!existsSync(sourcePath)) die(`source theme '${from}' does not exist`);
let css = readFileSync(sourcePath, "utf8");
const properties = cssFacts(sourcePath).declarations.filter(({ property }) => property.startsWith("--")).map(({ property }) => property);
if (properties.length === 0 || new Set(properties).size !== properties.length) die("source theme does not expose a valid declaration interface");

css = css
  .replace(/^:root,\s*\n\s*/m, "")
  .replace(new RegExp(`\\[data-theme=["']${from}["']\\]`), `[data-theme="${name}"]`)
  .replace(/color-scheme:\s*(?:light|dark)/, `color-scheme: ${scheme}`)
  .replace(new RegExp(from, "gi"), (match) => match[0] === match[0].toUpperCase() ? name.toUpperCase() : name);

const targetDir = join(stylesRoot, "chromatic-themes", name);
const targetCss = join(targetDir, `${name}.css`);
const targetDoc = join(targetDir, `${name}.md`);
const title = name.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
const document = `# ${title}\n\n**Status:** Draft copied from \`${from}\`.\n\n## Theory\n\nDescribe the physical material, polarity, contrast intent, and relationship among the palette families.\n\n## Verification\n\n- [ ] Every palette value has been intentionally reviewed.\n- [ ] Documented foreground/background pairs meet their contrast contract.\n- [ ] Every semantic role has been rendered against this theme.\n- [ ] Focus, selection, shadows, and filled controls have been reviewed.\n`;

const app = join(stylesRoot, "app.css");
const inventory = join(stylesRoot, "chromatic-themes", "chromatic-themes.md");
const dark = [];
for (const entry of readFileSync(inventory, "utf8").matchAll(/^\| `([^`]+)` \| (light|dark) \|/gm)) if (entry[2] === "dark") dark.push(entry[1]);
if (scheme === "dark") dark.push(name);

const tx = transaction();
tx.create(targetCss, css);
tx.create(targetDoc, document);
tx.edit(app, registerImport({ specifier: `./chromatic-themes/${name}/${name}.css` }));
tx.edit(inventory, updateInventory({
  path: inventory,
  start: "<!-- generated:theme-inventory:start -->",
  end: "<!-- generated:theme-inventory:end -->",
  header: "| Theme | Scheme | Default |\n| --- | --- | --- |",
  row: `| \`${name}\` | ${scheme} | no |`,
  key: name
}));
const variant = darkVariant([...new Set(dark)].sort());
tx.edit(variant.path, variant.contents);

try {
  report("created theme", tx.commit());
} catch (error) {
  die(error.message);
}
