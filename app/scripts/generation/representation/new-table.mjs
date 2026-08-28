#!/usr/bin/env node
/**
 * A table: its row type, its name in `TABLE_NAMES`, and its entry in
 * `TableFields`.
 *
 *     pnpm new-table -- <camelCaseName>
 *
 * Three edits that must agree, which is what a generator is for. Missing any one
 * of them either fails to compile or, worse, compiles and leaves a table nothing
 * can open by name.
 */
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

const base = packageRoot(import.meta.url);
const tables = join(libRoot(import.meta.url), "representation", "store", "tables.ts");
const plan = new Plan(base);

/** Kept in the sorted order the list is already in, so a diff shows one line. */
const insertSorted = (lines, entry, keyOf) => {
  const at = lines.findIndex((line) => keyOf(line) > keyOf(entry));
  return at === -1 ? [...lines, entry] : [...lines.slice(0, at), entry, ...lines.slice(at)];
};

plan.edit(tables, (text) => {
  if (new RegExp(`^\\s*"${name}",?$`, "m").test(text)) return text;

  const listed = text.match(/(export const TABLE_NAMES = \[\n)([\s\S]*?)(\n\] as const;)/);
  if (!listed) throw new Error("no TABLE_NAMES list to add to");
  const names = insertSorted(listed[2].split("\n"), `  "${name}",`, (line) => line.trim().replace(/[",]/g, ""));
  let next = text.replace(listed[0], `${listed[1]}${names.join("\n")}${listed[3]}`);

  const mapped = next.match(/(export type TableFields = \{\n)([\s\S]*?)(\n\};)/);
  if (!mapped) throw new Error("no TableFields map to add to");
  const fields = insertSorted(mapped[2].split("\n"), `  ${name}: ${Fields};`, (line) => line.trim().split(":")[0]);
  next = next.replace(mapped[0], `${mapped[1]}${fields.join("\n")}${mapped[3]}`);

  // The row type sits with the rest of them, at the end of the declarations.
  const declaration = `\n/** What a ${name} row holds. */\nexport type ${Fields} = {\n  readonly project: string;\n};\n`;
  const listStart = next.indexOf("export const TABLE_NAMES");
  return next.slice(0, listStart) + declaration.trimStart() + "\n" + next.slice(listStart);
});

plan.run({ dryRun: flags.has("dry-run"), what: "new-table" });
