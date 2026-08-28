/**
 * One mutation per rule, applied to the valid tree.
 *
 * A rule is not complete until both its passing and its failing behavior are
 * tested. The valid fixture proves a rule does not fire on legitimate structure;
 * these prove it fires on the thing it claims to catch. A rule with a typo'd
 * condition passes the first test and fails only here.
 *
 * Each case asserts on the failures *of its own rule*, because a broken tree
 * usually breaks more than one thing — removing a component breaks its inventory
 * too — and a test that asserted the total count would fail for the wrong reason
 * every time an unrelated rule improved.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { RULES } from "../rules.mjs";
import { buildFixture, removeFixture, remove, rename, replace, write } from "./build-fixtures.mjs";

/** Applies a mutation to a throwaway valid tree and returns what the rules found. */
const broken = (mutate) => {
  const fixture = buildFixture();
  try {
    mutate(fixture);
    return RULES.flatMap((rule) => rule(fixture.scope));
  } finally {
    removeFixture(fixture);
  }
};

const from = (failures, rule) => failures.filter(({ message }) => message.startsWith(`${rule}:`));

/** Asserts the named rule fired, and that some failure mentions `mentions`. */
const fired = (failures, rule, mentions) => {
  const found = from(failures, rule);
  assert.ok(found.length > 0, `expected ${rule} to fire, got: ${failures.map((f) => f.message).join(" | ") || "nothing"}`);
  if (mentions) {
    assert.ok(
      found.some(({ path, message }) => path.includes(mentions) || message.includes(mentions)),
      `expected ${rule} to mention ${mentions}, got: ${found.map((f) => `${f.path} ${f.message}`).join(" | ")}`
    );
  }
};

test("the valid fixture passes every rule", () => {
  const fixture = buildFixture();
  try {
    const failures = RULES.flatMap((rule) => rule(fixture.scope));
    assert.deepEqual(failures, [], failures.map((f) => `${f.path}  ${f.message}`).join("\n"));
  } finally {
    removeFixture(fixture);
  }
});

// ------------------------------------------------------- require-view-shape ----

test("require-view-shape rejects a file directly beneath views/", () => {
  fired(broken((f) => write(f, "readme.md", "# no")), "require-view-shape", "readme.md");
});

test("require-view-shape rejects a view whose name is not kebab-case", () => {
  fired(
    broken((f) => {
      write(f, "TabStrip/TabStrip.svelte", "<div></div>");
      write(f, "TabStrip/TabStrip.md", "# Tab Strip");
    }),
    "require-view-shape",
    "kebab-case"
  );
});

test("require-view-shape rejects a view missing its root component", () => {
  fired(broken((f) => remove(f, "document-editor/document-editor.svelte")), "require-view-shape", "document-editor.svelte");
});

test("require-view-shape rejects a file name that is not kebab-case", () => {
  fired(broken((f) => write(f, "workspace/procedures/formatTitle.ts", "export const x = 1;")), "require-view-shape", "formatTitle.ts");
});

// --------------------------------------------------- restrict-root-entries ----

test("restrict-root-entries rejects an unexpected file at a view root", () => {
  fired(broken((f) => write(f, "workspace/notes.txt", "scratch")), "restrict-root-entries", "notes.txt");
});

test("restrict-root-entries rejects a directory that is not a concern", () => {
  fired(broken((f) => write(f, "workspace/widgets/thing.svelte", "<div></div>")), "restrict-root-entries", "widgets");
});

test("restrict-root-entries rejects a banned name nested deep in the view", () => {
  fired(broken((f) => write(f, "workspace/components/tab-header/utils/pad.ts", "export const x = 1;")), "restrict-root-entries", "utils");
});

test("restrict-root-entries rejects an index.ts door", () => {
  fired(broken((f) => write(f, "workspace/index.ts", "export {};")), "restrict-root-entries", "index.ts");
});

// ------------------------------------------------------- match-entry-names ----

test("match-entry-names rejects a component directory with no matching entry", () => {
  fired(
    broken((f) => rename(f, "workspace/components/tab-header/tab-header.svelte", "workspace/components/tab-header/header.svelte")),
    "match-entry-names",
    "tab-header.svelte"
  );
});

test("match-entry-names rejects a component's children outside its components/", () => {
  fired(broken((f) => write(f, "workspace/components/tab-header/parts/icon.svelte", "<i></i>")), "match-entry-names", "parts");
});

test("match-entry-names rejects a recursive procedure directory", () => {
  fired(
    broken((f) => write(f, "workspace/procedures/reconcile-selection/deep-fix/deep-fix.ts", "export const x = 1;")),
    "match-entry-names",
    "do not recurse"
  );
});

test("match-entry-names rejects an interaction directory with no matching entry", () => {
  fired(broken((f) => write(f, "workspace/interactions/save-doc/persist.ts", "export const x = 1;")), "match-entry-names", "save-doc.ts");
});

// ----------------------------------------------------- require-effect-runes ----

test("require-effect-runes rejects a plain .ts under effects/", () => {
  fired(broken((f) => write(f, "workspace/effects/measure.ts", "export const x = 1;")), "require-effect-runes", "measure.ts");
});

test("require-effect-runes rejects a .svelte.ts under interactions/", () => {
  fired(broken((f) => write(f, "workspace/interactions/retry.svelte.ts", "export const x = 1;")), "require-effect-runes", "retry.svelte.ts");
});

test("require-effect-runes rejects a rune declared in a procedure", () => {
  fired(
    broken((f) => replace(f, "workspace/procedures/format-title.ts", "name.trim()", "$state(name.trim())")),
    "require-effect-runes",
    "declares a rune"
  );
});

// ------------------------------------------------- require-concern-document ----

test("require-concern-document rejects a concern directory with no document", () => {
  fired(broken((f) => remove(f, "workspace/interactions/interactions.md")), "require-concern-document", "interactions.md");
});

test("require-concern-document rejects a document inside a nested directory", () => {
  fired(
    broken((f) => write(f, "workspace/components/tab-header/tab-header.md", "# Tab Header")),
    "require-concern-document",
    "nested directories carry no document"
  );
});

// ------------------------------------------------- resolve-documented-paths ----

test("resolve-documented-paths rejects a tree naming a file that does not exist", () => {
  fired(
    broken((f) => replace(f, "workspace/procedures/procedures.md", "format-title.ts", "format-heading.ts")),
    "resolve-documented-paths",
    "format-heading.ts"
  );
});

test("resolve-documented-paths rejects an authored entry no inventory names", () => {
  fired(
    broken((f) => write(f, "workspace/procedures/normalize-ranges.ts", "export const x = 1;")),
    "resolve-documented-paths",
    "normalize-ranges.ts"
  );
});

// ----------------------------------------------------------- restrict-imports ----

test("restrict-imports rejects a relative import", () => {
  fired(
    broken((f) =>
      replace(f, "workspace/interactions/open-document.ts", '"$views/workspace/procedures/format-title"', '"../procedures/format-title"')
    ),
    "restrict-imports",
    "relative import"
  );
});

test("restrict-imports rejects a server-only import", () => {
  fired(
    broken((f) => write(f, "workspace/procedures/load.ts", 'import { db } from "$model/server/start.server";\nexport const x = db;\n')),
    "restrict-imports",
    "server-only"
  );
});

test("restrict-imports rejects route-generated state", () => {
  fired(
    broken((f) => write(f, "workspace/procedures/route-data.ts", 'import type { PageData } from "./$types";\nexport type X = PageData;\n')),
    "restrict-imports",
    "route-generated"
  );
});

test("restrict-imports rejects reaching inside another view", () => {
  fired(
    broken((f) => {
      write(f, "document-editor/components/components.md", "# Document Editor Components\n\n`body.svelte`\n");
      write(f, "document-editor/components/body.svelte", "<div></div>");
      replace(
        f,
        "workspace/workspace.svelte",
        '"$views/document-editor/document-editor.svelte"',
        '"$views/document-editor/components/body.svelte"'
      );
    }),
    "restrict-imports",
    "reaches inside view"
  );
});

test("restrict-imports permits composing another view through its root", () => {
  const fixture = buildFixture();
  try {
    const failures = RULES.flatMap((rule) => rule(fixture.scope));
    assert.deepEqual(from(failures, "restrict-imports"), []);
  } finally {
    removeFixture(fixture);
  }
});

// ------------------------------------------------------ reject-shared-singleton ----

test("reject-shared-singleton rejects an instance built at module load", () => {
  fired(
    broken((f) =>
      replace(
        f,
        "workspace/shared/create-shared.svelte.ts",
        "export const createWorkspaceShared",
        "export const shared = createWorkspaceShared();\n\nexport const createWorkspaceShared"
      )
    ),
    "reject-shared-singleton",
    "constructed at module load"
  );
});

test("reject-shared-singleton rejects a `new` at module load", () => {
  fired(
    broken((f) => write(f, "workspace/shared/bus.svelte.ts", "export const bus = new EventTarget();\n")),
    "reject-shared-singleton",
    "bus"
  );
});

// ------------------------------------------------------------- confine-tests ----

test("confine-tests rejects a test beside the code it covers", () => {
  fired(
    broken((f) => write(f, "workspace/procedures/format-title.test.ts", "import { test } from 'vitest';")),
    "confine-tests",
    "format-title.test.ts"
  );
});

test("confine-tests rejects a test category that is not one of the three", () => {
  fired(
    broken((f) => write(f, "workspace/test/integration/thing.test.ts", "import { test } from 'vitest';")),
    "confine-tests",
    "integration"
  );
});
