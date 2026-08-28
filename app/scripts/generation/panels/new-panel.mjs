#!/usr/bin/env node
/**
 * A panel leaf, at the path its key names.
 *
 *     pnpm new-panel -- <context|inspector> <subject> <name>
 *
 * Run `pnpm view-state-keys` after: the vocabulary is generated from these
 * paths, so until it is rewritten the new key does not exist and nothing can
 * open the panel.
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

plan.run({ dryRun: flags.has("dry-run"), what: "new-panel" });

if (!flags.has("dry-run")) console.log("\n  next: pnpm view-state-keys");
