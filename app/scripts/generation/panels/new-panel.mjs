#!/usr/bin/env node
/**
 * A panel leaf, at the path its key names, and the key beside it.
 *
 *     pnpm new-panel -- <context|inspector> <subject> <name>
 *
 * Three writes rather than one, because the vocabulary is no longer derived from
 * the tree: the `views` domain's panel keys are hand-written so a panel can be
 * named before it is built, and `key-vocabulary-matches-the-tree` refuses a file
 * the vocabulary does not name. Adding the key here is what stops that being a
 * step to forget.
 */
import { join } from "node:path";

import { Plan } from "../shared/plan.mjs";
import { PANEL_TREES } from "../../lint/shared/trees.mjs";
import { invocation, libRoot, requireKebab, usage } from "../shared/cli.mjs";

const LINE = "pnpm new-panel -- <context|inspector> <subject> <name>";
const { positional, flags } = invocation();
const [stack, subject, name, ...rest] = positional;
if (rest.length > 0) usage(LINE, "One panel at a time.");
if (!PANEL_TREES.includes(stack)) usage(LINE, `The stack is one of ${PANEL_TREES.join(", ")}.`);
requireKebab(subject, "subject name", LINE);
requireKebab(name, "panel name", LINE);

const lib = libRoot(import.meta.url);
const plan = new Plan(join(lib, "..", ".."));

plan.create(
  join(lib, "views", "panels", stack, subject, `${name}.svelte`),
  `<script lang="ts">
  /**
   * ${subject}.${name}
   *
   * Renders alone: no client instance, no route, no parent threading content
   * down. Capabilities, view state and components — nothing else.
   */
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
const CONSTANT = { context: "CONTEXT_IDS", inspector: "INSPECTION_KEYS" };
const UNION = { context: "ContextId", inspector: "InspectionKey" };
const key = `${subject}.${name}`;

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

plan.edit(join(lib, "representation", "data", "types", "workspace", "panels.ts"), (text) =>
  insert({
    text,
    what: UNION[stack],
    opens: `export type ${UNION[stack]} =\n`,
    closes: ";\n",
    line: `  | "${key}"`,
    separator: "\n"
  })
);

plan.edit(join(lib, "representation", "data", "behavior", "workspace", "panels.ts"), (text) =>
  insert({
    text,
    what: CONSTANT[stack],
    opens: `export const ${CONSTANT[stack]} = [\n`,
    closes: "\n] as const satisfies",
    line: `  "${key}"`,
    separator: ",\n"
  })
);

plan.run({ dryRun: flags.has("dry-run"), what: "new-panel" });
