#!/usr/bin/env node
/**
 * A component in a named vocabulary.
 *
 *     pnpm new-component -- <vocabulary> <name>
 *
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

import { Plan } from "../shared/plan.mjs";
import { invocation, libRoot, pascal, requireKebab, usage } from "../shared/cli.mjs";

const LINE = "pnpm new-component -- <vocabulary> <name>";
const { positional, flags } = invocation();
const [vocabulary, name, ...rest] = positional;
if (rest.length > 0) usage(LINE, "One component at a time.");
requireKebab(vocabulary, "vocabulary name", LINE);
requireKebab(name, "component name", LINE);

const lib = libRoot(import.meta.url);
const root = join(lib, "components", "authored", vocabulary);
const file = `${vocabulary}-${name}.svelte`;
const Export = pascal(name);

const plan = new Plan(join(lib, "..", ".."));
if (!existsSync(root)) plan.fail(vocabulary, "no such vocabulary — run pnpm new-vocabulary first");

plan.create(
  join(root, file),
  `<script lang="ts">
  import type { Snippet } from "svelte";

  let { children }: { children?: Snippet } = $props();
</script>

<div>
  {@render children?.()}
</div>
`
);

plan.edit(join(root, "index.ts"), (text) => {
  const line = `export { default as ${Export} } from "$authored-components/${vocabulary}/${file}";`;
  if (text.includes(line)) return text;
  const body = text.replace(/^export \{\};\n?$/m, "").replace(/\n+$/, "");
  return `${body ? `${body}\n` : ""}${line}\n`;
});

plan.run({ dryRun: flags.has("dry-run"), what: "new-component" });
