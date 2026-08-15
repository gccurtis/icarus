#!/usr/bin/env node
/**
 * Runs the model standard against `src/lib/model`.
 *
 * The rules live in rules.mjs so they can be tested against deliberately-broken
 * fixture trees; this file resolves the package's paths, points every rule at the
 * real tree, formats what they find, and sets the exit code. It decides nothing.
 *
 * **Two roots, and the second is deliberate.** The model tree is what is governed,
 * but half of the standard is about the boundary around it: which routes may reach
 * the client model, which modules may reach the server tree, and who may call a
 * constructor. Those questions are answered at the import site, which is usually
 * outside `model/`. So the rules are given `src/` as well, and only a specifier
 * naming a model path can produce a finding — foreign code under `src/` is walked
 * but never judged by the model template.
 *
 * Aliases come from svelte.config.js because that is the single map: SvelteKit
 * generates the TypeScript paths from it, so the compiler and the bundler cannot
 * disagree. `$model` is defaulted for the window in which the tree is being
 * introduced — the alias arrives with the code that needs it, and until then the
 * rules still resolve what they are asked about.
 */
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

import { RULES, discoverObjects } from "./rules.mjs";

const packageRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const source = join(packageRoot, "src");
const model = join(source, "lib", "model");

const config = await import(pathToFileURL(join(packageRoot, "svelte.config.js")).href);
const declared = config.default?.kit?.alias ?? {};
const aliases = {
  $lib: config.default?.kit?.files?.lib ?? "src/lib",
  $model: "src/lib/model",
  ...declared
};

const scope = { model, source, base: packageRoot, aliases };
const failures = RULES.flatMap((rule) => rule(scope));

if (failures.length > 0) {
  console.error(`model lint: ${failures.length} problem${failures.length === 1 ? "" : "s"}\n`);
  for (const { path, message } of failures) console.error(`  ${path}  ${message}`);
  console.error("\nSee docs/model-directory/model-directory.md.");
  process.exit(1);
}

// The tree is still being moved out of `runtime/`, so an absent root is a state
// this script has to survive rather than a reason to fail. Zero objects is the
// honest report, not a green one.
const found = discoverObjects(scope).length;
console.log(
  `model lint: ${found} object${found === 1 ? "" : "s"} on the template; ` +
    `layout, graph, lifetime, environment, doors, methods, tests, and view-keys clean`
);
