/**
 * The generators' central claim is that everything they write already passes
 * `pnpm lint:views`. These tests check exactly that, by generating into a
 * throwaway package and running the real rules over the result.
 *
 * Asserting that a file exists, or that a placeholder was substituted, would
 * pass just as happily for a scaffold the standard rejects — and a generator
 * whose output fails lint teaches people that the standard is optional. The
 * refusal and rollback cases are here for the same reason: a generator that
 * leaves half a scaffold behind costs someone an afternoon finding out why their
 * tree is red.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { RULES } from "../../../lint/views/rules.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const generators = dirname(here);
const realPackageRoot = dirname(dirname(dirname(generators)));

/** A package with just enough in it for the generators to run: their templates. */
const makePackage = () => {
  const root = mkdtempSync(join(tmpdir(), "view-generation-"));
  cpSync(
    join(realPackageRoot, "docs", "view-directory", "templates"),
    join(root, "docs", "view-directory", "templates"),
    { recursive: true }
  );
  writeFileSync(
    join(root, "svelte.config.js"),
    `export default { kit: { alias: { $views: "src/lib/views" } } };\n`
  );
  return root;
};

const run = (root, script, ...args) =>
  execFileSync(process.execPath, [join(generators, script), ...args], {
    env: { ...process.env, ICARUS_PACKAGE_ROOT: root },
    encoding: "utf8",
    stdio: "pipe"
  });

/** Runs a command expected to refuse, and returns everything it said. */
const refuses = (root, script, ...args) => {
  try {
    run(root, script, ...args);
    assert.fail(`${script} ${args.join(" ")} was expected to refuse`);
  } catch (error) {
    assert.notEqual(error.status, 0, `${script} exited 0`);
    return `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
};

const lintOf = (root) =>
  RULES.flatMap((rule) =>
    rule({
      views: join(root, "src", "lib", "views"),
      source: join(root, "src"),
      base: root,
      aliases: { $views: "src/lib/views", $lib: "src/lib" }
    })
  );

const clean = (root) => {
  const failures = lintOf(root);
  assert.deepEqual(failures, [], failures.map((f) => `${f.path}  ${f.message}`).join("\n"));
};

const view = (root, ...segments) => join(root, "src", "lib", "views", ...segments);

const withPackage = (body) => {
  const root = makePackage();
  try {
    body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

// -------------------------------------------------------------- the claim ----

test("a view with every concern passes the real linter", () => {
  withPackage((root) => {
    run(root, "new-view.mjs", "workspace");
    run(root, "new-view-part.mjs", "workspace", "components", "empty-state");
    run(root, "new-view-part.mjs", "workspace", "components", "tab-header", "--complex");
    run(root, "new-view-part.mjs", "workspace", "components", "tab-header/components/tab-title");
    run(root, "new-view-part.mjs", "workspace", "interactions", "save-document");
    run(root, "new-view-part.mjs", "workspace", "interactions", "reorder-tabs", "--complex");
    run(root, "new-view-part.mjs", "workspace", "effects", "track-selection");
    run(root, "new-view-part.mjs", "workspace", "procedures", "format-title");
    run(root, "new-view-part.mjs", "workspace", "procedures", "reconcile-selection", "--complex");
    run(root, "new-view-part.mjs", "workspace", "shared");

    clean(root);
  });
});

test("a bare view — two files and nothing else — passes the real linter", () => {
  withPackage((root) => {
    run(root, "new-view.mjs", "demo");

    assert.deepEqual(
      readFileSync(view(root, "demo", "demo.md"), "utf8").split("\n")[0],
      "# Demo",
      "the view name is substituted into its document"
    );
    assert.ok(!existsSync(view(root, "demo", "components")), "no empty concern directory is created");
    assert.ok(!existsSync(view(root, "demo", "test")), "no empty test directory is created");
    clean(root);
  });
});

// --------------------------------------------------------------- structure ----

test("--complex creates a directory whose entry is named for it", () => {
  withPackage((root) => {
    run(root, "new-view.mjs", "workspace");
    run(root, "new-view-part.mjs", "workspace", "procedures", "reconcile-selection", "--complex");

    assert.ok(existsSync(view(root, "workspace", "procedures", "reconcile-selection", "reconcile-selection.ts")));
    clean(root);
  });
});

test("the extension follows the concern, with no flag to choose it", () => {
  withPackage((root) => {
    run(root, "new-view.mjs", "workspace");
    run(root, "new-view-part.mjs", "workspace", "effects", "track-selection");
    run(root, "new-view-part.mjs", "workspace", "interactions", "save-document");
    run(root, "new-view-part.mjs", "workspace", "procedures", "format-title");

    assert.ok(existsSync(view(root, "workspace", "effects", "track-selection.svelte.ts")));
    assert.ok(existsSync(view(root, "workspace", "interactions", "save-document.ts")));
    assert.ok(existsSync(view(root, "workspace", "procedures", "format-title.ts")));
    clean(root);
  });
});

test("a second entry extends the concern document rather than creating a nested one", () => {
  withPackage((root) => {
    run(root, "new-view.mjs", "workspace");
    run(root, "new-view-part.mjs", "workspace", "procedures", "format-title");
    run(root, "new-view-part.mjs", "workspace", "procedures", "reconcile-selection", "--complex");

    const document = readFileSync(view(root, "workspace", "procedures", "procedures.md"), "utf8");
    assert.ok(document.includes("format-title.ts"));
    assert.ok(document.includes("reconcile-selection/reconcile-selection.ts"));
    assert.ok(!existsSync(view(root, "workspace", "procedures", "reconcile-selection", "reconcile-selection.md")));
    clean(root);
  });
});

test("the inventory is sorted, so command order does not change the document", () => {
  const documents = ["a", "b"].map((order) => {
    let text;
    withPackage((root) => {
      run(root, "new-view.mjs", "workspace");
      const names = order === "a" ? ["alpha", "beta"] : ["beta", "alpha"];
      for (const name of names) run(root, "new-view-part.mjs", "workspace", "procedures", name);
      text = readFileSync(view(root, "workspace", "procedures", "procedures.md"), "utf8");
    });
    return text;
  });

  assert.equal(documents[0], documents[1]);
});

// --------------------------------------------------------------- refusals ----

test("new-view refuses a name that is not kebab-case", () => {
  withPackage((root) => {
    assert.match(refuses(root, "new-view.mjs", "TabStrip"), /not a kebab-case view name/);
    assert.ok(!existsSync(join(root, "src")), "nothing was written");
  });
});

test("new-view refuses a view that already exists", () => {
  withPackage((root) => {
    run(root, "new-view.mjs", "workspace");
    assert.match(refuses(root, "new-view.mjs", "workspace"), /already exists/);
  });
});

test("new-view-part refuses a view that does not exist", () => {
  withPackage((root) => {
    assert.match(refuses(root, "new-view-part.mjs", "ghost", "procedures", "thing"), /no such view/);
  });
});

test("new-view-part refuses a concern that is not one of the five", () => {
  withPackage((root) => {
    run(root, "new-view.mjs", "workspace");
    assert.match(refuses(root, "new-view-part.mjs", "workspace", "widgets", "thing"), /is not a view concern/);
  });
});

test("a slash is refused outside the component tree", () => {
  withPackage((root) => {
    run(root, "new-view.mjs", "workspace");
    assert.match(
      refuses(root, "new-view-part.mjs", "workspace", "procedures", "reconcile/map-ranges"),
      /one level deep/
    );
  });
});

test("a component path that does not alternate is refused", () => {
  withPackage((root) => {
    run(root, "new-view.mjs", "workspace");
    assert.match(
      refuses(root, "new-view-part.mjs", "workspace", "components", "tab-header/tab-title"),
      /alternates/
    );
  });
});

test("an existing entry is refused, and its document is not appended to twice", () => {
  withPackage((root) => {
    run(root, "new-view.mjs", "workspace");
    run(root, "new-view-part.mjs", "workspace", "procedures", "format-title");
    const before = readFileSync(view(root, "workspace", "procedures", "procedures.md"), "utf8");

    assert.match(refuses(root, "new-view-part.mjs", "workspace", "procedures", "format-title"), /already exists/);
    assert.equal(readFileSync(view(root, "workspace", "procedures", "procedures.md"), "utf8"), before);
  });
});

test("shared is created once and refused the second time", () => {
  withPackage((root) => {
    run(root, "new-view.mjs", "workspace");
    run(root, "new-view-part.mjs", "workspace", "shared");

    for (const file of ["shared.md", "types.ts", "create-shared.svelte.ts"]) {
      assert.ok(existsSync(view(root, "workspace", "shared", file)), `missing ${file}`);
    }
    assert.match(refuses(root, "new-view-part.mjs", "workspace", "shared"), /already exists/);
    clean(root);
  });
});

// --------------------------------------------------------------- rollback ----

test("a result that would not lint leaves nothing behind", () => {
  withPackage((root) => {
    run(root, "new-view.mjs", "workspace");

    // A banned directory nobody generated: the tree is red, so the command's own
    // output must not survive it. This is the property that matters — a refusal
    // discovered after the write still costs nothing.
    mkdirSync(view(root, "workspace", "utils"), { recursive: true });
    writeFileSync(view(root, "workspace", "utils", "pad.ts"), "export const x = 1;\n");

    assert.match(refuses(root, "new-view-part.mjs", "workspace", "procedures", "format-title"), /would not pass view lint/);

    assert.ok(!existsSync(view(root, "workspace", "procedures")), "the concern directory was rolled back");
    assert.ok(existsSync(view(root, "workspace", "utils", "pad.ts")), "a file this run did not create was left alone");
  });
});

test("the generators run identically from any working directory", () => {
  withPackage((root) => {
    execFileSync(process.execPath, [join(generators, "new-view.mjs"), "workspace"], {
      cwd: tmpdir(),
      env: { ...process.env, ICARUS_PACKAGE_ROOT: root },
      encoding: "utf8",
      stdio: "pipe"
    });
    assert.ok(existsSync(view(root, "workspace", "workspace.svelte")));
    clean(root);
  });
});
