#!/usr/bin/env node
/**
 * A new procedure inside a capability.
 *
 *     pnpm new-procedure -- <capability> <procedure>
 *
 * Writes the procedure directory, the entry already gated and validating, the
 * declaration added to the index, and a failing test. The procedure receives
 * its authenticated server context explicitly; the remote declaration binds
 * that context at the one request adapter. A template that trips its own checks
 * on the first run is a template nobody trusts.
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
  `import type { CapabilityContext } from "$runtime/server/scope.server";

import type { ${Input}, ${Result} } from "$capabilities/${capability}/types/${procedure}";
import { validate${pascal(procedure)} } from "$capabilities/${capability}/api/${procedure}/validate-${procedure}";

/**
 * ${procedure}.
 *
 * CapabilityContext was authenticated before this function was entered. The
 * input is still checked before the operation acts on it.
 */
export const ${call} = async (context: CapabilityContext, input: ${Input}): Promise<${Result}> => {
  const ${call}Input = validate${pascal(procedure)}(input);

  throw new Error(\`${capability}/${procedure} is not implemented for \${context.scope.projectId}: \${${call}Input.project}\`);
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

import type { CapabilityContext } from "$runtime/server/scope.server";

const { ${call} } = await import("$capabilities/${capability}/api/${procedure}/${procedure}");

const context = {
  scope: { projectId: "p", userId: "u", username: "You" },
  model: {} as never,
  now: () => 0
} satisfies CapabilityContext;

test("${procedure} refuses an input it cannot act on", async () => {
  await assert.rejects(() => ${call}(context, { project: "" }));
});

test.fails("${procedure} answers", async () => {
  await ${call}(context, { project: "p" });
});
`
);

const index = ["index.remote.ts", "index.ts"]
  .map((file) => join(root, file))
  .find((candidate) => existsSync(candidate));

if (!index) plan.fail(capability, "has no index to declare a procedure in");
else {
  plan.edit(index, (text) => {
    if (text.includes(`api/${procedure}/${procedure}`)) return text;

    const remote = index.endsWith(".remote.ts");
    const factory = remote ? `query("unchecked", bindCapability(${call}Procedure))` : `${call}Procedure`;
    const opening = remote
      ? `${text.includes('from "$app/server"') ? "" : 'import { query } from "$app/server";\n'}${
          text.includes('bindCapability')
            ? ""
            : 'import { bindCapability } from "$runtime/server/scope.server";\n'
        }\n`
      : "";

    const declaration =
      `import { ${call} as ${call}Procedure } from "$capabilities/${capability}/api/${procedure}/${procedure}";\n` +
      `\nexport const ${call} = ${factory};\n` +
      `export type { ${Input}, ${Result} } from "$capabilities/${capability}/types/${procedure}";\n`;
    return `${opening}${text.replace(/\n+$/, "\n")}\n${declaration}`;
  });
}

plan.run({ dryRun: flags.has("dry-run"), what: "new-procedure" });
