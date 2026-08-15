#!/usr/bin/env node
/**
 * Scaffolds one capability onto the directory template.
 *
 * usage: pnpm new-capability <path/to/name> [--tables]
 *
 *   <path/to/name>     relative to src/lib/capabilities, e.g. name-manager
 *   --tables           also write schema.ts, a table fragment
 *
 * It writes two things in two trees: the capability, and its deployment door
 * under the functions directory. They cannot be one file — a Convex module's
 * path is its public name, so the registration has to sit where Convex looks and
 * the procedures have to sit where it does not.
 *
 * `api/` is created with its document and nothing else — a function directory
 * arrives with `new-api`, because which functions a capability offers is a
 * decision about its public surface rather than something to scaffold blindly.
 */
import { join } from "node:path";
import {
  KEBAB,
  aliasFor,
  camel,
  capabilitiesRoot,
  fail,
  functionsRoot,
  pascal,
  planner,
  render,
  snake,
  stopIfFailed,
  title
} from "./shared.mjs";

const USAGE = `usage: pnpm new-capability <path/to/name> [--tables]

  <path/to/name>     relative to src/lib/capabilities, e.g. name-manager
  --tables           also write schema.ts, a table fragment`;

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const [capabilityPath] = args.filter((arg) => !arg.startsWith("--"));

if (!capabilityPath) {
  console.error(USAGE);
  process.exit(1);
}

for (const flag of flags) {
  if (flag !== "--tables") {
    fail(flag, `unknown flag\n\n${USAGE}`);
  }
}

/**
 * A capability sits directly under `capabilities/`, named for itself.
 *
 * Grouping directories were tried and dropped. Every import a capability writes
 * goes through its own alias, so the directory above it never appeared in a line
 * of its own code — which made the group free to add and equally free to remove,
 * and left it earning nothing but a level of nesting. A deeper path is still
 * accepted, because `discover` reads a directory holding files as a capability at
 * any depth and refusing here would be the only place that disagreed.
 */
const segments = capabilityPath.split("/").filter(Boolean);
for (const segment of segments) {
  if (!KEBAB.test(segment)) fail(capabilityPath, `'${segment}' must be kebab-case`);
}
stopIfFailed("new-capability");

const name = segments.at(-1);

// The precondition, not a value: it refuses when no alias points at this
// capability, and prints the line to paste. Nothing generated here spells the
// alias out, because nothing generated here imports across a capability.
await aliasFor(capabilityPath);
stopIfFailed("new-capability");

const root = join(capabilitiesRoot, capabilityPath);
const substitutions = {
  "Capability Name": title(name),
  "capability-name": name
};

const write = planner();

write.add(join(root, "overview.md"), render("overview.md", substitutions));

write.add(
  join(root, "errors.ts"),
  `/**
 * The error ${title(name)} raises, and the codes it raises it with.
 *
 * At the capability root rather than in \`types/\` because a consumer catching
 * one is using the public contract. A code is a decision this capability made
 * and states; anything thrown without one is a fault.
 */
export type ${pascal(name)}ErrorCode = "TODO-code";

export class ${pascal(name)}Error extends Error {
  constructor(
    readonly code: ${pascal(name)}ErrorCode,
    message: string
  ) {
    super(message);
    this.name = "${pascal(name)}Error";
  }
}
`
);

/**
 * The deployment door: this capability's entire public surface.
 *
 * It sits under the functions directory rather than in the capability because a
 * Convex module's path *is* its public name, and camelCase because Convex
 * rejects a hyphen in one.
 */
write.add(
  join(functionsRoot, "capabilities", `${camel(name)}.ts`),
  `/**
 * ${title(name)}' public surface — \`api.capabilities.${camel(name)}.*\`.
 *
 * Everything exported here is reachable by anything holding the deployment URL.
 * Built from \`projectQuery\`/\`projectMutation\`, so each call resolves its
 * project token to a membership before the handler runs.
 *
 * \`pnpm new-api ${capabilityPath} <functionName> --query|--mutation\` appends here.
 */
export {};
`
);

write.add(join(root, "types", "types.md"), render("types.md", substitutions));

if (flags.has("--tables")) {
  write.add(
    join(root, "schema.ts"),
    `import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * The tables ${title(name)} owns, as a fragment \`src/convex/schema.ts\` composes.
 *
 * **\`projectId\` leads every index**, and that is the whole of project
 * isolation: one deployment holds every project, so a read that forgets the
 * predicate reads everyone's rows. Leading with it makes the scoped read the
 * cheap one and an unscoped read something you have to write on purpose.
 */
export const ${camel(name)}Tables = {
  ${snake(name)}: defineTable({
    projectId: v.id("projects")
    // TODO: the rest of the row.
  }).index("by_project", ["projectId"])
};
`
  );
}

write.add(join(root, "api", "api.md"), render("api.md", substitutions));

stopIfFailed("new-capability");
const written = write.commit();

console.log(`new-capability: wrote ${written.length} files\n`);
for (const path of written) console.log(`  ${path}`);

console.log(`
What this cannot do for you:
${
  flags.has("--tables")
    ? `
  1. Compose ${camel(name)}Tables into src/convex/schema.ts.
  2. Add functions:  pnpm new-api ${capabilityPath} <functionName> --query|--mutation`
    : `
  Add functions:  pnpm new-api ${capabilityPath} <functionName> --query|--mutation`
}

Then:  pnpm lint:capabilities`);
