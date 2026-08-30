#!/usr/bin/env node
/**
 * A panel leaf, at the path its key names, and the key beside it.
 *
 *     pnpm new-panel -- <context|inspector> <subject> <name>
 *
 * Two writes rather than one, because the vocabulary is no longer derived from
 * the tree: `panel-keys.ts` is hand-written so a panel can be named before it is
 * built, and `key-vocabulary-matches-the-tree` refuses a file the vocabulary
 * does not name. Adding the key here is what stops that being a step to forget.
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
 * The key, inserted in sorted order.
 *
 * The list is one string per line and code-unit sorted, so the insertion point
 * is the first member that sorts after the new one — and appending at the end
 * would be a diff nobody can read the second time.
 */
const CONSTANT = { context: "CONTEXT_IDS", inspector: "INSPECTION_KEYS" };
const key = `${subject}.${name}`;

plan.edit(
  join(lib, "model", "client", "view-state", "methods", "shared", "panel-keys.ts"),
  (text) => {
    const constant = CONSTANT[stack];
    const opened = text.indexOf(`export const ${constant} = [\n`);
    if (opened === -1) throw new Error(`no ${constant} to add ${key} to`);

    const start = opened + `export const ${constant} = [\n`.length;
    const end = text.indexOf("] as const;", start);
    const members = text.slice(start, end).split("\n").filter((line) => line.trim() !== "");
    if (members.some((line) => line.includes(`"${key}"`))) return text;

    const at = members.findIndex((line) => line.replace(/\D*"([^"]+)".*/, "$1") > key);
    const index = at === -1 ? members.length : at;
    members.splice(index, 0, `  "${key}"`);

    return `${text.slice(0, start)}${members.join(",\n").replace(/,+$/, "")}\n${text.slice(end)}`;
  }
);

plan.run({ dryRun: flags.has("dry-run"), what: "new-panel" });
