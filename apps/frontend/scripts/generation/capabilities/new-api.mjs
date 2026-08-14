#!/usr/bin/env node
/**
 * Adds one public function to a capability.
 *
 * usage: pnpm new-api <capability-path> <functionName> [--remote]
 *
 *   <capability-path>  relative to src/lib/capabilities, e.g. data/name-manager
 *   <functionName>     camelCase, as it will be exported; the directory takes
 *                      its kebab-case form
 *   --remote           also expose it to the browser
 *
 * Unlike its backend predecessor, this appends the export to the doors rather
 * than printing a reminder. The surface rule requires `index.server.ts` and
 * `api/` to describe the same set of functions, so a directory the door does
 * not export is red the moment it exists — and a generator whose output fails
 * lint teaches people the standard is optional.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CAMEL,
  aliasFor,
  appendExport,
  at,
  capabilitiesRoot,
  fail,
  kebabOf,
  planner,
  render,
  stopIfFailed,
  title
} from "./shared.mjs";

const USAGE = `usage: pnpm new-api <capability-path> <functionName> [--remote]

  <capability-path>  relative to src/lib/capabilities, e.g. data/name-manager
  <functionName>     camelCase, as it will be exported
  --remote           also expose it to the browser`;

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const [capabilityPath, functionName] = args.filter((arg) => !arg.startsWith("--"));

if (!capabilityPath || !functionName) {
  console.error(USAGE);
  process.exit(1);
}

for (const flag of flags) {
  if (flag !== "--remote") fail(flag, `unknown flag\n\n${USAGE}`);
}

if (!CAMEL.test(functionName)) {
  fail(functionName, "a function name is camelCase, e.g. applyStyle");
}

const root = join(capabilitiesRoot, capabilityPath);
if (!existsSync(root)) {
  fail(
    `src/lib/capabilities/${capabilityPath}`,
    "no such capability — create it first with pnpm new-capability"
  );
}

const serverDoor = join(root, "index.server.ts");
const browserDoor = join(root, "index.ts");

if (flags.has("--remote") && !existsSync(browserDoor)) {
  fail(
    at(browserDoor),
    "--remote needs a browser door — re-run new-capability with --browser-facing, or add index.ts by hand"
  );
}
stopIfFailed("new-api");

const directory = kebabOf(functionName);
const alias = await aliasFor(capabilityPath);
stopIfFailed("new-api");

const functionRoot = join(root, "api", directory);
const capabilityName = capabilityPath.split("/").at(-1);
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
  `import type { Scope } from "$runtime/server/scope.server";

/**
 * TODO: what this function is for, who calls it, and when it should be used
 * instead of a neighbouring one.
 *
 * \`scope\` is derived server-side and is deliberately separate from the input:
 * the browser's payload has no slot for a project or a user, so a client cannot
 * name authority it does not have.
 */
export const ${functionName} = async (scope: Scope): Promise<void> => {
  void scope;
  throw new Error("${functionName} is not implemented");
};
`
);

if (flags.has("--remote")) {
  write.add(
    join(functionRoot, `${directory}.remote.ts`),
    `import { getRequestEvent, query } from "$app/server";
import { ${functionName} as ${functionName}Procedure } from "${alias}/api/${directory}/${directory}";

/**
 * Exposes \`${functionName}\` to the browser.
 *
 * Admission is \`'unchecked'\`, so the procedure this calls is the only thing
 * between a hostile payload and the database.
 *
 * A \`.remote.ts\` may export only remote functions — the transform assigns an id
 * to every export, so a plain exported helper throws at module load. On the
 * client the body is discarded and regenerated as a fetch stub, which is why
 * importing the server tree from here is safe.
 */
export const ${functionName} = query(async () =>
  ${functionName}Procedure(getRequestEvent().locals.scope)
);
`
  );
}

/**
 * Instrumentation arrives with the first function, not with the capability.
 *
 * The standard requires every entry to record its call, so `shared/` is not
 * optional once a capability offers anything — but a capability with no
 * functions has nothing to instrument, and an empty directory is not what the
 * template means by absent.
 */
const sharedRoot = join(root, "api", "shared");

if (!existsSync(join(sharedRoot, "shared.md"))) {
  write.add(
    join(sharedRoot, "shared.md"),
    render("api-shared.md", {
      "Capability Name": title(capabilityName),
      "capability-name": capabilityName
    })
  );
}

if (!existsSync(join(sharedRoot, "record.ts"))) {
  write.add(
    join(sharedRoot, "record.ts"),
    `/**
 * Records one call: what it was asked for, and how it ended.
 *
 * Called from inside each entry rather than wrapping them, because a wrapper
 * above a procedure can be bypassed and a call inside it cannot — and a
 * browser-reachable call that leaves no trace is the one most worth having a
 * record of.
 *
 * Only names, shapes, and counts belong in \`fields\`. A log is copied, shipped,
 * and retained far longer than the data it describes, so authored values,
 * secrets, and personal fields stay out of it.
 *
 * TODO: send these to the logger from \`$runtime/server/observability\` once it
 * exists. Until then they go nowhere, which is worse than it looks — an
 * unrecorded rejection is indistinguishable from one that never happened.
 */
export const record = async <T>(
  operation: string,
  fields: Record<string, unknown>,
  run: () => Promise<T>
): Promise<T> => {
  void operation;
  void fields;

  try {
    return await run();
  } catch (error) {
    // A failure this capability chose and stated with a code is a decision;
    // anything else is a fault. Collapsing the two makes every ordinary
    // rejection read like a bug, and real bugs stop standing out.
    throw error;
  }
};
`
  );
}

stopIfFailed("new-api");
const written = write.commit();

const doors = [];
if (appendExport(serverDoor, `export { ${functionName} } from "${alias}/api/${directory}/${directory}";`)) {
  doors.push(at(serverDoor));
}
if (
  flags.has("--remote") &&
  appendExport(browserDoor, `export { ${functionName} } from "${alias}/api/${directory}/${directory}.remote";`)
) {
  doors.push(at(browserDoor));
}

// An `export {}` placeholder is how new-capability keeps an empty door valid
// TypeScript. Once a real export lands it is noise, so it goes.
for (const door of [serverDoor, browserDoor]) {
  if (!existsSync(door)) continue;
  const source = readFileSync(door, "utf8");
  if (!source.includes("export {};")) continue;
  const { writeFileSync } = await import("node:fs");
  writeFileSync(door, source.replace(/^export \{\};\n/m, ""));
}

console.log(`new-api: wrote ${written.length} files\n`);
for (const path of written) console.log(`  ${path}`);
for (const door of doors) console.log(`  ${door}  (export appended)`);

console.log(`
Next:

  1. Write the procedure in ${at(join(functionRoot, `${directory}.ts`))}
  2. Fill the TODOs in ${at(join(functionRoot, `${directory}.md`))} — the procedure
     tree names real paths, and lint checks that each one resolves
  3. pnpm lint:capabilities`);
