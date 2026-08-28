#!/usr/bin/env node
/**
 * A constant in a capability's vocabulary.
 *
 *     pnpm new-constant -- <capability> <name>
 *
 * Nothing is added to the door. A door exports remote functions only, so a
 * constant a caller outside the capability needs is served by a procedure.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

import { Plan } from "../shared/plan.mjs";
import { constant, invocation, libRoot, pascal, requireKebab, usage } from "../shared/cli.mjs";

const LINE = "pnpm new-constant -- <capability> <name>";
const { positional, flags } = invocation();
const [capability, name, ...rest] = positional;
if (rest.length > 0) usage(LINE, "One constant at a time.");
requireKebab(capability, "capability name", LINE);
requireKebab(name, "constant name", LINE);

const lib = libRoot(import.meta.url);
const root = join(lib, "capabilities", capability);

const plan = new Plan(join(lib, "..", ".."));
if (!existsSync(root)) plan.fail(capability, "no such capability — run pnpm new-capability first");

plan.create(
  join(root, "constants", `${name}.ts`),
  `export type ${pascal(name)}Entry = {
  readonly id: string;
};

export const ${constant(name)}: readonly ${pascal(name)}Entry[] = [];
`
);

plan.run({ dryRun: flags.has("dry-run"), what: "new-constant" });
