#!/usr/bin/env node
/**
 * One entry under a named concern, with the extension that concern requires.
 *
 *     pnpm new-concern-entry -- <surface> <concern> <name>
 *
 * The extension is not a choice. `effects/` is `.svelte.ts` or its runes never
 * run; `procedures/` and `interactions/` are `.ts` and hold none. Writing the
 * right one is the whole reason to generate a file this small.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

import { Plan } from "../shared/plan.mjs";
import { CONCERN_EXTENSIONS } from "../../lint/shared/views.mjs";
import { camel, invocation, libRoot, pascal, requireKebab, usage } from "../shared/cli.mjs";

const LINE = "pnpm new-concern-entry -- <surface> <concern> <name>";
const CONCERNS = Object.keys(CONCERN_EXTENSIONS);

const { positional, flags } = invocation();
const [surface, concern, name, ...rest] = positional;
if (rest.length > 0) usage(LINE, "One entry at a time.");
requireKebab(surface, "surface name", LINE);
if (!CONCERNS.includes(concern)) usage(LINE, `The concern is one of ${CONCERNS.join(", ")}.`);
requireKebab(name, "entry name", LINE);

const lib = libRoot(import.meta.url);
const roots = [join(lib, "views", surface), join(lib, "views", "development", surface)];
const root = roots.find((candidate) => existsSync(candidate));

const plan = new Plan(join(lib, "..", ".."));
if (!root) plan.fail(surface, "no such surface — run pnpm new-surface first");

// `shared/` holds whatever two concerns both needed, so it takes the plain
// extension unless what is being shared is reactive.
const extension = CONCERN_EXTENSIONS[concern] ?? ".ts";

const bodies = {
  components: `<script lang="ts">
  let { }: {} = $props();
</script>

<div></div>
`,
  effects: `/** ${name}. Runs for as long as the surface is mounted. */
export const ${camel(name)} = (): void => {
  $effect(() => {
    // …
  });
};
`,
  interactions: `/** ${name}: what the person meant, not which event fired. */
export const ${camel(name)} = (): void => {
  throw new Error("${surface}/${name} is not implemented");
};
`,
  procedures: `/** ${name}. */
export const ${camel(name)} = (): void => {
  throw new Error("${surface}/${name} is not implemented");
};
`,
  shared: `/**
 * ${name}.
 *
 * A constructor, never an instance: what this returns dies with the mount that
 * asked for it, and a module singleton would outlive the surface.
 */
export const create${pascal(name)} = () => ({});
`
};

if (root) plan.create(join(root, concern, `${name}${extension}`), bodies[concern]);

plan.run({ dryRun: flags.has("dry-run"), what: "new-concern-entry" });
