#!/usr/bin/env node
/**
 * The centre of a screen, or one of its states.
 *
 *     pnpm new-workspace -- <screen> [subscreen]
 *
 * With no subscreen this writes `workspace.svelte`, which is the screen's one
 * centre. With one it writes `workspace-<subscreen>.svelte`, which is one state
 * that centre can be in. Either way the key comes from the path, so
 * `pnpm screen-keys` is what makes it reachable.
 */
import { join } from "node:path";

import { Plan } from "../shared/plan.mjs";
import { invocation, libRoot, requireKebab, usage } from "../shared/cli.mjs";

const LINE = "pnpm new-workspace -- <screen> [subscreen]";
const { positional, flags } = invocation();
const [screen, subscreen, ...rest] = positional;
if (rest.length > 0) usage(LINE, "One workspace at a time.");
requireKebab(screen, "screen name", LINE);
if (subscreen) requireKebab(subscreen, "subscreen name", LINE);

const lib = libRoot(import.meta.url);
const file = subscreen ? `workspace-${subscreen}.svelte` : "workspace.svelte";
const region = subscreen ?? "workspace";

const plan = new Plan(join(lib, "..", ".."));

plan.create(
  join(lib, "views", "workspaces", screen, file),
  `<script lang="ts">
  /**
   * ${screen}${subscreen ? ` · ${subscreen}` : ""}.
   *
   * Reaches a resource runtime through view state, never by attaching one
   * itself — two attachments to one resource is two edit buffers.
   */
</script>

<section class="${region}">
  <header class="${region}__heading"></header>
  <div class="${region}__body"></div>
</section>

<style>
  .${region} {
    display: grid;
    grid-template-areas:
      "heading"
      "body";
    grid-template-rows: auto 1fr;
    height: 100%;
  }

  .${region}__heading {
    grid-area: heading;
  }

  .${region}__body {
    grid-area: body;
    overflow: auto;
  }
</style>
`
);

plan.run({ dryRun: flags.has("dry-run"), what: "new-workspace" });

if (!flags.has("dry-run")) console.log("\n  next: pnpm screen-keys");
