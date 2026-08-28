#!/usr/bin/env node
/**
 * A new capability: the directory, an empty door, and `types/`.
 *
 *     pnpm new-capability -- <name>
 *
 * No `api/`. A capability with no procedure is a legal state — the subject
 * exists before the first thing you can do to it does — and a generated empty
 * `api/` would make `entry-matches-directory` govern a directory nobody chose.
 */
import { join } from "node:path";

import { Plan } from "../shared/plan.mjs";
import { invocation, libRoot, pascal, requireKebab, usage } from "../shared/cli.mjs";

const LINE = "pnpm new-capability -- <name>";
const { positional, flags } = invocation();
const [name, ...rest] = positional;
if (rest.length > 0) usage(LINE, "One capability at a time.");
requireKebab(name, "capability name", LINE);

const lib = libRoot(import.meta.url);
const root = join(lib, "capabilities", name);
const Name = pascal(name);

const plan = new Plan(join(lib, "..", ".."));

plan.create(
  join(root, `${name}.md`),
  `# ${name}

<!-- What subject this bridges, and what a caller can ask of it. -->
`
);

plan.create(
  join(root, "index.remote.ts"),
  `export type {} from "$capabilities/${name}/types/${name}";
`
);

plan.create(
  join(root, "types", `${name}.ts`),
  `/** What a caller hands ${name}, and what it hands back. */
export type ${Name}Scope = {
  readonly project: string;
};
`
);

plan.run({ dryRun: flags.has("dry-run"), what: "new-capability" });
