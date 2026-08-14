#!/usr/bin/env node
/**
 * Runs the capability standard against `src/lib/capabilities`. No dependencies.
 *
 * The rules live in rules.mjs so they can be tested against deliberately-broken
 * fixture trees; this file is the entry point that points them at the real one
 * and formats what they find.
 *
 * **Scope is the whole design of this script: it walks `lib/capabilities` and
 * nothing else.** Everything outside is another domain's business —
 * `simple-components/` is vendored verbatim and uses relative imports
 * throughout, `style/` is CSS, and `routes/` answers to SvelteKit's conventions
 * rather than ours. Widening the walk would bury a real capability defect under
 * hundreds of findings about code this standard does not govern.
 *
 * Aliases come from svelte.config.js because that is the single map — SvelteKit
 * generates the TypeScript paths from it, so the compiler and the bundler
 * cannot disagree. The backend needed a rule checking two maps against each
 * other; there is no second map here to check.
 */
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import {
  checkCapabilities,
  checkNames,
  checkPaths,
  checkTestPlacement,
  discover
} from "./rules.mjs";

const packageRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const capabilitiesRoot = join(packageRoot, "src", "lib", "capabilities");

const config = await import(pathToFileURL(join(packageRoot, "svelte.config.js")).href);

/**
 * `$lib` is built in and so is absent from `kit.alias`, but it still has to
 * resolve on disk — it is the alias most imports actually use. `kit.files.lib`
 * can move it; the default is `src/lib`.
 */
const declared = config.default?.kit?.alias ?? {};
const aliases = { $lib: config.default?.kit?.files?.lib ?? "src/lib", ...declared };

const scope = { root: capabilitiesRoot, base: packageRoot };
const failures = [
  ...checkCapabilities(scope),
  ...checkPaths({ ...scope, aliases }),
  ...checkNames(scope),
  ...checkTestPlacement(scope)
];

if (failures.length > 0) {
  console.error(`capability lint: ${failures.length} problem${failures.length === 1 ? "" : "s"}\n`);
  for (const { path, message } of failures) console.error(`  ${path}  ${message}`);
  console.error("\nSee apps/frontend/docs/capability-directory/capability-directory.md.");
  process.exit(1);
}

const found = discover(capabilitiesRoot).length;
console.log(
  `capability lint: ${found} capabilit${found === 1 ? "y" : "ies"} on the template; paths, names, and test placement clean`
);
