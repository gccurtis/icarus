#!/usr/bin/env node
/**
 * Writes the fixture trees the lint tests run against.
 *
 * Generated rather than committed as hundreds of near-identical stub files: the
 * point of a fixture is the ONE thing wrong with it, and that is legible here
 * and invisible in a directory listing. `clean` is the compliant baseline and
 * every other fixture is `clean` plus a single deliberate defect, so a rule that
 * fires on the wrong fixture is a rule that is testing the wrong thing.
 *
 * Run by the test file itself; there is no need to invoke it directly.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const write = (root, path, contents = "") => {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents);
};

/**
 * A compliant capability: two functions, one of them browser-reachable, a
 * promoted shared procedure, a nested supporting procedure, and tables.
 */
const clean = (root) => {
  write(root, "data/thing/overview.md", "# Thing Overview\n");
  // The door exports functions, a type, and the error class. Only the functions
  // have api/ directories — the surface check must not demand one for the rest.
  write(
    root,
    "data/thing/index.server.ts",
    'export { define } from "$thing/api/define/define";\n' +
      'export { list } from "$thing/api/list/list";\n' +
      'export type { Thing } from "$thing/types/thing";\n' +
      'export { ThingError } from "$thing/errors";\n'
  );
  write(
    root,
    "data/thing/index.ts",
    'export { define } from "$thing/api/define/define.remote";\n'
  );
  write(root, "data/thing/errors.ts", "export class ThingError extends Error {}\n");

  write(root, "data/thing/types/types.md", "# Thing Types\n");
  write(root, "data/thing/types/thing.ts", "export interface Thing { readonly id: string }\n");

  write(root, "data/thing/api/api.md", "# Thing API\n");
  write(root, "data/thing/api/shared/shared.md", "# Thing Shared Procedures\n");
  write(root, "data/thing/api/shared/record.ts", "export const record = async () => {};\n");

  write(
    root,
    "data/thing/api/define/define.md",
    "# API: `define`\n\n## Procedure Tree\n\n```text\ndefine(scope, input)\n" +
      "├── record()            ../shared/record.ts\n" +
      "└── canonical()         canonical/canonical.ts\n```\n"
  );
  write(root, "data/thing/api/define/define.ts", "export const define = async () => {};\n");
  write(root, "data/thing/api/define/define.remote.ts", "export const define = null;\n");
  write(root, "data/thing/api/define/canonical/canonical.ts", "export const canonical = () => {};\n");
  write(root, "data/thing/api/define/canonical/guard.ts", "export const guard = () => {};\n");

  write(root, "data/thing/api/list/list.md", "# API: `list`\n");
  write(root, "data/thing/api/list/list.ts", "export const list = async () => {};\n");

  write(root, "data/thing/test/unit/api/list/list.test.ts", "// covered elsewhere\n");
};

/** Each fixture is `clean` plus exactly one defect. */
export const FIXTURES = {
  clean,

  "unknown-directory": (root) => {
    clean(root);
    write(root, "data/thing/domain/aggregate.ts", "export const x = 1;\n");
  },

  "stray-root-file": (root) => {
    clean(root);
    write(root, "data/thing/runtime.ts", "export const x = 1;\n");
  },

  "api-missing-entry": (root) => {
    clean(root);
    write(root, "data/thing/api/archive/archive.md", "# API: `archive`\n");
  },

  "remote-misnamed": (root) => {
    clean(root);
    write(root, "data/thing/api/list/fetch.remote.ts", "export const fetchThings = null;\n");
  },

  "remote-too-deep": (root) => {
    clean(root);
    write(root, "data/thing/api/define/canonical/canonical.remote.ts", "export const canonical = null;\n");
  },

  "surface-mismatch": (root) => {
    clean(root);
    write(
      root,
      "data/thing/index.server.ts",
      'export { define } from "$thing/api/define/define";\n'
    );
  },

  // A door exporting a camelCase name with no directory is the defect the
  // surface check exists for, and there are no exemptions to it.
  "surface-extra-export": (root) => {
    clean(root);
    write(
      root,
      "data/thing/index.server.ts",
      'export { define } from "$thing/api/define/define";\n' +
        'export { list } from "$thing/api/list/list";\n' +
        'export { archive } from "$thing/api/define/define";\n'
    );
  },

  "door-imports-server": (root) => {
    clean(root);
    write(
      root,
      "data/thing/index.ts",
      'export { define } from "$thing/api/define/define.remote";\n' +
        'export { createThing } from "$thing/api/define/define";\n'
    );
  },

  "missing-document": (root) => {
    clean(root);
    rmSync(join(root, "data/thing/types/types.md"));
  },

  "misplaced-document": (root) => {
    clean(root);
    write(root, "data/thing/types/model.md", "# Model\n");
  },

  "not-kebab-case": (root) => {
    clean(root);
    write(root, "data/thing/types/thingModel.ts", "export interface ThingModel {}\n");
  },

  "test-outside-test-dir": (root) => {
    clean(root);
    write(root, "data/thing/api/list/list.test.ts", "// beside the code it covers\n");
  },

  "procedure-tree-dangling": (root) => {
    clean(root);
    write(
      root,
      "data/thing/api/list/list.md",
      "# API: `list`\n\n## Procedure Tree\n\n```text\nlist(scope)\n" +
        "└── paginate()        paginate.ts\n```\n"
    );
  }
};

/** Builds every fixture under `into`, replacing whatever was there. */
export const buildFixtures = (into) => {
  rmSync(into, { recursive: true, force: true });
  for (const [name, build] of Object.entries(FIXTURES)) {
    const root = join(into, name);
    mkdirSync(root, { recursive: true });
    build(root);
  }
  return into;
};
