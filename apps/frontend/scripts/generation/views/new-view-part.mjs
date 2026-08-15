#!/usr/bin/env node
/**
 * Adds one part to an existing view.
 *
 *     pnpm new-view-part -- <view> <concern> <name> [--complex]
 *     pnpm new-view-part -- <view> shared
 *
 * One command for all five concerns rather than one command each, because the
 * five behave identically: write the entry, create the concern document from its
 * template if this is the first entry, add the entry to that document's
 * inventory. One code path, one test suite, and no chance of the five drifting
 * apart in what they do around the file they write.
 *
 * The extension is never an argument. Components are `.svelte`, effects are
 * `.svelte.ts` because an effect owns a rune, and interactions and procedures
 * are `.ts` because they must not — so there is no decision left to offer.
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { CONCERNS, KEBAB, at, commitIfClean, fail, planner, render, requireView, stopIfFailed, withInventoryEntry } from "./shared.mjs";

const NAME = "new-view-part";
const args = process.argv.slice(2);
const complex = args.includes("--complex");
const [view, concern, name] = args.filter((argument) => !argument.startsWith("--"));

const root = requireView(view);

if (!concern || !Object.hasOwn(CONCERNS, concern)) {
  fail("<concern>", `'${concern ?? ""}' is not a view concern — expected ${Object.keys(CONCERNS).join(", ")}`);
  stopIfFailed(NAME);
}

const pascal = (kebab) => kebab.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
const camel = (kebab) => {
  const upper = pascal(kebab);
  return upper.charAt(0).toLowerCase() + upper.slice(1);
};

const plan = planner();
const concernRoot = join(root, concern);

// ------------------------------------------------------------------ shared ----

if (concern === "shared") {
  if (existsSync(concernRoot)) {
    fail(at(concernRoot), "already exists — a view has one shared directory");
    stopIfFailed(NAME);
  }

  const type = `${pascal(view)}Shared`;
  plan.create(join(concernRoot, "shared.md"), render("shared.md", view));
  plan.create(
    join(concernRoot, "types.ts"),
    `export type ${type} = {
  // TODO: the values and operations this mounted instance shares.
};
`
  );
  plan.create(
    join(concernRoot, "create-shared.svelte.ts"),
    `import type { ${type} } from "$views/${view}/shared/types";

/**
 * Called once per mounted view, by the view root.
 *
 * Never hold the result at module scope: a view can be mounted more than once —
 * one per open document, one per panel — and a module-level instance would be
 * shared by mounts that must not see each other.
 */
export const create${type} = (): ${type} => {
  // TODO: state, derived values, and the operations that mutate them.
  return {};
};
`
  );

  await commitIfClean(plan, NAME);
  process.exit(0);
}

// ------------------------------------------------------- the four tree concerns ----

if (!name) {
  fail("<name>", `${concern} needs a name`);
  stopIfFailed(NAME);
}

// A path is permitted for components only, because only the component tree
// nests: `tab-header/components/tab-title` mirrors the rendered tree. The other
// concerns are one level, so a slash there is a mistake worth naming.
const segments = name.split("/");
if (concern !== "components" && segments.length > 1) {
  fail("<name>", `'${name}' — ${concern}/ is one level deep; a slash is only for the component tree`);
  stopIfFailed(NAME);
}
for (const segment of segments) {
  if (!KEBAB.test(segment)) {
    fail("<name>", `'${segment}' is not kebab-case`);
    stopIfFailed(NAME);
  }
}
if (concern === "components") {
  for (const [index, segment] of segments.entries()) {
    if (index % 2 === 1 && segment !== "components") {
      fail("<name>", `'${name}' — a nested component path alternates <component>/components/<component>`);
      stopIfFailed(NAME);
    }
  }
}

const extension = CONCERNS[concern];
const leaf = basename(name);
const relativePath = complex ? `${name}/${leaf}${extension}` : `${name}${extension}`;
const target = join(concernRoot, relativePath);

const BODIES = {
  components: () => `<script lang="ts">
  // TODO: the props this component takes from its parent.
</script>

<div>
  <!-- TODO: ${leaf} -->
</div>
`,
  interactions: () => `/**
 * TODO: the user intent this interaction serves.
 *
 * The component translates the DOM event; this receives application-shaped
 * input, coordinates the model or a capability, and owns the recovery.
 */
export const ${camel(leaf)} = (): void => {
  // TODO
};
`,
  effects: () => `/**
 * TODO: what change runs this, and who owns the cleanup.
 */
export const ${camel(leaf)} = (): void => {
  $effect(() => {
    // TODO: setup.
    return () => {
      // TODO: cleanup.
    };
  });
};
`,
  procedures: () => `/**
 * TODO: the operation or invariant this owns.
 */
export const ${camel(leaf)} = (): void => {
  // TODO
};
`
};

plan.create(target, BODIES[concern]());

// The concern document is the point of the command. An entry no inventory names
// fails `resolve-documented-paths`, so creating one without the other would
// produce a view that is red the moment it exists.
const document = join(concernRoot, `${concern}.md`);
const existing = existsSync(document) ? readFileSync(document, "utf8") : render(`${concern}.md`, view);
plan.edit(document, withInventoryEntry(existing, relativePath));

await commitIfClean(plan, NAME);
