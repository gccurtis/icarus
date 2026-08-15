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
  pascal,
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
// The error class `new-capability` wrote at the capability root. Both shared
// procedures branch on it, so the name has to match what is already there.
const errorClass = `${pascal(capabilityName)}Error`;
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
  `import type { Scope } from "$model/server/scope.server";

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
import { resolveScope } from "$model/server/scope.server";
import { ${functionName} as ${functionName}Procedure } from "${alias}/api/${directory}/${directory}";
import { stated } from "${alias}/api/shared/stated";

/**
 * Exposes \`${functionName}\` to the browser.
 *
 * Admission is \`'unchecked'\`, so the procedure this calls is the only thing
 * between a hostile payload and the database.
 *
 * The request carries a **project token** and nothing else about authority. A
 * remote function cannot see the page that called it — kit serves every one of
 * them from \`/_app/remote/…\` with empty route params — so the client sends the
 * token it holds in its URL, and \`resolveScope\` turns it into a project *within
 * this session's user*, or into a 404. Below that line the token no longer
 * exists.
 *
 * \`stated\` lets a refusal reach the browser with its code. Without it a thrown
 * capability error arrives as \`500 Internal Error\`, because kit hides thrown
 * values and cannot tell one of ours from a null dereference.
 *
 * A \`.remote.ts\` may export only remote functions — the transform assigns an id
 * to every export, so a plain exported helper throws at module load. On the
 * client the body is discarded and regenerated as a fetch stub, which is why
 * importing the server tree from here is safe.
 */
export const ${functionName} = query(
  "unchecked",
  (request: { project: string }) =>
    stated(async () => {
      const scope = await resolveScope(getRequestEvent().locals.session, request?.project);
      return ${functionName}Procedure(scope);
    })
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
    `import { errorFields, serverModel } from "$model/server/index.server";
import { ${errorClass} } from "${alias}/errors";

/**
 * Records one call: what it was asked for, and how it ended.
 *
 * Called from inside each entry rather than wrapping them, because a wrapper
 * above a procedure can be bypassed and a call inside it cannot — and a
 * browser-reachable call that leaves no trace is the one most worth having a
 * record of.
 *
 * The logger is resolved here rather than passed in: there is one per process
 * and it depends on nothing the caller knows. Only the database is scoped, and
 * only the database is a parameter.
 *
 * Only names, shapes, and counts belong in \`fields\`. A log is copied, shipped,
 * and retained far longer than the data it describes, so authored values,
 * secrets, and personal fields stay out of it.
 */
export const record = async <T>(
  operation: string,
  fields: Record<string, unknown>,
  run: () => Promise<T>
): Promise<T> => {
  const { logger } = serverModel().observability;

  logger.debug(\`${capabilityName}.\${operation}.started\`, fields);

  try {
    const result = await run();
    logger.debug(\`${capabilityName}.\${operation}.completed\`, fields);
    return result;
  } catch (error) {
    // A failure this capability chose and stated with a code is a decision;
    // anything else is a fault. Collapsing the two makes every ordinary
    // rejection read like a bug, and real bugs stop standing out.
    if (error instanceof ${errorClass}) {
      logger.warn(\`${capabilityName}.\${operation}.rejected\`, { ...fields, errorCode: error.code });
    } else {
      logger.error(\`${capabilityName}.\${operation}.failed\`, { ...fields, ...errorFields(error) });
    }
    throw error;
  }
};
`
  );
}

if (!existsSync(join(sharedRoot, "stated.ts"))) {
  write.add(
    join(sharedRoot, "stated.ts"),
    `import { error } from "@sveltejs/kit";
import { ${errorClass} } from "${alias}/errors";

/**
 * Lets a stated refusal reach the browser, and keeps a fault from doing so.
 *
 * Without this, a \`${errorClass}\` thrown inside a remote function surfaces to the
 * client as \`500 Internal Error\` — kit hides thrown values on purpose and cannot
 * tell one of ours from a null dereference. A view is then unable to distinguish
 * "that input was refused" from "the server is broken", so the only honest thing
 * it can show is the second.
 *
 * **Only remote wrappers call this.** A server-side caller catches
 * \`${errorClass}\` directly and has no use for an HTTP status, which is why the
 * translation lives at the boundary rather than in \`record\` or the procedures.
 */
export const stated = async <T>(run: () => Promise<T>): Promise<T> => {
  try {
    return await run();
  } catch (caught) {
    if (caught instanceof ${errorClass}) {
      error(400, \`\${caught.code}: \${caught.message}\`);
    }
    throw caught;
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
