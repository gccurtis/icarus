#!/usr/bin/env node
/**
 * Enforces the capability directory template. No dependencies — just Node.
 * See docs/capability-directory-redesign.md, which this script is the
 * machine-checked half of.
 *
 * The template exists so review is mechanical: a directory name means the same
 * thing wherever it appears, and every directory explains itself in a document
 * named after it. Both of those are only true if something checks.
 *
 * MIGRATED lists the capabilities already moved onto the template. It exists so
 * the rules can be enforced from the first migrated capability onward instead of
 * waiting for the last one — a capability is appended as its migration lands,
 * and the list is deleted once every capability is on the template, at which
 * point the whole tree is scanned.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const capabilitiesRoot = join(packageRoot, "src", "capabilities");

/** Paths relative to src/capabilities. Append one per migration. */
const MIGRATED = [
  "built-in",
  "data/manager",
  "platform/configuration",
  "platform/observability",
  "platform/persistence",
  "platform/web-server"
];

const ALLOWED_DIRS = new Set([
  "docs",
  "types",
  "runtime-objects",
  "runtime-api",
  "persistence",
  "endpoints",
  "test"
]);
const ALLOWED_ROOT_FILES = new Set(["overview.md", "index.ts", "errors.ts"]);
const PERSISTENCE_FILES = new Set([
  "persistence.md",
  "schema.ts",
  "stored-types.ts",
  "store.ts"
]);
/** Directories that carry no document: their contents are described elsewhere. */
const UNDOCUMENTED = new Set(["test", "wire", "docs"]);
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const failures = [];
const at = (absolute) => relative(packageRoot, absolute);
const fail = (absolute, message) => failures.push(`${at(absolute)}  ${message}`);

const entries = (dir) => readdirSync(dir, { withFileTypes: true });
const dirsIn = (dir) => entries(dir).filter((e) => e.isDirectory()).map((e) => e.name);
const filesIn = (dir) => entries(dir).filter((e) => e.isFile()).map((e) => e.name);

/**
 * Rule 12: a directory explains itself in a document named after it. The
 * capability root's document is `overview.md` rather than the capability's own
 * name, because it is the entry point rather than one more directory.
 */
const requireDocument = (dir, name) => {
  if (!filesIn(dir).includes(`${name}.md`)) {
    fail(dir, `missing document '${name}.md' — every directory explains itself`);
  }
};

/** Rule 13: a document sits in the directory it is named after, or in docs/. */
const checkDocumentPlacement = (dir, capabilityRoot) => {
  const name = dir === capabilityRoot ? "overview" : dir.split("/").pop();
  for (const file of filesIn(dir)) {
    if (!file.endsWith(".md")) continue;
    if (file === `${name}.md`) continue;
    fail(
      join(dir, file),
      `document does not match its directory — expected '${name}.md', or move it to docs/`
    );
  }
};

const walkDirectories = (dir, visit, capabilityRoot) => {
  visit(dir, capabilityRoot);
  for (const name of dirsIn(dir)) {
    if (UNDOCUMENTED.has(name)) continue;
    walkDirectories(join(dir, name), visit, capabilityRoot);
  }
};

/**
 * Rule 6: the interface a runtime object exports and its runtime-api directories
 * must describe the same set of methods.
 *
 * This reads the interface block with a regex. A type-aware check would need the
 * TypeScript compiler API, which these scripts deliberately do not depend on, so
 * a sufficiently creative rename can defeat it — the review checklist covers the
 * gap. It is still worth having: it catches a method implemented inline in
 * definition.ts, and a directory orphaned by a rename.
 */
const interfaceMethods = (definitionFile) => {
  const source = readFileSync(definitionFile, "utf8");
  const block = source.match(/export interface \w+\s*\{([\s\S]*?)\n\}/);
  if (!block) return null;
  return [...block[1].matchAll(/^\s{2}(\w+)\s*[(<]/gm)].map(([, name]) => name);
};

const kebabOf = (method) => method.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

const checkRuntimeObjects = (capabilityRoot, indexSource) => {
  const dir = join(capabilityRoot, "runtime-objects");
  if (!existsSync(dir)) return;
  requireDocument(dir, "runtime-objects");

  for (const object of dirsIn(dir)) {
    const objectDir = join(dir, object);
    const present = new Set(filesIn(objectDir));
    for (const required of [`${object}.md`, "definition.ts", "constructor.ts"]) {
      if (!present.delete(required)) fail(objectDir, `missing '${required}'`);
    }
    for (const extra of present) {
      fail(join(objectDir, extra), "a runtime object is exactly its document, definition, and constructor");
    }

    // Only an object the capability exports has a public API to describe.
    const definition = join(objectDir, "definition.ts");
    const exported = indexSource.includes(`runtime-objects/${object}/definition.js`);
    if (!exported || !existsSync(definition)) continue;

    const methods = interfaceMethods(definition);
    if (methods === null) continue;
    const apiRoot = join(capabilityRoot, "runtime-api");
    const directories = existsSync(apiRoot)
      ? dirsIn(apiRoot).filter((name) => name !== "shared")
      : [];

    for (const method of methods) {
      if (!directories.includes(kebabOf(method))) {
        fail(apiRoot, `'${method}' is on the ${object} interface but has no directory`);
      }
    }
    for (const directory of directories) {
      if (!methods.some((method) => kebabOf(method) === directory)) {
        fail(join(apiRoot, directory), `no method named '${directory}' on the ${object} interface`);
      }
    }
  }
};

const checkRuntimeApi = (capabilityRoot) => {
  const dir = join(capabilityRoot, "runtime-api");
  if (!existsSync(dir)) return;
  requireDocument(dir, "runtime-api");
  for (const method of dirsIn(dir)) {
    if (method === "shared") continue;
    if (!filesIn(join(dir, method)).includes(`${method}.ts`)) {
      fail(join(dir, method), `missing entry file '${method}.ts'`);
    }
  }
};

const checkPersistence = (capabilityRoot) => {
  const dir = join(capabilityRoot, "persistence");
  if (!existsSync(dir)) return;
  for (const file of filesIn(dir)) {
    if (!PERSISTENCE_FILES.has(file)) {
      fail(join(dir, file), "persistence/ holds storage only — schema, stored types, store");
    }
  }
};

const checkEndpoints = (capabilityRoot) => {
  const dir = join(capabilityRoot, "endpoints");
  if (!existsSync(dir)) return;
  requireDocument(dir, "endpoints");

  const files = filesIn(dir);
  if (!files.includes("register.ts")) fail(dir, "missing 'register.ts'");
  for (const file of files) {
    if (file !== "register.ts" && file !== "endpoints.md") {
      fail(join(dir, file), "endpoints/ holds registration and one directory per endpoint");
    }
  }

  for (const endpoint of dirsIn(dir)) {
    const endpointDir = join(dir, endpoint);
    if (!filesIn(endpointDir).includes("job.ts")) fail(endpointDir, "missing 'job.ts'");
    for (const child of dirsIn(endpointDir)) {
      if (child !== "wire" && child !== "procedures") {
        fail(join(endpointDir, child), "an endpoint holds only wire/ and procedures/");
      }
    }
  }
};

for (const capability of MIGRATED) {
  const capabilityRoot = join(capabilitiesRoot, capability);
  if (!existsSync(capabilityRoot)) {
    failures.push(`src/capabilities/${capability}  listed in MIGRATED but does not exist`);
    continue;
  }

  for (const file of filesIn(capabilityRoot)) {
    if (!ALLOWED_ROOT_FILES.has(file)) {
      fail(join(capabilityRoot, file), "only overview.md, index.ts, and errors.ts belong at a capability root");
    }
  }
  for (const dir of dirsIn(capabilityRoot)) {
    if (!ALLOWED_DIRS.has(dir)) {
      fail(join(capabilityRoot, dir), `unknown capability directory '${dir}' — see docs/capability-directory-redesign.md`);
    }
  }

  requireDocument(capabilityRoot, "overview");
  const indexFile = join(capabilityRoot, "index.ts");
  const indexSource = existsSync(indexFile) ? readFileSync(indexFile, "utf8") : "";

  walkDirectories(
    capabilityRoot,
    (dir, root) => {
      if (dir !== root) requireDocument(dir, dir.split("/").pop());
      checkDocumentPlacement(dir, root);
    },
    capabilityRoot
  );

  checkRuntimeObjects(capabilityRoot, indexSource);
  checkRuntimeApi(capabilityRoot);
  checkPersistence(capabilityRoot);
  checkEndpoints(capabilityRoot);
}

// Rule 8 applies to the whole source tree, not only migrated capabilities:
// nothing has to move for a name to be correct.
(function checkNames(dir) {
  if (!existsSync(dir)) return;
  for (const entry of entries(dir)) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!KEBAB.test(entry.name)) fail(path, "directory name must be kebab-case");
      checkNames(path);
    } else if (entry.name.endsWith(".ts")) {
      // `.test.ts` and friends are compound extensions: every dot-separated
      // segment of the name must be kebab-case, not the whole string at once.
      const segments = entry.name.slice(0, -3).split(".");
      if (!segments.every((segment) => KEBAB.test(segment))) {
        fail(path, "file name must be kebab-case");
      }
    }
  }
})(join(packageRoot, "src"));

if (failures.length > 0) {
  console.error(`lint-structure: ${failures.length} problem${failures.length === 1 ? "" : "s"}\n`);
  for (const failure of failures) console.error(`  ${failure}`);
  console.error("\nSee apps/backend/docs/capability-directory-redesign.md.");
  process.exit(1);
}

const scanned = MIGRATED.length;
console.log(
  `lint-structure: ${scanned} capabilit${scanned === 1 ? "y" : "ies"} on the template; names clean`
);
