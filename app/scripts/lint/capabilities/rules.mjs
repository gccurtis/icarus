/**
 * The capability standard, machine-checked. No dependencies — just Node.
 *
 * See docs/capability-directory/capability-directory.md, which this file is the
 * enforced half of. The standard exists so review is mechanical: a directory
 * name means the same thing wherever it appears, and every directory explains
 * itself in a document named after it. Both are only true if something checks.
 *
 * Exported as functions over a root rather than run directly, so the rules can
 * be tested against deliberately-broken fixture trees. A rule with a typo'd
 * condition never fires, and a linter that never fires reports success forever.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ALLOWED_DIRS = new Set(["docs", "types", "api", "test"]);

/**
 * A capability has no door. Its public surface is the registration file under
 * the deployment root, because a Convex module's path is its public name and
 * nothing outside that directory can be called.
 *
 * `schema.ts` is one file rather than a directory because a capability declares
 * tables and nothing else about storage — no queries to hold beside them, no
 * DDL. A directory would exist to hold one file and its document.
 */
const ALLOWED_ROOT_FILES = new Set(["overview.md", "errors.ts", "schema.ts"]);

/** Convex rejects a hyphen in a module path, so a door is named in camelCase. */
const camelOf = (kebab) => kebab.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

/** Every `.ts` beneath a directory, tests included — they may not register either. */
const walkTypeScript = (dir) => {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walkTypeScript(path));
    else if (entry.name.endsWith(".ts")) found.push(path);
  }
  return found;
};

/** Directories that carry no document: their contents are described elsewhere. */
const UNDOCUMENTED = new Set(["test", "docs"]);
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const entries = (dir) => readdirSync(dir, { withFileTypes: true });
const dirsIn = (dir) => entries(dir).filter((e) => e.isDirectory()).map((e) => e.name);
const filesIn = (dir) => entries(dir).filter((e) => e.isFile()).map((e) => e.name);

/**
 * A directory under capabilities/ is a capability when it holds files — every
 * capability has at least `overview.md` at its root. One holding nothing but
 * other directories is a grouping directory (`data/`, `platform/`) and is
 * recursed into.
 *
 * The tempting shortcut — "it is a capability if a child is named like a
 * template directory" — is wrong: a grouping directory could legitimately hold
 * a capability named `types`.
 *
 * A designed-but-unbuilt capability is a directory holding only `docs/`, and is
 * recognized here so the caller can skip its structure checks.
 */
export const discover = (root, prefix = "", found = []) => {
  if (!existsSync(root)) return found;
  for (const name of dirsIn(root)) {
    const path = join(root, name);
    const children = dirsIn(path);
    const relativePath = prefix ? `${prefix}/${name}` : name;
    const isCapability =
      filesIn(path).length > 0 || (children.length === 1 && children[0] === "docs");
    if (isCapability) found.push(relativePath);
    else discover(path, relativePath, found);
  }
  return found;
};

/**
 * Names exported from a barrel file.
 *
 * Regex rather than the TypeScript compiler API, which these scripts
 * deliberately do not depend on. It reads `export { a, b } from "..."` and
 * `export const c`, skipping type-only exports — a type is not a function and
 * has no `api/` directory. A sufficiently creative export can defeat it; the
 * review checklist covers the gap.
 */
export const exportedNames = (source) => {
  const names = [];
  for (const [, block] of source.matchAll(/export\s+\{([^}]*)\}/g)) {
    for (const part of block.split(",")) {
      const name = part.trim();
      if (name === "" || name.startsWith("type ")) continue;
      // `x as y` exports y.
      names.push((name.split(/\s+as\s+/).pop() ?? name).trim());
    }
  }
  for (const [, name] of source.matchAll(/export\s+(?:const|function|async function)\s+(\w+)/g)) {
    names.push(name);
  }
  return names;
};

const kebabOf = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** Import specifiers a file actually uses, in source order. */
export const importedSpecifiers = (source) => {
  const found = [];
  const pattern = /(?:\bfrom\s*|\bimport\s*|\brequire\s*\(\s*)["']([^"']+)["']/g;
  for (const [, specifier] of source.matchAll(pattern)) found.push(specifier);
  return found;
};

/**
 * Paths named in a function document's procedure tree.
 *
 * The tree is also the directory layout, so a rename that does not update the
 * tree is a detectable defect rather than a stale comment. Only tokens ending
 * in `.ts` are treated as paths — prose and SQL lines in the tree are ignored.
 *
 * Undecided procedures are ignored too, in both spellings: `{{placeholder}}` in
 * a template, and the `TODO-` marker a generator substitutes for one. A
 * procedure nobody has committed to yet is not a dangling reference, and
 * demanding a file for it would mean every scaffold is born failing.
 */
export const procedureTreePaths = (source) => {
  const heading = source.indexOf("## Procedure Tree");
  if (heading === -1) return [];
  const fence = source.slice(heading).match(/```[a-z]*\n([\s\S]*?)```/);
  if (!fence) return [];
  const paths = [];
  for (const line of fence[1].split("\n")) {
    for (const [, path] of line.matchAll(/([\w./-]+\.ts)\b/g)) {
      if (path.includes("{{") || path.includes("TODO")) continue;
      paths.push(path);
    }
  }
  return paths;
};

/**
 * Checks the shape of every capability under `root`.
 *
 * `base` is what failure paths are reported relative to — the package root in
 * the CLI, the fixture directory in a test. How files refer to each other is a
 * separate concern and lives in `checkPaths`.
 */
export const checkCapabilities = ({ root, base = root, functionsRoot }) => {
  const failures = [];
  const at = (absolute) => relative(base, absolute) || ".";
  const fail = (absolute, message) => failures.push({ path: at(absolute), message });

  const requireDocument = (dir, name) => {
    if (!filesIn(dir).includes(`${name}.md`)) {
      fail(dir, `missing document '${name}.md' — every directory explains itself`);
    }
  };

  const checkDocumentPlacement = (dir, expected) => {
    for (const file of filesIn(dir)) {
      if (!file.endsWith(".md")) continue;
      if (file === `${expected}.md`) continue;
      fail(
        join(dir, file),
        `document does not match its directory — expected '${expected}.md', or move it to docs/`
      );
    }
  };

  /**
   * `api/` is recursive: every directory holds a `.ts` named after it, at every
   * depth. A `shared/` directory is the one exception — it is a bag of promoted
   * procedures, not a procedure itself.
   *
   * A remote file marks a boundary crossing, and only a top-level function
   * directory has a boundary to cross; one nested deeper would expose a
   * supporting procedure the capability never meant to offer.
   */
  const checkApiTree = (dir, depth) => {
    for (const name of dirsIn(dir)) {
      const child = join(dir, name);
      const isShared = name === "shared";

      if (!isShared && !filesIn(child).includes(`${name}.ts`)) {
        fail(child, `missing entry file '${name}.ts'`);
      }

      if (depth === 0) {
        requireDocument(child, name);
        checkDocumentPlacement(child, name);
      }

      if (depth === 0 && !isShared) checkProcedureTree(child, name);

      checkApiTree(child, depth + 1);
    }
  };

  const checkProcedureTree = (dir, name) => {
    const document = join(dir, `${name}.md`);
    if (!existsSync(document)) return;
    for (const path of procedureTreePaths(readFileSync(document, "utf8"))) {
      if (existsSync(resolve(dir, path))) continue;
      fail(document, `procedure tree names '${path}', which does not exist`);
    }
  };

  const checkApi = (capabilityRoot) => {
    const dir = join(capabilityRoot, "api");
    if (!existsSync(dir)) return;
    requireDocument(dir, "api");
    checkApiTree(dir, 0);
  };

  /**
   * The deployment door and `api/` must describe the same set of functions.
   *
   * The door is `<functionsRoot>/capabilities/<camelCase>.ts`, and it is the
   * capability's entire public surface: a Convex module's path is its public
   * name, so what is exported there is exactly what an untrusted caller can
   * reach. A registration with no `api/` directory hides a procedure inline
   * where nothing documents it; an `api/` directory the door never exports is
   * unreachable code left behind by a rename.
   */
  const checkDeploymentDoor = (capabilityRoot, capability) => {
    const apiRoot = join(capabilityRoot, "api");
    if (!functionsRoot || !existsSync(apiRoot)) return;

    const name = camelOf(capability.split("/").at(-1));
    const door = join(functionsRoot, "capabilities", `${name}.ts`);

    if (!existsSync(door)) {
      fail(apiRoot, `no deployment door — expected capabilities/${name}.ts under the functions directory`);
      return;
    }

    const exported = exportedNames(readFileSync(door, "utf8")).filter((n) => /^[a-z]/.test(n));
    const directories = dirsIn(apiRoot).filter((n) => n !== "shared");

    for (const fn of exported) {
      if (!directories.includes(kebabOf(fn))) {
        fail(door, `registers '${fn}', which has no api/${kebabOf(fn)}/ directory`);
      }
    }
    for (const directory of directories) {
      if (!exported.some((fn) => kebabOf(fn) === directory)) {
        fail(join(apiRoot, directory), `no function named '${directory}' is registered in capabilities/${name}.ts`);
      }
    }
  };

  /**
   * A capability holds handlers, never registrations.
   *
   * A Convex function is public the moment it is registered, so `query` and
   * `mutation` are the tokens that decide what an untrusted caller can reach.
   * Keeping them out of `capabilities/` is what makes the deployment doors the
   * complete, readable list of that surface — one directory to audit rather than
   * every file in the tree.
   */
  const checkNoRegistrations = (capabilityRoot) => {
    for (const file of walkTypeScript(capabilityRoot)) {
      const source = readFileSync(file, "utf8");
      const imports = source.match(/import\s*\{([^}]*)\}\s*from\s*["'][^"']*_generated\/server["']/s);
      if (!imports) continue;

      const values = imports[1]
        .split(",")
        .map((part) => part.trim())
        .filter((part) => /^(query|mutation|action|internalQuery|internalMutation|internalAction)\b/.test(part));

      if (values.length > 0) {
        fail(
          file,
          `imports ${values.join(", ")} — a capability holds handlers; registration belongs in its deployment door`
        );
      }
    }
  };

  const walkDocuments = (dir, expected, isCapabilityRoot = false) => {
    requireDocument(dir, expected);
    checkDocumentPlacement(dir, expected);
    for (const name of dirsIn(dir)) {
      if (UNDOCUMENTED.has(name)) continue;
      // api/ walks itself — its nesting rules differ.
      if (name === "api") continue;
      // An unknown directory is already reported as unknown. Also demanding a
      // document for it doubles the output for one defect, and the second
      // message points at a directory that should not exist rather than at
      // anything to write.
      if (isCapabilityRoot && !ALLOWED_DIRS.has(name)) continue;
      walkDocuments(join(dir, name), name);
    }
  };

  for (const capability of discover(root)) {
    const capabilityRoot = join(root, capability);
    const children = dirsIn(capabilityRoot);

    // Designed but unbuilt: docs/ and nothing else. No structure to check yet.
    if (filesIn(capabilityRoot).length === 0 && children.length === 1 && children[0] === "docs") {
      continue;
    }

    for (const file of filesIn(capabilityRoot)) {
      if (!ALLOWED_ROOT_FILES.has(file)) {
        fail(
          join(capabilityRoot, file),
          "only overview.md, index.ts, index.server.ts, and errors.ts belong at a capability root"
        );
      }
    }
    for (const dir of dirsIn(capabilityRoot)) {
      if (!ALLOWED_DIRS.has(dir)) {
        fail(
          join(capabilityRoot, dir),
          `unknown capability directory '${dir}' — see docs/capability-directory/capability-directory.md`
        );
      }
    }

    walkDocuments(capabilityRoot, "overview", true);
    checkApi(capabilityRoot);
    checkDeploymentDoor(capabilityRoot, capability);
    checkNoRegistrations(capabilityRoot);
  }

  return failures;
};

/**
 * How a capability's files refer to each other.
 *
 * Separate from the shape checks because it answers a different question and is
 * read at a different time: shape is what a reviewer opens a directory to see,
 * paths are what breaks when something moves.
 */
export const checkPaths = ({ root, base = root, aliases = {} }) => {
  const failures = [];
  const at = (absolute) => relative(base, absolute) || ".";
  const fail = (absolute, line, message) =>
    failures.push({ path: `${at(absolute)}:${line}`, message });

  const sources = [];
  const collect = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of entries(dir)) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) collect(path);
      else if (entry.name.endsWith(".ts")) sources.push(path);
    }
  };
  collect(root);

  /** An alias resolves through the same map the bundler and compiler share. */
  const resolveAlias = (specifier) => {
    for (const [alias, target] of Object.entries(aliases)) {
      if (specifier === alias) return target;
      if (specifier.startsWith(`${alias}/`)) {
        return join(target, specifier.slice(alias.length + 1));
      }
    }
    return null;
  };

  /**
   * `.d.ts` is a candidate because a generated module is a `.js` implementation
   * beside its declarations, with no `.ts` anywhere — which is what a capability
   * imports when it names a Convex context type.
   */
  const resolvesOnDisk = (target) => {
    const absolute = resolve(base, target);
    const candidates = [
      absolute,
      `${absolute}.ts`,
      `${absolute}.d.ts`,
      join(absolute, "index.ts"),
      join(absolute, "index.d.ts")
    ];
    if (absolute.endsWith(".js")) candidates.push(`${absolute.slice(0, -3)}.ts`);
    return candidates.some((candidate) => existsSync(candidate));
  };

  for (const file of sources) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((text, index) => {
        const line = index + 1;

        if (/\bfrom\s+["']\.{1,2}\//.test(text)) {
          failures.push({
            path: `${at(file)}:${line}`,
            message: "relative import — use an alias declared in svelte.config.js"
          });
        }

        // Deriving a filesystem path from a module's own location breaks under
        // bundling: the module moves into a build chunk and the path follows it
        // somewhere valid but wrong, which fails silently.
        if (text.includes("import.meta.url") || text.includes("import.meta.resolve")) {
          fail(file, line, "import.meta.url / import.meta.resolve — a bundled module's location is not the project's");
        }

        for (const specifier of importedSpecifiers(text)) {
          if (!specifier.startsWith("$")) continue;
          // SvelteKit's own aliases resolve inside the framework, not on disk.
          if (/^\$(app|env|service-worker)\b/.test(specifier)) continue;

          const target = resolveAlias(specifier);
          if (target === null) {
            fail(file, line, `"${specifier}" matches no alias in svelte.config.js`);
          } else if (!resolvesOnDisk(target)) {
            fail(file, line, `"${specifier}" resolves to ${target} — no such file`);
          }
        }
      });
  }

  return failures;
};

/**
 * Rule 8 applies to the whole source tree, capability or not: nothing has to
 * move for a name to be correct.
 *
 * `.test.ts` and friends are compound extensions — every dot-separated segment
 * of the name must be kebab-case, not the whole string at once, so
 * `scope.server.test.ts` passes and `scopeServer.ts` does not.
 */
export const checkNames = ({ root, base = root }) => {
  const failures = [];
  const at = (absolute) => relative(base, absolute) || ".";

  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of entries(dir)) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!KEBAB.test(entry.name)) {
          failures.push({ path: at(path), message: "directory name must be kebab-case" });
        }
        walk(path);
      } else if (entry.name.endsWith(".ts")) {
        const segments = entry.name.slice(0, -3).split(".");
        if (!segments.every((segment) => KEBAB.test(segment))) {
          failures.push({ path: at(path), message: "file name must be kebab-case" });
        }
      }
    }
  };
  walk(root);
  return failures;
};

/** A test file sits under its capability's `test/`, never beside the code it covers. */
export const checkTestPlacement = ({ root, base = root }) => {
  const failures = [];
  const at = (absolute) => relative(base, absolute) || ".";

  for (const capability of discover(root)) {
    const capabilityRoot = join(root, capability);
    const walk = (dir, insideTest) => {
      for (const entry of entries(dir)) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path, insideTest || entry.name === "test");
        else if (!insideTest && entry.name.endsWith(".test.ts")) {
          failures.push({
            path: at(path),
            message: "a test file belongs under the capability's test/, not beside the code it covers"
          });
        }
      }
    };
    walk(capabilityRoot, false);
  }
  return failures;
};
