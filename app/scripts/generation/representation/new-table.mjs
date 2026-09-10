#!/usr/bin/env node
/**
 * A table: its own row-field module, its name in `TABLE_NAMES`, and its entry
 * in `TableFields`.
 *
 *     pnpm new-table -- <camelCaseName>
 *
 * The module plus three registry edits must agree, which is what a generator is
 * for. Missing any one either fails to compile or, worse, leaves a table that
 * nothing can open by name.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Plan } from "../shared/plan.mjs";
import { invocation, libRoot, packageRoot, usage } from "../shared/cli.mjs";

const LINE = "pnpm new-table -- <camelCaseName>";
const { positional, flags } = invocation();
const [name, ...rest] = positional;
if (rest.length > 0) usage(LINE, "One table at a time.");
if (!name) usage(LINE);
if (!/^[a-z][A-Za-z0-9]*$/.test(name)) usage(LINE, `'${name}' is not a camelCase table name.`);

const Fields = `${name[0].toUpperCase()}${name.slice(1).replace(/s$/, "")}Fields`;
const moduleName = name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

const base = packageRoot(import.meta.url);
const store = join(libRoot(import.meta.url), "representation", "store");
const index = join(store, "tables.ts");
const names = join(store, "tables", "names.ts");
const registry = join(store, "tables", "registry.ts");
const module = join(store, "tables", `${moduleName}.ts`);
const plan = new Plan(base);

/** Kept in the sorted order the list is already in, so a diff shows one line. */
const insertSorted = (lines, entry, keyOf) => {
  const at = lines.findIndex((line) => keyOf(line) > keyOf(entry));
  return at === -1 ? [...lines, entry] : [...lines.slice(0, at), entry, ...lines.slice(at)];
};

const alreadyListed = new RegExp(`^\\s*"${name}",?$`, "m").test(readFileSync(names, "utf8"));

if (!alreadyListed) {
  plan.create(
    module,
    `import type { Id, Row } from "$representation/data/types/core/id";\n\n` +
      `/** What a ${name} row holds. */\n` +
      `export type ${Fields} = {\n  readonly projectId: Id<"projects">;\n};\n\n` +
      `export type ${name[0].toUpperCase()}${name.slice(1).replace(/s$/, "")} = ` +
      `Row<"${name}"> & ${Fields};\n`
  );

  plan.edit(names, (text) => {
    const listed = text.match(/(export const TABLE_NAMES = \[\n)([\s\S]*?)(\n\] as const;)/);
    if (!listed) throw new Error("no TABLE_NAMES list to add to");
    const entries = insertSorted(
      listed[2].split("\n"),
      `  "${name}",`,
      (line) => line.trim().replace(/[",]/g, "")
    );
    return text.replace(listed[0], `${listed[1]}${entries.join("\n")}${listed[3]}`);
  });

  plan.edit(registry, (text) => {
    const importLine = `import type { ${Fields} } from "$representation/store/tables/${moduleName}";`;
    const firstImportEnd = text.indexOf("\n", text.indexOf("import type"));
    if (firstImportEnd < 0) throw new Error("no table registry imports to extend");
    const withImport = `${text.slice(0, firstImportEnd + 1)}${importLine}\n${text.slice(firstImportEnd + 1)}`;
    const mapped = withImport.match(/(export type TableFields = \{\n)([\s\S]*?)(\n\};)/);
    if (!mapped) throw new Error("no TableFields map to add to");
    const fields = insertSorted(
      mapped[2].split("\n"),
      `  ${name}: ${Fields};`,
      (line) => line.trim().split(":")[0]
    );
    return withImport.replace(mapped[0], `${mapped[1]}${fields.join("\n")}${mapped[3]}`);
  });

  plan.edit(index, (text) => {
    const line = `export type * from "$representation/store/tables/${moduleName}";`;
    const lines = text.trimEnd().split("\n");
    const at = lines.findIndex((entry) => entry.localeCompare(line) > 0);
    const next = at < 0 ? [...lines, line] : [...lines.slice(0, at), line, ...lines.slice(at)];
    return `${next.join("\n")}\n`;
  });
}

plan.run({ dryRun: flags.has("dry-run"), what: "new-table" });
