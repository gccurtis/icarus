#!/usr/bin/env node
/**
 * Scaffolds one runtime-api method directory. No dependencies — just Node, like
 * the lint scripts this exists to satisfy.
 *
 * See docs/capability-directory/capability-directory.md. One directory per public method,
 * named after the method in kebab-case, holding an entry file of the same name
 * that owns that method's complete orchestration.
 *
 * It deliberately does not touch `definition.ts`. Declaring a method on the
 * interface is a decision about the capability's public contract, and a
 * generator that made it for you would be adding to the contract on your behalf.
 * Lint rule 6 compares the interface to these directories in both directions, so
 * the omission is caught either way — and until you declare it, `pnpm lint`
 * reports exactly this directory. That failure is the reminder, not a bug.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const templatesRoot = join(packageRoot, "docs", "templates");

const USAGE = `usage: pnpm new-runtime-api <capability-path> <methodName>

  <capability-path>  relative to src/capabilities, e.g. resource-general/slide
  <methodName>       camelCase, exactly as it appears on the interface`;

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

const pascal = (kebab) =>
  kebab.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
const title = (kebab) =>
  kebab.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
/** The same transform lint rule 6 applies, so both agree on the directory name. */
const kebabOf = (method) => method.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

// ----------------------------------------------------------------- alias ----

const packageJson = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
const importsMap = packageJson.imports ?? {};

const sourceTarget = (value) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    return value.development ?? value.types ?? value.default ?? null;
  }
  return null;
};

/**
 * The capability's own alias, found by matching the alias map's targets against
 * the capability's path rather than guessing it from the directory name — the
 * two disagree often enough to matter (`data/manager` is `#data-manager`), and a
 * guess produces imports that resolve to nothing.
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

  if (bare === null || inside === null || bare !== inside) {
    fail(
      "package.json",
      `no alias pair declares src/capabilities/${capabilityPath} — declare "#${capabilityPath
        .split("/")
        .pop()}" and its "/*" form in imports and in tsconfig.json paths first`
    );
    return null;
  }
  return bare;
};

// ------------------------------------------------------------- templates ----

const collapse = (text) => text.replace(/\s+/g, " ").trim();
const PLACEHOLDER = /\{\{([^{}]*?)\}\}/g;

/**
 * What an unsubstituted placeholder becomes. A one-word placeholder keeps its
 * shape — `TODO-file-name`, not `TODO: file-name` — because it usually stands in
 * for part of a path or a link target, where a space turns a dangling link into
 * a malformed one. Both forms start with TODO, so one grep finds every decision
 * a generated document is still waiting on.
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
 * Renders a document template. Known placeholders are substituted; everything
 * left needs a decision only the author can make, so it becomes a marked TODO
 * rather than a silent blank. No `{{...}}` reaches a capability.
 */
const render = (templateName, values, edit = (text) => text) => {
  let text = edit(readFileSync(join(templatesRoot, templateName), "utf8"));

  text = text.replace(PLACEHOLDER, (_, inner) => `{{${collapse(inner)}}}`);
  text = text.replace(PLACEHOLDER, (match, inner) => {
    const quoted = inner.startsWith("`") && inner.endsWith("`");
    const key = inner.replace(/`/g, "").trim();
    if (!Object.hasOwn(values, key)) return match;
    return quoted ? `\`${values[key]}\`` : values[key];
  });

  // An example declaration nobody has written yet is worth less than an honest
  // instruction: `export interface TODO: TypeName` helps no one.
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

// --------------------------------------------------------------- writing ----

const planned = [];
const plan = (path, contents) => planned.push({ path, contents });

const writePlanned = (name) => {
  for (const { path } of planned.filter((entry) => existsSync(entry.path))) {
    fail(at(path), "already exists — creating is not overwriting");
  }
  stopIfFailed(name);
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
if (argv.length !== 2 || argv.some((argument) => argument.startsWith("--"))) {
  fail("argv", `expected a capability path and a method name\n\n${USAGE}`);
}
stopIfFailed("new-runtime-api");

const capabilityPath = argv[0].replace(/^\/+|\/+$/g, "");
const method = argv[1];

if (!/^[a-z][A-Za-z0-9]*$/.test(method)) {
  fail("argv", `'${method}' is not camelCase — pass the method name as it appears on the interface`);
}
if (method === "shared") {
  // `shared/` is where a procedure lands once a second method needs it, so it
  // can never be a method's own directory.
  fail("argv", "'shared' is reserved for procedures promoted out of a method directory");
}
stopIfFailed("new-runtime-api");

const capabilityRoot = join(packageRoot, "src", "capabilities", capabilityPath);
if (!existsSync(join(capabilityRoot, "index.ts"))) {
  fail(
    `src/capabilities/${capabilityPath}`,
    "no capability here — run `pnpm new-capability` first"
  );
}
stopIfFailed("new-runtime-api");

const alias = aliasFor(capabilityPath);
stopIfFailed("new-runtime-api");

/**
 * The runtime object whose interface this method joins.
 *
 * Only an exported object has a public API to describe: an internal object is
 * constructed for injection inside its capability and gets no `runtime-api`
 * directories at all, so refusing here is the rule rather than an obstacle.
 */
const exportedObject = () => {
  const indexSource = readFileSync(join(capabilityRoot, "index.ts"), "utf8");
  const objectsRoot = join(capabilityRoot, "runtime-objects");
  if (!existsSync(objectsRoot)) return null;

  for (const entry of readdirSync(objectsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!indexSource.includes(`runtime-objects/${entry.name}/definition.js`)) continue;
    const definition = join(objectsRoot, entry.name, "definition.ts");
    const source = existsSync(definition) ? readFileSync(definition, "utf8") : "";
    const declared = source.match(/export interface (\w+)/);
    return { directory: entry.name, name: declared ? declared[1] : pascal(entry.name) };
  }
  return null;
};

const object = exportedObject();
if (object === null) {
  fail(
    `src/capabilities/${capabilityPath}/index.ts`,
    "no runtime object is exported from index.ts — runtime-api/ describes an exported object's public methods, and an internal object has none"
  );
}
stopIfFailed("new-runtime-api");

const directory = kebabOf(method);
const apiRoot = join(capabilityRoot, "runtime-api");
const methodRoot = join(apiRoot, directory);
const displayName = title(alias.slice(1));

const values = {
  "Capability Name": displayName,
  RuntimeObjectName: object.name,
  methodName: method,
  "method-name": directory
};

// ---- runtime-api/runtime-api.md, when this is the capability's first method

const apiDocument = join(apiRoot, "runtime-api.md");
const firstMethod = !existsSync(apiDocument);
if (firstMethod) {
  plan(
    apiDocument,
    render("runtime-api.md", {
      ...values,
      "Summarize what lives in shared/ and why, or state that no procedure has been promoted yet.":
        "No procedure has been promoted yet — `shared/` does not exist. A procedure moves there when a second method needs it, not when a second call site wants the same code."
    })
  );
}

// ---- runtime-api/<method>/

plan(join(methodRoot, `${directory}.md`), render("runtime-api-method.md", values));

plan(
  join(methodRoot, `${directory}.ts`),
  `/**
 * \`${object.name}.${method}\` — this file owns the method's whole procedure.
 *
 * Everything the method does lives here or beside it in this directory;
 * \`definition.ts\` does nothing but delegate. A procedure a second method needs
 * moves to \`../shared/\`, never imported across method directories.
 *
 * The stub returns \`never\` so a delegation from the interface typechecks before
 * the real signature exists: replace both together, and the return type with it.
 */
export const ${method} = (): never => {
  throw new Error("${object.name}.${method} is not implemented");
};
`
);

writePlanned("new-runtime-api");

// ---------------------------------------------------------------- report ----

console.log(`new-runtime-api: ${planned.length} files under src/capabilities/${capabilityPath}/runtime-api/${directory} (${alias})\n`);
for (const { path } of planned) console.log(`  ${at(path)}`);

console.log(`
Do these yourself — a generator cannot decide them:

  src/capabilities/${capabilityPath}/runtime-objects/${object.directory}/definition.ts
      declare \`${method}\` on the \`${object.name}\` interface and delegate to this
      entry:

        import { ${method} } from "${alias}/runtime-api/${directory}/${directory}.js";

      Declaring a method is a decision about the public contract, so nothing does
      it for you. \`pnpm lint\` fails with

        src/capabilities/${capabilityPath}/runtime-api/${directory}  no method named '${directory}' on the ${object.directory} interface

      until you do. That is rule 6 working, not a broken scaffold.
${
  firstMethod
    ? ""
    : `
  src/capabilities/${capabilityPath}/runtime-api/runtime-api.md
      add \`${method}\` to the Methods table. The table and the directories have to
      list the same methods, and only the first one is written for you.
`
}
  src/capabilities/${capabilityPath}/overview.md
      add \`${method}\` to the Public API table.
`);
