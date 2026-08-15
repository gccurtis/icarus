#!/usr/bin/env node
/**
 * Scaffolds one capability onto the directory template.
 *
 * usage: pnpm new-capability <path/to/name> [--browser-facing]
 *
 *   <path/to/name>     relative to src/lib/capabilities, e.g. data/name-manager
 *   --browser-facing   also write index.ts, the browser door
 *
 * `api/` is created with its document and nothing else — a function directory
 * arrives with `new-api`, because which functions a capability offers is a
 * decision about its public surface rather than something to scaffold blindly.
 *
 * Nothing here scaffolds storage. A capability that declares tables gets a flag
 * written against whatever it declares them on, which is a decision the store
 * makes rather than this script.
 */
import { join } from "node:path";
import {
  KEBAB,
  aliasFor,
  capabilitiesRoot,
  fail,
  pascal,
  planner,
  render,
  stopIfFailed,
  title
} from "./shared.mjs";

const USAGE = `usage: pnpm new-capability <path/to/name> [--browser-facing]

  <path/to/name>     relative to src/lib/capabilities, e.g. data/name-manager
  --browser-facing   also write index.ts, the browser door`;

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const [capabilityPath] = args.filter((arg) => !arg.startsWith("--"));

if (!capabilityPath) {
  console.error(USAGE);
  process.exit(1);
}

for (const flag of flags) {
  if (flag !== "--browser-facing") {
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
const alias = await aliasFor(capabilityPath);
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

write.add(
  join(root, "index.server.ts"),
  `/**
 * The server door for ${title(name)}.
 *
 * Reached by import, from load functions, form actions, and other
 * capabilities. Every function exported here has a directory under \`api/\`, and
 * lint checks both directions.
 *
 * Views do not import this file — they import ${flags.has("--browser-facing") ? "`index.ts`" : "the browser door, which this capability does not have yet"}.
 */
export { ${pascal(name)}Error, type ${pascal(name)}ErrorCode } from "${alias}/errors";
`
);

if (flags.has("--browser-facing")) {
  write.add(
    join(root, "index.ts"),
    `/**
 * The browser door for ${title(name)}.
 *
 * Re-exports of remote functions, and nothing else. One plain import here would
 * drag this capability's server graph into the client bundle, so lint allows
 * only \`.remote.ts\` specifiers.
 *
 * \`pnpm new-api ${capabilityPath} <functionName> --remote\` appends to this file.
 */
export {};
`
  );
}

write.add(join(root, "types", "types.md"), render("types.md", substitutions));
write.add(
  join(root, "types", "ids.ts"),
  `/**
 * Identifiers ${title(name)} allocates.
 *
 * Branded rather than bare strings so one kind of id cannot be passed where
 * another is expected — the compiler catches the swap that a string type would
 * accept silently.
 */
export type ${pascal(name)}Id = string & { readonly __brand: "${pascal(name)}Id" };
`
);

write.add(join(root, "api", "api.md"), render("api.md", substitutions));

stopIfFailed("new-capability");
const written = write.commit();

console.log(`new-capability: wrote ${written.length} files\n`);
for (const path of written) console.log(`  ${path}`);

console.log(`
What this cannot do for you:

  Add functions:  pnpm new-api ${capabilityPath} <functionName>${flags.has("--browser-facing") ? " --remote" : ""}

Then:  pnpm lint:capabilities`);
