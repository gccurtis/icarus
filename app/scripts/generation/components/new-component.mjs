#!/usr/bin/env node
/**
 * A component in a named vocabulary.
 *
 *     pnpm new-component -- <vocabulary> <name>
 *
 * The trace registration is written in rather than left to be remembered: a
 * component that skips it renders correctly and makes the review page draw a
 * tree it cannot describe, which is the kind of omission nobody notices.
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
const Component = pascal(`${vocabulary}-${name}`);
const Export = pascal(name);

const plan = new Plan(join(lib, "..", ".."));
if (!existsSync(root)) plan.fail(vocabulary, "no such vocabulary — run pnpm new-vocabulary first");

plan.create(
  join(root, file),
  `<script lang="ts">
  import type { Snippet } from "svelte";

  import { traceNode } from "$components/development/trace.svelte";

  let { children }: { children?: Snippet } = $props();

  const trace = traceNode("${Component}", () => ({}));
</script>

<div {...trace}>
  {@render children?.()}
</div>
`
);

plan.edit(join(root, "index.ts"), (text) => {
  const line = `export { default as ${Export} } from "$components/authored/${vocabulary}/${file}";`;
  if (text.includes(line)) return text;
  const body = text.replace(/^export \{\};\n?$/m, "").replace(/\n+$/, "");
  return `${body ? `${body}\n` : ""}${line}\n`;
});

plan.run({ dryRun: flags.has("dry-run"), what: "new-component" });
