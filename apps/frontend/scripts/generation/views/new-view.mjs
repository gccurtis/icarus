#!/usr/bin/env node
/**
 * Creates a view: its root component and its document.
 *
 *     pnpm new-view -- <view>
 *
 * Nothing else. The standard says a directory is absent when the view has
 * nothing for it, so a generator scattering empty `components/` and `test/`
 * directories would train people to read that absence as noise. Concerns arrive
 * through `new-view-part` when there is something to put in them.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { KEBAB, at, commitIfClean, fail, packageRoot, planner, render, stopIfFailed, title, viewsRoot } from "./shared.mjs";

const [view] = process.argv.slice(2);

if (!view || !KEBAB.test(view)) {
  fail("<view>", `'${view ?? ""}' is not a kebab-case view name`);
  stopIfFailed("new-view");
}

const root = join(viewsRoot, view);
if (existsSync(root)) {
  fail(at(root), "already exists — nothing was written");
  stopIfFailed("new-view");
}

const component = `<script lang="ts">
  // TODO: props, client-model reads, and the interactions this surface wires up.
  // See ${view}.md for the contract this component is expected to satisfy.
</script>

<section>
  <!-- TODO: the rendered surface. -->
</section>
`;

const plan = planner();
plan.create(join(root, `${view}.md`), render("view.md", view));
plan.create(join(root, `${view}.svelte`), component);

await commitIfClean(plan, "new-view");

// The alias arrives with the code that needs it rather than ahead of it, so the
// first view is the one that has to declare `$views`. Editing svelte.config.js
// from here is the kind of regex edit that works until it silently does not.
const config = join(packageRoot, "svelte.config.js");
if (existsSync(config) && !readFileSync(config, "utf8").includes("$views")) {
  console.log(
    `\nThis is the first view. Declare its alias in svelte.config.js:\n\n    alias: {\n      $views: "src/lib/views",\n    }\n`
  );
}

console.log(`\n${title(view)} is on the template. Add concerns with:\n\n    pnpm new-view-part -- ${view} <concern> <name>\n`);
