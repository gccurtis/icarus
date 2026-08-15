#!/usr/bin/env node
/**
 * Runs the view standard against `src/lib/views`.
 *
 * The rules live in rules.mjs so they can be tested against deliberately-broken
 * fixture trees; this file resolves the package's paths, points every rule at
 * the real tree, formats what they find, and sets the exit code. It decides
 * nothing.
 *
 * Aliases come from svelte.config.js because that is the single map: SvelteKit
 * generates the TypeScript paths from it, so the compiler and the bundler cannot
 * disagree. `$views` is defaulted for the window in which the tree is being
 * introduced — the alias arrives with the first view, and until then the rules
 * still resolve what they are asked about.
 */
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

import { RULES, discoverViews } from "./rules.mjs";

const packageRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const source = join(packageRoot, "src");
const views = join(source, "lib", "views");

const config = await import(pathToFileURL(join(packageRoot, "svelte.config.js")).href);
const declared = config.default?.kit?.alias ?? {};
const aliases = {
  $lib: config.default?.kit?.files?.lib ?? "src/lib",
  $views: "src/lib/views",
  ...declared
};

const scope = { views, source, base: packageRoot, aliases };

// Sorted by path, then by the rule name inside the message, so two runs over the
// same tree print the same list and a diff of two runs shows only what changed.
const failures = RULES.flatMap((rule) => rule(scope)).sort(
  (a, b) => a.path.localeCompare(b.path) || a.message.localeCompare(b.message)
);

if (failures.length > 0) {
  console.error(`view lint: ${failures.length} problem${failures.length === 1 ? "" : "s"}\n`);
  for (const { path, message } of failures) console.error(`  ${path}  ${message}`);
  console.error("\nSee docs/view-directory/view-directory.md.");
  process.exit(1);
}

// The tree is not populated yet, so an absent root is a state this script has to
// survive rather than a reason to fail. Zero views is the honest report, not a
// green one.
const found = discoverViews(scope).length;
console.log(
  `view lint: ${found} view${found === 1 ? "" : "s"} on the template; shape, concerns, documents, imports, and tests clean`
);
