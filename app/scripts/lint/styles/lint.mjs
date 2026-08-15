#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync } from "node:fs";
import { checkStyles } from "./rules.mjs";

const packageRoot = process.env.ICARUS_PACKAGE_ROOT ?? dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const stylesRoot = join(packageRoot, "src", "lib", "styles");
const failures = checkStyles({ packageRoot, stylesRoot });

if (failures.length > 0) {
  console.error(`style lint: ${failures.length} problem${failures.length === 1 ? "" : "s"}\n`);
  for (const failure of failures) console.error(`  ${failure.path}:${failure.line}  ${failure.rule}  ${failure.message}`);
  console.error("\nSee docs/styles-directory/styles-directory.md.");
  process.exit(1);
}

const countDirs = (path) => readdirSync(path, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length;
const countCss = (path) => readdirSync(path, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".css")).length;
console.log(`style lint: ${countDirs(join(stylesRoot, "chromatic-themes"))} themes, ${countCss(join(stylesRoot, "semantic-sets"))} semantic sets, ${countCss(join(stylesRoot, "tokens"))} token domains, ${countDirs(join(stylesRoot, "x-integrations"))} integrations; graph and consumer surface clean`);
