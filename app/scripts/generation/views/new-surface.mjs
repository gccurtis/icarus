#!/usr/bin/env node
/**
 * A surface: its document and its root component, with the grid skeleton in
 * place.
 *
 *     pnpm new-surface -- <name> [--development]
 *
 * The grid is generated rather than left to be added, because
 * `surface-is-a-named-grid` reads exactly that and a template that trips its own
 * check on the first run is a template nobody trusts.
 */
import { join } from "node:path";

import { Plan } from "../shared/plan.mjs";
import { invocation, libRoot, requireKebab, usage } from "../shared/cli.mjs";

const LINE = "pnpm new-surface -- <name> [--development]";
const { positional, flags } = invocation();
const [name, ...rest] = positional;
if (rest.length > 0) usage(LINE, "One surface at a time.");
requireKebab(name, "surface name", LINE);

const lib = libRoot(import.meta.url);
const root = flags.has("development")
  ? join(lib, "views", "development", name)
  : join(lib, "views", name);

const plan = new Plan(join(lib, "..", ".."));

plan.create(
  join(root, `${name}.md`),
  `# ${name}

<!-- What a person sees here, and which capabilities it reads. -->
`
);

plan.create(
  join(root, `${name}.svelte`),
  `<script lang="ts">
  /**
   * ${name}.
   *
   * Data comes from a capability. A prop carries a callback or an id its parent
   * alone knows; content arriving as a prop is content two surfaces can
   * disagree about.
   */
</script>

<section class="${name}">
  <header class="${name}__heading"></header>
  <div class="${name}__body"></div>
</section>

<style>
  .${name} {
    display: grid;
    grid-template-areas:
      "heading"
      "body";
    grid-template-rows: auto 1fr;
    height: 100%;
  }

  .${name}__heading {
    grid-area: heading;
  }

  .${name}__body {
    grid-area: body;
    overflow: auto;
  }
</style>
`
);

plan.run({ dryRun: flags.has("dry-run"), what: "new-surface" });
