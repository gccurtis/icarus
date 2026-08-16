#!/usr/bin/env node
/**
 * Adds one public function to a capability.
 *
 * usage: pnpm new-api <capability-path> <functionName> --query|--mutation
 *
 *   <capability-path>  relative to src/lib/capabilities, e.g. name-manager
 *   <functionName>     camelCase, as it will be exported; the directory takes
 *                      its kebab-case form
 *   --query            reads; subscribable, and may not write
 *   --mutation         writes; one serializable transaction
 *
 * The kind is required rather than defaulted. A query that writes does not fail
 * loudly — it fails at the moment someone relies on the write — so guessing here
 * would be guessing about correctness.
 *
 * It writes the handler into the capability and appends the registration to the
 * capability's deployment door, because the surface rule requires the two to
 * describe the same set of functions: a directory the door does not register is
 * red the moment it exists, and a generator whose output fails lint teaches
 * people the standard is optional.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CAMEL,
  aliasFor,
  at,
  camel,
  capabilitiesRoot,
  commandArgs,
  fail,
  functionsRoot,
  kebabOf,
  planner,
  render,
  stopIfFailed,
  title
} from "./shared.mjs";

const USAGE = `usage: pnpm new-api <capability-path> <functionName> --query|--mutation

  <capability-path>  relative to src/lib/capabilities, e.g. name-manager
  <functionName>     camelCase, as it will be exported
  --query            reads; subscribable, and may not write
  --mutation         writes; one serializable transaction`;

const args = commandArgs();
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const [capabilityPath, functionName] = args.filter((arg) => !arg.startsWith("--"));

if (!capabilityPath || !functionName) {
  console.error(USAGE);
  process.exit(1);
}

for (const flag of flags) {
  if (flag !== "--query" && flag !== "--mutation") {
    fail(flag, `unknown flag\n\n${USAGE}`);
  }
}

if (flags.has("--query") === flags.has("--mutation")) {
  fail(functionName, `exactly one of --query or --mutation is required\n\n${USAGE}`);
}

if (!CAMEL.test(functionName)) {
  fail(functionName, "a function name is camelCase, e.g. applyStyle");
}
stopIfFailed("new-api");

const isQuery = flags.has("--query");
const builder = isQuery ? "projectQuery" : "projectMutation";
const contextType = isQuery ? "QueryCtx" : "MutationCtx";

const capabilityName = capabilityPath.split("/").filter(Boolean).at(-1);
const directory = kebabOf(functionName);
const root = join(capabilitiesRoot, capabilityPath);
const functionRoot = join(root, "api", directory);
const door = join(functionsRoot, "capabilities", `${camel(capabilityName)}.ts`);

if (!existsSync(root)) {
  fail(at(root), "no such capability — run pnpm new-capability first");
}
if (!existsSync(door)) {
  fail(at(door), "no deployment door — run pnpm new-capability first");
}
stopIfFailed("new-api");

const alias = await aliasFor(capabilityPath);
stopIfFailed("new-api");

const write = planner();

write.add(
  join(functionRoot, `${directory}.md`),
  render("api-function.md", {
    "Capability Name": title(capabilityName),
    "capability-name": capabilityName,
    functionName,
    "function-name": directory
  })
);

write.add(
  join(functionRoot, `${directory}.ts`),
  `import type { Scope } from "$access/types/access";
import type { ${contextType} } from "$convex/_generated/server";

/**
 * TODO: what this function is for, who calls it, and when it should be used
 * instead of a neighbouring one.
 *
 * \`scope\` is produced by the gate and is deliberately not part of the input:
 * the caller's payload carries a project *token*, which is resolved against
 * their own memberships before this runs. A handler cannot act on a project it
 * was not scoped to, because it cannot name one.
 */
export const ${functionName} = async (ctx: ${contextType}, scope: Scope): Promise<void> => {
  void ctx;
  void scope;
  throw new Error("${functionName} is not implemented");
};
`
);

stopIfFailed("new-api");
const written = write.commit();

/**
 * Appends the registration to the deployment door, keeping its two import lines
 * in step.
 *
 * A registration is a block rather than a re-export line, so this cannot reuse
 * the sorted-line appender the model generators use. Written as a real
 * `projectQuery({...})` call because codegen types a definition properly and a
 * re-export through a path alias can degrade the generated API to `AnyApi`.
 */
const source = readFileSync(door, "utf8");
const lines = source.replace(/^export \{\};\n/m, "").trimEnd();

const builderImport = `import { ${builder} } from "$convex/functions";`;
const handlerImport = `import { ${functionName} as ${functionName}Handler } from "${alias}/api/${directory}/${directory}";`;

const withBuilder = lines.includes(builder)
  ? lines
  : lines.includes('from "$convex/functions"')
    ? lines.replace(
        /import \{ ([^}]*) \} from "\$convex\/functions";/,
        (_, names) =>
          `import { ${[...names.split(",").map((n) => n.trim()), builder].sort().join(", ")} } from "$convex/functions";`
      )
    : `${builderImport}\n${lines}`;

const withHandler = withBuilder.includes(handlerImport)
  ? withBuilder
  : withBuilder.replace(/^(import .*\n)(?!import )/m, `$1${handlerImport}\n`);

writeFileSync(
  door,
  `${withHandler}\n
export const ${functionName} = ${builder}({
  args: {},
  handler: (ctx) => ${functionName}Handler(ctx, ctx.scope)
});
`
);

console.log(`new-api: wrote ${written.length} files\n`);
for (const path of written) console.log(`  ${path}`);
console.log(`  ${at(door)}  (registration appended)`);

console.log(`
Next:

  1. Write the handler in ${at(join(functionRoot, `${directory}.ts`))}
  2. Declare its arguments in ${at(door)} — a validator there is the
     security boundary for a public function, so an empty \`args\` accepts nothing
  3. Fill the TODOs in ${at(join(functionRoot, `${directory}.md`))} — the procedure
     tree names real paths, and lint checks that each one resolves
  4. pnpm lint:capabilities`);
