/**
 * The generator's central claim is that the category vocabulary is the category
 * tree and nothing else. These tests check the two halves of it: that a path
 * becomes exactly one category and one subscreen, and that `--check` refuses a
 * file the tree no longer agrees with.
 *
 * The second half is the one that earns its keep. A generator that writes the
 * right file is only useful while somebody remembers to run it, and the drift
 * check is what turns "somebody remembers" into a failing build — so a test that
 * only asserted the happy path would be testing the less important claim.
 *
 * Context and inspector views are not here. Their vocabulary is hand-written in
 * the same domain, because a view that has not been built yet still has to be
 * nameable, and `key-vocabulary-matches-the-tree` is what holds those files to
 * the tree.
 *
 * The last test runs the check against the real package rather than a fixture,
 * which is deliberately a test of the repository and not of this script: adding
 * a content view without regenerating should turn something red here.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const generators = dirname(here);
const generator = join(generators, "categories.mjs");
const realPackageRoot = dirname(dirname(dirname(generators)));

/** One valid category, so a fixture only has to say what it is about. */
const BASE = ["categories/project-overview/content/overview.svelte"];

/** Where a short path sits in the tree. */
const treePath = (root, path) => join(root, "src", "lib", "app-views", ...path.split("/"));

/**
 * A package holding nothing but content views. Their contents never matter —
 * the whole vocabulary is in the paths.
 */
const makePackage = (paths) => {
  const root = mkdtempSync(join(tmpdir(), "category-keys-"));
  for (const path of paths) {
    const file = treePath(root, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, "<script lang=\"ts\"></script>\n");
  }
  return root;
};

const withPackage = (paths, body) => {
  const root = makePackage([...BASE, ...paths]);
  try {
    return body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const run = (root, ...args) =>
  execFileSync(process.execPath, [generator, ...args], {
    env: { ...process.env, ICARUS_PACKAGE_ROOT: root },
    encoding: "utf8",
    stdio: "pipe"
  });

/** Runs a command expected to refuse, and returns everything it said. */
const refuses = (root, ...args) => {
  try {
    run(root, ...args);
    assert.fail(`categories.mjs ${args.join(" ")} was expected to refuse`);
  } catch (error) {
    assert.notEqual(error.status, 0, "categories.mjs exited 0");
    return `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
};

/**
 * Where the script writes, which has to match `categories.mjs`'s own targets
 * exactly. Two files, because `representation/` splits on what a file emits: the
 * unions under `data/types/`, which compiles to nothing, and the lists, the
 * table and the guard under `data/behavior/`.
 */
const unionsPath = (root) =>
  join(root, "src", "lib", "representation", "data", "types", "workspace", "categories.ts");
const listsPath = (root) =>
  join(root, "src", "lib", "representation", "data", "behavior", "workspace", "categories.ts");

const unions = (root) => readFileSync(unionsPath(root), "utf8");
const lists = (root) => readFileSync(listsPath(root), "utf8");
const both = (root) => `${unions(root)}${lists(root)}`;

/** The string members of one generated array, in the order they were written. */
const members = (source, constant) => {
  const opened = source.indexOf(`export const ${constant} = [`);
  assert.notEqual(opened, -1, `${constant} is missing`);
  const block = source.slice(opened, source.indexOf("] as const satisfies", opened));
  return [...block.matchAll(/"([^"]+)"/g)].map(([, value]) => value);
};

// --------------------------------------------------------- a path is a key ----

test("a content path becomes exactly one category and one subscreen", () => {
  withPackage(
    [
      "categories/research/content/one-question.svelte",
      "categories/research/content/all-threads.svelte"
    ],
    (root) => {
      run(root);

      assert.deepEqual(members(lists(root), "CATEGORIES"), ["project-overview", "research"]);
      assert.match(lists(root), /"research": \["all-threads", "one-question"\]/);
    }
  );
});

test("a subscreen is the file name, and nothing is stripped from it", () => {
  withPackage(
    [
      "categories/templates/content/editor.svelte",
      "categories/templates/content/library.svelte",
      "categories/new-tab/content/launcher.svelte"
    ],
    (root) => {
      run(root);

      assert.match(lists(root), /"templates": \["editor", "library"\]/);
      assert.match(lists(root), /"new-tab": \["launcher"\]/);
    }
  );
});

test("only content/ names a subscreen", () => {
  withPackage(
    [
      "categories/research/content/thread.svelte",
      "categories/research/context/history.svelte",
      "categories/research/inspector/source.svelte"
    ],
    (root) => {
      run(root);

      assert.match(lists(root), /"research": \["thread"\]/);
      assert.ok(!both(root).includes("history"), "a context view is not a subscreen");
      assert.ok(!both(root).includes("source"), "an inspector view is not a subscreen");
    }
  );
});

test("a category with nothing built yet is named with an empty list", () => {
  withPackage([], (root) => {
    mkdirSync(treePath(root, "categories/context-editor/context"), { recursive: true });
    run(root);

    assert.ok(members(lists(root), "CATEGORIES").includes("context-editor"));
    assert.match(lists(root), /"context-editor": \[\]/);
  });
});

test("the unions are declared where a file compiles to nothing", () => {
  withPackage(["categories/research/content/one-question.svelte"], (root) => {
    run(root);

    assert.match(unions(root), /export type Category =\n {2}\| "project-overview"\n {2}\| "research";/);
    assert.match(unions(root), /export type Subscreen =\n {2}\| "one-question"\n {2}\| "overview";/);
    assert.ok(!unions(root).includes("export const"), "types/ emits nothing");
  });
});

test("the lists satisfy the unions rather than declaring their own", () => {
  withPackage([], (root) => {
    run(root);

    assert.match(
      lists(root),
      /import type \{ Category, Subscreen \} from "\$representation\/data\/types\/workspace\/categories";/
    );
    assert.match(lists(root), /\] as const satisfies readonly Category\[\];/);
    assert.match(lists(root), /\} as const satisfies Record<Category, readonly Subscreen\[\]>;/);
  });
});

test("the hand-written vocabulary is not written here", () => {
  withPackage([], (root) => {
    run(root);
    const source = both(root);
    assert.ok(!source.includes("CONTEXT_VIEWS"), "contexts are hand-written beside these");
    assert.ok(!source.includes("INSPECTOR_VIEWS"), "lenses are hand-written beside these");
  });
});

test("the banner names the command that rewrites the file", () => {
  withPackage([], (root) => {
    run(root);
    for (const source of [unions(root), lists(root)]) {
      assert.match(source, /pnpm category-keys/);
      assert.match(source, /do not edit/i);
    }
  });
});

test("the guard narrows to the generated union", () => {
  withPackage([], (root) => {
    run(root);
    assert.ok(
      lists(root).includes("export const isCategory = (value: string): value is Category =>"),
      "isCategory"
    );
  });
});

// -------------------------------------------------------------- determinism ----

test("every generated list is sorted", () => {
  withPackage(
    [
      "categories/templates/content/library.svelte",
      "categories/analysis/content/one-analysis.svelte",
      "categories/analysis/content/all-analyses.svelte"
    ],
    (root) => {
      run(root);

      const found = members(lists(root), "CATEGORIES");
      assert.deepEqual(found, [...found].sort(), "CATEGORIES is not sorted");
      assert.match(lists(root), /"analysis": \["all-analyses", "one-analysis"\]/);
    }
  );
});

test("the order files were created in does not change the bytes", () => {
  const content = [
    "categories/templates/content/library.svelte",
    "categories/analysis/content/one-analysis.svelte",
    "categories/analysis/content/all-analyses.svelte"
  ];

  const [first, second] = [content, [...content].reverse()].map((order) =>
    withPackage(order, (root) => {
      run(root);
      return both(root);
    })
  );

  assert.equal(first, second);
});

test("a second run over an unchanged tree writes the same bytes", () => {
  withPackage(["categories/research/content/thread.svelte"], (root) => {
    run(root);
    const first = both(root);
    assert.match(run(root), /unchanged/);
    assert.equal(both(root), first);
  });
});

// -------------------------------------------------------------------- drift ----

test("--check passes on the files the generator just wrote", () => {
  withPackage(["categories/research/content/thread.svelte"], (root) => {
    run(root);
    assert.match(run(root, "--check"), /in step with the category tree/);
  });
});

test("--check fails on a category added since, and names what it would gain", () => {
  withPackage([], (root) => {
    run(root);

    const added = treePath(root, "categories/research/content/thread.svelte");
    mkdirSync(dirname(added), { recursive: true });
    writeFileSync(added, "<script lang=\"ts\"></script>\n");

    const said = refuses(root, "--check");
    assert.match(said, /has drifted from the category tree/);
    assert.match(said, /\+ "research",?/);
    assert.match(said, /pnpm category-keys/, "it says how to fix it");
  });
});

test("--check fails on a category removed since, and names what it would lose", () => {
  withPackage(["categories/research/content/thread.svelte"], (root) => {
    run(root);
    rmSync(treePath(root, "categories/research"), { recursive: true, force: true });

    assert.match(refuses(root, "--check"), /- "research",?/);
  });
});

// `analysis` rather than `research`, because it sorts before the base category
// and so carries the trailing comma the drift lines are compared with.
test("--check fails on a hand-edited file even when no category moved", () => {
  withPackage(["categories/analysis/content/chart.svelte"], (root) => {
    run(root);
    writeFileSync(listsPath(root), lists(root).replace('"analysis"', '"invented"'));

    const said = refuses(root, "--check");
    assert.match(said, /\+ "analysis",/, "the category the tree has");
    assert.match(said, /- "invented",/, "the category only the file has");
  });
});

test("--check fails when a file has never been generated", () => {
  withPackage([], (root) => {
    assert.match(refuses(root, "--check"), /has not been generated/);
  });
});

test("--check fails when only one of the two was written", () => {
  withPackage([], (root) => {
    run(root);
    rmSync(listsPath(root));

    const said = refuses(root, "--check");
    assert.match(said, /behavior\/workspace\/categories\.ts has not been generated/);
    assert.ok(
      !said.includes("types/workspace/categories.ts has"),
      "the one still in step is not reported"
    );
  });
});

test("--check writes nothing, so it is safe in CI", () => {
  withPackage([], (root) => {
    run(root);
    const before = both(root);

    const added = treePath(root, "categories/research/content/thread.svelte");
    mkdirSync(dirname(added), { recursive: true });
    writeFileSync(added, "");

    refuses(root, "--check");
    assert.equal(both(root), before);
  });
});

// ----------------------------------------------------------------- refusals ----

test("a view at the tree root is reported rather than dropped", () => {
  withPackage([], (root) => {
    writeFileSync(treePath(root, "categories/orphan.svelte"), "");
    assert.match(refuses(root), /orphan\.svelte {2}sits at the tree root/);
  });
});

test("a missing category tree is reported rather than generating an empty union", () => {
  withPackage([], (root) => {
    rmSync(treePath(root, "categories"), { recursive: true, force: true });
    assert.match(refuses(root), /no such tree/);
  });
});

test("an option that is not --check is refused", () => {
  withPackage([], (root) => {
    assert.match(refuses(root, "--verify"), /is not understood/);
  });
});

/**
 * The standards document every generator as `pnpm <script> -- <args>`, and pnpm
 * forwards that separator to the script rather than consuming it. The bug this
 * guards only ever reproduces through pnpm, so it survives every `node
 * scripts/…` run somebody reaches for to check the generator by hand.
 */
test("the leading -- pnpm forwards is not read as an argument", () => {
  withPackage([], (root) => {
    run(root, "--");
    assert.match(run(root, "--", "--check"), /in step with the category tree/);
  });
});

test("the generator runs identically from any working directory", () => {
  withPackage(["categories/research/content/thread.svelte"], (root) => {
    execFileSync(process.execPath, [generator], {
      cwd: tmpdir(),
      env: { ...process.env, ICARUS_PACKAGE_ROOT: root },
      encoding: "utf8",
      stdio: "pipe"
    });
    assert.ok(members(lists(root), "CATEGORIES").includes("research"));
  });
});

// ------------------------------------------------------------ the real tree ----

test("the committed category vocabulary is in step with the category tree", () => {
  execFileSync(process.execPath, [generator, "--check"], {
    env: { ...process.env, ICARUS_PACKAGE_ROOT: realPackageRoot },
    encoding: "utf8",
    stdio: "pipe"
  });
});
