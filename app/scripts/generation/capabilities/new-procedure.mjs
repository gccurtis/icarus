#!/usr/bin/env node
/**
 * A new procedure inside a capability.
 *
 *     pnpm new-procedure -- <capability> <procedure>
 *
 * Writes the procedure directory, the entry with its validator already the first
 * statement, the stub added to the door, and a failing test. The validator call
 * is generated rather than left to a comment because
 * `procedure-validates-first` reads exactly that first statement — a template
 * that trips its own check on the first run is a template nobody trusts.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

import { Plan } from "../shared/plan.mjs";
import { camel, invocation, libRoot, pascal, requireKebab, usage } from "../shared/cli.mjs";

const LINE = "pnpm new-procedure -- <capability> <procedure>";
const { positional, flags } = invocation();
const [capability, procedure, ...rest] = positional;
if (rest.length > 0) usage(LINE, "One procedure at a time.");
requireKebab(capability, "capability name", LINE);
requireKebab(procedure, "procedure name", LINE);

const lib = libRoot(import.meta.url);
const base = join(lib, "..", "..");
const root = join(lib, "capabilities", capability);
const directory = join(root, "api", procedure);

const call = camel(procedure);
const Input = `${pascal(procedure)}Input`;
const Result = `${pascal(procedure)}Result`;

const plan = new Plan(base);
if (!existsSync(root)) plan.fail(capability, "no such capability — run pnpm new-capability first");

plan.create(
  join(directory, `${procedure}.ts`),
  `import type { ${Input}, ${Result} } from "$capabilities/${capability}/types/${procedure}";
import { validate${pascal(procedure)} } from "$capabilities/${capability}/api/${procedure}/validate-${procedure}";

/**
 * ${procedure}.
 *
 * Validation is the first statement, before anything has happened. A type is a
 * claim about what a caller said it sent; this is the check.
 */
export const ${call} = async (input: ${Input}): Promise<${Result}> => {
  const ${call}Input = validate${pascal(procedure)}(input);

  throw new Error(\`${capability}/${procedure} is not implemented: \${${call}Input.project}\`);
};
`
);

plan.create(
  join(directory, `validate-${procedure}.ts`),
  `import type { ${Input} } from "$capabilities/${capability}/types/${procedure}";

/** Refuses anything the procedure could not act on. Throws; it never returns a partial. */
export const validate${pascal(procedure)} = (input: ${Input}): ${Input} => {
  if (typeof input?.project !== "string" || input.project.length === 0) {
    throw new Error("${capability}/${procedure}: project is required");
  }
  return input;
};
`
);

plan.create(
  join(root, "types", `${procedure}.ts`),
  `/** What ${procedure} is asked, and what it answers. */
export type ${Input} = {
  readonly project: string;
};

export type ${Result} = {
  readonly ok: boolean;
};
`
);

plan.create(
  join(root, "test", "unit", `${procedure}.test.ts`),
  `import assert from "node:assert/strict";
import { test } from "vitest";
import { ${call} } from "$capabilities/${capability}/api/${procedure}/${procedure}";

test("${procedure} refuses an input it cannot act on", async () => {
  await assert.rejects(() => ${call}({ project: "" }));
});

test.fails("${procedure} answers", async () => {
  await ${call}({ project: "p" });
});
`
);

const door = ["index.remote.ts", "index.ts"]
  .map((file) => join(root, file))
  .find((candidate) => existsSync(candidate));

if (!door) plan.fail(capability, "has no door to add a stub to");
else {
  plan.edit(door, (text) => {
    if (text.includes(`api/${procedure}/${procedure}`)) return text;

    const remote = door.endsWith(".remote.ts");
    const factory = remote ? `query("unchecked", ${call}Procedure)` : `${call}Procedure`;
    const opening = remote && !text.includes('from "$app/server"')
      ? 'import { query } from "$app/server";\n\n'
      : "";

    const stub =
      `import { ${call} as ${call}Procedure } from "$capabilities/${capability}/api/${procedure}/${procedure}";\n` +
      `\nexport const ${call} = ${factory};\n` +
      `export type { ${Input}, ${Result} } from "$capabilities/${capability}/types/${procedure}";\n`;
    return `${opening}${text.replace(/\n+$/, "\n")}\n${stub}`;
  });
}

plan.run({ dryRun: flags.has("dry-run"), what: "new-procedure" });
