#!/usr/bin/env node
/**
 * A new authored vocabulary: the directory and an empty index.
 *
 *     pnpm new-vocabulary -- <name>
 */
import { join } from "node:path";

import { Plan } from "../shared/plan.mjs";
import { invocation, libRoot, requireKebab, usage } from "../shared/cli.mjs";

const LINE = "pnpm new-vocabulary -- <name>";
const { positional, flags } = invocation();
const [name, ...rest] = positional;
if (rest.length > 0) usage(LINE, "One vocabulary at a time.");
requireKebab(name, "vocabulary name", LINE);

const lib = libRoot(import.meta.url);
const root = join(lib, "components", "authored", name);
const plan = new Plan(join(lib, "..", ".."));

plan.create(
  join(root, "index.ts"),
  `/** The ${name} vocabulary. This file is its whole export surface. */
export {};
`
);

plan.run({ dryRun: flags.has("dry-run"), what: "new-vocabulary" });
