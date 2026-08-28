#!/usr/bin/env node
/**
 * A method on an object, or a step under one.
 *
 *     pnpm new-method -- <client|server> <object> <method>
 *     pnpm new-method -- <client|server> <object> <method>/<step>
 *
 * A method is a file until it has supporting steps. Naming a step promotes the
 * method: the file becomes a directory holding an entry of the same name, which
 * is what `method-entry-matches-directory` reads, and the step lands beside it.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { Plan } from "../shared/plan.mjs";
import { camel, invocation, libRoot, requireKebab, usage } from "../shared/cli.mjs";

const LINE = "pnpm new-method -- <client|server> <object> <method>[/<step>]";
const { positional, flags } = invocation();
const [environment, object, spec, ...rest] = positional;
if (rest.length > 0) usage(LINE, "One method at a time.");
if (!["client", "server"].includes(environment)) usage(LINE, "The environment is client or server.");
requireKebab(object, "object name", LINE);
if (!spec) usage(LINE);

const parts = spec.split("/");
for (const part of parts) requireKebab(part, "method name", LINE);

const lib = libRoot(import.meta.url);
const base = join(lib, "..", "..");
const root = join(lib, "model", environment, object);
const methods = join(root, "methods");

const plan = new Plan(base);
if (!existsSync(root)) plan.fail(object, `is not an object in model/${environment}/`);

const body = (name, where) => `import type { ${pascalOf(object)}Model } from "$model/${environment}/${object}/types";

/** ${name}. */
export const ${camel(name)} = (model: ${pascalOf(object)}Model): void => {
  void model;
  throw new Error("${where} is not implemented");
};
`;

function pascalOf(value) {
  return value.replace(/(^|-)([a-z0-9])/g, (_, __, character) => character.toUpperCase());
}

/**
 * Where each part sits. Every part but the last is a directory holding an entry
 * named for it; the last is a file beside its parent's entry.
 */
const places = () => {
  const found = [];
  let at = methods;
  for (const [index, part] of parts.entries()) {
    if (index === parts.length - 1) {
      found.push({ part, path: join(at, `${part}.ts`), promotes: null });
      break;
    }
    const flat = join(at, `${part}.ts`);
    at = join(at, part);
    found.push({ part, path: join(at, `${part}.ts`), promotes: existsSync(flat) ? flat : null });
  }
  return found;
};

/** Every markdown file under the object, so a promotion can follow its name. */
const documents = (dir, found = []) => {
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir)) {
    const at = join(dir, entry);
    if (statSync(at).isDirectory()) documents(at, found);
    else if (entry.endsWith(".md")) found.push(at);
  }
  return found;
};

for (const { part, path, promotes } of places()) {
  if (existsSync(path)) continue;
  if (promotes) {
    // The method had no steps and now has one: its file becomes the entry of a
    // directory named for it, with the same contents — and every document that
    // drew the old path is rewritten, because `method-tree-paths-resolve` reads
    // exactly those.
    plan.create(path, readFileSync(promotes, "utf8"));
    plan.remove(promotes);

    // Paths only. A link target and a mention that already carries a directory
    // are paths, and `method-tree-paths-resolve` reads exactly those. The prose
    // around them still says "file" where it now means a directory, so every
    // document touched is named for the author to read.
    const target = new RegExp(`\\]\\(${part}\\.ts\\)`, "g");
    const withinPath = new RegExp(`((?:[\\w-]+/)+)${part}\\.ts(?![\\w-])`, "g");

    for (const document of documents(root)) {
      const before = readFileSync(document, "utf8");
      // Paths with a directory first: rewriting the bare link target first would
      // give the second pass something new to match.
      const after = before
        .replace(withinPath, `$1${part}/${part}.ts`)
        .replace(target, `](${part}/${part}.ts)`);
      if (after === before) continue;
      plan.edit(document, () => after);
      plan.note(`${plan.at(document)} still describes ${part} as a file; it is a directory now`);
    }
    continue;
  }
  plan.create(path, body(part, `${object}/${parts.join("/")}`));
}

plan.run({ dryRun: flags.has("dry-run"), what: "new-method" });
