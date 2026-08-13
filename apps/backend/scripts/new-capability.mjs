#!/usr/bin/env node
/**
 * Scaffolds one capability onto the directory template. No dependencies — just
 * Node, like the lint scripts this exists to satisfy.
 *
 * See docs/capability-directory/capability-directory.md. The generator's job is to make the
 * template the cheapest thing to follow: everything it writes already passes
 * `pnpm lint`, so nobody has to reconstruct the shape from the document.
 *
 * Two rules shape almost every decision below:
 *
 * 1. It never creates an empty directory. The template says an absent directory
 *    means the capability has nothing for it, and a generator that scattered
 *    placeholder directories would teach people to read that as noise. That is
 *    why `runtime-api/` is not created here (it arrives with the first method,
 *    via `new-runtime-api`) and why `test/unit`, `test/regression`, and
 *    `test/non-functional` are printed as follow-ups rather than made — this
 *    package keeps no `.gitkeep` files either.
 * 2. It never overwrites. Every target path is checked before anything is
 *    written, so a name collision costs a message rather than someone's work.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const templatesRoot = join(packageRoot, "docs", "templates");

const USAGE = `usage: pnpm new-capability <path/to/name> [--persisted] [--endpoints]

  <path/to/name>  relative to src/capabilities, e.g. resource-general/slide
  --persisted     also write persistence/ (schema, stored types, store)
  --endpoints     also write endpoints/ (endpoints.md, register.ts)`;

const problems = [];
const at = (absolute) => relative(packageRoot, absolute);
const fail = (path, message) => problems.push(`${path}  ${message}`);

/** Reports in the `path  message` format both lint scripts use, then stops. */
const stopIfFailed = (name) => {
  if (problems.length === 0) return;
  console.error(`${name}: ${problems.length} problem${problems.length === 1 ? "" : "s"}\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error("\nSee apps/backend/docs/capability-directory/capability-directory.md.");
  process.exit(1);
};

// ---------------------------------------------------------------- naming ----

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const pascal = (kebab) =>
  kebab.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
const camel = (kebab) => {
  const name = pascal(kebab);
  return name.charAt(0).toLowerCase() + name.slice(1);
};
const title = (kebab) =>
  kebab.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");

// ----------------------------------------------------------------- alias ----

const packageJson = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
const importsMap = packageJson.imports ?? {};
const tsconfigPaths =
  JSON.parse(
    readFileSync(join(packageRoot, "tsconfig.json"), "utf8").replace(/^\s*\/\/.*$/gm, "")
  ).compilerOptions?.paths ?? {};

/** Conditional entries point at `src/` for development and `dist/` for the build. */
const sourceTarget = (value) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    return value.development ?? value.types ?? value.default ?? null;
  }
  return null;
};

/**
 * The capability's own alias, found by matching the alias map's targets against
 * the capability's path.
 *
 * It is looked up rather than derived from the directory name because the two
 * disagree often enough to matter: `data/manager` is `#data-manager`, and
 * `platform/web-server` is `#web-server`. Guessing would produce imports that
 * resolve to nothing, which is exactly the breakage rule 10 was added for.
 */
const aliasFor = (capabilityPath) => {
  const index = `./src/capabilities/${capabilityPath}/index.ts`;
  const subpath = `./src/capabilities/${capabilityPath}/*`;
  let bare = null;
  let inside = null;

  for (const [key, value] of Object.entries(importsMap)) {
    const target = sourceTarget(value);
    if (key.endsWith("/*")) {
      if (target === subpath) inside = key.slice(0, -2);
    } else if (target === index) {
      bare = key;
    }
  }

  const suggestion = `#${capabilityPath.split("/").pop()}`;
  if (bare === null || inside === null || bare !== inside) {
    fail(
      "package.json",
      `no alias pair declares src/capabilities/${capabilityPath} — add it to imports and to tsconfig.json paths first, then run this again:\n` +
        `\n    package.json imports:\n` +
        `      "${suggestion}": {\n` +
        `        "development": "${index}",\n` +
        `        "types": "${index}",\n` +
        `        "default": "./dist/capabilities/${capabilityPath}/index.js"\n` +
        `      },\n` +
        `      "${suggestion}/*": {\n` +
        `        "development": "${subpath}",\n` +
        `        "types": "${subpath}",\n` +
        `        "default": "./dist/capabilities/${capabilityPath}/*"\n` +
        `      }\n` +
        `\n    tsconfig.json paths:\n` +
        `      "${suggestion}": ["${index}"],\n` +
        `      "${suggestion}/*": ["${subpath}"]\n`
    );
    return suggestion;
  }

  // Node resolves package.json imports and TypeScript resolves tsconfig paths.
  // A capability declared in only one of them compiles and then fails to start.
  for (const key of [bare, `${bare}/*`]) {
    if (!Object.hasOwn(tsconfigPaths, key)) {
      fail("tsconfig.json", `paths is missing "${key}", which package.json imports declares`);
    }
  }
  return bare;
};

// ------------------------------------------------------------- templates ----

const collapse = (text) => text.replace(/\s+/g, " ").trim();
const PLACEHOLDER = /\{\{([^{}]*?)\}\}/g;

/**
 * What an unsubstituted placeholder becomes.
 *
 * A one-word placeholder keeps its shape — `TODO-method-name`, not
 * `TODO: method-name` — because it is usually standing in for part of a path or
 * a link target, and a space there turns a dangling link into a malformed one.
 * Prose reads better as a sentence. Both start with TODO, so one grep finds
 * every decision a generated document is still waiting on.
 */
const todo = (inner) => {
  const text = inner.replace(/`/g, "").trim();
  if (/\s/.test(text)) return `TODO: ${text}`;
  return text.startsWith("/") ? `/TODO-${text.slice(1)}` : `TODO-${text}`;
};

/**
 * Re-wraps a rendered line at 80 columns.
 *
 * A placeholder may span several lines in a template and is collapsed onto one
 * before it is substituted, which leaves paragraphs far wider than everything
 * else in the file. Tables, headings, and fenced blocks are left exactly as
 * they are: wrapping any of them would change what they mean.
 */
const wrapLine = (line) => {
  const marker = /^(\s*(?:[-*] )?)/.exec(line)[1];
  const indent = " ".repeat(marker.length);
  const words = line.slice(marker.length).split(/\s+/).filter(Boolean);
  const wrapped = [];
  let current = "";

  for (const word of words) {
    const prefix = wrapped.length === 0 ? marker : indent;
    if (current !== "" && prefix.length + current.length + 1 + word.length > 80) {
      wrapped.push(prefix + current);
      current = word;
    } else {
      current = current === "" ? word : `${current} ${word}`;
    }
  }
  if (current !== "") wrapped.push((wrapped.length === 0 ? marker : indent) + current);
  return wrapped.join("\n");
};

/**
 * Re-wraps whole paragraphs, but only the ones a substitution made too wide.
 *
 * Wrapping line by line would leave an orphan: a paragraph whose first line grew
 * by one character would push its last word onto a line of its own. Everything
 * else is copied through byte for byte, so a document differs from its template
 * only where the generator actually changed something.
 */
const reflow = (text) => {
  const output = [];
  let paragraph = [];
  let fenced = false;

  const prose = (line) =>
    line.trim().length > 0 && !/^\s*[|#]/.test(line) && !line.startsWith("    ");
  const starts = (line) => /^\s*(?:[-*] |\d+\. )/.test(line);

  const flush = () => {
    if (paragraph.length === 0) return;
    output.push(
      paragraph.some((line) => line.length > 80)
        ? wrapLine(paragraph.map((line, index) => (index === 0 ? line : line.trim())).join(" "))
        : paragraph.join("\n")
    );
    paragraph = [];
  };

  for (const line of text.split("\n")) {
    if (line.startsWith("```")) {
      flush();
      fenced = !fenced;
      output.push(line);
    } else if (fenced) {
      output.push(line);
    } else if (!prose(line)) {
      flush();
      output.push(line);
    } else if (starts(line) || paragraph.length === 0) {
      flush();
      paragraph.push(line);
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return output.join("\n");
};

/**
 * Renders a document template.
 *
 * Known placeholders are substituted. Everything left needs a decision only the
 * author can make, so it becomes a marked TODO rather than a silent blank: a
 * generated document has to be a document someone finishes, and an
 * unsubstituted `{{...}}` reaching a capability is the one acceptance criterion
 * this whole exercise turns on.
 *
 * A `ts` example block that still holds a placeholder is replaced whole. Its
 * value was the shape of a declaration nobody has written yet, and
 * `export interface TODO: TypeName` is worse than an honest instruction.
 */
const render = (templateName, values, edit = (text) => text) => {
  let text = edit(readFileSync(join(templatesRoot, templateName), "utf8"));

  // A placeholder may wrap across lines in the template. Join it first so both
  // the substitution and the TODO it may become are decided on one line.
  text = text.replace(PLACEHOLDER, (_, inner) => `{{${collapse(inner)}}}`);

  text = text.replace(PLACEHOLDER, (match, inner) => {
    const quoted = inner.startsWith("`") && inner.endsWith("`");
    const key = inner.replace(/`/g, "").trim();
    if (!Object.hasOwn(values, key)) return match;
    return quoted ? `\`${values[key]}\`` : values[key];
  });

  text = text.replace(/```ts\n[\s\S]*?\n```/g, (block) =>
    block.includes("{{")
      ? `TODO: write the declaration this section describes — docs/capability-directory/templates/${templateName} shows the shape.`
      : block
  );

  text = text.replace(PLACEHOLDER, (_, inner) => todo(inner));

  if (text.includes("{{") || text.includes("}}")) {
    fail(`docs/capability-directory/templates/${templateName}`, "a placeholder survived rendering — this is a generator bug");
  }
  return reflow(text);
};

/** Removes a `##` section whole. Used for sections a fresh capability cannot fill. */
const dropSection = (text, heading) => {
  const start = text.indexOf(`\n${heading}\n`);
  if (start === -1) return text;
  const next = text.indexOf("\n## ", start + 1);
  return next === -1 ? text.slice(0, start + 1) : text.slice(0, start + 1) + text.slice(next + 1);
};

/** Removes table rows describing something this capability does not have. */
const dropLines = (text, marker) =>
  text
    .split("\n")
    .filter((line) => !line.includes(marker))
    .join("\n");

// --------------------------------------------------------------- writing ----

const planned = [];
const plan = (path, contents) => planned.push({ path, contents });

const writePlanned = () => {
  const existing = planned.filter(({ path }) => existsSync(path));
  for (const { path } of existing) {
    fail(at(path), "already exists — creating a capability is not overwriting one");
  }
  stopIfFailed("new-capability");

  for (const { path, contents } of planned) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
  }
};

// ---------------------------------------------------------------- script ----

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.length === 0) {
  console.log(USAGE);
  process.exit(argv.length === 0 ? 1 : 0);
}

const flags = argv.filter((argument) => argument.startsWith("--"));
const positional = argv.filter((argument) => !argument.startsWith("--"));
const persisted = flags.includes("--persisted");
const withEndpoints = flags.includes("--endpoints");

for (const flag of flags) {
  if (flag !== "--persisted" && flag !== "--endpoints") {
    fail("argv", `unknown flag '${flag}'\n\n${USAGE}`);
  }
}
if (positional.length !== 1) {
  fail("argv", `expected exactly one capability path\n\n${USAGE}`);
}
stopIfFailed("new-capability");

const capabilityPath = positional[0].replace(/^\/+|\/+$/g, "");
const segments = capabilityPath.split("/");
for (const segment of segments) {
  if (!KEBAB.test(segment)) {
    fail(`src/capabilities/${capabilityPath}`, `'${segment}' is not kebab-case — rule 8`);
  }
}
stopIfFailed("new-capability");

const capabilityRoot = join(packageRoot, "src", "capabilities", ...segments);
const leaf = segments[segments.length - 1];
const alias = aliasFor(capabilityPath);
stopIfFailed("new-capability");

// The alias is the capability's canonical short name, so every identifier is
// derived from it rather than from the leaf directory: `data/manager` is the
// `DataManager` built by `createDataManager`, not a `Manager`.
const base = alias.slice(1);
const Name = pascal(base);
const name = camel(base);
const displayName = title(base);
const table = base.replace(/-/g, "_");

// Documents are linked to `src/main.ts` by a path that depends on how deeply the
// capability is grouped. The templates carry one depth; only the generator knows
// the real one, and a dangling link is what this migration started by repairing.
const mainFromRoot = `${"../".repeat(segments.length + 1)}main.ts`;
const mainFromEndpoints = `${"../".repeat(segments.length + 2)}main.ts`;
const relinkMain = (text, path) => text.replace(/\]\((?:\.\.\/)+(?:src\/)?main\.ts\)/g, `](${path})`);

const treeEntries = ["overview.md", "index.ts", "errors.ts", "types/", "runtime-objects/"];
if (persisted) treeEntries.push("persistence/");
if (withEndpoints) treeEntries.push("endpoints/");
treeEntries.push("test/");
const fileTree = [
  `${leaf}/`,
  ...treeEntries.map((entry, index) =>
    `${index === treeEntries.length - 1 ? "└──" : "├──"} ${entry}`
  )
].join("\n");

const shared = {
  "Capability Name": displayName,
  "capability-name": leaf,
  RuntimeObjectName: Name,
  "object-name": leaf,
  createObjectName: `create${Name}`,
  table_name: table
};

// ---- overview.md

plan(
  join(capabilityRoot, "overview.md"),
  render("overview.md", { ...shared, "yes / internal": "yes" }, (text) => {
    let edited = relinkMain(text, mainFromRoot);
    // The generator knows exactly which directories it created, and the template
    // says to show only those. runtime-api/ is absent until the first method.
    edited = edited.replace(
      /```text\n\{\{capability-name\}\}\/[\s\S]*?\n```/,
      `\`\`\`text\n${fileTree}\n\`\`\``
    );
    edited = edited.replace(
      "Show only directories and files that belong to this capability. Omit directories\nthe capability does not have.",
      "Show only directories and files that belong to this capability. Omit directories\nthe capability does not have. `runtime-api/` appears here with the first method."
    );
    if (!withEndpoints) edited = dropLines(edited, "endpoint-job");
    if (!persisted) edited = dropSection(edited, "## Data Ownership");
    // `docs/` is not created: it holds material belonging to no single directory,
    // and a capability with no such material should not advertise a section.
    return dropSection(edited, "## Supporting Documents");
  })
);

// ---- index.ts

const exports = [
  ...(withEndpoints
    ? [`export { register${Name}Endpoints } from "${alias}/endpoints/register.js";`]
    : []),
  `export { ${Name}Error } from "${alias}/errors.js";`,
  `export type { ${Name}ErrorCode } from "${alias}/errors.js";`,
  `export { create${Name} } from "${alias}/runtime-objects/${leaf}/constructor.js";`,
  `export type { ${Name} } from "${alias}/runtime-objects/${leaf}/definition.js";`,
  `export type { ${Name}Id } from "${alias}/types/ids.js";`
];

plan(
  join(capabilityRoot, "index.ts"),
  `// The only file another capability may import, and the only place that decides
// what leaves. Everything re-exported here is a promise to a consumer; anything
// absent is free to change without one.
${exports.join("\n")}
`
);

// ---- errors.ts

plan(
  join(capabilityRoot, "errors.ts"),
  `/**
 * Every failure ${displayName} reports.
 *
 * The codes sit at the capability root rather than in \`types/\` because a
 * consumer that catches one is using the public contract: it branches on the
 * code, so renaming one is a breaking change.
 */
export type ${Name}ErrorCode =
  // TODO: replace with the conditions this capability actually reports.
  | "not-found";

export class ${Name}Error extends Error {
  constructor(
    readonly code: ${Name}ErrorCode,
    message: string
  ) {
    super(message);
    this.name = "${Name}Error";
  }
}
`
);

// ---- types/

plan(
  join(capabilityRoot, "types", "types.md"),
  render("types.md", shared, (text) =>
    // Only ids.ts exists yet. A row for a file nobody has written claims a shape
    // that is not there; add the row with the file.
    dropLines(dropLines(text, "`runtime-inputs.ts`"), "`runtime-results.ts`")
  )
);

plan(
  join(capabilityRoot, "types", "ids.ts"),
  `/**
 * The identifiers ${displayName} allocates.
 *
 * The brand is what stops one kind of identifier being passed where another is
 * expected: both are strings at runtime, and \`string\` alone would let any of
 * them through. Only this capability mints one, so the cast that creates it
 * belongs beside the code that allocates the row.
 */
export type ${Name}Id = string & { readonly brand: "${Name}Id" };
`
);

// ---- runtime-objects/

plan(
  join(capabilityRoot, "runtime-objects", "runtime-objects.md"),
  render("runtime-objects.md", { ...shared, "yes / internal": "yes" }, (text) =>
    // One object, so there is no relationship between objects to describe.
    dropSection(text, "## Relationships")
  )
);

plan(
  join(capabilityRoot, "runtime-objects", leaf, `${leaf}.md`),
  render("runtime-object.md", shared)
);

plan(
  join(capabilityRoot, "runtime-objects", leaf, "definition.ts"),
  `${persisted ? `import type { ${Name}Store } from "${alias}/persistence/store.js";\n\n` : ""}/**
 * What ${displayName} offers the rest of the backend.
 *
 * Each method is a thin delegation to its \`runtime-api\` entry — no persistence
 * queries, no algorithms, no wire decoding. Declaring one here is a decision
 * about the public contract, which is why \`pnpm new-runtime-api\` creates the
 * directory but leaves this file to you.
 */
export interface ${Name} {
  // TODO: declare one method per public operation, then run
  // \`pnpm new-runtime-api ${capabilityPath} <methodName>\` for each.
  // Until the two agree, lint rule 6 fails and says which side is missing.
}

/**
 * TODO: rename this class after the strategy it commits to, the way
 * \`InMemoryDataManager\`, \`SnapshotConfiguration\`, and \`PGliteDatabaseRuntime\`
 * do — the interface is the contract, the class is one way of keeping it.
 */
export class ${Name}Runtime implements ${Name} {${
    persisted ? `\n  constructor(private readonly store: ${Name}Store) {}\n` : ""
  }}
`
);

plan(
  join(capabilityRoot, "runtime-objects", leaf, "constructor.ts"),
  persisted
    ? `import type { Kysely } from "kysely";
import type { BackendDatabase } from "#persistence";
import { create${Name}Tables } from "${alias}/persistence/schema.js";
import { create${Name}Store } from "${alias}/persistence/store.js";
import type { ${Name} } from "${alias}/runtime-objects/${leaf}/definition.js";
import { ${Name}Runtime } from "${alias}/runtime-objects/${leaf}/definition.js";

/**
 * Creates the one ${displayName} for a backend runtime.
 *
 * This is the only place that performs startup work. The tables are created
 * here rather than lazily on first use, so a schema failure stops the process
 * instead of surfacing much later as a request error nobody can place.
 */
export const create${Name} = async (
  database: Kysely<BackendDatabase>
): Promise<${Name}> => {
  await create${Name}Tables(database);
  return new ${Name}Runtime(create${Name}Store(database));
};
`
    : `import type { ${Name} } from "${alias}/runtime-objects/${leaf}/definition.js";
import { ${Name}Runtime } from "${alias}/runtime-objects/${leaf}/definition.js";

/**
 * Creates the one ${displayName} for a backend runtime. This is the only place
 * that performs startup work, and it returns the interface rather than the class
 * so no caller can reach past the contract.
 */
export const create${Name} = (): ${Name} => new ${Name}Runtime();
`
);

// ---- persistence/

if (persisted) {
  plan(
    join(capabilityRoot, "persistence", "persistence.md"),
    render("persistence.md", shared)
  );

  plan(
    join(capabilityRoot, "persistence", "stored-types.ts"),
    `/**
 * ${displayName} rows exactly as they are stored.
 *
 * These are deliberately not the canonical types in \`types/\`. A stored row can
 * carry a serialized column, a denormalized ordering key, or a column that
 * exists only to be queried; keeping the two apart is what stops a row being
 * handed to a consumer as if it were the model.
 */
export interface Stored${Name} {
  // TODO: replace with the columns this capability stores.
  readonly id: string;
}
`
  );

  plan(
    join(capabilityRoot, "persistence", "schema.ts"),
    `import type { Kysely } from "kysely";
import type { BackendDatabase } from "#persistence";
import type { Stored${Name} } from "${alias}/persistence/stored-types.js";

/**
 * Kysely learns about this capability's tables by declaration merging.
 *
 * The augmentation names the module that declares the interface rather than the
 * persistence capability's index, because that is the module TypeScript merges
 * into. It is the one documented exception to reaching another capability only
 * through its bare alias.
 */
declare module "#persistence/types/database.js" {
  interface BackendDatabase {
    // TODO: rename to the table this capability owns. The key is its SQL name.
    ${table}: Stored${Name};
  }
}

/**
 * Creates this capability's tables if they are absent. Called once, from
 * \`constructor.ts\`, so the schema exists before any method can read it.
 */
export const create${Name}Tables = async (
  database: Kysely<BackendDatabase>
): Promise<void> => {
  await database.schema
    .createTable("${table}")
    .ifNotExists()
    // TODO: replace with this table's real columns, keys, and indexes.
    .addColumn("id", "text", (column) => column.primaryKey())
    .execute();
};
`
  );

  plan(
    join(capabilityRoot, "persistence", "store.ts"),
    `import type { Kysely } from "kysely";
import type { BackendDatabase } from "#persistence";
import type { Stored${Name} } from "${alias}/persistence/stored-types.js";

/**
 * The table interface: ordered reads and transaction-scoped writes.
 *
 * It decides no capability behavior. A \`runtime-api\` entry opens the
 * transaction and decides what the capability does; the store executes what it
 * is asked for, which is what keeps behavior out of this directory.
 */
export interface ${Name}Store {
  read(id: string): Promise<Stored${Name} | undefined>;
}

export const create${Name}Store = (database: Kysely<BackendDatabase>): ${Name}Store => ({
  // TODO: replace with the reads and writes this capability's runtime-api needs.
  read: (id) =>
    database
      .selectFrom("${table}")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst()
});
`
  );
}

// ---- endpoints/

if (withEndpoints) {
  plan(
    join(capabilityRoot, "endpoints", "endpoints.md"),
    render(
      "endpoints.md",
      { ...shared, CapabilityHttpError: `${Name}HttpError` },
      (text) =>
        relinkMain(text, mainFromEndpoints).replace(
          "{{registerCapabilityEndpoints}}(registry, {{runtimeObject}})",
          `register${Name}Endpoints(registry)`
        )
    )
  );

  plan(
    join(capabilityRoot, "endpoints", "register.ts"),
    `import type { RouteRegistry } from "#registry/registry.js";

/**
 * Every endpoint ${displayName} serves, mapped to the job that answers it.
 *
 * Registration only: no decoding, no capability behavior. \`main.ts\` calls this
 * once before the server listens, and the registry throws on a duplicate
 * endpoint because that is always a wiring bug rather than a request failure.
 */
export const register${Name}Endpoints = (registry: RouteRegistry): void => {
  // TODO: \`pnpm new-endpoint ${capabilityPath} <endpoint-name>\` appends one
  // registration here per endpoint. Add the runtime object as a second
  // parameter once a job needs it, and pass it from main.ts.
};
`
  );
}

// ---- test/
//
// Only bruno/ is created, because only bruno/ has a file to put in it: a
// collection is rooted at the directory holding its bruno.json, so every
// capability needs its own. unit/, regression/, and non-functional/ would be
// empty directories, which the template forbids and which this package cannot
// express anyway — it keeps no .gitkeep files. They are printed instead.

plan(
  join(capabilityRoot, "test", "bruno", "bruno.json"),
  `${JSON.stringify({ version: "1", name: leaf, type: "collection" }, null, 2)}\n`
);

writePlanned();

// ---------------------------------------------------------------- report ----

console.log(`new-capability: ${planned.length} files under src/capabilities/${capabilityPath} (${alias})\n`);
for (const { path } of planned) console.log(`  ${at(path)}`);

const construction = persisted
  ? `const ${name} = await create${Name}(database.database);`
  : `const ${name} = create${Name}();`;

console.log(`
Do these yourself — a generator cannot decide them:

  src/main.ts  construct the capability during startup and hold it on Runtime:
      import { create${Name}, type ${Name} } from "${alias}";
      ${construction}${
        withEndpoints
          ? `\n      import { register${Name}Endpoints } from "${alias}";\n      register${Name}Endpoints(registry);`
          : ""
      }

  package.json / tsconfig.json  "${alias}" and "${alias}/*" are declared already,
      in imports and in paths. This script added neither: it read them, so that
      every import it wrote uses the capability's own alias rather than a guess.

  src/capabilities/${capabilityPath}/test  create unit/, regression/, or
      non-functional/ with the first test that needs one. They are not created
      empty — an unused directory is absent, and this package keeps no .gitkeep.

  src/capabilities/${capabilityPath}/runtime-objects/${leaf}/definition.ts
      declare the interface's methods, then run
      \`pnpm new-runtime-api ${capabilityPath} <methodName>\` for each.
`);
