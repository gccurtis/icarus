#!/usr/bin/env node
/**
 * A new model object, and its place in the graph that builds it.
 *
 *     pnpm new-model-object -- <client|server> <name> [--depends-on=a,b]
 *
 * Writes the document, types, definition, constructor and index, then adds the
 * field to the runtime's aggregate and the call to its builder — after
 * everything it is handed, because `objects-are-built-in-order` reads exactly
 * that. An object nobody builds is a directory; the edits to `runtime/` are
 * what make it part of the model.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

import { Plan } from "../shared/plan.mjs";
import { camel, invocation, libRoot, pascal, requireKebab, usage } from "../shared/cli.mjs";

const LINE = "pnpm new-model-object -- <client|server> <name> [--depends-on=a,b]";
const { positional, flags } = invocation();
const [environment, name, ...rest] = positional;
if (rest.length > 0) usage(LINE, "One object at a time.");
if (!["client", "server"].includes(environment)) usage(LINE, "The environment is client or server.");
requireKebab(name, "object name", LINE);

const dependsOn = [...flags]
  .filter((flag) => flag.startsWith("depends-on="))
  .flatMap((flag) => flag.slice("depends-on=".length).split(",").filter(Boolean));

const lib = libRoot(import.meta.url);
const base = join(lib, "..", "..");
const root = join(lib, "model", environment, name);

const isServer = environment === "server";
const index = isServer ? "index.server.ts" : "index.ts";
const definition = isServer ? "definition.ts" : "definition.svelte.ts";
const Model = `${pascal(name)}Model`;
const create = `create${pascal(name)}`;
const field = camel(name);

const runtime = {
  start: join(lib, "runtime", environment, isServer ? "start.server.ts" : "start.ts"),
  types: join(lib, "runtime", environment, "types.ts"),
  aggregate: isServer ? "ServerModel" : "ClientModel"
};

const plan = new Plan(base);

for (const dependency of dependsOn) {
  if (existsSync(join(lib, "model", environment, dependency))) continue;
  plan.fail(dependency, `is not an object in model/${environment}/, so nothing can be built after it`);
}

// -------------------------------------------------------------- the object ----

plan.create(
  join(root, `${name}.md`),
  `# ${name}

<!-- What this object owns, and for how long. -->
`
);

plan.create(
  join(root, "types.ts"),
  `/** What ${name} promises to keep stable. */
export interface ${Model} {
  readonly ready: boolean;
}
`
);

plan.create(
  join(root, definition),
  isServer
    ? `import type { ${Model} } from "$model/${environment}/${name}/types";

/** The state ${name} holds, and what reading it means. */
export const define${pascal(name)} = (): ${Model} => ({
  ready: true
});
`
    : `import type { ${Model} } from "$model/${environment}/${name}/types";

/** The state ${name} holds. Runes live here, which is why this file says so in its name. */
export const define${pascal(name)} = (): ${Model} => {
  let ready = $state(true);

  return {
    get ready() {
      return ready;
    }
  };
};
`
);

plan.create(
  join(root, "constructor.ts"),
  `import { define${pascal(name)} } from "$model/${environment}/${name}/${definition.replace(/\.ts$/, "")}";
import type { ${Model} } from "$model/${environment}/${name}/types";

/**
 * A fresh ${name}. Caches nothing — the runtime holds the one instance, and a
 * second caller here would be a second graph over the same state.
 */
export const ${create} = (${dependsOn.map((one) => `${camel(one)}: unknown`).join(", ")}): ${Model} =>
  define${pascal(name)}();
`
);

plan.create(
  join(root, index),
  `export { ${create} } from "$model/${environment}/${name}/constructor";
export type { ${Model} } from "$model/${environment}/${name}/types";
`
);

// ------------------------------------------------------------- the runtime ----

plan.edit(runtime.types, (text) => {
  if (text.includes(`readonly ${field}:`)) return text;
  const importLine = `import type { ${Model} } from "$model/${environment}/${name}/${index.replace(/\.ts$/, "")}";\n`;
  const withImport = text.includes(importLine) ? text : importLine + text;

  const marker = new RegExp(`(export interface ${runtime.aggregate} \\{\\n)`);
  if (!marker.test(withImport)) throw new Error(`no interface ${runtime.aggregate} to add a field to`);
  return withImport.replace(marker, `$1  readonly ${field}: ${Model};\n`);
});

plan.edit(runtime.start, (text) => {
  if (text.includes(`${create}(`)) return text;

  const importLine = `import { ${create} } from "$model/${environment}/${name}/${index.replace(/\.ts$/, "")}";\n`;
  let next = text.includes(importLine) ? text : text.replace(/^(import .*\n)(?![\s\S]*^import )/m, `$1${importLine}`);

  // After everything it is handed. With no dependencies it goes first, which is
  // still after nothing.
  const construction = `  const ${field} = ${create}(${dependsOn.map(camel).join(", ")});\n`;
  const anchor = dependsOn
    .map((one) => next.lastIndexOf(`const ${camel(one)} =`))
    .reduce((furthest, at) => Math.max(furthest, at), -1);

  if (anchor === -1) {
    const builder = next.match(/=> \{\n/);
    if (!builder) throw new Error("no builder body to add a construction to");
    const at = builder.index + builder[0].length;
    next = next.slice(0, at) + construction + next.slice(at);
  } else {
    const endOfLine = next.indexOf("\n", anchor) + 1;
    next = next.slice(0, endOfLine) + construction + next.slice(endOfLine);
  }

  const returned = next.match(/\n(\s*)return \{\n/);
  if (!returned) throw new Error("no returned graph to add a field to");
  const at = returned.index + returned[0].length;
  return next.slice(0, at) + `    ${field},\n` + next.slice(at);
});

plan.run({ dryRun: flags.has("dry-run"), what: "new-model-object" });
