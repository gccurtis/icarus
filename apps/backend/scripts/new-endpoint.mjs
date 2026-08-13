#!/usr/bin/env node
/**
 * Scaffolds one endpoint directory. No dependencies — just Node, like the lint
 * scripts this exists to satisfy.
 *
 * See docs/capability-directory-redesign.md. An endpoint is a directory holding
 * its document, `job.ts`, and — when it admits input — `wire/`.
 *
 * `procedures/` is never generated. A job starts as a pass-through, and that
 * directory arrives only when someone decides the job composes work of its own.
 * Its presence is the review signal that a decision was made, which is worth a
 * deliberate `mkdir` and a written justification in `procedures/procedures.md`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const templatesRoot = join(packageRoot, "docs", "templates");

const USAGE = `usage: pnpm new-endpoint <capability-path> <endpoint-name> [--no-wire]

  <capability-path>  relative to src/capabilities, e.g. resource-general/slide
  <endpoint-name>    kebab-case, e.g. documents-command
  --no-wire          omit wire/ for an endpoint that admits no input`;

const problems = [];
const notes = [];
const at = (absolute) => relative(packageRoot, absolute);
const fail = (path, message) => problems.push(`${path}  ${message}`);

/** Reports in the `path  message` format both lint scripts use, then stops. */
const stopIfFailed = (name) => {
  if (problems.length === 0) return;
  console.error(`${name}: ${problems.length} problem${problems.length === 1 ? "" : "s"}\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error("\nSee apps/backend/docs/capability-directory-redesign.md.");
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

  text = text.replace(/```ts\n[\s\S]*?\n```/g, (block) =>
    block.includes("{{")
      ? `TODO: write the declaration this section describes — docs/templates/${templateName} shows the shape.`
      : block
  );

  text = text.replace(PLACEHOLDER, (_, inner) => todo(inner));

  if (text.includes("{{") || text.includes("}}")) {
    fail(`docs/templates/${templateName}`, "a placeholder survived rendering — this is a generator bug");
  }
  return reflow(text);
};

/** Removes a `##` section whole. Used for sections an endpoint cannot have. */
const dropSection = (text, heading) => {
  const start = text.indexOf(`\n${heading}\n`);
  if (start === -1) return text;
  const next = text.indexOf("\n## ", start + 1);
  return next === -1 ? text.slice(0, start + 1) : text.slice(0, start + 1) + text.slice(next + 1);
};

// --------------------------------------------------------------- writing ----

const planned = [];
const plan = (path, contents) => planned.push({ path, contents });

const writePlanned = (name) => {
  for (const { path } of planned.filter((entry) => existsSync(entry.path))) {
    fail(at(path), "already exists — creating an endpoint is not overwriting one");
  }
  stopIfFailed(name);
  for (const { path, contents } of planned) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
  }
};

/**
 * Adds one endpoint's import and registration to `register.ts`.
 *
 * The file is edited rather than rewritten, so a hand-written register.ts keeps
 * whatever it already says. When its shape is not recognizable — a multi-line
 * import, a body that does not close on its own line — nothing is changed and
 * the two lines are printed instead. Half-applying an edit to someone's
 * registration file is worse than asking them to paste it.
 */
const addRegistration = (source, importLine, registration) => {
  const lines = source.split("\n");

  const imports = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.startsWith("import ") && line.endsWith(";"));
  if (imports.length === 0) return null;

  const specifierOf = (line) => line.match(/from "([^"]+)"/)?.[1] ?? "";
  const specifier = specifierOf(importLine);
  const after = imports.find(({ line }) => specifierOf(line) > specifier);
  const importAt = after ? after.index : imports[imports.length - 1].index + 1;

  const closing = lines.reduce(
    (found, line, index) => (line.trim() === "};" ? index : found),
    -1
  );
  if (closing === -1 || closing < importAt) return null;

  const updated = [...lines];
  updated.splice(closing, 0, ...registration);
  updated.splice(importAt, 0, importLine);
  return updated.join("\n");
};

// ---------------------------------------------------------------- script ----

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.length === 0) {
  console.log(USAGE);
  process.exit(argv.length === 0 ? 1 : 0);
}

const flags = argv.filter((argument) => argument.startsWith("--"));
const positional = argv.filter((argument) => !argument.startsWith("--"));
const noWire = flags.includes("--no-wire");

for (const flag of flags) {
  if (flag !== "--no-wire") fail("argv", `unknown flag '${flag}'\n\n${USAGE}`);
}
if (positional.length !== 2) {
  fail("argv", `expected a capability path and an endpoint name\n\n${USAGE}`);
}
stopIfFailed("new-endpoint");

const capabilityPath = positional[0].replace(/^\/+|\/+$/g, "");
const endpoint = positional[1];

if (!KEBAB.test(endpoint)) {
  fail("argv", `'${endpoint}' is not kebab-case — rule 8`);
}
if (endpoint === "register" || endpoint === "endpoints") {
  fail("argv", `'${endpoint}' collides with endpoints/${endpoint}.ts or its document`);
}
stopIfFailed("new-endpoint");

const capabilityRoot = join(packageRoot, "src", "capabilities", capabilityPath);
if (!existsSync(join(capabilityRoot, "index.ts"))) {
  fail(
    `src/capabilities/${capabilityPath}`,
    "no capability here — run `pnpm new-capability` first"
  );
}
stopIfFailed("new-endpoint");

const alias = aliasFor(capabilityPath);
stopIfFailed("new-endpoint");

const displayName = title(alias.slice(1));
const Capability = pascal(alias.slice(1));
const Endpoint = pascal(endpoint);
const jobName = `${camel(endpoint)}Job`;

// The method and path are the endpoint's identity, and only its author knows
// them. They are written as marked TODOs rather than a plausible guess: a guessed
// route that reads like a real one is the kind of thing that ships.
const METHOD = "TODO-METHOD";
const path = `/TODO-${endpoint}`;

const endpointsRoot = join(capabilityRoot, "endpoints");
const endpointRoot = join(endpointsRoot, endpoint);
const wireRoot = join(endpointRoot, "wire");

// The endpoints document links `src/main.ts` by a path that depends on how
// deeply the capability is grouped. The template carries one depth; only the
// generator knows the real one, and a dangling link is what this migration
// started by repairing.
const mainFromEndpoints = `${"../".repeat(capabilityPath.split("/").length + 2)}main.ts`;

const requestType = `${Endpoint}Request`;
const responseType = `${Endpoint}Response`;
const decodeName = `decode${Endpoint}Request`;

// ---- endpoints/endpoints.md and endpoints/register.ts, when the first endpoint

const endpointsDocument = join(endpointsRoot, "endpoints.md");
const registerFile = join(endpointsRoot, "register.ts");
const firstEndpoint = !existsSync(endpointsDocument);

if (firstEndpoint) {
  plan(
    endpointsDocument,
    render(
      "endpoints.md",
      {
        "Capability Name": displayName,
        CapabilityHttpError: `${Capability}HttpError`,
        METHOD,
        "/path": path,
        "endpoint-name": endpoint
      },
      (text) =>
        text
          .replace(/\]\((?:\.\.\/)+(?:src\/)?main\.ts\)/g, `](${mainFromEndpoints})`)
          .replace(
            "{{registerCapabilityEndpoints}}(registry, {{runtimeObject}})",
            `register${Capability}Endpoints(registry)`
          )
    )
  );
}

const registerCreated = !existsSync(registerFile);
if (registerCreated) {
  plan(
    registerFile,
    `import type { RouteRegistry } from "#registry/registry.js";

/**
 * Every endpoint ${displayName} serves, mapped to the job that answers it.
 *
 * Registration only: no decoding, no capability behavior. \`main.ts\` calls this
 * once before the server listens, and the registry throws on a duplicate
 * endpoint because that is always a wiring bug rather than a request failure.
 */
export const register${Capability}Endpoints = (registry: RouteRegistry): void => {
};
`
  );
}

// ---- endpoints/<endpoint>/

plan(
  join(endpointRoot, `${endpoint}.md`),
  render(
    "endpoint.md",
    {
      "Capability Name": displayName,
      METHOD,
      "/path": path,
      "endpoint-name": endpoint,
      RuntimeObjectName: `${Capability}`,
      "pass-through to a runtime method / composes its own work":
        "pass-through to a runtime method",
      "yes, via wire/ / no": noWire ? "no" : "yes, via `wire/`",
      'or "none — see procedures/"': '— or "none" when the job composes its own work',
      RequestName: requestType,
      ResponseName: responseType
    },
    (text) => {
      if (!noWire) {
        // The document shows what wire/ actually declares, so the two agree the
        // moment they are written rather than after someone reconciles them.
        return text
          .replace(
            /export interface \{\{RequestName\}\} \{[\s\S]*?\n\}/,
            `export interface ${requestType} {\n  readonly body: unknown;\n}`
          )
          .replace(
            /export interface \{\{ResponseName\}\} \{[\s\S]*?\n\}/,
            `export interface ${responseType} {\n  readonly admitted: unknown;\n}`
          );
      }
      // An endpoint admitting no input has nothing to describe under Request or
      // Admission Rules, no wire/ for them to describe, and no decoding step in
      // its work procedure. The step is replaced rather than removed so the
      // numbering the rest of the tree refers to still holds.
      return dropSection(dropSection(text, "## Request"), "## Admission Rules").replace(
        `  2. Strictly decode the body as {{RequestName}}.
     || admission fails
        2.a.1. Return 400 with the stable invalid-request body.`,
        "  2. Read nothing from the envelope: this endpoint admits no input."
      );
    }
  )
);

plan(
  join(endpointRoot, "job.ts"),
  noWire
    ? `import type { EndpointJob } from "#registry/registry.js";

/**
 * \`${METHOD} ${path}\`
 *
 * It admits no input, so it has no \`wire/\`: the request envelope is never read,
 * and there is nothing to reject before the work runs.
 */
export const ${jobName}: EndpointJob = async () => {
  // TODO: produce this endpoint's response body. Map expected failures onto the
  // statuses in ../endpoints.md; throw on anything unexpected, so the web server
  // logs the fault and returns 500 rather than inventing a response.
  return { statusCode: 200, body: {} };
};
`
    : `import type { EndpointJob } from "#registry/registry.js";
import { ${decodeName} } from "${alias}/endpoints/${endpoint}/wire/decode.js";
import type { ${responseType} } from "${alias}/endpoints/${endpoint}/wire/response.js";

/**
 * \`${METHOD} ${path}\`
 *
 * A pass-through job: decode, call one runtime method, map the result. If it
 * ever does more than that it needs a \`procedures/\` directory, and its document
 * has to say why that work does not belong on the runtime object instead.
 */
export const ${jobName}: EndpointJob = async (request) => {
  const admitted = ${decodeName}(request);

  // TODO: call the runtime method this endpoint exists to reach, and map its
  // expected failures onto the statuses in ../endpoints.md. An unexpected error
  // is thrown rather than converted: the web server logs the fault and answers
  // 500, so a bug never reaches a client as a well-formed response.
  const body: ${responseType} = { admitted };

  return { statusCode: 200, body };
};
`
);

if (!noWire) {
  plan(
    join(wireRoot, "request.ts"),
    `/**
 * What \`${METHOD} ${path}\` admits, after decoding.
 *
 * This is a trusted value: [\`decode.ts\`](decode.ts) produces it from the request
 * envelope, and the job never sees the envelope itself. That is the whole point
 * of the type — it cannot be constructed by an untrusted caller.
 */
export interface ${requestType} {
  // TODO: one readonly field per admitted value.
  readonly body: unknown;
}
`
  );

  plan(
    join(wireRoot, "decode.ts"),
    `import type { ${requestType} } from "${alias}/endpoints/${endpoint}/wire/request.js";
import type { RequestEnvelope } from "#web-server";

/**
 * Admits one \`${METHOD} ${path}\` request.
 *
 * HTTP supplies untrusted JSON, not a trusted input value, even when the two
 * look identical in TypeScript — making that difference real is why \`wire/\`
 * exists. Everything rejected here is rejected before the runtime is called.
 */
export const ${decodeName} = (
  envelope: RequestEnvelope
): ${requestType} => ({
  // TODO: reject missing and extra keys, unknown discriminants, values outside
  // this capability's limits, non-finite numbers, and malformed identifiers.
  body: envelope.body
});
`
  );

  plan(
    join(wireRoot, "response.ts"),
    `/** The JSON \`${METHOD} ${path}\` returns. */
export interface ${responseType} {
  // TODO: one readonly field per value the endpoint returns.
  readonly admitted: unknown;
}
`
  );
}

writePlanned("new-endpoint");

// ---- the registration line, appended to register.ts

const importLine = `import { ${jobName} } from "${alias}/endpoints/${endpoint}/job.js";`;
const registration = [
  `  // TODO: replace ${METHOD} and ${path} with this endpoint's real identity.`,
  `  registry.register({ method: "${METHOD}", path: "${path}" }, ${jobName});`
];

const registerSource = readFileSync(registerFile, "utf8");
const registered = addRegistration(registerSource, importLine, registration);
if (registered === null) {
  notes.push(
    `${at(registerFile)}  could not place the registration — add it yourself:\n` +
      `      ${importLine}\n` +
      registration.map((line) => `    ${line}`).join("\n")
  );
} else {
  writeFileSync(registerFile, registered);
}

// ---------------------------------------------------------------- report ----

console.log(`new-endpoint: ${planned.length} files under src/capabilities/${capabilityPath}/endpoints/${endpoint} (${alias})\n`);
for (const { path: created } of planned) console.log(`  ${at(created)}`);
if (registered !== null) {
  console.log(`  ${at(registerFile)}  registration appended`);
}

console.log("\nDo these yourself — a generator cannot decide them:\n");
for (const note of notes) console.log(`  ${note}\n`);

console.log(`  src/capabilities/${capabilityPath}/endpoints/${endpoint}/${endpoint}.md
      replace ${METHOD} and ${path} with the endpoint's identity, here and in
      register.ts, job.ts, and wire/. The method and path are the endpoint's
      public contract, so nothing guesses them for you.
`);

if (!firstEndpoint) {
  console.log(`  src/capabilities/${capabilityPath}/endpoints/endpoints.md
      add ${endpoint} to the Endpoint Surface table. Only the first endpoint's row
      is written for you.
`);
}

if (registerCreated) {
  console.log(`  src/capabilities/${capabilityPath}/index.ts
      re-export register${Capability}Endpoints, and call it from src/main.ts before
      the server listens. Registration is wiring, and wiring is main.ts's job.
`);
}

console.log(`  src/capabilities/${capabilityPath}/overview.md
      add the endpoint to the Public API table.
`);
