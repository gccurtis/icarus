/**
 * What a generator writes passes the checks that govern where it wrote it.
 *
 * A template that trips its own check on the first run is a template nobody
 * trusts, and the two halves drift the moment they are written apart — so every
 * generator is run against a copy of the tree and the tree's own checks are run
 * over the result. Nothing new may be reported.
 *
 *     pnpm test:scripts
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { after, describe, test } from "node:test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { breaking, discard, sandbox, treeIn } from "./sandbox.mjs";

const scripts = new URL("../", import.meta.url).pathname;
const lintRoot = join(scripts, "lint");

/**
 * A declaration that already matches the tree, so `new-domain` is not the first
 * domain ever declared.
 *
 * Read off the tree rather than written out: what is being tested is that the
 * generator adds a domain the check then accepts, not that a hand-written list
 * is still accurate.
 */
const seededDomains = async (base) => {
  const tree = await treeIn(base);
  const edges = new Map();

  for (const kind of ["types", "behavior"]) {
    for (const name of tree.dirsIn(tree.path("representation", "data", kind))) {
      if (!edges.has(name)) edges.set(name, new Set());
    }
  }
  for (const path of tree.under(tree.path("representation", "data"))) {
    if (!path.endsWith(".ts")) continue;
    const self = tree.rel(path).split("/")[5];
    if (!edges.has(self)) continue;
    for (const record of tree.imports(path)) {
      const target = tree.aliasTarget(record.specifier);
      if (target?.tree !== "representation") continue;
      const [data, kind, other] = target.segments;
      if (data !== "data" || !["types", "behavior"].includes(kind) || !other || other === self) continue;
      edges.get(self).add(other);
    }
  }

  const listed = [...edges]
    .sort(([left], [right]) => (left < right ? -1 : 1))
    .map(([name, reaches]) => `    ${name}: [${[...reaches].sort().join(", ")}]`)
    .join("\n");
  return `representation:\n  store:\n    directory: data\n  domains:\n${listed}\n`;
};

/**
 * Each generator, what to run it with, and which trees have to stay clean
 * afterwards. `then` is a second command the generator's own output tells you to
 * run — the key vocabulary is generated from the tree, so a new leaf is not
 * reachable until it is rewritten.
 */
const GENERATORS = [
  { name: "new-capability", script: "capabilities/new-capability.mjs", args: ["probe"], trees: ["capabilities", "across"] },
  {
    name: "new-procedure",
    script: "capabilities/new-procedure.mjs",
    args: ["probe", "do-thing"],
    before: ["capabilities/new-capability.mjs", ["probe"]],
    trees: ["capabilities"]
  },
  {
    name: "new-constant",
    script: "capabilities/new-constant.mjs",
    args: ["probe", "kinds"],
    before: ["capabilities/new-capability.mjs", ["probe"]],
    trees: ["capabilities"]
  },
  { name: "new-vocabulary", script: "components/new-vocabulary.mjs", args: ["probe"], trees: ["components"] },
  {
    name: "new-component",
    script: "components/new-component.mjs",
    args: ["probe", "thing"],
    before: ["components/new-vocabulary.mjs", ["probe"]],
    trees: ["components", "across"]
  },
  {
    name: "new-model-object",
    script: "model/new-model-object.mjs",
    args: ["client", "probe", "--depends-on=workspace-state"],
    trees: ["model", "runtime"]
  },
  {
    name: "new-method",
    script: "model/new-method.mjs",
    args: ["client", "workspace-state", "probe"],
    trees: ["model"]
  },
  {
    name: "new-method (promoting)",
    script: "model/new-method.mjs",
    args: ["client", "workspace-state", "resize/probe"],
    trees: ["model"]
  },
  {
    name: "new-domain",
    script: "representation/new-domain.mjs",
    args: ["probe", "--with-behavior"],
    seed: seededDomains,
    trees: ["representation", "across"]
  },
  { name: "new-table", script: "representation/new-table.mjs", args: ["probeThings"], trees: ["representation"] },
  { name: "new-theme", script: "styles/new-theme.mjs", args: ["probe", "--dark"], trees: [] },
  { name: "new-token", script: "styles/new-token.mjs", args: ["spacing", "probe-gap", "4px"], trees: ["styles"] },
  { name: "new-surface", script: "views/new-surface.mjs", args: ["probe-bar"], trees: ["views", "across"] },
  {
    name: "new-concern-entry",
    script: "views/new-concern-entry.mjs",
    args: ["top-bar", "effects", "probe"],
    trees: ["views"]
  },
  {
    name: "new-panel",
    script: "panels/new-panel.mjs",
    args: ["context", "project", "probe"],
    trees: ["panels"]
  },
  {
    name: "new-workspace",
    script: "workspaces/new-workspace.mjs",
    args: ["agents", "probe"],
    then: ["representation/screens.mjs", []],
    trees: ["workspaces"]
  }
];

const loadChecks = async (trees) => {
  const found = [];
  for (const tree of trees) {
    for (const file of readdirSync(join(lintRoot, tree)).sort()) {
      if (!file.endsWith(".mjs")) continue;
      const module = await import(pathToFileURL(join(lintRoot, tree, file)).href);
      found.push({ tree, ...module.default });
    }
  }
  return found;
};

const key = ({ subject, path, message }) => `${subject ?? ""}|${path}|${message}`;

const generate = (base, script, args) =>
  execFileSync(process.execPath, [join(scripts, "generation", script), "--", ...args], {
    env: { ...process.env, ICARUS_PACKAGE_ROOT: base },
    encoding: "utf8"
  });

describe("every generator is named here", () => {
  test("and none is missing", () => {
    const dirs = readdirSync(join(scripts, "generation"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== "shared")
      .flatMap((entry) =>
        readdirSync(join(scripts, "generation", entry.name))
          .filter((file) => file.endsWith(".mjs"))
          .map((file) => `${entry.name}/${file}`)
      );

    // `aliases` and `imports` rewrite what is already there rather than adding to
    // a tree, and `screens` runs as the second half of one entry above.
    const covered = new Set([
      ...GENERATORS.map(({ script }) => script),
      "across/aliases.mjs",
      "across/imports.mjs",
      "representation/screens.mjs"
    ]);
    assert.deepEqual(dirs.filter((script) => !covered.has(script)), []);
  });
});

describe("what a generator writes passes the checks where it wrote it", () => {
  for (const generator of GENERATORS) {
    test(generator.name, async () => {
      // A sandbox each: a generator writes files, and there is nothing to undo
      // them with in a copy that is not a repository.
      const base = sandbox();
      const checks = await loadChecks(generator.trees);
      const pristine = await treeIn(base);
      const baseline = new Map();
      for (const check of checks) baseline.set(check.name, new Set((await check.run(pristine)).map(key)));

      const written = [];
      const seed = generator.seed
        ? [{ path: "configuration/representation.yaml", write: await generator.seed(base) }]
        : [];
      await breaking(base, seed, async () => {
        if (generator.before) written.push(generate(base, ...generator.before));
        written.push(generate(base, generator.script, generator.args));
        if (generator.then) written.push(generate(base, ...generator.then));

        const tree = await treeIn(base);
        for (const check of checks) {
          const fresh = (await check.run(tree)).filter((failure) => !baseline.get(check.name).has(key(failure)));
          assert.deepEqual(
            fresh.map((failure) => `${check.name}${failure.subject ? ` · ${failure.subject}` : ""}: ${tree.rel(failure.path)}  ${failure.message}`),
            [],
            `${generator.name} left ${check.name} with something to say`
          );
        }
      });

      assert.ok(
        written.every((output) => /wrote|unchanged|in step/.test(output)),
        `${generator.name} reported writing nothing`
      );
      discard(base);
    });
  }
});
