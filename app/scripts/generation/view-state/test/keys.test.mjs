/**
 * The generator's central claim is that the key vocabulary is the panel trees
 * and nothing else. These tests check the two halves of it: that a path becomes
 * exactly one key, and that `--check` refuses a file the trees no longer agree
 * with.
 *
 * The second half is the one that earns its keep. A generator that writes the
 * right file is only useful while somebody remembers to run it, and the drift
 * check is what turns "somebody remembers" into a failing build — so a test that
 * only asserted the happy path would be testing the less important claim.
 *
 * The last test runs the check against the real package rather than a fixture,
 * which is deliberately a test of the repository and not of this script: adding
 * a panel without regenerating `keys.ts` should turn something red here.
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
const generator = join(generators, "keys.mjs");
const realPackageRoot = dirname(dirname(dirname(generators)));

/** One valid file in each tree, so a fixture only has to say what it is about. */
const BASE = [
  "context/project/variables.svelte",
  "inspector/collaboration/person.svelte",
  "workspaces/project-overview/workspace.svelte"
];

/**
 * Where a short path sits in the tree. A test says `context/project/x.svelte`
 * because that is the key it is about; the two stack trees live under
 * `views/panels/` and everything else directly under `views/`.
 */
const treePath = (root, path) => {
  const [tree, ...rest] = path.split("/");
  const under = tree === "context" || tree === "inspector" ? ["panels", tree] : [tree];
  return join(root, "src", "lib", "views", ...under, ...rest);
};

/**
 * A package holding nothing but panels. Their contents never matter — the whole
 * vocabulary is in the paths.
 */
const makePackage = (paths) => {
  const root = mkdtempSync(join(tmpdir(), "view-state-keys-"));
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
    assert.fail(`keys.mjs ${args.join(" ")} was expected to refuse`);
  } catch (error) {
    assert.notEqual(error.status, 0, "keys.mjs exited 0");
    return `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
};

/**
 * Where the script writes. It has to match `keys.mjs`'s own target exactly: the
 * vocabulary lives under the model object that holds the state it names, and the
 * model standard admits only a document, a door, types, a definition and a
 * constructor at an object root — so it sits in `methods/shared/`.
 */
const keysPath = (root) =>
  join(root, "src", "lib", "model", "client", "view-state", "methods", "shared", "keys.ts");
const keys = (root) => readFileSync(keysPath(root), "utf8");

/** The string members of one generated array, in the order they were written. */
const members = (source, constant) => {
  const opened = source.indexOf(`export const ${constant} = [`);
  assert.notEqual(opened, -1, `${constant} is missing`);
  const block = source.slice(opened, source.indexOf("] as const;", opened));
  return [...block.matchAll(/"([^"]+)"/g)].map(([, value]) => value);
};

// --------------------------------------------------------- a key is a path ----

test("a panel path becomes exactly one key", () => {
  withPackage(
    [
      "context/library/templates.svelte",
      "inspector/copilot/home.svelte",
      "workspaces/research/workspace-one-question.svelte",
      "workspaces/research/workspace-all-threads.svelte"
    ],
    (root) => {
      run(root);
      const source = keys(root);

      assert.deepEqual(members(source, "CONTEXT_IDS"), ["library.templates", "project.variables"]);
      assert.deepEqual(members(source, "INSPECTION_KEYS"), ["collaboration.person", "copilot.home"]);
      assert.deepEqual(members(source, "SCREENS"), ["project-overview", "research"]);
      assert.match(source, /"research": \["all-threads", "one-question"\]/);
    }
  );
});

test("a subscreen is its file name with the workspace prefix stripped", () => {
  withPackage(
    [
      "workspaces/templates/workspace-editor.svelte",
      "workspaces/templates/workspace-library.svelte",
      "workspaces/new-tab/workspace.svelte"
    ],
    (root) => {
      run(root);
      const source = keys(root);

      assert.match(source, /"templates": \["editor", "library"\]/);
      assert.match(source, /"new-tab": \["workspace"\]/, "a bare workspace.svelte keeps the name 'workspace'");
      assert.ok(!source.includes("workspace-editor"), "the prefix is stripped rather than kept");
    }
  );
});

test("Subscreen is read back off the table rather than declared beside it", () => {
  withPackage(["workspaces/research/workspace-one-question.svelte"], (root) => {
    run(root);
    assert.match(keys(root), /export type Subscreen = \(typeof SUBSCREENS\)\[Screen\]\[number\];/);
    assert.match(keys(root), /\} as const satisfies Record<Screen, readonly string\[\]>;/);
  });
});

test("INSPECTION_KEYS carries no 'empty' member", () => {
  withPackage(["inspector/copilot/home.svelte"], (root) => {
    run(root);
    assert.ok(!members(keys(root), "INSPECTION_KEYS").includes("empty"));
  });
});

test("the banner names the command that rewrites the file", () => {
  withPackage([], (root) => {
    run(root);
    assert.match(keys(root), /pnpm view-state-keys/);
    assert.match(keys(root), /do not edit/i);
  });
});

test("the guards narrow to the three generated unions", () => {
  withPackage([], (root) => {
    run(root);
    const source = keys(root);
    for (const [guard, type] of [
      ["isContextId", "ContextId"],
      ["isInspectionKey", "InspectionKey"],
      ["isScreen", "Screen"]
    ]) {
      assert.ok(source.includes(`export const ${guard} = (value: string): value is ${type} =>`), guard);
    }
  });
});

// -------------------------------------------------------------- determinism ----

test("every generated list is sorted", () => {
  withPackage(
    [
      "context/scope/add.svelte",
      "context/agents/work.svelte",
      "inspector/scope/context.svelte",
      "inspector/agents/model.svelte",
      "workspaces/templates/workspace-library.svelte",
      "workspaces/analysis/workspace-one-analysis.svelte",
      "workspaces/analysis/workspace-all-analyses.svelte"
    ],
    (root) => {
      run(root);
      const source = keys(root);

      for (const constant of ["CONTEXT_IDS", "INSPECTION_KEYS", "SCREENS"]) {
        const found = members(source, constant);
        assert.deepEqual(found, [...found].sort(), `${constant} is not sorted`);
      }
      assert.match(source, /"analysis": \["all-analyses", "one-analysis"\]/);
    }
  );
});

test("the order files were created in does not change the bytes", () => {
  const panels = [
    "context/scope/add.svelte",
    "context/agents/work.svelte",
    "inspector/agents/model.svelte",
    "workspaces/analysis/workspace-one-analysis.svelte",
    "workspaces/analysis/workspace-all-analyses.svelte"
  ];

  const [first, second] = [panels, [...panels].reverse()].map((order) =>
    withPackage(order, (root) => {
      run(root);
      return keys(root);
    })
  );

  assert.equal(first, second);
});

test("a second run over an unchanged tree writes the same bytes", () => {
  withPackage(["context/library/templates.svelte"], (root) => {
    run(root);
    const first = keys(root);
    assert.match(run(root), /unchanged/);
    assert.equal(keys(root), first);
  });
});

// -------------------------------------------------------------------- drift ----

test("--check passes on the file the generator just wrote", () => {
  withPackage(["context/library/templates.svelte"], (root) => {
    run(root);
    assert.match(run(root, "--check"), /in step with the panel trees/);
  });
});

test("--check fails on a panel added since, and names the key it would gain", () => {
  withPackage([], (root) => {
    run(root);

    const added = treePath(root, "context/library/templates.svelte");
    mkdirSync(dirname(added), { recursive: true });
    writeFileSync(added, "<script lang=\"ts\"></script>\n");

    const said = refuses(root, "--check");
    assert.match(said, /has drifted from the panel trees/);
    assert.match(said, /\+ "library\.templates",?/);
    assert.match(said, /pnpm view-state-keys/, "it says how to fix it");
  });
});

test("--check fails on a panel removed since, and names the key it would lose", () => {
  withPackage(["context/library/templates.svelte"], (root) => {
    run(root);
    rmSync(treePath(root, "context/library"), { recursive: true, force: true });

    assert.match(refuses(root, "--check"), /- "library\.templates",?/);
  });
});

test("--check fails on a hand-edited file even when no panel moved", () => {
  withPackage(["context/library/templates.svelte"], (root) => {
    run(root);
    writeFileSync(keysPath(root), keys(root).replace('"library.templates"', '"library.invented"'));

    const said = refuses(root, "--check");
    assert.match(said, /\+ "library\.templates",/, "the key the trees have");
    assert.match(said, /- "library\.invented",/, "the key only the file has");
  });
});

test("--check fails when the file has never been generated", () => {
  withPackage([], (root) => {
    assert.match(refuses(root, "--check"), /has not been generated/);
  });
});

test("--check writes nothing, so it is safe in CI", () => {
  withPackage([], (root) => {
    run(root);
    const before = keys(root);

    const added = treePath(root, "inspector/copilot/home.svelte");
    mkdirSync(dirname(added), { recursive: true });
    writeFileSync(added, "");

    refuses(root, "--check");
    assert.equal(keys(root), before);
  });
});

// ----------------------------------------------------------------- refusals ----

test("a panel at a tree root is reported rather than dropped", () => {
  withPackage([], (root) => {
    writeFileSync(treePath(root, "context/orphan.svelte"), "");
    assert.match(refuses(root), /orphan\.svelte {2}sits at the tree root/);
  });
});

test("a third level under a panel tree is reported", () => {
  withPackage(["inspector/resource/nested/deep.svelte"], (root) => {
    assert.match(refuses(root), /is a third level, and a key is <subject>\.<name>/);
  });
});

test("a workspace file the naming rule cannot read names no subscreen", () => {
  withPackage(["workspaces/research/panel-one-question.svelte"], (root) => {
    assert.match(refuses(root), /is not 'workspace' or 'workspace-<name>'/);
  });
});

test("a screen directory with nothing to render is reported", () => {
  withPackage([], (root) => {
    mkdirSync(treePath(root, "workspaces/hollow"), { recursive: true });
    assert.match(refuses(root), /has no workspace file/);
  });
});

test("a missing panel tree is reported rather than generating an empty union", () => {
  withPackage([], (root) => {
    rmSync(treePath(root, "inspector"), { recursive: true, force: true });
    assert.match(refuses(root), /no such panel tree/);
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
    assert.match(run(root, "--", "--check"), /in step with the panel trees/);
  });
});

test("the generator runs identically from any working directory", () => {
  withPackage(["context/library/templates.svelte"], (root) => {
    execFileSync(process.execPath, [generator], {
      cwd: tmpdir(),
      env: { ...process.env, ICARUS_PACKAGE_ROOT: root },
      encoding: "utf8",
      stdio: "pipe"
    });
    assert.ok(members(keys(root), "CONTEXT_IDS").includes("library.templates"));
  });
});

// ------------------------------------------------------------ the real trees ----

test("the committed keys.ts is in step with the panel trees", () => {
  execFileSync(process.execPath, [generator, "--check"], {
    env: { ...process.env, ICARUS_PACKAGE_ROOT: realPackageRoot },
    encoding: "utf8",
    stdio: "pipe"
  });
});
