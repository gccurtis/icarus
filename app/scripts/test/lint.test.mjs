/**
 * Every check fires.
 *
 * A rule with a typo'd condition never fires, and a linter that never fires
 * reports success forever — so each check is pointed at a tree broken in exactly
 * the way it is meant to catch, and has to report *that file*. The pristine tree
 * is measured first and subtracted, so a check that was already unhappy about
 * something else cannot pass by accident.
 *
 *     pnpm test:scripts
 */
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { after, before, describe, test } from "node:test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { CHECKER_TREES } from "../lint/shared/checker-trees.mjs";
import { breaking, discard, sandbox, treeIn } from "./sandbox.mjs";
import { MUTATIONS } from "./mutations.mjs";

const lintRoot = new URL("../lint/", import.meta.url).pathname;

const allChecks = async () => {
  const found = [];
  for (const tree of CHECKER_TREES) {
    for (const file of readdirSync(join(lintRoot, tree)).sort()) {
      if (!file.endsWith(".mjs")) continue;
      const module = await import(pathToFileURL(join(lintRoot, tree, file)).href);
      found.push({ tree, ...module.default });
    }
  }
  return found;
};

const key = ({ subject, path, message }) => `${subject ?? ""}|${path}|${message}`;

let base;
let checks;
let baseline;

before(async () => {
  base = sandbox();
  checks = await allChecks();
  const tree = await treeIn(base);

  baseline = new Map();
  for (const check of checks) {
    baseline.set(check.name, new Set((await check.run(tree)).map(key)));
  }
});

after(() => discard(base));

describe("every check has a way to fail", () => {
  test("and a mutation that proves it", async () => {
    const named = new Set(MUTATIONS.map((mutation) => mutation.check));
    const missing = checks.map(({ name }) => name).filter((name) => !named.has(name));
    assert.deepEqual(missing, [], "checks with no mutation to prove they fire");
  });
});

describe("checks fire on a tree broken the way they describe", () => {
  for (const mutation of MUTATIONS) {
    test(`${mutation.tree ? `${mutation.tree}/` : ""}${mutation.check} · ${mutation.says}`, async () => {
      // Two trees hold a check of the same name, so a mutation aimed at one of
      // them says which.
      const check = checks.find(
        ({ tree, name }) => name === mutation.check && (!mutation.tree || tree === mutation.tree)
      );
      assert.ok(check, `${mutation.check} is not a check`);

      const found = await breaking(base, mutation.changes, (tree) => check.run(tree));
      const fresh = found.filter((failure) => !baseline.get(check.name).has(key(failure)));

      assert.ok(
        fresh.length > 0,
        `${check.name} reported nothing new about ${mutation.names}`
      );
      assert.ok(
        fresh.some((failure) => failure.path.endsWith(mutation.names)),
        `${check.name} reported ${fresh.map((f) => f.path).join(", ")}, none of them ${mutation.names}`
      );
      if (mutation.subject) {
        assert.ok(
          fresh.some((failure) => failure.subject === mutation.subject),
          `${check.name} reported no finding under ${mutation.subject}`
        );
      }
    });
  }
});

describe("explicit-dependency functions retain their legal boundaries", () => {
  test("stored model fields and supplied mutator ports stay available", async () => {
    const check = checks.find(({ name }) => name === "model-functions-are-explicit");
    assert.ok(check);
    const found = await breaking(base, [
      {
        path: "src/lib/model/client/probe/types.ts",
        write: `export type ProbeModel = { body: string };\nexport type WritePort = { write(value: string): void };\n`
      },
      {
        path: "src/lib/model/client/probe/definition.ts",
        write: `import type { ProbeModel } from "$model/client/probe/types";\nexport const defineProbe = (): ProbeModel => ({ body: "ready" });\n`
      },
      {
        path: "src/lib/model/client/probe/methods/get-body.ts",
        write: `import type { ProbeModel } from "$model/client/probe/types";\nexport const getBody = (runtime: ProbeModel): string => runtime.body;\n`
      },
      {
        path: "src/lib/model/client/probe/methods/save-body.ts",
        write: `import type { ProbeModel, WritePort } from "$model/client/probe/types";\nexport const saveBody = (runtime: ProbeModel, port: WritePort): void => port.write(runtime.body);\n`
      }
    ], (tree) => check.run(tree));

    assert.deepEqual(
      found.filter(({ path }) => path.includes("/model/client/probe/")),
      []
    );
  });

  test("capabilities and component procedures may call supplied ports", async () => {
    const capability = checks.find(({ name }) => name === "capability-functions-are-explicit");
    const component = checks.find(({ name }) => name === "component-procedures-are-explicit");
    assert.ok(capability);
    assert.ok(component);
    const changes = [
      {
        path: "src/lib/capabilities/probe/api/act/act.ts",
        write: `import type { CapabilityContext } from "$runtime/server/scope.server";\ntype WritePort = { write(value: string): void };\nexport const act = (context: CapabilityContext, port: WritePort): void => port.write(context.scope.projectId);\n`
      },
      {
        path: "src/lib/app-views/categories/project-overview/procedures/save-body.ts",
        write: `type Runtime = { body: string };\ntype WritePort = { write(value: string): void };\nexport const saveBody = (runtime: Runtime, port: WritePort): void => port.write(runtime.body);\n`
      }
    ];

    const capabilityFindings = await breaking(base, changes, (tree) => capability.run(tree));
    const componentFindings = await breaking(base, changes, (tree) => component.run(tree));
    assert.deepEqual(
      capabilityFindings.filter(({ path }) => path.includes("/capabilities/probe/")),
      []
    );
    assert.deepEqual(
      componentFindings.filter(({ path }) => path.endsWith("/procedures/save-body.ts")),
      []
    );
  });
});

describe("pure islands retain their legal language", () => {
  test("fields and explicitly supplied mutator ports remain ordinary inputs", async () => {
    const imports = checks.find(({ name }) => name === "pure-island-import-closure");
    const authority = checks.find(({ name }) => name === "pure-island-has-no-ambient-authority");
    assert.ok(imports);
    assert.ok(authority);
    const changes = [
      {
        path: "src/lib/model/client/pure-positive/state.ts",
        write: `export type PurePositiveState = { body: string };\nexport const createPurePositiveState = (): PurePositiveState => ({ body: "ready" });\n`
      },
      {
        path: "src/lib/model/client/pure-positive/types.ts",
        write: `export type WritePort = { write(value: string): Promise<void> };\n`
      },
      {
        path: "src/lib/model/client/pure-positive/methods/get-body.ts",
        write: `import type { PurePositiveState } from "../state";\nexport const getBody = (runtime: PurePositiveState): string => runtime.body;\n`
      },
      {
        path: "src/lib/model/client/pure-positive/methods/save-body.ts",
        write: `import type { PurePositiveState } from "../state";\nimport type { WritePort } from "../types";\nexport const saveBody = async (runtime: PurePositiveState, port: WritePort): Promise<void> => { await port.write(runtime.body); };\n`
      },
      {
        path: "src/lib/app-views/categories/pure-positive/procedures/read.ts",
        write: `type ExplicitWindow = { body: string };\ntype WritePort = { write(value: string): void };\nexport const read = (window: ExplicitWindow, port: WritePort): string => { port.write(window.body); return window.body; };\n`
      }
    ];

    const importFindings = await breaking(base, changes, (tree) => imports.run(tree));
    const authorityFindings = await breaking(base, changes, (tree) => authority.run(tree));
    const relevant = (finding) =>
      finding.path.includes("/model/client/pure-positive/") ||
      finding.path.includes("/categories/pure-positive/");
    assert.deepEqual(importFindings.filter(relevant), []);
    assert.deepEqual(authorityFindings.filter(relevant), []);
  });

  test("raw unknown is confined to a named local admission function", async () => {
    const authority = checks.find(({ name }) => name === "pure-island-has-no-ambient-authority");
    assert.ok(authority);
    const findings = await breaking(base, [{
      path: "src/lib/capabilities/pure-positive/api/admit-input.ts",
      write: `export const admitInput = (raw: unknown): string => typeof raw === "string" ? raw : "";\n`
    }], (tree) => authority.run(tree));
    assert.deepEqual(
      findings.filter(({ path }) => path.includes("/capabilities/pure-positive/")),
      []
    );
  });

  test("primitive and recursively frozen literal exports remain closed", async () => {
    const exports = checks.find(({ name }) => name === "pure-island-exports-are-closed");
    assert.ok(exports);
    const findings = await breaking(base, [{
      path: "src/lib/app-views/categories/pure-positive/procedures/constants.ts",
      write: `export const EMPTY = Object.freeze({ values: Object.freeze(["one", "two"]) });\nexport const COUNT = 2;\nexport const read = (value: string): string => value;\nexport type Name = string;\n`
    }], (tree) => exports.run(tree));
    assert.deepEqual(
      findings.filter(({ path }) => path.includes("/categories/pure-positive/")),
      []
    );
  });

  test("model state may store a body field and query it through getBody(state)", async () => {
    const state = checks.find(({ name }) => name === "model-state-is-fields");
    const operations = checks.find(({ name }) => name === "model-operations-are-free");
    assert.ok(state);
    assert.ok(operations);
    const changes = [
      {
        path: "src/lib/model/client/body-positive/state.ts",
        write: `export type BodyPositiveState = { body: string };\nexport const createBodyPositiveState = (body: string): BodyPositiveState => ({ body });\n`
      },
      {
        path: "src/lib/model/client/body-positive/methods/get-body.ts",
        write: `import type { BodyPositiveState } from "../state";\nexport const getBody = (runtime: BodyPositiveState): string => runtime.body;\n`
      },
      {
        path: "src/lib/model/client/body-positive/methods/version.ts",
        write: `export const version = (): number => 1;\n`
      }
    ];
    const stateFindings = await breaking(base, changes, (tree) => state.run(tree));
    const operationFindings = await breaking(base, changes, (tree) => operations.run(tree));
    const relevant = ({ path }) => path.includes("/model/client/body-positive/");
    assert.deepEqual(stateFindings.filter(relevant), []);
    assert.deepEqual(operationFindings.filter(relevant), []);
  });
});
