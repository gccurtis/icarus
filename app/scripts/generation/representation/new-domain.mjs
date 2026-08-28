#!/usr/bin/env node
/**
 * A new domain under `data/types/`, with its import declaration.
 *
 *     pnpm new-domain -- <name> [--may-import=a,b] [--with-behavior]
 *
 * The matching `behavior/` directory only when asked: most domains never have
 * one, and a generated empty directory is a place for a runtime value to end up
 * without anybody deciding it should.
 */
import { join } from "node:path";

import { parse as parseYaml } from "yaml";

import { Plan } from "../shared/plan.mjs";
import { invocation, libRoot, packageRoot, pascal, requireKebab, usage } from "../shared/cli.mjs";

const LINE = "pnpm new-domain -- <name> [--may-import=a,b] [--with-behavior]";
const { positional, flags } = invocation();
const [name, ...rest] = positional;
if (rest.length > 0) usage(LINE, "One domain at a time.");
requireKebab(name, "domain name", LINE);

const mayImport = [...flags]
  .filter((flag) => flag.startsWith("may-import="))
  .flatMap((flag) => flag.slice("may-import=".length).split(",").filter(Boolean));

const base = packageRoot(import.meta.url);
const lib = libRoot(import.meta.url);
const declaration = join(base, "configuration", "representation.yaml");
const types = join(lib, "representation", "data", "types", name);

const plan = new Plan(base);

plan.create(
  join(types, `${name}.ts`),
  `/** ${name}: what the system knows about ${name}, declared and nothing else. */
export type ${pascal(name)} = {
  readonly id: string;
};
`
);

if (flags.has("with-behavior")) {
  plan.create(
    join(lib, "representation", "data", "behavior", name, `${name}.ts`),
    `import type { ${pascal(name)} } from "$representation/data/types/${name}/${name}";

/** Pure over ${name}. Same arguments, same answer, on either side of the boundary. */
export const is${pascal(name)} = (value: { id?: unknown }): value is ${pascal(name)} =>
  typeof value?.id === "string";
`
  );
}

/**
 * The declaration is a setting rather than a module: a module under `types/`
 * would have to compile to nothing, and one under `behavior/` would be a
 * function over nothing. Written by hand into the YAML because a round trip
 * through a parser would rewrite every comment in the file.
 */
plan.edit(declaration, (text) => {
  const document = parseYaml(text) ?? {};
  const declared = document.representation?.domains ?? {};
  if (name in declared) return text;

  for (const other of mayImport) {
    if (other in declared) continue;
    throw new Error(`${name} may not import ${other}, which is not a declared domain`);
  }

  const entry = `    ${name}: [${mayImport.join(", ")}]\n`;
  if (/^\s*domains:\s*$/m.test(text)) {
    return text.replace(/^(\s*domains:\s*\n)/m, `$1${entry}`);
  }
  return `${text.replace(/\n+$/, "\n")}\n  # Which domains each domain may reach. The graph is acyclic.\n  domains:\n${entry}`;
});

plan.run({ dryRun: flags.has("dry-run"), what: "new-domain" });
