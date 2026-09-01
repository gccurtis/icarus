#!/usr/bin/env node
/**
 * One view, on one of a category's three surfaces.
 *
 *     pnpm new-view -- <category> <content|context|inspector> <name>
 *
 * A content view is reachable as soon as it exists, because `pnpm category-keys`
 * reads the tree. A context or inspector view is not: its vocabulary is
 * hand-written so a view can be named before it is built, and
 * `key-vocabulary-matches-the-tree` refuses a file the vocabulary does not name.
 * Adding the key here is what stops that being a step to forget.
 */
import { join } from "node:path";

import { Plan } from "../shared/plan.mjs";
import { VIEW_SURFACES } from "../../lint/shared/trees.mjs";
import { invocation, libRoot, requireKebab, usage } from "../shared/cli.mjs";

const LINE = "pnpm new-view -- <category> <content|context|inspector> <name>";
const { positional, flags } = invocation();
const [category, surface, name, ...rest] = positional;
if (rest.length > 0) usage(LINE, "One view at a time.");
requireKebab(category, "category name", LINE);
if (!VIEW_SURFACES.includes(surface)) usage(LINE, `The surface is one of ${VIEW_SURFACES.join(", ")}.`);
requireKebab(name, "view name", LINE);

const lib = libRoot(import.meta.url);
const plan = new Plan(join(lib, "..", ".."));

plan.create(
  join(lib, "app-views", "categories", category, surface, `${name}.svelte`),
  `<script lang="ts">
  let { open }: { open?: boolean } = $props();
</script>

{#if open !== false}
  <section></section>
{/if}
`
);

/**
 * The key, inserted in sorted order into both halves of the vocabulary.
 *
 * The union is what a stored `TabView` names, so it lives under `data/types/`
 * where a file compiles to nothing; the list and its guard are a runtime value
 * over that union, so they live under `data/behavior/`. Both are one key per
 * line and code-unit sorted, so the insertion point is the first member that
 * sorts after the new one — appending at the end would be a diff nobody can
 * read the second time.
 */
const CONSTANT = { context: "CONTEXT_VIEWS", inspector: "INSPECTOR_VIEWS" };
const UNION = { context: "ContextView", inspector: "InspectorView" };
const key = `${category}.${name}`;

/**
 * Splices the key into the block between `opens` and `closes`, in sorted order.
 * `line` spells one member and `separator` is what stands between two.
 */
const insert = ({ text, what, opens, closes, line, separator }) => {
  const opened = text.indexOf(opens);
  if (opened === -1) throw new Error(`no ${what} to add ${key} to`);

  const start = opened + opens.length;
  const end = text.indexOf(closes, start);
  const members = text
    .slice(start, end)
    .split("\n")
    .map((member) => member.replace(/,\s*$/, ""))
    .filter((member) => member.trim() !== "");
  if (members.some((member) => member.includes(`"${key}"`))) return text;

  const at = members.findIndex((member) => member.replace(/\D*"([^"]+)".*/, "$1") > key);
  members.splice(at === -1 ? members.length : at, 0, line);

  return `${text.slice(0, start)}${members.join(separator)}${text.slice(end)}`;
};

if (surface === "content") {
  plan.run({ dryRun: flags.has("dry-run"), what: "new-view" });
  if (!flags.has("dry-run")) console.log("\n  next: pnpm category-keys");
} else {
  plan.edit(join(lib, "representation", "data", "types", "workspace", "views.ts"), (text) =>
    insert({
      text,
      what: UNION[surface],
      opens: `export type ${UNION[surface]} =\n`,
      closes: ";\n",
      line: `  | "${key}"`,
      separator: "\n"
    })
  );

  plan.edit(join(lib, "representation", "data", "behavior", "workspace", "views.ts"), (text) =>
    insert({
      text,
      what: CONSTANT[surface],
      opens: `export const ${CONSTANT[surface]} = [\n`,
      closes: "\n] as const satisfies",
      line: `  "${key}"`,
      separator: ",\n"
    })
  );

  plan.run({ dryRun: flags.has("dry-run"), what: "new-view" });
}
